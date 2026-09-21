(function () {
  window.ZFG = window.ZFG || {};
  ZFG.games = ZFG.games || {};

  var LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  class TicTacToe extends ZFG.Game {
    constructor(container, opts) {
      opts = opts || {};
      opts.id = 'tictactoe';
      super(container, opts);

      this.statusEl = opts.status || null;
      this.room = null;
      this.mySymbol = 'X';
      this.opponentName = 'Przeciwnik';
      this.turn = 'X';
      this.board = ['', '', '', '', '', '', '', '', ''];
      this.moveCount = 0;
      this.over = false;
      this.wins = ZFG.Storage.get('ttt.wins', 0);
      this.boardEl = document.createElement('div');
      this.boardEl.className = 'ttt-board';
      this.container.insertBefore(this.boardEl, this.overlay);
      this.cells = [];
    }

    attach(room) {
      var self = this;
      this.room = room;
      this.mySymbol = room.isHost ? 'X' : 'O';

      var opponent = room.players.filter(function (player) {
        return player.id !== room.playerId;
      })[0];
      this.opponentName = opponent ? opponent.name : 'Przeciwnik';

      room.on('event', function (message) { self.handleEvent(message); });
      room.on('closed', function (data) {
        self.stop();
        self.showOverlay({
          title: 'Pokój zamknięty',
          text: data.reason || 'Drugi gracz wyszedł.',
          actions: [{ label: 'Zagraj ponownie', primary: true, onClick: function () { window.location.reload(); } }]
        });
      });
    }

    init() {
      this.renderBoard();
      this.resetGame();
      this.updateHud();
    }

    renderBoard() {
      var self = this;
      this.boardEl.innerHTML = '';
      this.cells = [];
      for (var i = 0; i < 9; i++) {
        (function (index) {
          var cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'ttt-cell';
          cell.addEventListener('click', function () { self.play(index); });
          self.cells.push(cell);
          self.boardEl.appendChild(cell);
        })(i);
      }
    }

    _start() {
      this.resetGame();
    }

    resetGame() {
      this.board = ['', '', '', '', '', '', '', '', ''];
      this.turn = 'X';
      this.moveCount = 0;
      this.over = false;
      this.winningLine = null;
      this.hideOverlay();
      this.paint();
      this.updateHud();
    }

    paint() {
      for (var i = 0; i < 9; i++) {
        var value = this.board[i];
        var cell = this.cells[i];
        cell.textContent = value === 'X' ? '✕' : value === 'O' ? '◯' : '';
        cell.classList.toggle('ttt-cell--x', value === 'X');
        cell.classList.toggle('ttt-cell--o', value === 'O');
        cell.classList.toggle('ttt-cell--win', this.winningLine && this.winningLine.indexOf(i) >= 0);
        cell.disabled = !!value || this.over;
      }
    }

    play(index) {
      if (!this.running || this.over) return;
      if (this.board[index]) return;
      if (this.turn !== this.mySymbol) return;

      this.applyMove(index, this.mySymbol);
      this.room.sendEvent('move', { index: index, symbol: this.mySymbol });
    }

    applyMove(index, symbol) {
      if (this.board[index]) return;
      this.board[index] = symbol;
      this.moveCount++;

      var winner = this.findWinner();
      if (winner) {
        this.winningLine = winner.line;
        this.finish(winner.symbol);
        return;
      }
      if (this.moveCount === 9) {
        this.finish(null);
        return;
      }
      this.turn = this.turn === 'X' ? 'O' : 'X';
      this.paint();
      this.updateHud();
    }

    findWinner() {
      for (var i = 0; i < LINES.length; i++) {
        var line = LINES[i];
        var a = this.board[line[0]];
        if (a && a === this.board[line[1]] && a === this.board[line[2]]) {
          return { symbol: a, line: line };
        }
      }
      return null;
    }

    finish(symbol) {
      this.over = true;
      this.paint();

      if (symbol === this.mySymbol) {
        this.wins++;
        ZFG.Storage.set('ttt.wins', this.wins);
      }
      this.updateHud();

      var title;
      if (!symbol) title = 'Remis!';
      else if (symbol === this.mySymbol) title = 'Wygrałeś!';
      else title = 'Przegrałeś';

      var text = symbol ? 'Wygrywa: ' + symbol : 'Nikt nie wygrał.';

      if (this.room.isHost) {
        this.showOverlay({
          title: title,
          text: text,
          actions: [{
            label: 'Zagraj ponownie',
            primary: true,
            onClick: () => {
              this.resetGame();
              this.room.sendEvent('restart');
            }
          }]
        });
      } else {
        this.showOverlay({
          title: title,
          text: text + ' Czekam, aż host rozpocznie kolejną grę...'
        });
      }
    }

    handleEvent(message) {
      if (!message) return;
      if (message.type === 'move') {
        if (message.data) this.applyMove(message.data.index, message.data.symbol);
      } else if (message.type === 'restart') {
        this.resetGame();
      }
    }

    updateHud() {
      if (this.hudEl) {
        this.hudEl.innerHTML = '';
        this.hudEl.appendChild(this.stat('Ty (' + this.mySymbol + ')', this.wins));
        this.hudEl.appendChild(this.stat('Ruch', this.turn === this.mySymbol ? 'Twój' : 'Przeciwnik'));
      }
      if (this.statusEl) {
        if (this.over) this.statusEl.textContent = 'Koniec rundy.';
        else this.statusEl.textContent = this.turn === this.mySymbol ? 'Twoja kolej' : 'Kolej: ' + this.opponentName;
      }
    }
  }

  ZFG.games.TicTacToe = TicTacToe;
})();
