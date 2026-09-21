(function () {
  window.ZFG = window.ZFG || {};
  ZFG.games = ZFG.games || {};

  function createGame() {
    return {
      stock: [],
      waste: [],
      foundations: [[], [], [], []],
      tableau: [[], [], [], [], [], [], []]
    };
  }

  class Klondike extends ZFG.Game {
    constructor(container, opts) {
      opts = opts || {};
      opts.id = 'klondike';
      super(container, opts);

      this.statusEl = opts.status || null;
      this.drawCount = 3;
      this.state = createGame();
      this.selection = null;
      this.undoStack = [];
      this.moves = 0;
      this.elapsed = 0;
      this.timer = null;

      this.board = document.createElement('div');
      this.board.className = 'soli-board';
      this.board.style.setProperty('--card-w', '78px');
      this.board.style.setProperty('--card-h', '108px');
      this.board.style.setProperty('--fd', '15px');
      this.board.style.setProperty('--fu', '29px');
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

    newGame() {
      var deck = ZFG.cards.shuffle(ZFG.cards.createDeck(1));
      var state = createGame();

      for (var col = 0; col < 7; col++) {
        for (var n = 0; n <= col; n++) {
          var card = deck.pop();
          card.faceUp = n === col;
          state.tableau[col].push(card);
        }
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

    setDrawCount(count) {
      this.drawCount = count;
    }

    isSelected(pile, index, cardIndex) {
      var s = this.selection;
      return !!s && s.pile === pile && s.index === index && s.cardIndex === cardIndex;
    }

    render() {
      this.board.innerHTML = '';

      var top = document.createElement('div');
      top.className = 'soli-top';
      top.appendChild(this.buildStock());
      top.appendChild(this.buildWaste());
      var gap = document.createElement('div');
      gap.className = 'soli-spacer';
      top.appendChild(gap);
      var foundations = document.createElement('div');
      foundations.className = 'soli-foundations';
      for (var f = 0; f < 4; f++) foundations.appendChild(this.buildFoundation(f));
      top.appendChild(foundations);
      this.board.appendChild(top);

      var tableau = document.createElement('div');
      tableau.className = 'soli-tableau';
      for (var col = 0; col < 7; col++) tableau.appendChild(this.buildColumn(col));
      this.board.appendChild(tableau);
    }

    buildStock() {
      var pile = document.createElement('div');
      pile.className = 'soli-pile soli-stock';
      pile.setAttribute('data-pile', 'stock');
      pile.setAttribute('data-index', '0');

      if (this.state.stock.length) {
        var back = ZFG.cards.element(this.state.stock[this.state.stock.length - 1], false);
        back.classList.add('is-stacked');
        pile.appendChild(back);
      } else {
        var slot = document.createElement('div');
        slot.className = 'soli-slot soli-slot--recycle';
        slot.textContent = '↺';
        pile.appendChild(slot);
      }
      return pile;
    }

    buildWaste() {
      var pile = document.createElement('div');
      pile.className = 'soli-pile soli-waste';
      pile.setAttribute('data-pile', 'waste');
      pile.setAttribute('data-index', '0');

      var waste = this.state.waste;
      var start = Math.max(0, waste.length - 3);
      for (var i = start; i < waste.length; i++) {
        var card = ZFG.cards.element(waste[i], true);
        card.setAttribute('data-card', i);
        card.style.left = ((i - start) * 18) + 'px';
        card.style.zIndex = i;
        if (this.isSelected('waste', 0, i)) card.classList.add('is-selected');
        pile.appendChild(card);
      }
      if (!waste.length) {
        var slot = document.createElement('div');
        slot.className = 'soli-slot';
        pile.appendChild(slot);
      }
      return pile;
    }

    buildFoundation(index) {
      var pile = document.createElement('div');
      pile.className = 'soli-pile soli-foundation';
      pile.setAttribute('data-pile', 'foundation');
      pile.setAttribute('data-index', index);

      var cards = this.state.foundations[index];
      if (cards.length) {
        var card = ZFG.cards.element(cards[cards.length - 1], true);
        card.setAttribute('data-card', cards.length - 1);
        if (this.isSelected('foundation', index, cards.length - 1)) card.classList.add('is-selected');
        pile.appendChild(card);
      } else {
        var slot = document.createElement('div');
        slot.className = 'soli-slot';
        slot.textContent = ZFG.cards.SUITS[index].symbol;
        pile.appendChild(slot);
      }
      return pile;
    }

    buildColumn(index) {
      var column = document.createElement('div');
      column.className = 'soli-column';
      column.setAttribute('data-pile', 'tableau');
      column.setAttribute('data-index', index);

      var cards = this.state.tableau[index];
      var y = 0;
      for (var i = 0; i < cards.length; i++) {
        var card = ZFG.cards.element(cards[i], cards[i].faceUp);
        card.setAttribute('data-card', i);
        card.style.top = y + 'px';
        card.style.zIndex = i;
        if (this.isSelected('tableau', index, i)) card.classList.add('is-selected');
        column.appendChild(card);
        y += cards[i].faceUp ? 29 : 15;
      }
      column.style.minHeight = (y + 108) + 'px';
      return column;
    }

    updateHud() {
      if (this.hudEl) {
        var done = 0;
        this.state.foundations.forEach(function (pile) { done += pile.length; });
        this.hudEl.innerHTML = '';
        this.hudEl.appendChild(this.stat('Ruchy', this.moves));
        this.hudEl.appendChild(this.stat('Czas', this.formatTime()));
        this.hudEl.appendChild(this.stat('Ułożone', done + '/52'));
      }
      if (this.statusEl) {
        this.statusEl.textContent = this.selection ? 'Wybrano karty — kliknij miejsce docelowe' : 'Kliknij kartę, aby ją wybrać';
      }
    }

    formatTime() {
      var m = Math.floor(this.elapsed / 60);
      var s = this.elapsed % 60;
      return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    validRun(column, ci) {
      var cards = this.state.tableau[column];
      for (var i = ci; i < cards.length; i++) {
        if (!cards[i].faceUp) return false;
        if (i > ci) {
          if (cards[i - 1].rank !== cards[i].rank + 1) return false;
          if (ZFG.cards.isRed(cards[i - 1]) === ZFG.cards.isRed(cards[i])) return false;
        }
      }
      return true;
    }

    select(pile, index, cardIndex) {
      if (pile === 'waste') {
        if (index >= 0 && cardIndex === this.state.waste.length - 1) {
          this.selection = { pile: 'waste', index: 0, cardIndex: cardIndex };
          return true;
        }
        return false;
      }
      if (pile === 'foundation') {
        var cards = this.state.foundations[index];
        if (cards.length && cardIndex === cards.length - 1) {
          this.selection = { pile: 'foundation', index: index, cardIndex: cardIndex };
          return true;
        }
        return false;
      }
      if (pile === 'tableau') {
        if (cardIndex < 0) return false;
        var column = this.state.tableau[index];
        if (!column[cardIndex] || !column[cardIndex].faceUp) return false;
        if (!this.validRun(index, cardIndex)) return false;
        this.selection = { pile: 'tableau', index: index, cardIndex: cardIndex };
        return true;
      }
      return false;
    }

    selectedCards() {
      var s = this.selection;
      if (!s) return null;
      if (s.pile === 'waste') return [this.state.waste[this.state.waste.length - 1]];
      if (s.pile === 'foundation') {
        var f = this.state.foundations[s.index];
        return [f[f.length - 1]];
      }
      var col = this.state.tableau[s.index];
      return col.slice(s.cardIndex);
    }

    removeSelected() {
      var s = this.selection;
      var cards;
      if (s.pile === 'waste') {
        cards = [this.state.waste.pop()];
      } else if (s.pile === 'foundation') {
        cards = [this.state.foundations[s.index].pop()];
      } else {
        var col = this.state.tableau[s.index];
        cards = col.splice(s.cardIndex);
      }
      this.selection = null;
      return cards;
    }

    canPlaceFoundation(cards, index) {
      if (cards.length !== 1) return false;
      var card = cards[0];
      var pile = this.state.foundations[index];
      if (!pile.length) return card.rank === 1;
      var top = pile[pile.length - 1];
      return top.suit === card.suit && card.rank === top.rank + 1;
    }

    canPlaceTableau(cards, index) {
      var card = cards[0];
      var column = this.state.tableau[index];
      if (!column.length) return card.rank === 13;
      var top = column[column.length - 1];
      if (!top.faceUp) return false;
      return card.rank === top.rank - 1 && ZFG.cards.isRed(card) !== ZFG.cards.isRed(top);
    }

    tryMoveTo(pile, index) {
      if (!this.selection) return false;
      if (pile === 'foundation') {
        var cards = this.selectedCards();
        if (!cards || !this.canPlaceFoundation(cards, index)) return false;
        this.snapshot();
        var moved = this.removeSelected();
        this.state.foundations[index].push(moved[0]);
        this.afterMove();
        return true;
      }
      if (pile === 'tableau') {
        var run = this.selectedCards();
        if (!run || !this.canPlaceTableau(run, index)) return false;
        if (this.selection.pile === 'tableau' && this.selection.index === index) return false;
        this.snapshot();
        var movedRun = this.removeSelected();
        Array.prototype.push.apply(this.state.tableau[index], movedRun);
        this.afterMove();
        return true;
      }
      return false;
    }

    afterMove() {
      for (var col = 0; col < 7; col++) {
        var column = this.state.tableau[col];
        if (column.length && !column[column.length - 1].faceUp) {
          column[column.length - 1].faceUp = true;
        }
      }
      this.moves++;
      this.render();
      this.updateHud();
      this.checkWin();
    }

    draw() {
      this.selection = null;
      if (this.state.stock.length) {
        this.snapshot();
        var count = Math.min(this.drawCount, this.state.stock.length);
        for (var i = 0; i < count; i++) {
          var card = this.state.stock.pop();
          card.faceUp = true;
          this.state.waste.push(card);
        }
        this.moves++;
      } else if (this.state.waste.length) {
        this.snapshot();
        while (this.state.waste.length) {
          var c = this.state.waste.pop();
          c.faceUp = false;
          this.state.stock.push(c);
        }
        this.moves++;
      } else {
        return;
      }
      this.render();
      this.updateHud();
    }

    autoFoundation(pile, index, cardIndex) {
      var cards = null;
      if (pile === 'tableau') {
        var column = this.state.tableau[index];
        if (cardIndex !== column.length - 1 || !column[cardIndex].faceUp) return false;
        cards = [column[cardIndex]];
      } else if (pile === 'waste') {
        if (cardIndex !== this.state.waste.length - 1) return false;
        cards = [this.state.waste[cardIndex]];
      } else {
        return false;
      }

      for (var f = 0; f < 4; f++) {
        if (this.canPlaceFoundation(cards, f)) {
          this.selection = { pile: pile, index: index, cardIndex: cardIndex };
          return this.tryMoveTo('foundation', f);
        }
      }
      return false;
    }

    checkWin() {
      var done = this.state.foundations.reduce(function (sum, pile) { return sum + pile.length; }, 0);
      if (done !== 52) return;
      clearInterval(this.timer);
      this.over = true;
      this.showOverlay({
        title: 'Brawo, ułożone!',
        text: 'Ruchy: ' + this.moves + ' · Czas: ' + this.formatTime(),
        actions: [{ label: 'Nowa gra', primary: true, onClick: () => this.newGame() }]
      });
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
        this.draw();
        return;
      }

      if (this.selection) {
        if (this.isSelected(pile, index, cardIndex)) {
          this.selection = null;
          this.render();
          return;
        }
        if (this.tryMoveTo(pile, index)) return;
      }

      if (this.select(pile, index, cardIndex)) {
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
      var pile = container.getAttribute('data-pile');
      var index = parseInt(container.getAttribute('data-index'), 10) || 0;
      var cardIndex = parseInt(cardEl.getAttribute('data-card'), 10);
      this.autoFoundation(pile, index, cardIndex);
    }
  }

  ZFG.games.Klondike = Klondike;
})();
