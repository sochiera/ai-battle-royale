'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const config = require('./config');
const Room = require('./game');
const Rankings = require('./rankings');
const { RateLimiter, IpGuard, IpCounter, clientIp } = require('./security');
const { makeCode, token, sanitizeName } = require('./util');

const rankings = new Rankings(config.dataDir);

class Manager {
  constructor(cfg) {
    this.cfg = cfg;
    this.rooms = new Map();
    this.tickets = new Map();
    this.hostLimiter = new RateLimiter(cfg.security.hostMax, cfg.security.apiWindowMs);
    this.joinLimiter = new RateLimiter(cfg.security.joinMax, cfg.security.apiWindowMs);
    this.rejoinLimiter = new RateLimiter(cfg.security.rejoinMax, cfg.security.apiWindowMs);
    this.guard = new IpGuard(cfg.security.maxBadCodes, cfg.security.badCodeWindowMs, cfg.security.badCodeBanMs);
    this.wsCount = new IpCounter(cfg.security.wsMaxPerIp);
  }

  createRoom() {
    let code;
    do { code = makeCode(); } while (this.rooms.has(code));
    const room = new Room(code, this.cfg, rankings);
    room.onDestroy = () => this.rooms.delete(code);
    this.rooms.set(code, room);
    return room;
  }

  issueTicket(code, playerId, playerToken) {
    const ticket = token();
    this.tickets.set(ticket, {
      code,
      playerId,
      playerToken,
      expires: Date.now() + this.cfg.security.ticketTtlMs,
    });
    return ticket;
  }

  consumeTicket(ticket) {
    if (typeof ticket !== 'string' || ticket.length > 128) return null;
    const rec = this.tickets.get(ticket);
    if (!rec) return null;
    this.tickets.delete(ticket);
    if (rec.expires < Date.now()) return null;
    return rec;
  }

  sweep() {
    const now = Date.now();
    this.hostLimiter.sweep();
    this.joinLimiter.sweep();
    this.rejoinLimiter.sweep();
    this.guard.sweep();
    for (const [t, rec] of this.tickets) {
      if (rec.expires < now) this.tickets.delete(t);
    }
    for (const [code, room] of this.rooms) {
      if (room.state === 'lobby') room.prunePending();
      if (room.state === 'lobby' && room.players.size === 0 && room.emptyFor(this.cfg.lobby.emptyTtlMs)) {
        room.destroy();
        continue;
      }
      if (room.state === 'ended' && room.destroyAt && now > room.destroyAt) {
        room.destroy();
        continue;
      }
      if (room.players.size === 0 && room.state !== 'lobby') {
        room.destroy();
      }
    }
  }

  stats() {
    let players = 0;
    let playing = 0;
    for (const room of this.rooms.values()) {
      players += room.players.size;
      if (room.state === 'playing') playing += 1;
    }
    return { rooms: this.rooms.size, players, playing };
  }
}

const manager = new Manager(config);

