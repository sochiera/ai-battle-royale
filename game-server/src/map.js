'use strict';
// Statyczne przeszkody areny: mury (prostokaty), drzewa (kola), krzaki (kola, ukrycie),
// woda (prostokaty, spowolnienie). Pomocnicze funkcje kolizji i linii widzenia.

function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function circleRectResolve(px, py, radius, r) {
  const cx = Math.max(r.x, Math.min(px, r.x + r.w));
  const cy = Math.max(r.y, Math.min(py, r.y + r.h));
  let dx = px - cx;
  let dy = py - cy;
  let d = Math.hypot(dx, dy);
  if (d >= radius) return null;
  if (d < 0.0001) {
    // srodek wewnatrz prostokata - wypchnij najkrotsza krawedzia
    const left = px - r.x;
    const right = r.x + r.w - px;
    const top = py - r.y;
    const bottom = r.y + r.h - py;
    const m = Math.min(left, right, top, bottom);
    if (m === left) return { x: r.x - radius, y: py };
    if (m === right) return { x: r.x + r.w + radius, y: py };
    if (m === top) return { x: px, y: r.y - radius };
    return { x: px, y: r.y + r.h + radius };
  }
  const push = (radius - d) / d;
  return { x: px + dx * push, y: py + dy * push };
}

function circleCircleResolve(px, py, radius, c) {
  const dx = px - c.x;
  const dy = py - c.y;
  const min = radius + c.r;
  const d = Math.hypot(dx, dy);
  if (d >= min) return null;
  if (d < 0.0001) return { x: px + min, y: py };
  const push = (min - d) / d;
  return { x: px + dx * push, y: py + dy * push };
}

// Wypycha punkt (gracza) z przeszkod; zwraca skorygowana pozycje.
function resolveStaticObstacles(x, y, radius, map) {
  if (!map) return { x, y };
  let nx = x;
  let ny = y;
  for (const w of map.walls) {
    const c = circleRectResolve(nx, ny, radius, w);
    if (c) { nx = c.x; ny = c.y; }
  }
  for (const t of map.trees) {
    const c = circleCircleResolve(nx, ny, radius, t);
    if (c) { nx = c.x; ny = c.y; }
  }
  return { x: nx, y: ny };
}

function pointInWater(x, y, map) {
  if (!map) return false;
  for (const w of map.water) if (pointInRect(x, y, w)) return true;
  return false;
}

function pointInBush(x, y, map) {
  if (!map) return null;
  for (const b of map.bushes) {
    const dx = x - b.x;
    const dy = y - b.y;
    if (dx * dx + dy * dy <= b.r * b.r) return b;
  }
  return null;
}

// Przecięcie odcinka z osią-aligned prostokątem (slab method).
function segmentHitsRect(ax, ay, bx, by, r) {
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - r.x, r.x + r.w - ax, ay - r.y, r.y + r.h - ay];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
  }
  return true;
}

function segmentHitsCircle(ax, ay, bx, by, c) {
  const dx = bx - ax;
  const dy = by - ay;
  const fx = ax - c.x;
  const fy = ay - c.y;
  const a = dx * dx + dy * dy;
  if (a < 0.0001) return false;
  const b = 2 * (fx * dx + fy * dy);
  const cc = fx * fx + fy * fy - c.r * c.r;
  let disc = b * b - 4 * a * cc;
  if (disc < 0) return false;
  disc = Math.sqrt(disc);
  const t1 = (-b - disc) / (2 * a);
  const t2 = (-b + disc) / (2 * a);
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
}

// Czy odcinek jest zablokowany przez mury lub drzewa (krzaki i woda nie blokują).
function lineBlocked(ax, ay, bx, by, map) {
  if (!map) return false;
  for (const w of map.walls) if (segmentHitsRect(ax, ay, bx, by, w)) return true;
  for (const t of map.trees) if (segmentHitsCircle(ax, ay, bx, by, t)) return true;
  return false;
}

