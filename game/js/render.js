function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }

function hashHue(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const ANIMAL_EMOJI = { eagle: '\u{1F985}', boar: '\u{1F417}', badger: '\u{1F9A1}' };
const POWERUP_STYLE = {
  hp: { c: '#43d17a', l: '+' },
  dash: { c: '#4bb4ff', l: 'D' },
  atk: { c: '#ffb020', l: 'A' },
  medkit: { c: '#ff5d73', l: '+' },
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.camera = { x: 0, y: 0, init: false };
    this.baseDpr = Math.min(window.devicePixelRatio || 1, 2);
    this.quality = 1;
    this.viewW = 0;
    this.viewH = 0;
    this.frameSamples = [];
    this.lastDrawAt = 0;
    this.hurtAlpha = 0;
    this.sprites = new Map();
    this.groundPattern = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.applySize();
    this.bgGrad = null;
  }

  applySize() {
    const dpr = this.baseDpr * this.quality;
    this.canvas.width = Math.max(1, Math.floor(this.viewW * dpr));
    this.canvas.height = Math.max(1, Math.floor(this.viewH * dpr));
    this.canvas.style.width = this.viewW + 'px';
    this.canvas.style.height = this.viewH + 'px';
    this.dpr = dpr;
  }

  sprite(emoji, px) {
    const key = emoji + '@' + px;
    let s = this.sprites.get(key);
    if (s) return s;
    const c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    const g = c.getContext('2d');
    g.font = Math.round(px * 0.82) + 'px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, px / 2, px / 2 + px * 0.04);
    this.sprites.set(key, c);
    return c;
  }

  getGroundPattern(ctx) {
    if (this.groundPattern) return this.groundPattern;
    const tile = document.createElement('canvas');
    const T = 200;
    tile.width = T;
    tile.height = T;
    const g = tile.getContext('2d');
    g.fillStyle = '#123024';
    g.fillRect(0, 0, T, T);
    const img = g.getImageData(0, 0, T, T);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 10;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(111,211,255,0.06)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0.5, 0);
    g.lineTo(0.5, T);
    g.moveTo(0, 0.5);
    g.lineTo(T, 0.5);
    g.stroke();
    this.groundPattern = ctx.createPattern(tile, 'repeat');
    return this.groundPattern;
  }

  screenToWorld(sx, sy) {
    return { x: sx - this.viewW / 2 + this.camera.x, y: sy - this.viewH / 2 + this.camera.y };
  }

  draw(app, now) {
    // adaptacyjna jakosc
    if (this.lastDrawAt) {
      const frame = now - this.lastDrawAt;
      this.frameSamples.push(frame);
      if (this.frameSamples.length >= 40) {
        const sorted = this.frameSamples.slice().sort((a, b) => a - b);
        const med = sorted[Math.floor(sorted.length / 2)];
        this.frameSamples.length = 0;
        let next = this.quality;
        if (med > 30) next = Math.max(0.65, this.quality - 0.15);
        else if (med < 17 && this.quality < 1) next = Math.min(1, this.quality + 0.1);
        if (next !== this.quality) { this.quality = next; this.applySize(); }
      }
    }
    this.lastDrawAt = now;

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBackdrop(ctx);

    if (!app.arena || !app.view) return;

    const local = app.localPos || { x: app.arena[0] / 2, y: app.arena[1] / 2 };
    const focus = app.eliminated && app.spectate ? app.spectate : local;
    if (!this.camera.init) { this.camera.x = focus.x; this.camera.y = focus.y; this.camera.init = true; }
    const k = Math.min(1, 10 * (app.dt || 0.016));
    this.camera.x = lerp(this.camera.x, focus.x, k);
    this.camera.y = lerp(this.camera.y, focus.y, k);
    const aw = app.arena[0];
    const ah = app.arena[1];
    this.camera.x = clamp(this.camera.x, Math.min(this.viewW / 2, aw / 2), Math.max(aw - this.viewW / 2, aw / 2));
    this.camera.y = clamp(this.camera.y, Math.min(this.viewH / 2, ah / 2), Math.max(ah - this.viewH / 2, ah / 2));

    ctx.save();
    ctx.translate(Math.round(this.viewW / 2 - this.camera.x), Math.round(this.viewH / 2 - this.camera.y));
    this.drawWorld(ctx, app, now);
    ctx.restore();

    this.drawHud(ctx, app, now);
  }

  drawBackdrop(ctx) {
    if (!this.bgGrad) {
      this.bgGrad = ctx.createLinearGradient(0, 0, 0, this.viewH);
      this.bgGrad.addColorStop(0, '#0e1f1b');
      this.bgGrad.addColorStop(1, '#08120f');
    }
    ctx.fillStyle = this.bgGrad;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
  }

  viewBounds() {
    const left = this.camera.x - this.viewW / 2;
    const right = this.camera.x + this.viewW / 2;
    const top = this.camera.y - this.viewH / 2;
    const bottom = this.camera.y + this.viewH / 2;
    return { left, right, top, bottom };
  }

  visible(x, y, pad) {
    const b = this.bounds;
    return x >= b.left - pad && x <= b.right + pad && y >= b.top - pad && y <= b.bottom + pad;
  }

  drawWorld(ctx, app, now) {
    const view = app.view;
    const aw = app.arena[0];
    const ah = app.arena[1];
    const b = this.viewBounds();
    this.bounds = b;

    const gx = Math.max(0, b.left);
    const gy = Math.max(0, b.top);
    const gw = Math.min(aw, b.right) - gx;
    const gh = Math.min(ah, b.bottom) - gy;
    if (gw > 0 && gh > 0) {
      ctx.fillStyle = this.getGroundPattern(ctx);
      ctx.fillRect(gx, gy, gw, gh);
    }

    const map = app.map;
    if (map) this.drawTerrain(ctx, map, now, b);

    const z = view.zone;
    if (z) {
      ctx.beginPath();
      ctx.rect(b.left - 200, b.top - 200, (b.right - b.left) + 400, (b.bottom - b.top) + 400);
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2, true);
      ctx.fillStyle = 'rgba(150,25,25,0.34)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,90,90,0.85)';
      ctx.lineWidth = 5;
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(111,211,255,0.35)';
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, aw, ah);

    for (const o of view.powerups.values()) {
      if (!this.visible(o.x, o.y, 60)) continue;
      this.drawLoot(ctx, o, now);
    }

    if (map) {
      for (const t of map.trees) {
        if (!this.visible(t.x, t.y, 120)) continue;
        this.drawTreeBase(ctx, t);
      }
    }

    for (const a of view.animals.values()) {
      if (!this.visible(a.x, a.y, 60)) continue;
      this.drawAnimal(ctx, a);
    }

    for (const p of view.players.values()) {
      if (p.id === app.me) continue;
      if (!this.visible(p.x, p.y, 80)) continue;
      this.drawPlayer(ctx, p, false, now, app);
    }

    for (const e of app.effects) {
      if (!this.visible(e.x, e.y, 120)) continue;
      this.drawEffect(ctx, e, now);
    }

    if (map) {
      for (const t of map.trees) {
        if (!this.visible(t.x, t.y, 160)) continue;
        this.drawTreeCanopy(ctx, t);
      }
      for (const bu of map.bushes) {
        if (!this.visible(bu.x, bu.y, 90)) continue;
        this.drawBush(ctx, bu, now);
      }
    }

    const me = view.players.get(app.me);
    if (me) this.drawPlayer(ctx, me, true, now, app);
  }

  drawTerrain(ctx, map, now, b) {
    for (const w of map.water) {
      if (w.x > b.right || w.x + w.w < b.left || w.y > b.bottom || w.y + w.h < b.top) continue;
      ctx.fillStyle = '#1b4a63';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = 'rgba(150,220,255,0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = 'rgba(190,235,255,0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let y = w.y + 22; y < w.y + w.h - 6; y += 26) {
        const off = Math.sin((now / 900) + y * 0.05) * 10;
        ctx.moveTo(w.x + 12 + off, y);
        ctx.lineTo(w.x + w.w - 12 + off, y);
      }
      ctx.stroke();
    }
    for (const w of map.walls) {
      if (w.x > b.right || w.x + w.w < b.left || w.y > b.bottom || w.y + w.h < b.top) continue;
      ctx.fillStyle = '#4a4f52';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(w.x, w.y, w.w, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(w.x, w.y + w.h - 6, w.w, 6);
      ctx.strokeStyle = 'rgba(15,20,22,0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(w.x, w.y, w.w, w.h);
    }
  }

  drawTreeBase(ctx, t) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(t.x + 6, t.y + 10, t.r * 1.4, t.r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5b3d24';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  drawTreeCanopy(ctx, t) {
    const size = t.r * 4.2;
    const spr = this.sprite('\u{1F333}', 128);
    ctx.drawImage(spr, t.x - size / 2, t.y - size / 2 - t.r * 0.7, size, size);
  }

  drawBush(ctx, b, now) {
    const sway = Math.sin(now / 700 + b.x * 0.02) * 1.5;
    ctx.save();
    ctx.globalAlpha = 0.94;
    const blobs = [
      [0, 0, b.r],
      [-b.r * 0.6, b.r * 0.15, b.r * 0.7],
      [b.r * 0.6, b.r * 0.15, b.r * 0.7],
      [0, -b.r * 0.5, b.r * 0.72],
    ];
    for (let i = 0; i < blobs.length; i++) {
      const [dx, dy, rr] = blobs[i];
      ctx.fillStyle = i % 2 ? '#1f6b3a' : '#26804a';
      ctx.beginPath();
      ctx.arc(b.x + dx + sway, b.y + dy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(180,255,210,0.25)';
    ctx.beginPath();
    ctx.arc(b.x - b.r * 0.3 + sway, b.y - b.r * 0.35, b.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawLoot(ctx, o, now) {
    const bob = Math.sin(now / 260 + o.x * 0.01) * 3;
    ctx.save();
    ctx.translate(o.x, o.y + bob);
    if (o.kind === 'weapon') {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      this.drawWeaponIcon(ctx, o.type, 0, 0, 26);
    } else {
      const st = POWERUP_STYLE[o.type] || POWERUP_STYLE.hp;
      ctx.rotate(Math.PI / 4);
      const s = o.type === 'medkit' ? 15 : 14;
      ctx.fillStyle = st.c;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = o.type === 'medkit' ? '#fff' : '#062029';
      ctx.font = 'bold 18px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(st.l, 0, 1);
    }
    ctx.restore();
  }

  drawWeaponIcon(ctx, key, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    const s = size / 26;
    ctx.fillStyle = '#dfe7ea';
    ctx.strokeStyle = '#2a3236';
    ctx.lineWidth = 2;
    if (key === 'knife') {
      ctx.beginPath();
      ctx.moveTo(-8 * s, 3 * s);
      ctx.lineTo(6 * s, -4 * s);
      ctx.lineTo(11 * s, -1 * s);
      ctx.lineTo(-6 * s, 6 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(-12 * s, 2 * s, 5 * s, 5 * s);
    } else if (key === 'machete') {
      ctx.beginPath();
      ctx.moveTo(-9 * s, 4 * s);
      ctx.lineTo(4 * s, -4 * s);
      ctx.lineTo(13 * s, 0);
      ctx.lineTo(13 * s, 3 * s);
      ctx.lineTo(-7 * s, 7 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(-13 * s, 3 * s, 5 * s, 6 * s);
    } else if (key === 'pistol') {
      ctx.fillStyle = '#31393d';
      ctx.fillRect(-9 * s, -4 * s, 16 * s, 6 * s);
      ctx.fillRect(-6 * s, 2 * s, 6 * s, 8 * s);
      ctx.strokeRect(-9 * s, -4 * s, 16 * s, 6 * s);
    } else if (key === 'rifle') {
      ctx.fillStyle = '#31393d';
      ctx.fillRect(-13 * s, -3 * s, 26 * s, 5 * s);
      ctx.fillRect(-6 * s, 2 * s, 6 * s, 7 * s);
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(-14 * s, -3 * s, 6 * s, 6 * s);
      ctx.strokeRect(-13 * s, -3 * s, 26 * s, 5 * s);
    }
    ctx.restore();
  }

  drawAnimal(ctx, a) {
    const emoji = ANIMAL_EMOJI[a.type] || '?';
    const size = a.type === 'boar' ? 40 : 34;
    const spr = this.sprite(emoji, 96);
    ctx.drawImage(spr, a.x - size / 2, a.y - size / 2, size, size);
    this.drawBar(ctx, a.x - 22, a.y - size / 2 - 8, 44, 5, a.hpRatio, '#e05353');
  }

  drawPlayer(ctx, p, isMe, now, app) {
    const hue = hashHue(p.id);
    const col = `hsl(${hue} 70% 55%)`;
    const dark = `hsl(${hue} 70% 40%)`;
    const angle = Math.atan2(p.aimY, p.aimX) || 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = p.alive ? (p.hidden && !isMe ? 0.35 : 1) : 0.3;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 20, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(angle);
    if (p.dashing) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(-40, 0);
      ctx.lineTo(-12, 0);
      ctx.stroke();
      ctx.globalAlpha = p.alive ? 1 : 0.3;
    }
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-4, -9);
    ctx.lineTo(-24, -26);
    ctx.lineTo(10, -11);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4, 9);
    ctx.lineTo(-24, 26);
    ctx.lineTo(10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f6f1e6';
    ctx.beginPath();
    ctx.arc(14, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffcc33';
    ctx.beginPath();
    ctx.moveTo(19, -4);
    ctx.lineTo(32, 0);
    ctx.lineTo(19, 4);
    ctx.closePath();
    ctx.fill();
    if (p.weapon && p.weapon !== 'knife') {
      ctx.save();
      ctx.translate(16, 6);
      const sc = p.weapon === 'rifle' ? 0.9 : 0.7;
      this.drawWeaponIcon(ctx, p.weapon, 0, 0, 26 * sc);
      ctx.restore();
    }
    if (p.invuln) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    if (isMe) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 27, 0, Math.PI * 2);
      ctx.stroke();
      const range = app.weaponRange || 80;
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x + p.aimX * 18, p.y + p.aimY * 18);
      ctx.lineTo(p.x + p.aimX * range, p.y + p.aimY * range);
      ctx.stroke();
    }

    if (p.alive) this.drawBar(ctx, p.x - 30, p.y - 42, 60, 6, p.hp / p.maxHp, '#43d17a');
    ctx.font = 'bold 13px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = isMe ? '#ffffff' : 'rgba(235,245,243,0.85)';
    ctx.fillText(p.name || p.id, p.x, p.y - 46);
  }

  drawBar(ctx, x, y, w, h, ratio, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * clamp(ratio, 0, 1), h);
  }

  drawEffect(ctx, e, now) {
    const t = (now - e.t0) / e.ttl;
    if (t < 0 || t > 1) return;
    const alpha = 1 - t;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (e.kind === 'swing') {
      ctx.translate(e.x, e.y);
      ctx.rotate(e.a);
      ctx.strokeStyle = 'rgba(255,240,180,0.9)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 60, -0.6, 0.6);
      ctx.stroke();
    } else if (e.kind === 'shot') {
      const len = e.l || 400;
      ctx.strokeStyle = 'rgba(255,235,150,0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.a) * len, e.y + Math.sin(e.a) * len);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,200,0.9)';
      ctx.beginPath();
      ctx.arc(e.x + Math.cos(e.a) * len, e.y + Math.sin(e.a) * len, 4 * (1 - t), 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'dash') {
      ctx.translate(e.x, e.y);
      ctx.rotate(e.a);
      ctx.strokeStyle = 'rgba(140,220,255,0.8)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-70 + t * 40, 0);
      ctx.lineTo(-10 + t * 40, 0);
      ctx.stroke();
    } else if (e.kind === 'hit' || e.kind === 'bite') {
      ctx.strokeStyle = e.kind === 'bite' ? 'rgba(255,110,110,0.9)' : 'rgba(255,210,120,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 8 + t * 34, 0, Math.PI * 2);
      ctx.stroke();
      if (e.d) {
        ctx.fillStyle = e.kind === 'bite' ? '#ff8a8a' : '#ffd166';
        ctx.font = 'bold 16px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('-' + e.d, e.x, e.y - 20 - t * 26);
      }
    } else if (e.kind === 'kill') {
      ctx.strokeStyle = 'rgba(255,180,90,0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 10 + t * 46, 0, Math.PI * 2);
      ctx.stroke();
    } else if (e.kind === 'death' || e.kind === 'leave') {
      ctx.strokeStyle = 'rgba(255,80,80,0.9)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 12 + t * 70, 0, Math.PI * 2);
      ctx.stroke();
    } else if (e.kind === 'pickup') {
      const st = POWERUP_STYLE[e.type] || POWERUP_STYLE.hp;
      ctx.strokeStyle = st.c;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 12 + t * 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawHud(ctx, app, now) {
    const view = app.view;
    const me = view.players.get(app.me);
    const pad = 22;

    const ratio = me ? me.hp / me.maxHp : 0;
    const hpColor = ratio > 0.5 ? '#43d17a' : ratio > 0.25 ? '#ffb020' : '#e05353';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, pad, pad, 268, 74, 14);
    ctx.fill();
    this.drawBar(ctx, pad + 14, pad + 14, 240, 20, ratio, hpColor);
    ctx.fillStyle = '#eaf4f2';
    ctx.font = 'bold 14px Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`HP ${me ? Math.ceil(me.hp) : 0}/${me ? me.maxHp : 0}`, pad + 20, pad + 24);

    const atkReady = app.myAttackDur ? clamp(1 - app.myAttackCd / app.myAttackDur, 0, 1) : 1;
    const dashReady = app.myDashDur ? clamp(1 - app.myDashCd / app.myDashDur, 0, 1) : 1;
    this.drawBar(ctx, pad + 14, pad + 44, 115, 12, atkReady, '#ffb020');
    this.drawBar(ctx, pad + 139, pad + 44, 115, 12, dashReady, '#4bb4ff');
    ctx.font = '10px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('ATAK', pad + 16, pad + 50);
    ctx.fillText('DASH', pad + 141, pad + 50);

    this.drawWeaponPanel(ctx, app, me);

    const time = view.tm;
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, this.viewW / 2 - 70, pad, 140, 46, 14);
    ctx.fill();
    ctx.fillStyle = time < 30 ? '#ff8a8a' : '#eaf4f2';
    ctx.font = 'bold 26px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, this.viewW / 2, pad + 24);

    const alive = [...view.players.values()].filter((p) => p.alive && !p.eliminated).length;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, this.viewW - pad - 200, pad, 200, 74, 14);
    ctx.fill();
    ctx.fillStyle = '#eaf4f2';
    ctx.font = 'bold 15px Segoe UI, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Punkty: ${me ? me.score : 0}`, this.viewW - pad - 14, pad + 22);
    ctx.fillText(`Zabójstwa: ${me ? me.kills : 0}  Zwierzęta: ${me ? me.animalKills : 0}`, this.viewW - pad - 14, pad + 46);
    ctx.fillStyle = 'rgba(200,230,225,0.8)';
    ctx.font = '12px Segoe UI, sans-serif';
    ctx.fillText(`Żywych: ${alive}   Ping: ${app.ping}ms`, this.viewW - pad - 14, pad + 64);

    const z = view.zone;
    const inZone = me ? ((me.x - z.x) ** 2 + (me.y - z.y) ** 2) <= z.r * z.r : true;
    if (me && me.alive && !inZone) {
      ctx.fillStyle = 'rgba(255,60,60,0.85)';
      ctx.font = 'bold 18px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POZA STREFĄ! -' + (app.zoneDamage || 5) + ' HP/s', this.viewW / 2, pad + 74);
    } else if (me && me.alive && me.hidden) {
      ctx.fillStyle = 'rgba(140,255,190,0.9)';
      ctx.font = 'bold 16px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('UKRYTY W KRZAKACH', this.viewW / 2, pad + 74);
    }

    this.drawMinimap(ctx, app);

    if (!app.helpSeen && app.phase === 'playing') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      roundRect(ctx, this.viewW / 2 - 150, this.viewH - 44, 300, 28, 10);
      ctx.fill();
      ctx.fillStyle = 'rgba(220,240,236,0.85)';
      ctx.font = '13px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('1/2 lub Q zmiana broni · H pomoc', this.viewW / 2, this.viewH - 30);
    }

    if (app.countdown > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.fillStyle = '#6fd3ff';
      ctx.font = 'bold 120px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(app.countdown), this.viewW / 2, this.viewH / 2);
    }

    if (app.eliminated && !app.ended) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, this.viewW / 2 - 170, this.viewH - 90, 340, 56, 14);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 18px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Widz — czekasz na koniec meczu', this.viewW / 2, this.viewH - 62);
    }

    if (this.hurtAlpha > 0) {
      ctx.strokeStyle = `rgba(255,40,40,${this.hurtAlpha})`;
      ctx.lineWidth = 18;
      ctx.strokeRect(0, 0, this.viewW, this.viewH);
    }

    if (app.scoreboard) this.drawScoreboard(ctx, app);
  }

  drawWeaponPanel(ctx, app, me) {
    const pad = 22;
    const y = pad + 84;
    const w = 268;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, pad, y, w, 54, 14);
    ctx.fill();
    const slots = [
      { key: me ? me.melee : 'knife', label: '1' },
      { key: me ? me.ranged : null, label: '2' },
    ];
    const active = me ? me.slot : 0;
    for (let i = 0; i < 2; i++) {
      const x = pad + 14 + i * 124;
      const on = i === active;
      ctx.fillStyle = on ? 'rgba(111,211,255,0.22)' : 'rgba(255,255,255,0.05)';
      roundRect(ctx, x, y + 8, 116, 38, 10);
      ctx.fill();
      if (on) {
        ctx.strokeStyle = '#6fd3ff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      const key = slots[i].key;
      if (key) {
        this.drawWeaponIcon(ctx, key, x + 24, y + 27, 22);
        ctx.fillStyle = on ? '#eaf4f2' : 'rgba(234,244,242,0.6)';
        ctx.font = '12px Segoe UI, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(app.weaponNames[key] || key, x + 44, y + 27);
      } else {
        ctx.fillStyle = 'rgba(200,220,218,0.45)';
        ctx.font = '12px Segoe UI, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('brak', x + 44, y + 27);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '10px Segoe UI, sans-serif';
      ctx.fillText(slots[i].label, x + 6, y + 27);
    }
  }

  drawMinimap(ctx, app) {
    const arena = app.arena;
    const mw = 200;
    const mh = Math.round(mw * arena[1] / arena[0]);
    const mx = this.viewW - mw - 22;
    const my = this.viewH - mh - 22;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, mx, my, mw, mh, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(111,211,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    roundRect(ctx, mx, my, mw, mh, 10);
    ctx.clip();
    const sx = mw / arena[0];
    const sy = mh / arena[1];
    const map = app.map;
    if (map) {
      ctx.fillStyle = 'rgba(70,150,200,0.55)';
      for (const w of map.water) ctx.fillRect(mx + w.x * sx, my + w.y * sy, w.w * sx, w.h * sy);
      ctx.fillStyle = 'rgba(40,90,55,0.85)';
      for (const t of map.trees) ctx.fillRect(mx + t.x * sx - 1.5, my + t.y * sy - 1.5, 3, 3);
      ctx.fillStyle = 'rgba(180,180,180,0.75)';
      for (const w of map.walls) ctx.fillRect(mx + w.x * sx, my + w.y * sy, Math.max(1.5, w.w * sx), Math.max(1.5, w.h * sy));
    }
    const z = app.view.zone;
    ctx.beginPath();
    ctx.ellipse(mx + z.x * sx, my + z.y * sy, z.r * sx, z.r * sy, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,90,90,0.85)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    for (const o of app.view.powerups.values()) {
      ctx.fillStyle = o.kind === 'weapon' ? 'rgba(255,240,150,0.9)' : o.type === 'medkit' ? 'rgba(255,120,140,0.95)' : 'rgba(120,255,170,0.8)';
      ctx.fillRect(mx + o.x * sx - 1.5, my + o.y * sy - 1.5, 3, 3);
    }
    for (const a of app.view.animals.values()) {
      ctx.fillStyle = 'rgba(255,140,140,0.7)';
      ctx.fillRect(mx + a.x * sx - 1, my + a.y * sy - 1, 2, 2);
    }
    for (const p of app.view.players.values()) {
      if (!p.alive) continue;
      ctx.beginPath();
      ctx.arc(mx + p.x * sx, my + p.y * sy, p.id === app.me ? 3.5 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = p.id === app.me ? '#ffffff' : `hsl(${hashHue(p.id)} 70% 58%)`;
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }

  drawScoreboard(ctx, app) {
    const rows = [...app.view.players.values()].sort((a, b) => b.score - a.score);
    const w = Math.min(680, this.viewW - 40);
    const h = 90 + rows.length * 30;
    const x = (this.viewW - w) / 2;
    const y = (this.viewH - h) / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(4,16,14,0.92)';
    roundRect(ctx, x, y, w, h, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(111,211,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#6fd3ff';
    ctx.font = 'bold 20px Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tablica wyników', x + 24, y + 34);
    const cols = [
      ['Gracz', 24],
      ['HP', w - 300],
      ['Zab.', w - 230],
      ['Zwierzęta', w - 160],
      ['Śmierci', w - 70],
      ['Punkty', w - 24],
    ];
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(159,184,181,0.9)';
    cols.forEach(([label, dx], i) => {
      ctx.textAlign = i === cols.length - 1 ? 'right' : 'left';
      ctx.fillText(label.toUpperCase(), x + dx, y + 62);
    });
    ctx.font = '14px Segoe UI, sans-serif';
    rows.forEach((p, i) => {
      const ry = y + 90 + i * 30;
      if (p.id === app.me) {
        ctx.fillStyle = 'rgba(111,211,255,0.12)';
        ctx.fillRect(x + 8, ry - 15, w - 16, 28);
      }
      ctx.fillStyle = p.alive ? '#eaf4f2' : 'rgba(234,244,242,0.4)';
      ctx.textAlign = 'left';
      ctx.fillText(p.name || p.id, x + 24, ry);
      ctx.fillText(String(Math.ceil(p.hp)), x + w - 300, ry);
      ctx.fillText(String(p.kills), x + w - 230, ry);
      ctx.fillText(String(p.animalKills), x + w - 160, ry);
      ctx.fillText(String(p.deaths), x + w - 70, ry);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd166';
      ctx.fillText(String(p.score), x + w - 24, ry);
    });
    ctx.restore();
  }

  setHurt(alpha) { this.hurtAlpha = alpha; }
}
