const SESSION_KEY = 'orlywro.session';

export class Net {
  constructor({ onMessage, onStatus }) {
    this.onMessage = onMessage;
    this.onStatus = onStatus || (() => {});
    this.ws = null;
    this.session = Net.loadSession();
    this.attempts = 0;
    this.maxAttempts = 5;
    this.autoReconnect = false;
    this.timer = null;
  }

  static loadSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  }
  static saveSession(s) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }
  static clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  }

  setSession(s) { this.session = s; Net.saveSession(s); }
  getSession() { return this.session; }

  wsUrl(ticket) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws?ticket=${encodeURIComponent(ticket)}`;
  }

  connect(ticket) {
    this.autoReconnect = true;
    this.attempts = 0;
    this.open(ticket);
  }

  open(ticket) {
    this._closeSocket();
    this.onStatus('connecting');
    let ws;
    try { ws = new WebSocket(this.wsUrl(ticket)); } catch { this.scheduleReconnect(); return; }
    this.ws = ws;
    ws.onopen = () => { this.attempts = 0; this.onStatus('open'); };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      this.onMessage(msg);
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      if (this.autoReconnect) this.scheduleReconnect();
    };
    ws.onerror = () => { /* handled by onclose */ };
  }

  _closeSocket() {
    if (!this.ws) return;
    const ws = this.ws;
    this.ws = null;
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
    try { ws.close(); } catch { /* ignore */ }
  }

  disconnect() {
    this.autoReconnect = false;
    this.attempts = 0;
    clearTimeout(this.timer);
    this.timer = null;
    this._closeSocket();
  }

  scheduleReconnect() {
    if (!this.session) return;
    if (this.attempts >= this.maxAttempts) {
      this.onStatus('failed');
      return;
    }
    const delay = 1000 * Math.pow(2, this.attempts);
    this.attempts += 1;
    this.onStatus('reconnecting', { attempt: this.attempts, delay });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.tryRejoin(), delay);
  }

  async tryRejoin() {
    const s = this.session;
    if (!s) return;
    try {
      const res = await fetch('/api/rejoin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: s.code, playerId: s.playerId, token: s.token }),
      });
      if (!res.ok) throw new Error('rejoin failed');
      const data = await res.json();
      this.open(data.ticket);
    } catch {
      this.scheduleReconnect();
    }
  }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) {
      try { this.ws.send(JSON.stringify(obj)); } catch { /* ignore */ }
    }
  }
}
