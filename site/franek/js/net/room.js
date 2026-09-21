(function () {
  window.ZFG = window.ZFG || {};

  class Room {
    constructor(gameId) {
      this.gameId = gameId;
      this.code = null;
      this.playerId = null;
      this.players = [];
      this.hostId = null;
      this.isHost = false;
      this.started = false;
      this.handlers = {};
      this._bind();
    }

    static connect(gameId) {
      return ZFG.Net.connect().then(function () {
        return new Room(gameId);
      });
    }

    _bind() {
      var self = this;
      this._onPlayers = function (data) {
        self.players = data.players || [];
        self.hostId = data.hostId;
        self.isHost = self.hostId === self.playerId;
        self._fire('players', data);
      };
      this._onStarted = function () {
        self.started = true;
        self._fire('started');
      };
      this._onClosed = function (data) {
        self._fire('closed', data || { reason: 'Pokój został zamknięty.' });
      };
      this._onState = function (data) {
        self._fire('state', data);
      };
      this._onEvent = function (data) {
        self._fire('event', data);
      };
      ZFG.Net.on('room:players', this._onPlayers);
      ZFG.Net.on('room:started', this._onStarted);
      ZFG.Net.on('room:closed', this._onClosed);
      ZFG.Net.on('game:state', this._onState);
      ZFG.Net.on('game:event', this._onEvent);
    }

    _fire(type, data) {
      var list = this.handlers[type] || [];
      list.forEach(function (handler) {
        handler(data);
      });
    }

    on(type, handler) {
      (this.handlers[type] = this.handlers[type] || []).push(handler);
      return this;
    }

    create(name) {
      var self = this;
      return ZFG.Net.request('room:create', { game: this.gameId, name: name }).then(function (res) {
        if (!res.ok) throw new Error(res.error || 'Nie udało się utworzyć pokoju.');
        self.code = res.code;
        self.playerId = res.playerId;
        self.players = res.players || [];
        self.hostId = res.hostId;
        self.isHost = true;
        return self;
      });
    }

    join(code, name) {
      var self = this;
      return ZFG.Net.request('room:join', { code: code, name: name }).then(function (res) {
        if (!res.ok) throw new Error(res.error || 'Nie udało się dołączyć do pokoju.');
        self.code = res.code;
        self.playerId = res.playerId;
        self.players = res.players || [];
        self.hostId = res.hostId;
        self.isHost = self.hostId === self.playerId;
        return self;
      });
    }

    start() {
      ZFG.Net.emit('room:start', {});
    }

    sendState(state) {
      if (!this.code) return;
      ZFG.Net.emit('game:state', { code: this.code, state: state });
    }

    sendEvent(type, data) {
      if (!this.code) return;
      ZFG.Net.emit('game:event', { code: this.code, type: type, data: data });
    }

    leave() {
      if (this.code) ZFG.Net.emit('room:leave', {});
      ZFG.Net.off('room:players', this._onPlayers);
      ZFG.Net.off('room:started', this._onStarted);
      ZFG.Net.off('room:closed', this._onClosed);
      ZFG.Net.off('game:state', this._onState);
      ZFG.Net.off('game:event', this._onEvent);
      this.code = null;
    }

    playerName(id) {
      for (var i = 0; i < this.players.length; i++) {
        if (this.players[i].id === id) return this.players[i].name;
      }
      return 'Gracz';
    }
  }

  ZFG.Room = Room;
})();