function json(res, status, body) {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(raw),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(raw);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > config.security.bodyLimit) {
        reject(new Error('too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('bad_json'));
      }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

function serveStatic(req, res, pathname) {
  const root = path.resolve(config.staticDir);
  let rel = pathname.replace(/^\/game\/?/, '');
  if (rel === '') rel = 'index.html';
  const filePath = path.resolve(root, rel);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    return json(res, 403, { error: 'Brak dostepu' });
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return json(res, 404, { error: 'Nie znaleziono' });
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
}

function handleHost(req, res) {
  const ip = clientIp(req);
  if (manager.guard.isBanned(ip)) return json(res, 429, { error: 'Zablokowany, sprobuj pozniej' });
  if (!manager.hostLimiter.allow(ip)) return json(res, 429, { error: 'Zbyt wiele zadan, odczekaj chwile' });
  readBody(req).then((body) => {
    const name = sanitizeName(body.name);
    const room = manager.createRoom();
    const { player, error } = room.addPlayer(name, ip);
    if (error) return json(res, 503, { error });
    const ticket = manager.issueTicket(room.code, player.id, player.token);
    json(res, 200, { code: room.code, ticket, playerId: player.id, token: player.token, name: player.name });
  }).catch((err) => {
    json(res, 400, { error: err.message === 'too_large' ? 'Zadanie za duze' : 'Nieprawidlowe dane' });
  });
}

function handleJoin(req, res) {
  const ip = clientIp(req);
  if (manager.guard.isBanned(ip)) return json(res, 429, { error: 'Zablokowany, sprobuj pozniej' });
  if (!manager.joinLimiter.allow(ip)) return json(res, 429, { error: 'Zbyt wiele zadan, odczekaj chwile' });
  readBody(req).then((body) => {
    const name = sanitizeName(body.name);
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (!/^[A-Z]{4}$/.test(code)) {
      manager.guard.fail(ip);
      return json(res, 400, { error: 'Kod musi miec 4 litery' });
    }
    const room = manager.rooms.get(code);
    if (!room) {
      manager.guard.fail(ip);
      return json(res, 404, { error: 'Nie ma takiego lobby' });
    }
    const { player, error } = room.addPlayer(name, ip);
    if (error) return json(res, 409, { error });
    const ticket = manager.issueTicket(room.code, player.id, player.token);
    json(res, 200, { code: room.code, ticket, playerId: player.id, token: player.token, name: player.name });
  }).catch((err) => {
    json(res, 400, { error: err.message === 'too_large' ? 'Zadanie za duze' : 'Nieprawidlowe dane' });
  });
}

function handleRejoin(req, res) {
  const ip = clientIp(req);
  if (manager.guard.isBanned(ip)) return json(res, 429, { error: 'Zablokowany, sprobuj pozniej' });
  if (!manager.rejoinLimiter.allow(ip)) return json(res, 429, { error: 'Zbyt wiele zadan, odczekaj chwile' });
  readBody(req).then((body) => {
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    const playerId = typeof body.playerId === 'string' ? body.playerId : '';
    const playerToken = typeof body.token === 'string' ? body.token : '';
    const room = manager.rooms.get(code);
    if (!room) return json(res, 404, { error: 'Lobby juz nie istnieje' });
    const player = room.players.get(playerId);
    if (!player || player.token !== playerToken) return json(res, 403, { error: 'Sesja wygasla' });
    const ticket = manager.issueTicket(code, playerId, playerToken);
    json(res, 200, { code, ticket, playerId, token: playerToken, name: player.name });
  }).catch(() => json(res, 400, { error: 'Nieprawidlowe dane' }));
}

const server = http.createServer((req, res) => {
  let url;
  let pathname;
  try {
    url = new URL(req.url, 'http://localhost');
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return json(res, 400, { error: 'Nieprawidlowe zadanie' });
  }

  if (req.method === 'GET' && pathname === '/healthz') {
    return json(res, 200, { ok: true, uptime: Math.round(process.uptime()), ...manager.stats() });
  }
  if (req.method === 'GET' && pathname === '/api/rankings') {
    return json(res, 200, { top: rankings.top(10) });
  }
  if (req.method === 'POST' && pathname === '/api/host') return handleHost(req, res);
  if (req.method === 'POST' && pathname === '/api/join') return handleJoin(req, res);
  if (req.method === 'POST' && pathname === '/api/rejoin') return handleRejoin(req, res);

  if ((req.method === 'GET' || req.method === 'HEAD') && (pathname === '/' || pathname === '/game')) {
    res.writeHead(302, { Location: '/game/' });
    return res.end();
  }
  if ((req.method === 'GET' || req.method === 'HEAD') && pathname.startsWith('/game/')) {
    return serveStatic(req, res, pathname);
  }
  return json(res, 404, { error: 'Nie znaleziono' });
});

const wss = new WebSocket.Server({ noServer: true, maxPayload: 2048 });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/ws') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }
  const ip = clientIp(req);
  const rec = manager.consumeTicket(url.searchParams.get('ticket'));
  if (!rec) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  const room = manager.rooms.get(rec.code);
  const player = room && room.players.get(rec.playerId);
  if (!room || !player || player.token !== rec.playerToken) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  if (manager.wsCount.atLimit(ip)) {
    socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    manager.wsCount.add(ip);
    attachPlayer(ws, room, player, ip);
    ws.on('close', () => manager.wsCount.remove(ip));
  });
});

function attachPlayer(ws, room, player, ip) {
  room.attachSocket(player.id, ws);

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  room.sendTo(player, {
    t: 'welcome',
    playerId: player.id,
    code: room.code,
    name: player.name,
    hostId: room.hostId,
    state: room.state,
    max: room.cfg.lobby.maxPlayers,
    arena: [room.arena.w, room.arena.h],
  });

  if (room.state === 'lobby' || room.state === 'countdown') {
    room.broadcastLobby();
  } else {
    room.sendStartTo(player);
    room.sendTo(player, room.buildSnapshot());
    if (room.state === 'ended' && room.lastEnd) room.sendTo(player, room.lastEnd);
  }

  ws.on('message', (raw) => {
    if (raw.length > 2048) return;
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    const p = room.players.get(player.id);
    if (!p) return;
    switch (msg.t) {
      case 'ready':
        p.ready = !!msg.ready;
        room.broadcastLobby();
        break;
      case 'start':
        room.requestStart(p.id);
        break;
      case 'in': {
        p.input.x = clampInput(msg.x);
        p.input.y = clampInput(msg.y);
        p.input.attack = !!msg.a;
        p.input.dash = !!msg.d;
        p.input.aimX = Number.isFinite(msg.ax) ? msg.ax : null;
        p.input.aimY = Number.isFinite(msg.ay) ? msg.ay : null;
        p.input.slot = msg.slot === 0 || msg.slot === 1 ? msg.slot : null;
        if (Number.isFinite(msg.s)) p.inputSeq = msg.s | 0;
        break;
      }
      case 'ping':
        ws.send(JSON.stringify({ t: 'pong', ts: msg.ts }));
        break;
      case 'leave':
        room.handleDisconnect(p.id);
        try { ws.close(4002, 'wyjscie gracza'); } catch { /* ignore */ }
        break;
      default:
        break;
    }
  });

  ws.on('close', () => {
    const p = room.players.get(player.id);
    if (p && p.ws === ws) room.handleDisconnect(p.id);
  });

  ws.on('error', () => { /* ignore */ });
}

function clampInput(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n < -1 ? -1 : n > 1 ? 1 : n;
}

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { try { ws.terminate(); } catch { /* ignore */ } continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* ignore */ }
  }
}, 15000);

const sweeper = setInterval(() => manager.sweep(), 5000);
sweeper.unref();

server.listen(config.port, config.host, () => {
  console.log(`[orlywro-game] http://${config.host}:${config.port} statyki=${config.staticDir} dane=${config.dataDir}`);
});

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(heartbeat);
  clearInterval(sweeper);
  for (const room of manager.rooms.values()) room.destroy();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

function fatal(err) {
  console.error('[orlywro-game] blad krytyczny:', err && err.stack ? err.stack : err);
  shutdown();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', fatal);
process.on('unhandledRejection', fatal);
