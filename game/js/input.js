export class Input {
  constructor() {
    this.keys = { up: false, down: false, left: false, right: false, attack: false, dash: false };
    this.scoreboard = false;
    this.seq = 0;
    this.active = false;
    this.helpOpen = false;
    this.dashQueued = false;
    this.mouseAttack = false;
    this.currentSlot = 0;
    this.slotRequest = null;
    this.aimX = null;
    this.aimY = null;
    this.onScoreboard = null;
    this.onCancel = null;
    this.onToggleHelp = null;
    window.addEventListener('keydown', (e) => this.handle(e, true), { passive: false });
    window.addEventListener('keyup', (e) => this.handle(e, false), { passive: false });
    window.addEventListener('blur', () => this.reset());
  }

  handle(e, down) {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
    let handled = true;
    switch (e.code) {
      case 'ArrowUp': case 'KeyW': this.keys.up = down; break;
      case 'ArrowDown': case 'KeyS': this.keys.down = down; break;
      case 'ArrowLeft': case 'KeyA': this.keys.left = down; break;
      case 'ArrowRight': case 'KeyD': this.keys.right = down; break;
      case 'Space': case 'KeyJ': this.keys.attack = down; break;
      case 'Digit1': if (down && !e.repeat) this.slotRequest = 0; break;
      case 'Digit2': if (down && !e.repeat) this.slotRequest = 1; break;
      case 'KeyQ':
        if (!down || e.repeat) break;
        if (!this.active) { handled = false; break; }
        this.slotRequest = this.currentSlot === 1 ? 0 : 1;
        break;
      case 'KeyH':
        if (!down || e.repeat) break;
        if (this.onToggleHelp) this.onToggleHelp();
        break;
      case 'ShiftLeft': case 'ShiftRight':
        this.keys.dash = down;
        if (down && !e.repeat) this.dashQueued = true;
        break;
      case 'Tab':
        if (!this.active || this.helpOpen) { handled = false; break; }
        if (down && !e.repeat) {
          this.scoreboard = !this.scoreboard;
          if (this.onScoreboard) this.onScoreboard(this.scoreboard);
        }
        break;
      case 'Escape':
        if (!this.active && !this.helpOpen) { handled = false; break; }
        if (down && this.onCancel) this.onCancel();
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  }

  reset() {
    for (const k of Object.keys(this.keys)) this.keys[k] = false;
    this.scoreboard = false;
    this.dashQueued = false;
    this.mouseAttack = false;
  }

  vector() {
    let x = 0;
    let y = 0;
    if (this.keys.left) x -= 1;
    if (this.keys.right) x += 1;
    if (this.keys.up) y -= 1;
    if (this.keys.down) y += 1;
    return { x, y };
  }

  packet() {
    const v = this.vector();
    const dash = this.dashQueued;
    this.dashQueued = false;
    this.seq += 1;
    const p = { t: 'in', x: v.x, y: v.y, a: this.keys.attack || this.mouseAttack, d: dash, s: this.seq };
    if (this.slotRequest !== null) {
      p.slot = this.slotRequest;
      this.slotRequest = null;
    }
    if (this.aimX !== null && this.aimY !== null) {
      p.ax = Math.round(this.aimX * 1000) / 1000;
      p.ay = Math.round(this.aimY * 1000) / 1000;
    }
    return p;
  }
}
