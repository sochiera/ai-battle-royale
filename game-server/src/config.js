'use strict';
const path = require('path');

function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

const ROOT = path.resolve(__dirname, '..', '..');

module.exports = {
  host: process.env.HOST || '127.0.0.1',
  port: num(process.env.PORT, 8502),
  staticDir: process.env.STATIC_DIR || path.join(ROOT, 'game'),
  dataDir: process.env.DATA_DIR || path.join(ROOT, 'game-server', 'data'),

  tickHz: 60,
  snapshotHz: 30,
  matchDuration: num(process.env.MATCH_DURATION, 300),

  lobby: { maxPlayers: 8, countdown: 3, emptyTtlMs: 120000, endedTtlMs: 45000 },

  arena: { w: 3200, h: 2200 },

  player: {
    radius: 22,
    maxHp: 100,
    speed: 230,
    attackDamage: 15,
    attackCooldown: 0.5,
    attackCooldownMin: 0.2,
    attackRange: 80,
    attackArc: Math.PI * 0.75,
    dashDamage: 8,
    dashCooldown: 3,
    dashCooldownMin: 1.2,
    dashSpeed: 780,
    dashDuration: 0.16,
    invulnOnSpawn: 1.0,
    disconnectGraceSec: 10,
  },

  zone: {
    shrinkStart: 60,
    shrinkEnd: 270,
    endRadius: 180,
    damagePerSec: 5,
    animalDamagePerSec: 2,
    aggressionBoost: 1.4,
  },

  animals: {
    eagle: { hp: 60, damage: 10, speed: 185, radius: 18, range: 58, cooldown: 1.1, points: 10 },
    boar: { hp: 100, damage: 20, speed: 135, radius: 26, range: 62, cooldown: 1.5, points: 18 },
    badger: { hp: 40, damage: 8, speed: 155, radius: 16, range: 46, cooldown: 0.9, points: 8 },
  },
  animalTypes: ['eagle', 'badger', 'boar'],

  weapons: {
    knife: { kind: 'melee', dmg: 20, range: 82, arc: Math.PI * 0.78, cd: 0.42 },
    machete: { kind: 'melee', dmg: 34, range: 100, arc: Math.PI * 0.95, cd: 0.62 },
    pistol: { kind: 'ranged', dmg: 24, range: 620, cd: 0.5, spread: 0.045 },
    rifle: { kind: 'ranged', dmg: 42, range: 940, cd: 1.0, spread: 0.012 },
  },
  weaponOrder: ['knife', 'machete', 'pistol', 'rifle'],
  weaponNames: { knife: 'Nóż', machete: 'Maczeta', pistol: 'Pistolet', rifle: 'Karabin' },

  loot: {
    max: 44,
    startWeapons: 12,
    startMedkits: 10,
    medkitHeal: 60,
    dropChance: 0.35,
    medkitDropChance: 0.12,
    weaponDropChance: 0.18,
  },

  terrain: {
    waterSlow: 0.55,
    bushReveal: 150,
    bushAnimalSense: 210,
    attackRevealSec: 1.2,
  },

  wave: {
    firstDelay: 8,
    interval: 16,
    minInterval: 7,
    base: 3,
    growth: 0.9,
    maxPerWave: 10,
    maxAnimals: 44,
  },

  powerups: { types: ['hp', 'dash', 'atk'], dropChance: 0.35, lifeSec: 25, max: 24, radius: 16 },

  score: { damage: 1, kill: 50, animalKill: 12, survivalPerSec: 1 },

  security: {
    apiWindowMs: num(process.env.RATE_WINDOW_MS, 60000),
    hostMax: num(process.env.HOST_RATE_MAX, 6),
    joinMax: num(process.env.JOIN_RATE_MAX, 20),
    rejoinMax: num(process.env.REJOIN_RATE_MAX, 40),
    maxBadCodes: num(process.env.MAX_BAD_CODES, 10),
    badCodeBanMs: num(process.env.BAD_CODE_BAN_MS, 600000),
    badCodeWindowMs: num(process.env.BAD_CODE_WINDOW_MS, 600000),
    wsMaxPerIp: num(process.env.WS_MAX_PER_IP, 10),
    ticketTtlMs: num(process.env.TICKET_TTL_MS, 90000),
    bodyLimit: 4096,
  },
};
