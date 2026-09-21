(function () {
  window.ZFG = window.ZFG || {};
  ZFG.games = ZFG.games || {};

  var FBI = 12;
  var FUI = 24;
  var CARD_H = 88;

  function emptyState() {
    var columns = [];
    for (var i = 0; i < 10; i++) columns.push([]);
    return { columns: columns, stock: [], completed: 0 };
  }

  class Spider extends ZFG.Game {
    constructor(container, opts) {
      opts = opts || {};
      opts.id = 'spider';
      super(container, opts);

      this.statusEl = opts.status || null;
      this.suitCount = 1;
      this.state = emptyState();
      this.selection = null;
      this.undoStack = [];
      this.moves = 0;
      this.elapsed = 0;
      this.timer = null;

      this.board = document.createElement('div');
      this.board.className = 'soli-board spider-board';
      this.board.style.setProperty('--card-w', '62px');
      this.board.style.setProperty('--card-h', '88px');
    }

    init() {
      this.container.classList.add('game-stage--board');
      this.container.insertBefore(this.board, this.overlay);

      this._onClick = this._onClick.bind(this);
      this._onDouble = this._onDouble.bind(this);
      this.board.addEventListener('click', this._onClick);
      this.board.addEventListener('dblclick', this._onDouble);
    }

    _destroy() {
      this.board.removeEventListener('click', this._onClick);
      this.board.removeEventListener('dblclick', this._onDouble);
    }

    _start() {
      this.newGame();
    }

    _stop() {
      clearInterval(this.timer);
      this.timer = null;
    }

    _pause() {
      clearInterval(this.timer);
      this.timer = null;
      this.showOverlay({
        title: 'Pauza',
        text: 'Ruchy: ' + this.moves,
        actions: [{ label: 'Wznów', primary: true, onClick: () => this.resume() }]
      });
    }

    _resume() {
      this.startTimer();
    }

    _restart() {
      this.stop();
      this.start();
    }

    setSuits(count) {
      if (this.suitCount === count) return;
      this.suitCount = count;
      this.newGame();
    }

    newGame() {
      var suitIds = this.suitCount === 1 ? ['S']
        : this.suitCount === 2 ? ['S', 'H']
          : ['S', 'H', 'D', 'C'];
      var copies = 104 / (suitIds.length * 13);
      var deck = ZFG.cards.shuffle(ZFG.cards.createDeck(copies, suitIds));
      var state = emptyState();

      for (var col = 0; col < 10; col++) {
        var count = col < 4 ? 6 : 5;
        for (var n = 0; n < count; n++) {
          state.columns[col].push(deck.pop());
        }
        state.columns[col][state.columns[col].length - 1].faceUp = true;
      }
      state.stock = deck;

      this.state = state;
      this.selection = null;
      this.undoStack = [];
      this.moves = 0;
      this.elapsed = 0;
      this.over = false;
      this.startTimer();
      this.hideOverlay();
      this.render();
      this.updateHud();
    }

    snapshot() {
      this.undoStack.push(JSON.stringify(this.state));
      if (this.undoStack.length > 200) this.undoStack.shift();
    }

    undo() {
      if (!this.undoStack.length) return;
      this.state = JSON.parse(this.undoStack.pop());
      this.selection = null;
      this.moves = Math.max(0, this.moves - 1);
      this.render();
      this.updateHud();
    }

    startTimer() {
      var self = this;
      clearInterval(this.timer);
      this.timer = setInterval(function () {
        self.elapsed++;
        self.updateHud();
      }, 1000);
    }

    isSelected(column, cardIndex) {
      var s = this.selection;
      return !!s && s.index === column && s.cardIndex === cardIndex;
    }

    render() {
      this.board.innerHTML = '';

      var top = document.createElement('div');
      top.className = 'spider-top';
      top.appendChild(this.buildStock());
      var info = document.createElement('div');
      info.className = 'spider-info';
      info.textContent = 'Ułożone sekwencje: ' + this.state.completed + '/8';
      top.appendChild(info);
      this.board.appendChild(top);

      var row = document.createElement('div');
      row.className = 'spider-columns';
      for (var col = 0; col < 10; col++) row.appendChild(this.buildColumn(col));
      this.board.appendChild(row);
    }

    buildStock() {
      var pile = document.createElement('div');
      pile.className = 'soli-pile spider-stock';
      pile.setAttribute('data-pile', 'stock');
      pile.setAttribute('data-index', '0');

      if (this.state.stock.length) {
        var back = ZFG.cards.element({ suit: 'S', rank: 1 }, false);
        pile.appendChild(back);
        var badge = document.createElement('span');
        badge.className = 'spider-stock__count';
        badge.textContent = Math.floor(this.state.stock.length / 10) + 'x';
        pile.appendChild(badge);
      } else {
        var slot = document.createElement('div');
        slot.className = 'soli-slot';
        pile.appendChild(slot);
      }
      return pile;
    }

    buildColumn(index) {
      var column = document.createElement('div');
      column.className = 'soli-column spider-column';
      column.setAttribute('data-pile', 'column');
      column.setAttribute('data-index', index);

      var cards = this.state.columns[index];
      var y = 0;
      for (var i = 0; i < cards.length; i++) {
        var card = ZFG.cards.element(cards[i], cards[i].faceUp);
        card.setAttribute('data-card', i);
        card.style.top = y + 'px';
        card.style.zIndex = i;
        if (this.isSelected(index, i)) card.classList.add('is-selected');
        column.appendChild(card);
        y += cards[i].faceUp ? FUI : FBI;
      }
      var height = cards.length ? y - (cards[cards.length - 1].faceUp ? FUI : FBI) + CARD_H : CARD_H;
      column.style.minHeight = height + 'px';
      return column;
    }

    validRun(column, ci) {
      var cards = this.state.columns[column];
      if (!cards[ci]) return false;
      for (var i = ci; i < cards.length; i++) {
        if (!cards[i].faceUp) return false;
        if (i > ci) {
          if (cards[i].suit !== cards[i - 1].suit) return false;
          if (cards[i].rank !== cards[i - 1].rank - 1) return false;
        }
      }
      return true;
    }

    selectedCards() {
      var s = this.selection;
      if (!s) return null;
      return this.state.columns[s.index].slice(s.cardIndex);
    }

    select(column, cardIndex) {
      if (cardIndex < 0) return false;
      var cards = this.state.columns[column];
      if (!cards[cardIndex] || !cards[cardIndex].faceUp) return false;
      if (!this.validRun(column, cardIndex)) return false;
      this.selection = { index: column, cardIndex: cardIndex };
      return true;
    }

    canPlace(cards, column) {
      var pile = this.state.columns[column];
      if (!pile.length) return true;
      var top = pile[pile.length - 1];
      if (!top.faceUp) return false;
      return cards[0].rank === top.rank - 1;
    }

    tryMoveTo(column) {
      if (!this.selection) return false;
      if (this.selection.index === column) return false;
      var run = this.selectedCards();
      if (!run || !this.canPlace(run, column)) return false;

      this.snapshot();
      var from = this.state.columns[this.selection.index];
      from.splice(this.selection.cardIndex);
      Array.prototype.push.apply(this.state.columns[column], run);
      this.selection = null;
      this.moves++;
      this.afterMove();
      return true;
    }

    afterMove() {
      this.flipTops();
      this.checkCompletions();
      this.flipTops();
      this.render();
      this.updateHud();
      this.checkWin();
    }

    flipTops() {
      for (var i = 0; i < 10; i++) {
        var column = this.state.columns[i];
        if (column.length && !column[column.length - 1].faceUp) {
          column[column.length - 1].faceUp = true;
        }
      }
    }

    checkCompletions() {
      var found = true;
      while (found) {
        found = false;
        for (var i = 0; i < 10; i++) {
          var column = this.state.columns[i];
          if (column.length < 13) continue;
          var start = column.length - 13;
          var ok = true;
          for (var n = 0; n < 13; n++) {
            var card = column[start + n];
            if (card.rank !== 13 - n || card.suit !== column[start].suit || !card.faceUp) {
              ok = false;
              break;
            }
          }
          if (ok) {
            column.splice(start, 13);
            this.state.completed++;
            found = true;
            break;
          }
        }
      }
    }

    deal() {
      if (!this.state.stock.length || this.over) return;
      var hasEmpty = this.state.columns.some(function (column) { return column.length === 0; });
      if (hasEmpty) {
        if (this.statusEl) this.statusEl.textContent = 'Najpierw zapełnij puste kolumny!';
        return;
      }
      this.snapshot();
      for (var i = 0; i < 10 && this.state.stock.length; i++) {
        var card = this.state.stock.pop();
        card.faceUp = true;
        this.state.columns[i].push(card);
      }
      this.selection = null;
      this.moves++;
      this.afterMove();
    }

    autoMove(column, cardIndex) {
      var cards = this.state.columns[column];
      if (cardIndex !== cards.length - 1 && !this.validRun(column, cardIndex)) return false;
      var run = cards.slice(cardIndex);

      var sameSuit = -1;
      var empty = -1;
      for (var i = 0; i < 10; i++) {
        if (i === column) continue;
        if (!this.canPlace(run, i)) continue;
        var pile = this.state.columns[i];
        if (pile.length && pile[pile.length - 1].suit === run[0].suit) {
          sameSuit = i;
          break;
        }
        if (!pile.length && empty < 0) empty = i;
      }

      var target = sameSuit >= 0 ? sameSuit : empty;
      if (target < 0) return false;

      this.selection = { index: column, cardIndex: cardIndex };
      return this.tryMoveTo(target);
    }

    checkWin() {
      if (this.state.completed < 8) return;
      clearInterval(this.timer);
      this.over = true;
      this.showOverlay({
        title: 'Brawo, pająk ułożony!',
        text: 'Ruchy: ' + this.moves + ' · Czas: ' + this.formatTime(),
        actions: [{ label: 'Nowa gra', primary: true, onClick: () => this.newGame() }]
      });
    }

    updateHud() {
      if (this.hudEl) {
        this.hudEl.innerHTML = '';
        this.hudEl.appendChild(this.stat('Ruchy', this.moves));
        this.hudEl.appendChild(this.stat('Czas', this.formatTime()));
        this.hudEl.appendChild(this.stat('Sekwencje', this.state.completed + '/8'));
      }
      if (this.statusEl) {
        this.statusEl.textContent = this.selection
          ? 'Wybrano karty — kliknij kolumnę docelową'
          : 'Talia: ' + this.suitCount + (this.suitCount === 1 ? ' kolor' : ' kolory');
      }
    }

    formatTime() {
      var m = Math.floor(this.elapsed / 60);
      var s = this.elapsed % 60;
      return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    _onClick(event) {
      var container = event.target.closest('[data-pile]');
      if (!container) return;
      if (this.paused || this.over) return;

      var pile = container.getAttribute('data-pile');
      var index = parseInt(container.getAttribute('data-index'), 10) || 0;
      var cardEl = event.target.closest('.card');
      var cardIndex = cardEl ? parseInt(cardEl.getAttribute('data-card'), 10) : -1;

      if (pile === 'stock') {
        this.deal();
        return;
      }

      if (this.selection) {
        if (this.isSelected(index, cardIndex)) {
          this.selection = null;
          this.render();
          return;
        }
        if (this.tryMoveTo(index)) return;
      }

      if (this.select(index, cardIndex)) {
        this.render();
        this.updateHud();
      } else {
        this.selection = null;
        this.render();
      }
    }

    _onDouble(event) {
      var cardEl = event.target.closest('.card');
      var container = event.target.closest('[data-pile]');
      if (!cardEl || !container) return;
      if (this.paused || this.over) return;
      if (container.getAttribute('data-pile') !== 'column') return;
      var index = parseInt(container.getAttribute('data-index'), 10) || 0;
      var cardIndex = parseInt(cardEl.getAttribute('data-card'), 10);
      this.autoMove(index, cardIndex);
    }
  }

  ZFG.games.Spider = Spider;
})();
