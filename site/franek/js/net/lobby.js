(function () {
  window.ZFG = window.ZFG || {};

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function savedName() {
    try {
      return localStorage.getItem('zfg.name') || '';
    } catch (err) {
      return '';
    }
  }

  function saveName(name) {
    try {
      localStorage.setItem('zfg.name', name);
    } catch (err) {
      /* noop */
    }
  }

  class Lobby {
    constructor(container, options) {
      this.container = container;
      this.options = options || {};
      this.game = this.options.game;
      this.onReady = this.options.onReady || function () {};
      this.onClosed = this.options.onClosed || function () {};
      this.room = null;
      this._renderStart();
    }

    _renderStart() {
      var self = this;
      this.container.innerHTML = '';

      var card = el('div', 'lobby__card');
      card.appendChild(el('h2', 'lobby__title', 'Gra online: ' + (this.game ? this.game.name : '')));
      card.appendChild(el('p', 'lobby__subtitle', 'Utwórz pokój i podaj kod znajomym albo dołącz do istniejącego.'));

      var nameRow = el('label', 'lobby__field');
      nameRow.appendChild(el('span', 'lobby__label', 'Twoja nazwa'));
      var nameInput = el('input', 'input');
      nameInput.type = 'text';
      nameInput.maxLength = 16;
      nameInput.placeholder = 'Gracz';
      nameInput.value = savedName();
      nameRow.appendChild(nameInput);
      card.appendChild(nameRow);

      var createBtn = el('button', 'btn btn--primary btn--block', 'Utwórz pokój');
      card.appendChild(createBtn);

      var divider = el('div', 'lobby__divider');
      divider.appendChild(el('span', null, 'albo dołącz kodem'));
      card.appendChild(divider);

      var joinRow = el('div', 'lobby__join');
      var codeInput = el('input', 'input input--code');
      codeInput.type = 'text';
      codeInput.inputMode = 'numeric';
      codeInput.maxLength = 4;
      codeInput.placeholder = '0000';
      var joinBtn = el('button', 'btn', 'Dołącz');
      joinRow.appendChild(codeInput);
      joinRow.appendChild(joinBtn);
      card.appendChild(joinRow);

      var error = el('p', 'lobby__error hidden');
      card.appendChild(error);

      var status = el('p', 'lobby__status hidden');
      card.appendChild(status);

      this.container.appendChild(card);

      function getName() {
        var value = nameInput.value.trim();
        if (!value) value = 'Gracz';
        saveName(value);
        return value;
      }

      function setBusy(busy, message) {
        createBtn.disabled = busy;
        joinBtn.disabled = busy;
        codeInput.disabled = busy;
        nameInput.disabled = busy;
        error.classList.add('hidden');
        if (busy && message) {
          status.textContent = message;
          status.classList.remove('hidden');
        } else {
          status.classList.add('hidden');
        }
      }

      function fail(err) {
        setBusy(false);
        error.textContent = err && err.message ? err.message : String(err);
        error.classList.remove('hidden');
      }

      createBtn.addEventListener('click', function () {
        setBusy(true, 'Tworzę pokój...');
        ZFG.Room.connect(self.game.id)
          .then(function (room) {
            return room.create(getName()).then(function () {
              self._enter(room);
            });
          })
          .catch(fail);
      });

      function doJoin() {
        var code = codeInput.value.replace(/\D/g, '');
        if (code.length !== 4) {
          fail(new Error('Kod pokoju ma 4 cyfry.'));
          return;
        }
        setBusy(true, 'Dołączam do pokoju...');
        ZFG.Room.connect(self.game.id)
          .then(function (room) {
            return room.join(code, getName()).then(function () {
              self._enter(room);
            });
          })
          .catch(fail);
      }

      joinBtn.addEventListener('click', doJoin);
      codeInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') doJoin();
      });
      nameInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') createBtn.click();
      });
      codeInput.addEventListener('input', function () {
        codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 4);
      });
    }

    _enter(room) {
      var self = this;
      this.room = room;

      room.on('players', function () {
        self._renderWaiting();
      });
      room.on('started', function () {
        self.container.innerHTML = '';
        self.onReady(room);
      });
      room.on('closed', function (data) {
        room.leave();
        self.container.innerHTML = '';
        var card = el('div', 'lobby__card');
        card.appendChild(el('h2', 'lobby__title', 'Pokój zamknięty'));
        card.appendChild(el('p', 'lobby__subtitle', data.reason || 'Host opuścił pokój.'));
        var again = el('button', 'btn btn--primary', 'Nowy pokój');
        again.addEventListener('click', function () {
          self._renderStart();
        });
        card.appendChild(again);
        self.container.appendChild(card);
        self.onClosed(data);
      });

      this._renderWaiting();
    }

    _renderWaiting() {
      var self = this;
      var room = this.room;
      this.container.innerHTML = '';

      var card = el('div', 'lobby__card');
      card.appendChild(el('h2', 'lobby__title', 'Lobby'));

      var codeBox = el('div', 'code-display');
      codeBox.appendChild(el('span', 'code-display__label', 'Kod pokoju'));
      codeBox.appendChild(el('span', 'code-display__value', room.code));
      card.appendChild(codeBox);
      card.appendChild(el('p', 'lobby__hint', 'Podaj ten kod drugiemu graczowi.'));

      var list = el('div', 'lobby__players');
      room.players.forEach(function (player) {
        var chip = el('div', 'player-chip');
        if (player.id === room.hostId) chip.classList.add('player-chip--host');
        if (player.id === room.playerId) chip.classList.add('player-chip--me');
        chip.appendChild(el('span', 'player-chip__name', player.name));
        if (player.id === room.hostId) chip.appendChild(el('span', 'player-chip__tag', 'host'));
        if (player.id === room.playerId) chip.appendChild(el('span', 'player-chip__tag', 'Ty'));
        list.appendChild(chip);
      });
      card.appendChild(list);

      if (room.isHost) {
        var startBtn = el('button', 'btn btn--primary btn--block', 'Start gry');
        startBtn.disabled = room.players.length < 2;
        startBtn.addEventListener('click', function () {
          room.start();
        });
        card.appendChild(startBtn);

        if (room.players.length < 2) {
          card.appendChild(el('p', 'lobby__hint', 'Czekam na drugiego gracza...'));
        }
      } else {
        card.appendChild(el('p', 'lobby__hint', 'Czekam, aż host rozpocznie grę...'));
      }

      var leave = el('button', 'btn btn--ghost btn--block', 'Opuść pokój');
      leave.addEventListener('click', function () {
        room.leave();
        self._renderStart();
      });
      card.appendChild(leave);

      this.container.appendChild(card);
    }

    destroy() {
      if (this.room) this.room.leave();
    }
  }

  ZFG.Lobby = Lobby;
  ZFG.createLobby = function (container, options) {
    return new Lobby(container, options);
  };
})();
