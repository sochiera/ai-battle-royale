import { Net } from './net.js';
import { Input } from './input.js';
import { Renderer } from './render.js';

const INTERP_MS = 100;
const EXTRAP_MS = 250;
const MAX_RING = 24;
const NAME_KEY = 'orlywro.name';
const HELP_KEY = 'orlywro.helpSeen';

const ANIMAL_MAX = { eagle: 60, boar: 100, badger: 40 };

const app = {
  phase: 'menu',
  me: null,
  code: null,
  hostId: null,
  names: new Map(),
  arena: null,
  map: null,
  view: null,
  ring: [],
  effects: [],
  clockOffset: null,
  tickRate: 60,
  snapshotRate: 30,
  localPos: null,
  spectate: null,
  pointer: null,
  eliminated: false,
  ended: false,
  scoreboard: false,
  helpOpen: false,
  helpSeen: false,
  countdown: 0,
  dt: 0.016,
  ping: 0,
  zoneDamage: 5,
  zoneCfg: null,
  weapons: {},
  weaponOrder: ['knife', 'machete', 'pistol', 'rifle'],
  weaponNames: { knife: 'Nóż', machete: 'Maczeta', pistol: 'Pistolet', rifle: 'Karabin' },
  weaponRange: 80,
  myAttackCd: 0,
  myAttackDur: 0.45,
  myDashCd: 0,
  myDashDur: 3,
  hurtAt: 0,
  lastHp: null,
};

const $ = (id) => document.getElementById(id);
const screens = {
  menu: $('screen-menu'),
  lobby: $('screen-lobby'),
  connect: $('screen-connect'),
  end: $('screen-end'),
};

function showScreen(name) {
  for (const key of Object.keys(screens)) {
    screens[key].classList.toggle('hidden', key !== name);
  }
}

