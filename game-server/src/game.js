'use strict';
const { clamp, rand, dist, pick, token } = require('./util');
const { zoneAt } = require('./zone');
const {
  generateMap, resolveStaticObstacles, pointInWater, pointInBush, lineBlocked, rayCast,
} = require('./map');

class Room {
  constructor(code, cfg, rankings) {
    this.code = code;
    this.cfg = cfg;
    this.rankings = rankings;
    this.state = 'lobby';
    this.hostId = null;
    this.players = new Map();
    this.animals = new Map();
    this.powerups = new Map();
    this.pendingEvents = [];
    this.tick = 0;
    this.elapsed = 0;
    this.timeLeft = cfg.matchDuration;
    this.arena = { w: cfg.arena.w, h: cfg.arena.h };
    this.map = null;
    this.zoneBase = {
      cx: this.arena.w / 2,
      cy: this.arena.h / 2,
      startR: Math.hypot(this.arena.w, this.arena.h) / 2 + 60,
      endR: cfg.zone.endRadius,
    };
    this.zone = { x: this.zoneBase.cx, y: this.zoneBase.cy, r: this.zoneBase.startR };
    this.nextWaveAt = cfg.wave.firstDelay;
    this.wave = 0;
    this.nextId = 1;
    this.loop = null;
    this.acc = 0;
    this.lastTime = 0n;
    this.snapEvery = Math.max(1, Math.round(cfg.tickHz / cfg.snapshotHz));
    this.startedWith = 0;
    this.destroyAt = null;
    this.emptySince = Date.now();
    this.countdownTimer = null;
    this.lastEnd = null;
    this.onDestroy = null;
  }

  nextEntityId() { return this.nextId++; }

  createPlayer(name, ip) {
    const cfg = this.cfg;
    return {
      id: 'p' + this.nextEntityId(),
      name,
      ip,
      joinedAt: Date.now(),
      token: null,
      ws: null,
      connected: false,
      x: this.arena.w / 2,
      y: this.arena.h / 2,
      aimX: 1,
      aimY: 0,
      hp: cfg.player.maxHp,
      maxHp: cfg.player.maxHp,
      melee: 'knife',
      ranged: null,
      slot: 0,
      attackSpeedMul: 1,
      attackCd: 0,
      dashCd: 0,
      dashCooldown: cfg.player.dashCooldown,
      dashTime: 0,
      dashX: 0,
      dashY: 0,
      dashHit: null,
      invuln: cfg.player.invulnOnSpawn,
      lastAttackAt: -999,
      lastDashAt: -999,
      alive: true,
      eliminated: false,
      ready: false,
      kills: 0,
      deaths: 0,
      animalKills: 0,
      damageDealt: 0,
      survival: 0,
      input: { x: 0, y: 0, attack: false, dash: false, aimX: null, aimY: null, slot: null },
      inputSeq: 0,
      disconnectedAt: null,
    };
  }

  addPlayer(name, ip) {
    if (this.state !== 'lobby') return { error: 'Mecz juz trwa' };
    if (this.players.size >= this.cfg.lobby.maxPlayers) return { error: 'Lobby jest pelne' };
    const player = this.createPlayer(name, ip);
    player.token = token();
    this.players.set(player.id, player);
    if (!this.hostId) this.hostId = player.id;
    this.emptySince = null;
    this.broadcastLobby();
    return { player };
  }

  attachSocket(playerId, ws) {
    const player = this.players.get(playerId);
    if (!player) return null;
    if (player.ws && player.ws !== ws) {
      try { player.ws.close(4000, 'zastapione nowym polaczeniem'); } catch { /* ignore */ }
    }
    player.ws = ws;
    player.connected = true;
    player.disconnectedAt = null;
    if (!this.hostId || !this.players.has(this.hostId)) this.hostId = player.id;
    return player;
  }

  emptyFor(ms) {
    return Date.now() - (this.emptySince || Date.now()) > ms;
  }

  prunePending() {
    if (this.state !== 'lobby') return;
    const ttl = this.cfg.security.ticketTtlMs;
    const now = Date.now();
    for (const p of [...this.players.values()]) {
      if (!p.connected && !p.disconnectedAt && now - p.joinedAt > ttl) {
        this.players.delete(p.id);
      }
    }
    if (this.hostId && !this.players.has(this.hostId)) {
      const next = this.connectedPlayers()[0];
      this.hostId = next ? next.id : null;
    }
    if (!this.players.size && this.emptySince === null) this.emptySince = now;
  }

  connectedPlayers() {
    return [...this.players.values()].filter((p) => p.connected);
  }