function rayRectDist(ax, ay, dx, dy, r) {
  let tmin = 0;
  let tmax = Infinity;
  const inv = [1 / dx, 1 / dy];
  const o = [ax, ay];
  const mn = [r.x, r.y];
  const mx = [r.x + r.w, r.y + r.h];
  for (let i = 0; i < 2; i++) {
    if (!Number.isFinite(inv[i])) {
      if (o[i] < mn[i] || o[i] > mx[i]) return Infinity;
    } else {
      let t1 = (mn[i] - o[i]) * inv[i];
      let t2 = (mx[i] - o[i]) * inv[i];
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin >= 0 ? tmin : Infinity;
}

function rayCircleDist(ax, ay, dx, dy, c) {
  const fx = ax - c.x;
  const fy = ay - c.y;
  const a = dx * dx + dy * dy;
  if (a < 0.0001) return Infinity;
  const b = 2 * (fx * dx + fy * dy);
  const cc = fx * fx + fy * fy - c.r * c.r;
  let disc = b * b - 4 * a * cc;
  if (disc < 0) return Infinity;
  disc = Math.sqrt(disc);
  const t1 = (-b - disc) / (2 * a);
  const t2 = (-b + disc) / (2 * a);
  if (t1 >= 0) return t1;
  if (t2 >= 0) return t2;
  return Infinity;
}

// Odleglosc od (ax,ay) w kierunku (dx,dy) do pierwszej przeszkody lub maxDist.
function rayCast(ax, ay, dx, dy, maxDist, map) {
  if (!map) return maxDist;
  let best = maxDist;
  for (const w of map.walls) {
    const t = rayRectDist(ax, ay, dx, dy, w);
    if (t < best) best = t;
  }
  for (const t of map.trees) {
    const d = rayCircleDist(ax, ay, dx, dy, t);
    if (d < best) best = d;
  }
  return best;
}

function generateMap(arena) {
  const W = arena.w;
  const H = arena.h;
  const R = { x: 0, y: 0, w: W, h: H };
  const walls = [];
  const water = [];
  const trees = [];
  const bushes = [];

  const margin = 140;
  const cx = W / 2;
  const cy = H / 2;

  // Woda: 2-3 zbiorniki (prostokaty)
  const ponds = 3;
  for (let i = 0; i < ponds; i++) {
    const w = 260 + Math.random() * 320;
    const h = 180 + Math.random() * 240;
    for (let a = 0; a < 24; a++) {
      const x = margin + Math.random() * (W - 2 * margin - w);
      const y = margin + Math.random() * (H - 2 * margin - h);
      const rect = { x, y, w, h };
      if (Math.hypot(x + w / 2 - cx, y + h / 2 - cy) < 300) continue;
      water.push(rect);
      break;
    }
  }

  const inWater = (x, y) => water.some((r) => x > r.x - 60 && x < r.x + r.w + 60 && y > r.y - 60 && y < r.y + r.h + 60);

  // Mury: segmenty (pionowe/poziome) jako prostokaty
  const wallCount = 14;
  for (let i = 0; i < wallCount; i++) {
    const horizontal = Math.random() < 0.5;
    const len = 160 + Math.random() * 340;
    const thick = 34;
    let x;
    let y;
    if (horizontal) {
      x = margin + Math.random() * (W - 2 * margin - len);
      y = margin + Math.random() * (H - 2 * margin - thick);
      walls.push({ x: Math.round(x), y: Math.round(y), w: Math.round(len), h: thick });
    } else {
      x = margin + Math.random() * (W - 2 * margin - thick);
      y = margin + Math.random() * (H - 2 * margin - len);
      walls.push({ x: Math.round(x), y: Math.round(y), w: thick, h: Math.round(len) });
    }
  }

  const blockedByWall = (x, y, pad) => walls.some((w) => x > w.x - pad && x < w.x + w.w + pad && y > w.y - pad && y < w.y + w.h + pad);

  // Drzewa (przeszkody + osłona)
  for (let i = 0; i < 40; i++) {
    const x = margin + Math.random() * (W - 2 * margin);
    const y = margin + Math.random() * (H - 2 * margin);
    if (Math.hypot(x - cx, y - cy) < 220) continue;
    if (blockedByWall(x, y, 30) || inWater(x, y)) continue;
    const r = 22 + Math.random() * 16;
    let ok = true;
    for (const t of trees) if (Math.hypot(x - t.x, y - t.y) < r + t.r + 90) { ok = false; break; }
    if (!ok) continue;
    trees.push({ x: Math.round(x), y: Math.round(y), r: Math.round(r) });
  }

  // Krzaki (ukrycie, bez kolizji)
  for (let i = 0; i < 34; i++) {
    const x = margin + Math.random() * (W - 2 * margin);
    const y = margin + Math.random() * (H - 2 * margin);
    if (blockedByWall(x, y, 10) || inWater(x, y)) continue;
    const r = 34 + Math.random() * 16;
    let ok = true;
    for (const b of bushes) if (Math.hypot(x - b.x, y - b.y) < r + b.r + 40) { ok = false; break; }
    if (!ok) continue;
    bushes.push({ x: Math.round(x), y: Math.round(y), r: Math.round(r) });
  }

  return { bounds: R, walls, water, trees, bushes };
}

module.exports = {
  generateMap,
  resolveStaticObstacles,
  pointInWater,
  pointInBush,
  lineBlocked,
  rayCast,
  pointInRect,
};