function toggleHelp(open) {
  app.helpOpen = open === undefined ? !app.helpOpen : open;
  $('help-panel').classList.toggle('hidden', !app.helpOpen);
  if (!app.helpOpen) {
    app.helpSeen = true;
    try { localStorage.setItem(HELP_KEY, '1'); } catch { /* ignore */ }
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function sanitizeName(value) {
  const v = (value || '').replace(/[<>]/g, '').trim().slice(0, 16);
  return v || 'Orzeł';
}

async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Błąd ${res.status}`);
  return data;
}

let countdownTimer = null;
const input = new Input();
const canvas = $('game');
const renderer = new Renderer(canvas);

const net = new Net({
  onMessage,
  onStatus(status, info) {
    if (status === 'connecting') {
      setConnectText('Łączenie…');
      if (app.phase !== 'playing' && app.phase !== 'ended') showScreen('connect');
    } else if (status === 'reconnecting') {
      const text = `Rozłączono. Ponawiam (${info.attempt}/5)…`;
      if (app.phase === 'playing' || app.phase === 'ended') {
        app.ping = 0;
        renderer.setHurt(0);
        setConnectText(text);
      } else {
        setConnectText(text);
        showScreen('connect');
      }
    } else if (status === 'failed') {
      Net.clearSession();
      app.phase = 'menu';
      showScreen('menu');
      showMenuError('Nie udało się połączyć. Spróbuj ponownie.');
    } else if (status === 'open') {
      // czekamy na komunikat welcome
    }
  },
});

function setConnectText(text) {
  $('connect-text').textContent = text;
}

function showMenuError(text) {
  $('menu-error').textContent = text || '';
}

function decodeSnap(snap) {
  const players = new Map();
  for (const row of snap.p) {
    const [id, x, y, hp, maxHp, aimX, aimY, flags, score, kills, animalKills, deaths, meleeIdx, rangedIdx, slot] = row;
    const melee = app.weaponOrder[meleeIdx] || 'knife';
    const ranged = rangedIdx >= 0 ? (app.weaponOrder[rangedIdx] || null) : null;
    const weapon = slot === 1 && ranged ? ranged : melee;
    players.set(id, {
      id, x, y, hp, maxHp, aimX, aimY, score, kills, animalKills, deaths,
      melee, ranged, slot, weapon,
      alive: (flags & 1) !== 0,
      dashing: (flags & 2) !== 0,
      invuln: (flags & 4) !== 0,
      connected: (flags & 8) !== 0,
      eliminated: (flags & 16) !== 0,
      hidden: (flags & 32) !== 0,
      name: app.names.get(id) || id,
    });
  }
  const animals = new Map();
  for (const row of snap.a) {
    const [id, type, x, y, hp, maxHp] = row;
    animals.set(id, { id, type, x, y, hp, maxHp, hpRatio: hp / (maxHp || ANIMAL_MAX[type] || 1) });
  }
  const powerups = new Map();
  for (const row of snap.u) {
    const [id, type, x, y, kind] = row;
    powerups.set(id, { id, type, x, y, kind: kind || 'powerup' });
  }
  return {
    tm: snap.tm,
    zone: { x: snap.z[0], y: snap.z[1], r: snap.z[2] },
    players, animals, powerups,
  };
}

function interpolate(a, b, f) {
  const players = new Map();
  for (const [id, bp] of b.players) {
    const ap = a.players.get(id);
    players.set(id, ap ? { ...bp, x: lerp(ap.x, bp.x, f), y: lerp(ap.y, bp.y, f) } : bp);
  }
  const animals = new Map();
  for (const [id, ba] of b.animals) {
    const aa = a.animals.get(id);
    animals.set(id, aa ? { ...ba, x: lerp(aa.x, ba.x, f), y: lerp(aa.y, ba.y, f) } : ba);
  }
  let zone = b.zone;
  if (a.zone && b.zone) {
    zone = { x: lerp(a.zone.x, b.zone.x, f), y: lerp(a.zone.y, b.zone.y, f), r: lerp(a.zone.r, b.zone.r, f) };
  }
  return { tm: b.tm, zone, players, animals, powerups: b.powerups };
}

function sampleAt(clientTime) {
  const ring = app.ring;
  if (!ring.length) return null;
  if (app.clockOffset === null) return ring[ring.length - 1].snap;
  const target = clientTime - app.clockOffset - INTERP_MS;
  if (ring.length === 1 || target <= ring[0].st) return ring[0].snap;
  const last = ring[ring.length - 1];
  if (target >= last.st) {
    const prev = ring.length > 1 ? ring[ring.length - 2] : null;
    const over = target - last.st;
    if (!prev || over > EXTRAP_MS) return last.snap;
    const f = 1 + over / ((last.st - prev.st) || 1);
    return interpolate(prev.snap, last.snap, f);
  }
  for (let i = ring.length - 1; i > 0; i--) {
    const b = ring[i];
    const a = ring[i - 1];
    if (a.st <= target && target <= b.st) {
      const f = (target - a.st) / ((b.st - a.st) || 1);
      return interpolate(a.snap, b.snap, f);
    }
  }
  return last.snap;
}

function onMessage(msg) {
  switch (msg.t) {
    case 'welcome': {
      app.me = msg.playerId;
      app.code = msg.code;
      app.hostId = msg.hostId;
      const session = net.getSession() || {};
      net.setSession({
        code: msg.code,
        playerId: msg.playerId,
        token: session.token,
        name: session.name || msg.name,
      });
      if (msg.arena) app.arena = msg.arena;
      if (msg.state === 'playing' || msg.state === 'ended') {
        app.phase = 'playing';
        showScreen(null);
      } else {
        app.phase = 'lobby';
        showScreen('lobby');
      }
      break;
    }
    case 'lobby': {
      app.hostId = msg.hostId;
      app.code = msg.code;
      renderLobby(msg.players);
      if (app.phase !== 'playing' && app.phase !== 'ended') {
        app.phase = 'lobby';
        showScreen('lobby');
      }
      break;
    }
    case 'countdown': {
      app.countdown = msg.seconds;
      clearTimeout(countdownTimer);
      countdownTimer = setTimeout(() => { app.countdown = 0; }, 1000);
      break;
    }
    case 'start': {
      clearTimeout(countdownTimer);
      input.dashQueued = false;
      app.phase = 'playing';
      app.ended = false;
      app.eliminated = false;
      app.ring = [];
      app.effects = [];
      app.view = null;
      app.lastHp = null;
      app.hurtAt = 0;
      app.arena = msg.arena;
      app.map = msg.map || null;
      app.tickRate = msg.tickRate || 60;
      app.snapshotRate = msg.snapshotRate || 30;
      app.clockOffset = null;
      app.zoneCfg = msg.zone;
      app.zoneDamage = msg.zone.damagePerSec;
      if (msg.weapons) app.weapons = msg.weapons;
      if (msg.weaponOrder) app.weaponOrder = msg.weaponOrder;
      if (msg.weaponNames) app.weaponNames = msg.weaponNames;
      app.names.clear();
      for (const p of msg.players) app.names.set(p.id, p.name);
      app.myDashDur = msg.balance.dashCooldown;
      app.myDashCd = 0;
      app.myAttackCd = 0;
      const knife = app.weapons.knife;
      app.myAttackDur = knife ? knife.cd : 0.45;
      app.countdown = 0;
      showScreen(null);
      toggleHelp(false);
      startLoop();
      break;
    }
    case 'snap': {
      const decoded = decodeSnap(msg);
      const st = msg.tick * (1000 / (app.tickRate || 60));
      const nowPerf = performance.now();
      if (app.clockOffset === null) app.clockOffset = nowPerf - st;
      else {
        const drift = (nowPerf - st) - app.clockOffset;
        if (Math.abs(drift) > 300) app.clockOffset = nowPerf - st;
        else app.clockOffset += drift * 0.06;
      }
      const last = app.ring[app.ring.length - 1];
      if (!last || st > last.st) {
        app.ring.push({ st, time: nowPerf, snap: decoded });
        if (app.ring.length > MAX_RING) app.ring.shift();
      }
      const me = decoded.players.get(app.me);
      if (me) {
        if (app.lastHp !== null && me.hp < app.lastHp) app.hurtAt = performance.now();
        app.lastHp = me.hp;
        app.eliminated = !me.alive || me.eliminated;
        const def = app.weapons[me.weapon];
        if (def) app.weaponRange = def.range;
      }
      break;
    }
    case 'ev': {
      handleEvents(msg.e, performance.now());
      break;
    }
    case 'pong':
      app.ping = Math.round(performance.now() - msg.ts);
      break;
    case 'end': {
      app.phase = 'ended';
      app.ended = true;
      clearTimeout(countdownTimer);
      app.countdown = 0;
      stopLoop();
      renderEnd(msg);
      showScreen('end');
      refreshTop10();
      break;
    }
    default:
      break;
  }
}

function handleEvents(events, now) {
  if (!Array.isArray(events)) return;
  for (const e of events) {
    let ttl = 250;
    if (e.k === 'swing') ttl = 130;
    else if (e.k === 'shot') ttl = 130;
    else if (e.k === 'dash') ttl = 200;
    else if (e.k === 'hit') ttl = 220;
    else if (e.k === 'bite') ttl = 320;
    else if (e.k === 'kill') ttl = 450;
    else if (e.k === 'death' || e.k === 'leave') ttl = 800;
    else if (e.k === 'pickup') ttl = 600;
    app.effects.push({
      kind: e.k, x: e.x || 0, y: e.y || 0, a: e.a || 0, l: e.l,
      type: e.type, d: e.d, t0: now, ttl,
    });
    if ((e.k === 'swing' || e.k === 'shot' || e.k === 'dash') && e.p === app.me) {
      if (e.k === 'dash') {
        if (e.cd) app.myDashDur = e.cd;
        app.myDashCd = app.myDashDur;
      } else {
        if (e.cd) app.myAttackDur = e.cd;
        app.myAttackCd = app.myAttackDur;
      }
    }
    if ((e.k === 'hit' || e.k === 'bite') && e.p === app.me) app.hurtAt = now;
  }
  if (app.effects.length > 160) app.effects.splice(0, app.effects.length - 160);
}

function renderLobby(players) {
  $('lobby-code').textContent = app.code || '----';
  const list = $('lobby-players');
  list.innerHTML = '';
  for (const p of players) {
    const li = document.createElement('li');
    if (!p.connected) li.classList.add('off');
    const name = document.createElement('span');
    name.textContent = p.name;
    li.appendChild(name);
    const tags = [];
    if (p.id === app.hostId) tags.push('HOST');
    if (p.ready) tags.push('GOTOWY');
    if (!p.connected) tags.push('OFFLINE');
    if (tags.length) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = tags.join(' · ');
      li.appendChild(tag);
    }
    list.appendChild(li);
  }
  const isHost = app.me && app.me === app.hostId;
  $('btn-start').classList.toggle('hidden', !isHost);
  const meReady = players.some((p) => p.id === app.me && p.ready);
  $('btn-ready').textContent = meReady ? 'Nie gotowy' : 'Gotowy';
  $('lobby-hint').textContent = isHost ? 'Jesteś hostem — możesz wystartować.' : 'Czekamy, aż host wystartuje mecz…';
}

function renderEnd(msg) {
  $('end-title').textContent = msg.winner ? `Zwycięzca: ${msg.winner.name}` : 'Koniec meczu';
  const table = $('end-table');
  table.innerHTML = '';
  const head = document.createElement('thead');
  head.innerHTML = '<tr><th>#</th><th>Gracz</th><th class="num">Punkty</th><th class="num">Zab.</th><th class="num">Zwierzęta</th><th class="num">Śmierci</th><th class="num">Obrażenia</th><th class="num">Przetrwanie</th></tr>';
  table.appendChild(head);
  const body = document.createElement('tbody');
  const medals = ['🥇', '🥈', '🥉'];
  msg.results.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (r.id === app.me) tr.classList.add('me');
    if (r.winner) tr.classList.add('winner');
    const medal = medals[i] ? `<span class="medal">${medals[i]}</span>` : '';
    tr.innerHTML = `<td>${i + 1}</td><td>${medal}${escapeHtml(r.name)}</td>` +
      `<td class="num">${r.points}</td><td class="num">${r.kills}</td><td class="num">${r.animalKills}</td>` +
      `<td class="num">${r.deaths}</td><td class="num">${r.damage}</td><td class="num">${r.survival}s</td>`;
    body.appendChild(tr);
  });
  table.appendChild(body);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function refreshTop10() {
  try {
    const res = await fetch('/api/rankings');
    const data = await res.json();
    const list = $('top10-list');
    list.innerHTML = '';
    const top = Array.isArray(data.top) ? data.top : [];
    if (!top.length) {
      list.innerHTML = '<li class="muted">Brak wyników — bądź pierwszy!</li>';
      return;
    }
    for (const e of top) {
      const li = document.createElement('li');
      li.innerHTML = `<span>${escapeHtml(e.name)}</span><span class="pts">${e.points} pkt</span>`;
      list.appendChild(li);
    }
  } catch {
    $('top10-list').innerHTML = '<li class="muted">Nie udało się pobrać rankingu</li>';
  }
}

let inputTimer = null;
let pingTimer = null;

function startLoop() {
  stopLoop();
  inputTimer = setInterval(() => {
    if (app.phase !== 'playing') return;
    if (app.eliminated) return;
    net.send(input.packet());
  }, 33);
  pingTimer = setInterval(() => {
    if (app.phase === 'playing' || app.phase === 'lobby') net.send({ t: 'ping', ts: performance.now() });
  }, 2000);
}

function stopLoop() {
  clearInterval(inputTimer);
  clearInterval(pingTimer);
  inputTimer = null;
  pingTimer = null;
}

function frame(ts) {
  const now = ts;
  app.dt = Math.min(0.1, (now - (app._last || now)) / 1000) || 0.016;
  app._last = now;
  input.active = app.phase === 'playing' || app.phase === 'lobby';
  input.helpOpen = app.helpOpen;

  if (app.phase === 'playing' || app.phase === 'ended') {
    const view = sampleAt(now);
    if (view) {
      app.view = view;
      const me = view.players.get(app.me);
      if (me) app.localPos = { x: me.x, y: me.y };
      if (me) input.currentSlot = me.slot;
      if (app.eliminated) {
        let leader = null;
        for (const p of view.players.values()) {
          if (p.alive && (!leader || p.score > leader.score)) leader = p;
        }
        if (leader) app.spectate = { x: leader.x, y: leader.y };
      }
    }
    updateAim();
    app.myAttackCd = Math.max(0, app.myAttackCd - app.dt);
    app.myDashCd = Math.max(0, app.myDashCd - app.dt);
    app.effects = app.effects.filter((e) => now - e.t0 < e.ttl);
    renderer.hurtAlpha = Math.max(0, 1 - (now - app.hurtAt) / 450);
  } else {
    renderer.hurtAlpha = 0;
    input.aimX = null;
    input.aimY = null;
  }

  renderer.draw(app, now);
  requestAnimationFrame(frame);
}

function updateAim() {
  if (!app.pointer || !app.localPos || !renderer.camera.init || app.helpOpen) {
    if (input.mouseAttack) {
      // brak kursora (np. touch) – kierunek z ruchu
    }
    input.aimX = null;
    input.aimY = null;
    return;
  }
  const world = renderer.screenToWorld(app.pointer.x, app.pointer.y);
  const dx = world.x - app.localPos.x;
  const dy = world.y - app.localPos.y;
  const len = Math.hypot(dx, dy) || 1;
  input.aimX = dx / len;
  input.aimY = dy / len;
}

function resetApp() {
  app.phase = 'menu';
  app.me = null;
  app.code = null;
  app.hostId = null;
  app.names.clear();
  app.view = null;
  app.ring = [];
  app.effects = [];
  app.clockOffset = null;
  app.localPos = null;
  app.spectate = null;
  app.eliminated = false;
  app.ended = false;
  app.countdown = 0;
  app.map = null;
  app.lastHp = null;
  renderer.camera.init = false;
  renderer.hurtAlpha = 0;
}

async function doHost() {
  showMenuError('');
  toggleHelp(false);
  const name = sanitizeName($('name').value);
  try {
    localStorage.setItem(NAME_KEY, name);
    setConnectText('Tworzenie lobby…');
    showScreen('connect');
    const data = await api('/api/host', { name });
    net.setSession({ code: data.code, playerId: data.playerId, token: data.token, name: data.name });
    net.connect(data.ticket);
  } catch (err) {
    showScreen('menu');
    showMenuError(err.message);
  }
}

async function doJoin() {
  showMenuError('');
  toggleHelp(false);
  const name = sanitizeName($('name').value);
  const code = ($('code').value || '').trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) {
    showMenuError('Kod musi mieć 4 litery.');
    return;
  }
  try {
    localStorage.setItem(NAME_KEY, name);
    setConnectText('Dołączanie…');
    showScreen('connect');
    const data = await api('/api/join', { code, name });
    net.setSession({ code: data.code, playerId: data.playerId, token: data.token, name: data.name });
    net.connect(data.ticket);
  } catch (err) {
    showScreen('menu');
    showMenuError(err.message);
  }
}

function doLeave() {
  net.send({ t: 'leave' });
  net.disconnect();
  Net.clearSession();
  stopLoop();
  resetApp();
  showScreen('menu');
  refreshTop10();
}

input.onScoreboard = (open) => { app.scoreboard = open; };
input.onToggleHelp = () => toggleHelp();
input.onCancel = () => {
  if (app.helpOpen) { toggleHelp(false); return; }
  if (app.phase === 'lobby') {
    if (window.confirm('Czy na pewno wyjść z lobby?')) doLeave();
  } else if (app.phase === 'ended') {
    showScreen('end');
  }
};

$('btn-host').addEventListener('click', doHost);
$('btn-join').addEventListener('click', doJoin);
$('btn-ready').addEventListener('click', () => {
  const ready = $('btn-ready').textContent === 'Gotowy';
  net.send({ t: 'ready', ready });
});
$('btn-start').addEventListener('click', () => net.send({ t: 'start' }));
$('btn-leave').addEventListener('click', doLeave);
$('btn-again').addEventListener('click', doLeave);
$('btn-help')?.addEventListener('click', () => toggleHelp(true));
$('btn-help-close')?.addEventListener('click', () => toggleHelp(false));
$('btn-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(app.code || '');
    $('btn-copy').textContent = 'Skopiowano!';
    setTimeout(() => { $('btn-copy').textContent = 'Kopiuj'; }, 1500);
  } catch { /* ignore */ }
});
$('code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
$('name').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const code = ($('code').value || '').trim().toUpperCase();
  if (/^[A-Z]{4}$/.test(code)) doJoin();
  else doHost();
});
$('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });

window.addEventListener('mousemove', (e) => {
  app.pointer = { x: e.clientX, y: e.clientY };
});
window.addEventListener('mousedown', (e) => {
  if (e.button === 0) input.mouseAttack = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) input.mouseAttack = false;
});
window.addEventListener('contextmenu', (e) => {
  if (app.phase === 'playing') e.preventDefault();
});

const savedName = localStorage.getItem(NAME_KEY);
if (savedName) $('name').value = savedName;
try { app.helpSeen = localStorage.getItem(HELP_KEY) === '1'; } catch { /* ignore */ }

refreshTop10();
requestAnimationFrame(frame);