  sendAll(msg) {
    const raw = JSON.stringify(msg);
    for (const p of this.players.values()) {
      if (p.ws && p.ws.readyState === 1) {
        try { p.ws.send(raw); } catch { /* ignore */ }
      }
    }
  }

  sendTo(player, msg) {
    if (player && player.ws && player.ws.readyState === 1) {
      try { player.ws.send(JSON.stringify(msg)); } catch { /* ignore */ }
    }
  }

  pushEvent(ev) {
    if (this.pendingEvents.length >= 90) return;
    this.pendingEvents.push(ev);
  }

  broadcastLobby() {
    const players = [...this.players.values()].map((p) => ({
      id: p.id, name: p.name, ready: p.ready, connected: p.connected,
    }));
    this.sendAll({
      t: 'lobby',
      code: this.code,
      hostId: this.hostId,
      max: this.cfg.lobby.maxPlayers,
      state: this.state,
      players,
    });
  }

  requestStart(playerId) {
    if (this.state !== 'lobby') return;
    if (playerId !== this.hostId) return;
    const ready = this.connectedPlayers().filter((p) => p.ready);
    if (!ready.length) return;
    this.state = 'countdown';
    let n = this.cfg.lobby.countdown;
    this.sendAll({ t: 'countdown', seconds: n });
    this.countdownTimer = setInterval(() => {
      n -= 1;
      if (n > 0) {
        this.sendAll({ t: 'countdown', seconds: n });
      } else {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        if (this.state === 'countdown') this.startMatch();
      }
    }, 1000);
  }

  startMatch() {
    const cfg = this.cfg;
    this.state = 'playing';
    this.elapsed = 0;
    this.timeLeft = cfg.matchDuration;
    this.tick = 0;
    this.wave = 0;
    this.nextWaveAt = cfg.wave.firstDelay;
    this.animals.clear();
    this.powerups.clear();
    this.pendingEvents.length = 0;
    this.startedWith = 0;
    this.map = generateMap(this.arena);
    for (const p of this.players.values()) {
      if (!p.connected) continue;
      p.alive = true;
      p.eliminated = false;
      p.hp = cfg.player.maxHp;
      p.maxHp = cfg.player.maxHp;
      p.kills = 0;
      p.deaths = 0;
      p.animalKills = 0;
      p.damageDealt = 0;
      p.survival = 0;
      p.melee = 'knife';
      p.ranged = null;
      p.slot = 0;
      p.attackSpeedMul = 1;
      p.attackCd = 0;
      p.dashCd = 0;
      p.dashCooldown = cfg.player.dashCooldown;
      p.dashTime = 0;
      p.invuln = cfg.player.invulnOnSpawn;
      p.lastAttackAt = -999;
      p.lastDashAt = -999;
      p.input = { x: 0, y: 0, attack: false, dash: false, aimX: null, aimY: null, slot: null };
      p.disconnectedAt = null;
      this.placePlayer(p);
      this.startedWith += 1;
    }
    this.spawnStartLoot();
    this.lastTime = process.hrtime.bigint();
    this.acc = 0;
    this.sendStart();
    if (!this.loop) this.loop = setInterval(() => this.step(), 1000 / cfg.tickHz);
  }

  sendStart() {
    for (const p of this.players.values()) this.sendStartTo(p);
  }

  sendStartTo(p) {
    this.sendTo(p, {
      t: 'start',
      you: p.id,
      tickRate: this.cfg.tickHz,
      snapshotRate: this.cfg.snapshotHz,
      arena: [this.arena.w, this.arena.h],
      duration: this.cfg.matchDuration,
      map: this.map,
      zone: {
        shrinkStart: this.cfg.zone.shrinkStart,
        shrinkEnd: this.cfg.zone.shrinkEnd,
        damagePerSec: this.cfg.zone.damagePerSec,
      },
      weapons: Object.fromEntries(Object.entries(this.cfg.weapons).map(([k, v]) => [k, {
        kind: v.kind, dmg: v.dmg, range: v.range, cd: v.cd,
      }])),
      weaponOrder: this.cfg.weaponOrder,
      weaponNames: this.cfg.weaponNames,
      terrain: this.cfg.terrain,
      balance: {
        dashCooldown: this.cfg.player.dashCooldown,
        dashCooldownMin: this.cfg.player.dashCooldownMin,
        dashDamage: this.cfg.player.dashDamage,
        maxHp: this.cfg.player.maxHp,
      },
      players: [...this.players.values()].map((o) => ({ id: o.id, name: o.name })),
    });
  }

