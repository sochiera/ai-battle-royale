'use strict';
const crypto = require('crypto');

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function id() { return crypto.randomBytes(6).toString('hex'); }
function token() { return crypto.randomBytes(18).toString('hex'); }

function sanitizeName(n) {
  if (typeof n !== 'string') return 'Orzel';
  const cleaned = n
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
  return cleaned.length ? cleaned : 'Orzel';
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function makeCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return s;
}

module.exports = {
  clamp, rand, randInt, dist, dist2, pick, id, token, sanitizeName, makeCode, CODE_ALPHABET,
};
