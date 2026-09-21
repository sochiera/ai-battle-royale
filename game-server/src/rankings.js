'use strict';
const fs = require('fs');
const path = require('path');

class Rankings {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'rankings.json');
    this.entries = this.load();
  }

  load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const data = JSON.parse(raw);
      return Array.isArray(data.entries) ? data.entries : [];
    } catch {
      return [];
    }
  }

  save() {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ updated: new Date().toISOString(), entries: this.entries }, null, 2));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('[rankings] zapis nieudany:', err.message);
    }
  }

  top(n = 10) {
    return this.entries.slice(0, n);
  }

  add(list) {
    if (!Array.isArray(list) || !list.length) return;
    for (const e of list) {
      if (!e || typeof e.name !== 'string') continue;
      this.entries.push({
        name: e.name,
        points: Math.max(0, Math.round(e.points || 0)),
        kills: Math.max(0, Math.round(e.kills || 0)),
        date: e.date || new Date().toISOString(),
      });
    }
    this.entries.sort((a, b) => b.points - a.points || b.kills - a.kills);
    if (this.entries.length > 200) this.entries = this.entries.slice(0, 200);
    this.save();
  }
}

module.exports = Rankings;