  placePlayer(p) {
    const a = this.arena;
    for (let i = 0; i < 60; i++) {
      const x = rand(a.w * 0.12, a.w * 0.88);
      const y = rand(a.h * 0.12, a.h * 0.88);
      if (this.map && pointInWater(x, y, this.map)) continue;
      const fixed = this.map ? resolveStaticObstacles(x, y, this.cfg.player.radius, this.map) : { x, y };
      if (Math.hypot(fixed.x - x, fixed.y - y) > 1) continue;
      let ok = true;
      for (const o of this.players.values()) {
        if (o !== p && o.alive && dist(fixed.x, fixed.y, o.x, o.y) < 160) { ok = false; break; }
      }
      if (ok) { p.x = fixed.x; p.y = fixed.y; return; }
    }
    p.x = rand(0, a.w);
    p.y = rand(0, a.h);
  }

  inZone(x, y) {
    const dx = x - this.zone.x;
    const dy = y - this.zone.y;
    return dx * dx + dy * dy <= this.zone.r * this.zone.r;
  }

  playerScore(p) {
    const s = this.cfg.score;
    return Math.floor(p.damageDealt * s.damage + p.kills * s.kill + p.animalKills * s.animalKill + p.survival * s.survivalPerSec);
  }

  currentWeapon(p) {
    const key = p.slot === 1 && p.ranged ? p.ranged : p.melee;
    return { key, def: this.cfg.weapons[key] || this.cfg.weapons.knife };
  }

  weaponCooldown(p) {
    const { def } = this.currentWeapon(p);
    return def.cd * p.attackSpeedMul;
  }

  weaponIdx(key) {
    const i = this.cfg.weaponOrder.indexOf(key);
    return i < 0 ? -1 : i;
  }

  step() {
    if (this.state !== 'playing') return;
    const now = process.hrtime.bigint();
    let dt = Number(now - this.lastTime) / 1e9;
    this.lastTime = now;
    if (dt > 0.3) dt = 0.3;
    this.acc += dt;
    if (this.acc > 0.5) this.acc = 0.5;
    const fixed = 1 / this.cfg.tickHz;
    let guard = 0;
    while (this.acc >= fixed && guard < 8 && this.state === 'playing') {
      this.update(fixed);
      this.acc -= fixed;
      guard += 1;
      if (this.tick % this.snapEvery === 0) this.broadcastSnapshot();
    }
    if (this.pendingEvents.length) {
      this.sendAll({ t: 'ev', e: this.pendingEvents });
      this.pendingEvents = [];
    }
  }

  update(dt) {
    this.tick += 1;
    this.elapsed += dt;
    this.timeLeft = Math.max(0, this.cfg.matchDuration - this.elapsed);
    this.zone = zoneAt(this.elapsed, this.cfg.zone, this.zoneBase);
    this.updatePlayers(dt);
    this.updateAnimals(dt);
    this.resolveCollisions();
    this.settlePlayers();
    this.updatePowerups(dt);
    this.updateWaves();
    this.checkGrace();
    this.checkEnd();
  }

  updatePlayers(dt) {
    const cfg = this.cfg;
    const radius = cfg.player.radius;
    for (const p of this.players.values()) {
      p.attackCd = Math.max(0, p.attackCd - dt);
      p.dashCd = Math.max(0, p.dashCd - dt);
      p.invuln = Math.max(0, p.invuln - dt);
      if (!p.alive || p.eliminated) continue;
      p.survival += dt;

      if (p.input.slot === 0 || p.input.slot === 1) {
        if (p.input.slot === 1 && p.ranged) p.slot = 1;
        else if (p.input.slot === 0) p.slot = 0;
        p.input.slot = null;
      }

      const hasAim = Number.isFinite(p.input.aimX) && Number.isFinite(p.input.aimY)
        && (p.input.aimX !== 0 || p.input.aimY !== 0);
      if (hasAim) {
        const l = Math.hypot(p.input.aimX, p.input.aimY) || 1;
        p.aimX = p.input.aimX / l;
        p.aimY = p.input.aimY / l;
      }

      const slow = this.map && pointInWater(p.x, p.y, this.map) ? cfg.terrain.waterSlow : 1;

      if (p.dashTime > 0) {
        p.dashTime -= dt;
        p.x += p.dashX * cfg.player.dashSpeed * slow * dt;
        p.y += p.dashY * cfg.player.dashSpeed * slow * dt;
        this.dashDamage(p);
        if (p.dashTime <= 0) p.dashHit = null;
      } else {
        let ix = p.input.x;
        let iy = p.input.y;
        const len = Math.hypot(ix, iy);
        if (len > 1) { ix /= len; iy /= len; }
        if ((ix || iy) && !hasAim) {
          p.aimX = ix;
          p.aimY = iy;
        }
        p.x += ix * cfg.player.speed * slow * dt;
        p.y += iy * cfg.player.speed * slow * dt;
        if (p.input.attack && p.attackCd <= 0) this.doAttack(p);
        if (p.input.dash && p.dashCd <= 0) this.startDash(p);
      }

      if (this.map) {
        const fixed = resolveStaticObstacles(p.x, p.y, radius, this.map);
        p.x = fixed.x;
        p.y = fixed.y;
      }
      p.x = clamp(p.x, radius, this.arena.w - radius);
      p.y = clamp(p.y, radius, this.arena.h - radius);

      if (!this.inZone(p.x, p.y)) {
        this.damagePlayer(p, cfg.zone.damagePerSec * dt, null, 'zone');
      }
    }
  }

