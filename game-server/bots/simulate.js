'use strict';
const WebSocket = require('ws');

function arg(name, def) {
  const hit = process.argv.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : def;
}

const HOST = arg('host', 'http://127.0.0.1:8502');
const BOTS = Number(arg('bots', '8'));
const SECONDS = Number(arg('seconds', '340'));
const DROP = arg('drop', '0') === '1';

const stats = { snaps: 0, snapTimes: [], pongs: [], reconnects: 0, errors: 0, ends: 0, winner: null };

async function post(path, body) {
  const res = await fetch(HOST + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
  return data;
}

function wsUrl(ticket) {
  const base = HOST.replace(/^http/, 'ws');
  return base + '/ws?ticket=' + encodeURIComponent(ticket);
}

class Bot {
  constructor(index) {
    this.index = index;
    this.name = 'Bot' + index;
    this.creds = null;
    this.ws = null;
    this.playing = false;
    this.intentLeave = false;
    this.dropTimer = null;
    this.interval = null;
    this.dir = { x: 0, y: 0 };
    this.seq = 0;
  }

  async enroll(code) {
    const body = { name: this.name };
    if (code) body.code = code;
    this.creds = code ? await post('/api/join', body) : await post('/api/host', body);
    return this.creds.code;
  }

  connect() {
    this.ws = new WebSocket(wsUrl(this.creds.ticket));
    this.ws.on('message', (raw) => this.onMessage(raw));
    this.ws.on('close', () => {
      if (!this.intentLeave && this.playing) this.scheduleRejoin();
    });
    this.ws.on('error', () => { stats.errors += 1; });
  }

  onMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.t === 'welcome') {
      this.ready();
    } else if (msg.t === 'start') {
      if (!this.playing) this.startPlaying();
    } else if (msg.t === 'snap') {
      stats.snaps += 1;
      stats.snapTimes.push(Date.now());
    } else if (msg.t === 'pong') {
      stats.pongs.push(Date.now() - msg.ts);
    } else if (msg.t === 'end') {
      stats.ends += 1;
      stats.winner = msg.winner ? msg.winner.name : 'brak (punkty)';
    }
  }

  ready() { this.send({ t: 'ready', ready: true }); }

  startPlaying() {
    this.playing = true;
    if (DROP && this.index === 0) {
      this.dropTimer = setTimeout(() => this.dropOnce(), 5000 + Math.random() * 3000);
    }
    this.interval = setInterval(() => this.tick(), 50);
    this.pingTimer = setInterval(() => this.send({ t: 'ping', ts: Date.now() }), 1500);
  }

  tick() {
    if (Math.random() < 0.2 || (this.dir.x === 0 && this.dir.y === 0)) {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1], [0, 0]];
      const d = dirs[Math.floor(Math.random() * dirs.length)];
      this.dir = { x: d[0], y: d[1] };
    }
    this.seq += 1;
    this.send({
      t: 'in',
      x: this.dir.x,
      y: this.dir.y,
      a: Math.random() < 0.25,
      d: Math.random() < 0.08,
      s: this.seq,
    });
  }

  dropOnce() {
    stats.reconnects += 1;
    try { this.ws.terminate(); } catch { /* ignore */ }
  }

  scheduleRejoin() {
    setTimeout(async () => {
      try {
        const data = await post('/api/rejoin', {
          code: this.creds.code,
          playerId: this.creds.playerId,
          token: this.creds.token,
        });
        this.creds.ticket = data.ticket;
        this.connect();
      } catch {
        stats.errors += 1;
      }
    }, 1200);
  }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) {
      try { this.ws.send(JSON.stringify(obj)); } catch { /* ignore */ }
    }
  }

  stop() {
    this.intentLeave = true;
    clearInterval(this.interval);
    clearInterval(this.pingTimer);
    clearTimeout(this.dropTimer);
    try { this.ws.close(); } catch { /* ignore */ }
  }
}

function summarize() {
  const times = stats.snapTimes;
  let avg = 0;
  let max = 0;
  for (let i = 1; i < times.length; i++) {
    const d = times[i] - times[i - 1];
    avg += d;
    if (d > max) max = d;
  }
  if (times.length > 1) avg /= (times.length - 1);
  const pongs = stats.pongs.slice().sort((a, b) => a - b);
  const p50 = pongs.length ? pongs[Math.floor(pongs.length * 0.5)] : 0;
  const p95 = pongs.length ? pongs[Math.floor(pongs.length * 0.95)] : 0;
  return {
    snaps: stats.snaps,
    avgGapMs: Number(avg.toFixed(2)),
    maxGapMs: max,
    pingP50: p50,
    pingP95: p95,
    reconnects: stats.reconnects,
    errors: stats.errors,
    ends: stats.ends,
    winner: stats.winner,
  };
}

(async () => {
  const bots = [];
  let code = null;
  for (let i = 0; i < BOTS; i++) {
    const bot = new Bot(i);
    await bot.enroll(code);
    code = bot.creds.code;
    bot.connect();
    bots.push(bot);
    await new Promise((r) => setTimeout(r, 150));
  }
  console.log('[bots] kod lobby:', code, '| boty:', BOTS, '| czas:', SECONDS + 's');
  await new Promise((r) => setTimeout(r, 800));
  bots[0].send({ t: 'start' });
  setTimeout(() => {
    for (const bot of bots) bot.stop();
    setTimeout(() => {
      console.log('[bots] wynik:', JSON.stringify(summarize()));
      process.exit(0);
    }, 600);
  }, SECONDS * 1000);
})().catch((err) => {
  console.error('[bots] blad:', err.message);
  process.exit(1);
});
