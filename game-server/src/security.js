'use strict';

class RateLimiter {
  constructor(max, windowMs) {
    this.max = max;
    this.windowMs = windowMs;
    this.hits = new Map();
  }

  allow(key) {
    const now = Date.now();
    let arr = this.hits.get(key);
    if (!arr) { arr = []; this.hits.set(key, arr); }
    while (arr.length && now - arr[0] > this.windowMs) arr.shift();
    if (arr.length >= this.max) return false;
    arr.push(now);
    return true;
  }

  sweep() {
    const now = Date.now();
    for (const [k, arr] of this.hits) {
      const kept = arr.filter((t) => now - t <= this.windowMs);
      if (kept.length) this.hits.set(k, kept);
      else this.hits.delete(k);
    }
  }
}

class IpGuard {
  constructor(maxFails, windowMs, banMs) {
    this.maxFails = maxFails;
    this.windowMs = windowMs;
    this.banMs = banMs;
    this.fails = new Map();
    this.bans = new Map();
  }

  isBanned(ip) {
    const until = this.bans.get(ip);
    if (!until) return false;
    if (Date.now() > until) { this.bans.delete(ip); this.fails.delete(ip); return false; }
    return true;
  }

  fail(ip) {
    const now = Date.now();
    let rec = this.fails.get(ip);
    if (!rec || now - rec.first > this.windowMs) rec = { n: 0, first: now };
    rec.n++;
    this.fails.set(ip, rec);
    if (rec.n >= this.maxFails) this.bans.set(ip, now + this.banMs);
  }

  sweep() {
    const now = Date.now();
    for (const [ip, rec] of this.fails) {
      if (now - rec.first > this.windowMs) this.fails.delete(ip);
    }
    for (const [ip, until] of this.bans) {
      if (now > until) this.bans.delete(ip);
    }
  }
}

class IpCounter {
  constructor(max) {
    this.max = max;
    this.counts = new Map();
  }

  add(ip) {
    const n = this.counts.get(ip) || 0;
    this.counts.set(ip, n + 1);
  }

  remove(ip) {
    const n = (this.counts.get(ip) || 1) - 1;
    if (n <= 0) this.counts.delete(ip);
    else this.counts.set(ip, n);
  }

  atLimit(ip) {
    return (this.counts.get(ip) || 0) >= this.max;
  }
}

function isLocalAddr(addr) {
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

function clientIp(req) {
  const socketIp = (req.socket && req.socket.remoteAddress) || '';
  if (isLocalAddr(socketIp)) {
    const real = req.headers['x-real-ip'];
    if (typeof real === 'string') {
      const ip = real.trim();
      if (ip && ip.length <= 64) return ip;
    }
    return socketIp || 'unknown';
  }
  return socketIp || 'unknown';
}

module.exports = { RateLimiter, IpGuard, IpCounter, clientIp };