  // Domkniecie wypychania po kolizjach miedzy graczami.
  settlePlayers() {
    if (!this.map) return;
    for (const p of this.players.values()) {
      if (!p.alive || p.eliminated) continue;
      const fixed = resolveStaticObstacles(p.x, p.y, this.cfg.player.radius, this.map);
      p.x = clamp(fixed.x, this.cfg.player.radius, this.arena.w - this.cfg.player.radius);
      p.y = clamp(fixed.y, this.cfg.player.radius, this.arena.h - this.cfg.player.radius);
    }
  }

  inArc(from, target, halfArc) {
    const dx = target.x - from.x;
    const dy = target.y - from.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return true;
    const ux = dx / d;
    const uy = dy / d;
    const dot = ux * from.aimX + uy * from.aimY;
    return dot >= Math.cos(halfArc);
  }

  doAttack(p) {
    const { key, def } = this.currentWeapon(p);
    p.attackCd = this.weaponCooldown(p);
    p.lastAttackAt = this.elapsed;
    const idx = this.weaponIdx(key);
    if (def.kind === 'melee') {
      const half = def.arc / 2;
      for (const a of [...this.animals.values()]) {
        if (dist(p.x, p.y, a.x, a.y) <= def.range + a.radius && this.inArc(p, a, half)
          && !lineBlocked(p.x, p.y, a.x, a.y, this.map)) {
          this.damageAnimal(p, a, def.dmg);
        }
      }
      for (const o of this.players.values()) {
        if (o === p || !o.alive || o.eliminated) continue;
        if (dist(p.x, p.y, o.x, o.y) <= def.range + this.cfg.player.radius && this.inArc(p, o, half)
          && !lineBlocked(p.x, p.y, o.x, o.y, this.map)) {
          this.damagePlayer(o, def.dmg, p, 'attack');
        }
      }
      this.pushEvent({
        k: 'swing', p: p.id, x: Math.round(p.x), y: Math.round(p.y),
        a: Math.round(Math.atan2(p.aimY, p.aimX) * 100) / 100, w: idx, m: 1, cd: p.attackCd,
      });
    } else {
      this.rangedAttack(p, def, idx);
    }
  }

  rangedAttack(p, def, idx) {
    let ang = Math.atan2(p.aimY, p.aimX);
    if (def.spread) ang += rand(-def.spread, def.spread);
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);

    let best = null;
    let bestT = Infinity;

    const consider = (obj, radius) => {
      const ox = obj.x - p.x;
      const oy = obj.y - p.y;
      const t = ox * dx + oy * dy;
      if (t < 0 || t > def.range + radius) return;
      const perp = Math.abs(ox * dy - oy * dx);
      if (perp > radius + 4) return;
      if (t >= bestT) return;
      if (lineBlocked(p.x, p.y, p.x + dx * t, p.y + dy * t, this.map)) return;
      best = obj;
      bestT = t;
    };

    for (const a of this.animals.values()) consider(a, a.radius);
    for (const o of this.players.values()) {
      if (o === p || !o.alive || o.eliminated) continue;
      consider(o, this.cfg.player.radius);
    }

    const wallDist = rayCast(p.x, p.y, dx, dy, def.range, this.map);
    let len = Math.min(def.range, wallDist);

    if (best && bestT <= wallDist) {
      len = bestT;
      if (this.animals.has(best.id)) this.damageAnimal(p, best, def.dmg);
      else this.damagePlayer(best, def.dmg, p, 'shot');
    }

    this.pushEvent({
      k: 'shot', p: p.id, x: Math.round(p.x), y: Math.round(p.y),
      a: Math.round(ang * 1000) / 1000, l: Math.round(len), w: idx, cd: p.attackCd,
    });
  }

  startDash(p) {
    p.dashCd = p.dashCooldown;
    p.dashTime = this.cfg.player.dashDuration;
    p.lastDashAt = this.elapsed;
    let dx = p.aimX;
    let dy = p.aimY;
    const len = Math.hypot(dx, dy) || 1;
    p.dashX = dx / len;
    p.dashY = dy / len;
    p.dashHit = new Set();
    this.pushEvent({ k: 'dash', p: p.id, x: Math.round(p.x), y: Math.round(p.y), a: Math.round(Math.atan2(p.dashY, p.dashX) * 100) / 100, cd: p.dashCd });
  }

  dashDamage(p) {
    if (!p.dashHit) return;
    const reach = this.cfg.player.radius + 16;
    for (const a of [...this.animals.values()]) {
      if (p.dashHit.has(a.id)) continue;
      if (dist(p.x, p.y, a.x, a.y) <= reach + a.radius) {
        p.dashHit.add(a.id);
        this.damageAnimal(p, a, this.cfg.player.dashDamage);
      }
    }
    for (const o of this.players.values()) {
      if (o === p || !o.alive || o.eliminated) continue;
      if (p.dashHit.has(o.id)) continue;
      if (dist(p.x, p.y, o.x, o.y) <= reach + this.cfg.player.radius) {
        p.dashHit.add(o.id);
        this.damagePlayer(o, this.cfg.player.dashDamage, p, 'dash');
      }
    }
  }

  damageAnimal(attacker, a, amount) {
    if (!this.animals.has(a.id)) return;
    a.hp -= amount;
    if (attacker) attacker.damageDealt += amount;
    if (a.hp <= 0) {
      this.animals.delete(a.id);
      if (attacker) attacker.animalKills += 1;
      this.pushEvent({ k: 'kill', x: Math.round(a.x), y: Math.round(a.y), p: attacker ? attacker.id : null });
      this.maybeDropLoot(a.x, a.y, 'animal');
    } else {
      this.pushEvent({ k: 'hit', x: Math.round(a.x), y: Math.round(a.y), d: Math.round(amount), p: attacker ? attacker.id : null });
    }
  }

  damagePlayer(target, amount, attacker, cause) {
    if (!target.alive || target.eliminated) return;
    if (target.invuln > 0 && cause !== 'zone') return;
    target.hp -= amount;
    if (attacker && attacker !== target && this.players.has(attacker.id)) attacker.damageDealt += amount;
    if (target.hp <= 0) {
      target.hp = 0;
      this.killPlayer(target, attacker, cause);
    } else if (cause !== 'zone') {
      this.pushEvent({ k: 'hit', x: Math.round(target.x), y: Math.round(target.y), d: Math.round(amount), p: target.id });
    }
  }

  killPlayer(victim, attacker, cause) {
    if (!victim.alive) return;
    victim.alive = false;
    victim.deaths += 1;
    victim.hp = 0;
    victim.dashTime = 0;
    victim.dashHit = null;
    if (attacker && attacker !== victim && this.players.has(attacker.id)) attacker.kills += 1;
    this.pushEvent({
      k: 'death',
      x: Math.round(victim.x),
      y: Math.round(victim.y),
      p: victim.id,
      by: attacker && this.players.has(attacker.id) ? attacker.id : null,
      cause,
    });
    const drop = victim.ranged || (victim.melee !== 'knife' ? victim.melee : null);
    if (drop) this.spawnPickup(drop, victim.x, victim.y);
  }

  hiddenNow(p) {
    if (this.elapsed - p.lastAttackAt < this.cfg.terrain.attackRevealSec) return false;
    if (this.elapsed - p.lastDashAt < this.cfg.terrain.attackRevealSec) return false;
    return !!pointInBush(p.x, p.y, this.map);
  }

  visibleTo(viewer, target) {
    if (viewer === target) return true;
    if (!target.alive || target.eliminated) return true;
    if (!this.hiddenNow(target)) return true;
    return dist(viewer.x, viewer.y, target.x, target.y) <= this.cfg.terrain.bushReveal;
  }

  pickAnimalTarget(a) {
    let best = null;
    let bestScore = Infinity;
    for (const p of this.players.values()) {
      if (!p.alive || p.eliminated || !p.connected) continue;
      const d = dist(a.x, a.y, p.x, p.y);
      if (pointInBush(p.x, p.y, this.map) && d > this.cfg.terrain.bushAnimalSense) continue;
      const score = this.inZone(p.x, p.y) ? d : d - 1e6;
      if (best === null || score < bestScore) {
        best = p;
        bestScore = score;
      }
    }
    return best;
  }

  updateAnimals(dt) {
    const cfg = this.cfg;
    for (const a of [...this.animals.values()]) {
      if (a.hp <= 0) continue;
      a.attackCd = Math.max(0, a.attackCd - dt);
      const target = this.pickAnimalTarget(a);
      if (!target) {
        const dx = this.zone.x - a.x;
        const dy = this.zone.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        a.x += (dx / d) * a.speed * 0.5 * dt;
        a.y += (dy / d) * a.speed * 0.5 * dt;
      } else {
        const outside = !this.inZone(target.x, target.y);
        const speed = a.speed * (outside ? cfg.zone.aggressionBoost : 1);
        const d = dist(a.x, a.y, target.x, target.y);
        if (d <= a.range + cfg.player.radius) {
          if (a.attackCd <= 0) {
            a.attackCd = a.cooldown;
            this.damagePlayer(target, a.damage, null, 'animal');
            this.pushEvent({ k: 'bite', x: Math.round(a.x), y: Math.round(a.y), p: target.id, d: a.damage });
          }
        } else {
          a.x += ((target.x - a.x) / d) * speed * dt;
          a.y += ((target.y - a.y) / d) * speed * dt;
        }
      }
      a.x = clamp(a.x, a.radius, this.arena.w - a.radius);
      a.y = clamp(a.y, a.radius, this.arena.h - a.radius);
      if (!this.inZone(a.x, a.y)) {
        a.hp -= cfg.zone.animalDamagePerSec * dt;
        if (a.hp <= 0) this.animals.delete(a.id);
      }
    }
  }

  resolveCollisions() {
    const list = [];
    for (const p of this.players.values()) {
      if (p.alive && !p.eliminated) list.push({ ref: p, r: this.cfg.player.radius, isPlayer: true });
    }
    for (const a of this.animals.values()) list.push({ ref: a, r: a.radius, isPlayer: false });

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const A = list[i];
        const B = list[j];
        if (!A.isPlayer && !B.isPlayer) continue;
        const dx = B.ref.x - A.ref.x;
        const dy = B.ref.y - A.ref.y;
        const min = A.r + B.r;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 0.001) d = 0.001;
        const overlap = (min - d) / d;
        const ax = dx * overlap;
        const ay = dy * overlap;
        const aShare = A.isPlayer && B.isPlayer ? 0.5 : A.isPlayer ? 1 : 0;
        const bShare = A.isPlayer && B.isPlayer ? 0.5 : B.isPlayer ? 1 : 0;
        A.ref.x -= ax * aShare;
        A.ref.y -= ay * aShare;
        B.ref.x += ax * bShare;
        B.ref.y += ay * bShare;
      }
    }
  }

  updatePowerups(dt) {
    for (const o of [...this.powerups.values()]) {
      o.life -= dt;
      if (o.life <= 0) { this.powerups.delete(o.id); continue; }
      for (const p of this.players.values()) {
        if (!p.alive || p.eliminated) continue;
        const reach = this.cfg.player.radius + (o.r || this.cfg.powerups.radius);
        if (dist(p.x, p.y, o.x, o.y) <= reach) {
          this.applyPickup(p, o);
          this.powerups.delete(o.id);
          break;
        }
      }
    }
  }

  spawnPickup(type, x, y) {
    if (this.powerups.size >= this.cfg.loot.max) return null;
    const weapons = this.cfg.weapons;
    let kind = 'powerup';
    if (type === 'medkit') kind = 'medkit';
    else if (weapons[type]) kind = 'weapon';
    const o = {
      id: 'u' + this.nextEntityId(),
      kind,
      type,
      x: clamp(x, 30, this.arena.w - 30),
      y: clamp(y, 30, this.arena.h - 30),
      r: kind === 'weapon' ? 20 : this.cfg.powerups.radius,
      life: kind === 'powerup' ? this.cfg.powerups.lifeSec : Infinity,
    };
    this.powerups.set(o.id, o);
    return o;
  }

  maybeDropLoot(x, y, source) {
    if (this.powerups.size >= this.cfg.loot.max) return;
    const loot = this.cfg.loot;
    const roll = Math.random();
    if (roll < loot.medkitDropChance) {
      this.spawnPickup('medkit', x, y);
      return;
    }
    if (roll < loot.medkitDropChance + loot.weaponDropChance) {
      this.spawnPickup(pick(['pistol', 'machete', 'rifle']), x, y);
      return;
    }
    if (Math.random() > loot.dropChance) return;
    const types = this.cfg.powerups.types;
    const r2 = Math.random();
    const type = r2 < 0.45 ? types[0] : r2 < 0.75 ? types[1] : types[2];
    this.spawnPickup(type, x, y);
  }

  spawnStartLoot() {
    const loot = this.cfg.loot;
    const a = this.arena;
    const freeSpot = (pad) => {
      for (let i = 0; i < 60; i++) {
        const x = rand(pad, a.w - pad);
        const y = rand(pad, a.h - pad);
        if (pointInWater(x, y, this.map)) continue;
        const fixed = resolveStaticObstacles(x, y, 26, this.map);
        if (Math.hypot(fixed.x - x, fixed.y - y) > 1) continue;
        return { x, y };
      }
      return null;
    };
    const weaponPool = ['pistol', 'machete', 'pistol', 'rifle', 'machete', 'pistol', 'rifle', 'machete'];
    for (let i = 0; i < loot.startWeapons; i++) {
      const s = freeSpot(150);
      if (s) this.spawnPickup(pick(weaponPool), s.x, s.y);
    }
    for (let i = 0; i < loot.startMedkits; i++) {
      const bush = this.map && this.map.bushes.length ? pick(this.map.bushes) : null;
      let x;
      let y;
      if (bush) {
        const ang = rand(0, Math.PI * 2);
        const rr = rand(0, bush.r * 0.6);
        x = clamp(bush.x + Math.cos(ang) * rr, 40, a.w - 40);
        y = clamp(bush.y + Math.sin(ang) * rr, 40, a.h - 40);
      } else {
        const s = freeSpot(150);
        if (!s) continue;
        x = s.x;
        y = s.y;
      }
      this.spawnPickup('medkit', x, y);
    }
  }

  applyPickup(p, o) {
    const cfg = this.cfg;
    if (o.kind === 'weapon') {
      const def = cfg.weapons[o.type];
      if (!def) return;
      if (def.kind === 'melee') {
        p.melee = o.type;
        p.slot = 0;
      } else {
        p.ranged = o.type;
        p.slot = 1;
      }
    } else if (o.kind === 'medkit') {
      if (p.hp >= p.maxHp) return; // nie marnuj apteczki przy pelnym HP
      p.hp = Math.min(p.maxHp, p.hp + cfg.loot.medkitHeal);
    } else if (o.type === 'hp') {
      p.maxHp += 20;
      p.hp = Math.min(p.maxHp, p.hp + 30);
    } else if (o.type === 'dash') {
      p.dashCooldown = Math.max(cfg.player.dashCooldownMin, (p.dashCooldown || cfg.player.dashCooldown) * 0.75);
    } else if (o.type === 'atk') {
      p.attackSpeedMul = Math.max(0.5, p.attackSpeedMul * 0.82);
    }
    this.pushEvent({ k: 'pickup', x: Math.round(p.x), y: Math.round(p.y), p: p.id, type: o.type });
  }

  spawnPoint() {
    for (let i = 0; i < 20; i++) {
      const ang = rand(0, Math.PI * 2);
      const rr = this.zone.r * rand(1.02, 1.35);
      const x = this.zone.x + Math.cos(ang) * rr;
      const y = this.zone.y + Math.sin(ang) * rr;
      if (x > 40 && x < this.arena.w - 40 && y > 40 && y < this.arena.h - 40 && !pointInWater(x, y, this.map)) {
        return { x, y };
      }
    }
    return { x: rand(40, this.arena.w - 40), y: rand(40, this.arena.h - 40) };
  }

  spawnAnimal() {
    if (this.animals.size >= this.cfg.wave.maxAnimals) return;
    let pool = ['eagle', 'badger'];
    if (this.wave >= 2) pool = ['eagle', 'badger', 'boar'];
    else if (this.wave >= 1 && Math.random() < 0.3) pool = ['eagle', 'badger', 'boar'];
    const type = pick(pool);
    const t = this.cfg.animals[type];
    const pos = this.spawnPoint();
    const a = {
      id: 'a' + this.nextEntityId(),
      type,
      x: pos.x,
      y: pos.y,
      hp: t.hp,
      maxHp: t.hp,
      radius: t.radius,
      speed: t.speed,
      damage: t.damage,
      range: t.range,
      cooldown: t.cooldown,
      attackCd: rand(0, t.cooldown),
    };
    this.animals.set(a.id, a);
  }

  updateWaves() {
    const w = this.cfg.wave;
    if (this.elapsed < this.nextWaveAt) return;
    if (this.animals.size < w.maxAnimals) {
      this.wave += 1;
      const count = clamp(Math.round(w.base + this.wave * w.growth), 1, w.maxPerWave);
      for (let i = 0; i < count; i++) this.spawnAnimal();
    }
    this.nextWaveAt = this.elapsed + Math.max(w.minInterval, w.interval - this.wave * 0.7);
  }

  buildSnapshotFor(viewer) {
    const p = [];
    for (const pl of this.players.values()) {
      if (!this.visibleTo(viewer, pl)) continue;
      let flags = 0;
      if (pl.alive) flags |= 1;
      if (pl.dashTime > 0) flags |= 2;
      if (pl.invuln > 0) flags |= 4;
      if (pl.connected) flags |= 8;
      if (pl.eliminated) flags |= 16;
      if (this.hiddenNow(pl)) flags |= 32;
      p.push([
        pl.id,
        Math.round(pl.x),
        Math.round(pl.y),
        Math.round(pl.hp),
        Math.round(pl.maxHp),
        Math.round(pl.aimX * 100) / 100,
        Math.round(pl.aimY * 100) / 100,
        flags,
        this.playerScore(pl),
        pl.kills,
        pl.animalKills,
        pl.deaths,
        this.weaponIdx(pl.melee),
        pl.ranged ? this.weaponIdx(pl.ranged) : -1,
        pl.slot,
      ]);
    }
    const a = [];
    for (const an of this.animals.values()) {
      a.push([an.id, an.type, Math.round(an.x), Math.round(an.y), Math.round(an.hp), an.maxHp]);
    }
    const u = [];
    for (const o of this.powerups.values()) {
      u.push([o.id, o.type, Math.round(o.x), Math.round(o.y), o.kind]);
    }
    return {
      t: 'snap',
      tick: this.tick,
      tm: Math.round(this.timeLeft * 10) / 10,
      z: [Math.round(this.zone.x), Math.round(this.zone.y), Math.round(this.zone.r)],
      p,
      a,
      u,
    };
  }

  broadcastSnapshot() {
    for (const viewer of this.players.values()) {
      if (viewer.ws && viewer.ws.readyState === 1) {
        try { viewer.ws.send(JSON.stringify(this.buildSnapshotFor(viewer))); } catch { /* ignore */ }
      }
    }
  }

  checkEnd() {
    if (this.state !== 'playing') return;
    if (this.timeLeft <= 0) { this.endMatch(this.leader()); return; }
    const alive = [...this.players.values()].filter((p) => p.alive && !p.eliminated);
    if (this.startedWith >= 2 && alive.length <= 1) {
      this.endMatch(alive[0] || null);
    }
  }

  leader() {
    let best = null;
    for (const p of this.players.values()) {
      if (!best || this.playerScore(p) > this.playerScore(best)) best = p;
    }
    return best;
  }

  endMatch(winner) {
    if (this.state === 'ended') return;
    this.state = 'ended';
    if (this.loop) { clearInterval(this.loop); this.loop = null; }
    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
    this.broadcastSnapshot();

    const results = [...this.players.values()]
      .map((p) => ({
        id: p.id,
        name: p.name,
        points: this.playerScore(p),
        kills: p.kills,
        animalKills: p.animalKills,
        deaths: p.deaths,
        damage: Math.round(p.damageDealt),
        survival: Math.round(p.survival),
        winner: !!(winner && p.id === winner.id && !p.eliminated),
      }))
      .sort((x, y) => y.points - x.points);

    const date = new Date().toISOString();
    this.rankings.add(results.map((r) => ({ name: r.name, points: r.points, kills: r.kills, date })));

    this.lastEnd = {
      t: 'end',
      winner: winner ? { id: winner.id, name: winner.name } : null,
      results,
    };
    this.sendAll(this.lastEnd);
    this.destroyAt = Date.now() + this.cfg.lobby.endedTtlMs;
  }

  handleDisconnect(playerId) {
    const p = this.players.get(playerId);
    if (!p) return;
    p.ws = null;
    p.connected = false;
    p.disconnectedAt = Date.now();
    p.input = { x: 0, y: 0, attack: false, dash: false, aimX: null, aimY: null, slot: null };
    if (this.state === 'lobby' || this.state === 'countdown') {
      this.players.delete(playerId);
      if (this.hostId === playerId) {
        const next = this.connectedPlayers()[0];
        this.hostId = next ? next.id : null;
      }
      if (!this.players.size) {
        this.emptySince = Date.now();
        if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
        this.state = 'lobby';
      } else {
        if (this.state === 'countdown' && !this.connectedPlayers().some((p) => p.ready)) {
          if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
          this.state = 'lobby';
        }
        this.broadcastLobby();
      }
    }
  }

  checkGrace() {
    if (this.state !== 'playing') return;
    const grace = this.cfg.player.disconnectGraceSec * 1000;
    for (const p of this.players.values()) {
      if (!p.connected && p.disconnectedAt && !p.eliminated && Date.now() - p.disconnectedAt > grace) {
        p.eliminated = true;
        p.alive = false;
        p.hp = 0;
        this.pushEvent({ k: 'leave', x: Math.round(p.x), y: Math.round(p.y), p: p.id });
      }
    }
  }

  destroy() {
    if (this.loop) { clearInterval(this.loop); this.loop = null; }
    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
    for (const p of this.players.values()) {
      if (p.ws) { try { p.ws.close(4001, 'pokoj zamkniety'); } catch { /* ignore */ } }
    }
    this.players.clear();
    if (this.onDestroy) this.onDestroy();
  }
}

module.exports = Room;
