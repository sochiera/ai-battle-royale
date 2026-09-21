(function () {
  window.ZFG = window.ZFG || {};
  ZFG.games = ZFG.games || {};

  var LEVELS = {
    beginner: { cols: 9, rows: 9, mines: 10, label: 'Początkujący' },
    intermediate: { cols: 16, rows: 16, mines: 40, label: 'Średni' },
    expert: { cols: 30, rows: 16, mines: 99, label: 'Ekspert' }
  };

  function pxSet(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w || 1, h || 1);
  }

  function pixelURL(draw) {
    var canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
    return canvas.toDataURL();
  }

  function drawFlag(ctx) {
    pxSet(ctx, '#000000', 4, 1, 1, 12);
    pxSet(ctx, '#000000', 2, 13, 6, 1);
    pxSet(ctx, '#c00000', 5, 1, 4, 1);
    pxSet(ctx, '#c00000', 5, 2, 3, 1);
    pxSet(ctx, '#c00000', 5, 3, 2, 1);
    pxSet(ctx, '#c00000', 5, 4, 1, 1);
  }

  function drawMine(ctx) {
    pxSet(ctx, '#000000', 7, 1, 2, 4);
    pxSet(ctx, '#000000', 7, 11, 2, 4);
    pxSet(ctx, '#000000', 1, 7, 4, 2);
    pxSet(ctx, '#000000', 11, 7, 4, 2);
    pxSet(ctx, '#000000', 3, 3, 2, 2);
    pxSet(ctx, '#000000', 11, 3, 2, 2);
    pxSet(ctx, '#000000', 3, 11, 2, 2);
    pxSet(ctx, '#000000', 11, 11, 2, 2);
    pxSet(ctx, '#1a1a1a', 5, 5, 6, 6);
    pxSet(ctx, '#1a1a1a', 4, 6, 8, 4);
    pxSet(ctx, '#ffffff', 5, 5, 2, 2);
    pxSet(ctx, '#000000', 7, 7, 2, 2);
  }

  function drawFace(ctx, state) {
    ctx.clearRect(0, 0, 16, 16);

    for (var y = 0; y < 16; y++) {
      for (var x = 0; x < 16; x++) {
        var dx = x - 7.5;
        var dy = y - 7.5;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < 6.2) pxSet(ctx, '#ffff00', x, y);
        else if (d < 7.0) pxSet(ctx, '#000000', x, y);
      }
    }

    if (state === 'dead') {
      pxSet(ctx, '#000000', 4, 5, 2, 1);
      pxSet(ctx, '#000000', 5, 6, 1, 1);
      pxSet(ctx, '#000000', 3, 6, 1, 1);
      pxSet(ctx, '#000000', 10, 5, 2, 1);
      pxSet(ctx, '#000000', 11, 6, 1, 1);
      pxSet(ctx, '#000000', 9, 6, 1, 1);
      pxSet(ctx, '#000000', 5, 10, 6, 1);
      return;
    }

    if (state === 'win') {
      pxSet(ctx, '#000000', 3, 5, 10, 1);
      pxSet(ctx, '#000000', 3, 6, 3, 2);
      pxSet(ctx, '#000000', 10, 6, 3, 2);
      pxSet(ctx, '#ffffff', 4, 6, 1, 1);
      pxSet(ctx, '#ffffff', 11, 6, 1, 1);
      pxSet(ctx, '#000000', 5, 10, 6, 1);
      pxSet(ctx, '#000000', 4, 9, 1, 1);
      pxSet(ctx, '#000000', 11, 9, 1, 1);
      return;
    }

    if (state === 'ooh') {
      pxSet(ctx, '#000000', 5, 6, 2, 2);
      pxSet(ctx, '#000000', 9, 6, 2, 2);
      pxSet(ctx, '#000000', 6, 10, 4, 4);
      pxSet(ctx, '#ffff00', 7, 11, 2, 2);
      return;
    }

    pxSet(ctx, '#000000', 5, 6, 2, 2);
    pxSet(ctx, '#000000', 9, 6, 2, 2);
    pxSet(ctx, '#000000', 4, 9, 1, 1);
    pxSet(ctx, '#000000', 5, 10, 6, 1);
    pxSet(ctx, '#000000', 11, 9, 1, 1);
  }

  function pad(value, size) {
    var text = String(value);
    while (text.length < size) text = '0' + text;
    return text;
  }

  class Minesweeper extends ZFG.Game {
    constructor(container, opts) {
      opts = opts || {};
      opts.id = 'minesweeper';
      super(container, opts);

      this.statusEl = opts.status || null;
      this.level = 'beginner';

      this.panel = document.createElement('div');
      this.panel.className = 'ms-panel';

      this.minesEl = document.createElement('div');
      this.minesEl.className = 'ms-counter';

      this.faceBtn = document.createElement('button');
      this.faceBtn.type = 'button';
      this.faceBtn.className = 'ms-face';
      this.faceBtn.title = 'Nowa gra';
      this.faceCanvas = document.createElement('canvas');
      this.faceCanvas.width = 16;
      this.faceCanvas.height = 16;
      this.faceCanvas.className = 'pixel-icon';
      this.faceCanvas.style.width = '24px';
      this.faceCanvas.style.height = '24px';
      this.faceBtn.appendChild(this.faceCanvas);

      this.timerEl = document.createElement('div');
      this.timerEl.className = 'ms-counter';

      this.panel.appendChild(this.minesEl);
      this.panel.appendChild(this.faceBtn);
      this.panel.appendChild(this.timerEl);

      this.board = document.createElement('div');
      this.board.className = 'ms-board';

      this.assets = null;
      this.cells = [];
      this.buttons = [];
      this.longPress = false;
      this.timer = null;
    }

    init() {
      this.container.insertBefore(this.board, this.overlay);
      this.container.insertBefore(this.panel, this.board);

      this.assets = {
        flag: pixelURL(drawFlag),
        mine: pixelURL(drawMine)
      };

      this.faceCtx = this.faceCanvas.getContext('2d');
      this.faceCtx.imageSmoothingEnabled = false;

      this._onClick = this._onClick.bind(this);
      this._onContext = this._onContext.bind(this);
      this._onDouble = this._onDouble.bind(this);
      this._onTouchStart = this._onTouchStart.bind(this);
      this._onTouchEnd = this._onTouchEnd.bind(this);

      this.board.addEventListener('click', this._onClick);
      this.board.addEventListener('contextmenu', this._onContext);
      this.board.addEventListener('dblclick', this._onDouble);
      this.board.addEventListener('touchstart', this._onTouchStart, { passive: true });
      this.board.addEventListener('touchend', this._onTouchEnd, { passive: true });
      this.faceBtn.addEventListener('click', () => this.newGame());
    }

    _destroy() {
      this.board.removeEventListener('click', this._onClick);
      this.board.removeEventListener('contextmenu', this._onContext);
      this.board.removeEventListener('dblclick', this._onDouble);
      this.board.removeEventListener('touchstart', this._onTouchStart);
      this.board.removeEventListener('touchend', this._onTouchEnd);
    }

    _start() {
      this.newGame();
    }

    _stop() {
      clearInterval(this.timer);
      this.timer = null;
    }

    setLevel(name) {
      if (!LEVELS[name] || this.level === name) return;
      this.level = name;
      this.newGame();
    }

    newGame() {
      var level = LEVELS[this.level];
      this.cols = level.cols;
      this.rows = level.rows;
      this.mineCount = level.mines;

      this.cells = [];
      for (var i = 0; i < this.cols * this.rows; i++) {
        this.cells.push({ mine: false, revealed: false, flagged: false, count: 0 });
      }

      this.placed = false;
      this.revealedCount = 0;
      this.flags = 0;
      this.elapsed = 0;
      this.over = false;
      this.face = 'smile';
      clearInterval(this.timer);
      this.timer = null;

      this.renderBoard();
      this.updateCounter();
      this.updateTimer();
      this.drawFace();
      this.hideOverlay();
      if (this.statusEl) this.statusEl.textContent = 'Grasz: ' + level.label;
      this.updateHud();
    }

    renderBoard() {
      var self = this;
      this.board.innerHTML = '';
      this.board.style.gridTemplateColumns = 'repeat(' + this.cols + ', 20px)';
      this.buttons = [];

      for (var i = 0; i < this.cells.length; i++) {
        (function (index) {
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'ms-cell';
          button.setAttribute('data-index', index);
          self.buttons[index] = button;
          self.board.appendChild(button);
        })(i);
      }
    }

    cellClass(cell) {
      if (cell.flagged) return 'ms-cell ms-cell--flag';
      if (!cell.revealed) return 'ms-cell';
      if (cell.mine) return 'ms-cell ms-cell--open ms-cell--mine';
      if (cell.count > 0) return 'ms-cell ms-cell--open ms-cell--n' + cell.count;
      return 'ms-cell ms-cell--open';
    }

    paint(index) {
      var cell = this.cells[index];
      var button = this.buttons[index];
      button.className = this.cellClass(cell);
      button.textContent = '';
      if (cell.revealed && !cell.mine && cell.count > 0) {
        button.textContent = cell.count;
      }
      if (cell.flagged) {
        button.style.backgroundImage = 'url(' + this.assets.flag + ')';
      } else if (cell.revealed && cell.mine) {
        button.style.backgroundImage = 'url(' + this.assets.mine + ')';
      } else {
        button.style.backgroundImage = '';
      }
    }

    repaint() {
      for (var i = 0; i < this.cells.length; i++) this.paint(i);
    }

    neighbors(index) {
      var r = Math.floor(index / this.cols);
      var c = index % this.cols;
      var result = [];
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          var nr = r + dr;
          var nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= this.rows || nc >= this.cols) continue;
          result.push(nr * this.cols + nc);
        }
      }
      return result;
    }

    placeMines(safeIndex) {
      var safe = {};
      safe[safeIndex] = true;
      this.neighbors(safeIndex).forEach(function (i) { safe[i] = true; });

      var pool = [];
      for (var i = 0; i < this.cells.length; i++) {
        if (!safe[i]) pool.push(i);
      }
      if (pool.length < this.mineCount) {
        pool = [];
        for (var j = 0; j < this.cells.length; j++) {
          if (j !== safeIndex) pool.push(j);
        }
      }

      var self = this;
      for (var m = 0; m < this.mineCount && pool.length; m++) {
        var pick = Math.floor(Math.random() * pool.length);
        var idx = pool.splice(pick, 1)[0];
        this.cells[idx].mine = true;
      }

      for (var k = 0; k < this.cells.length; k++) {
        if (this.cells[k].mine) continue;
        var count = 0;
        this.neighbors(k).forEach(function (n) { if (self.cells[n].mine) count++; });
        this.cells[k].count = count;
      }

      this.placed = true;
    }

    reveal(index) {
      var cell = this.cells[index];
      if (cell.revealed || cell.flagged || this.over) return;

      if (!this.placed) {
        this.placeMines(index);
        this.startTimer();
      }

      if (cell.mine) {
        cell.revealed = true;
        this.lose(index);
        return;
      }

      var stack = [index];
      while (stack.length) {
        var i = stack.pop();
        var current = this.cells[i];
        if (current.revealed || current.flagged || current.mine) continue;
        current.revealed = true;
        this.revealedCount++;
        this.paint(i);
        if (current.count === 0) {
          var self = this;
          this.neighbors(i).forEach(function (n) { stack.push(n); });
        }
      }

      this.checkWin();
    }

    toggleFlag(index) {
      var cell = this.cells[index];
      if (cell.revealed || this.over) return;
      cell.flagged = !cell.flagged;
      this.flags += cell.flagged ? 1 : -1;
      this.paint(index);
      this.updateCounter();
    }

    chord(index) {
      var cell = this.cells[index];
      if (!cell.revealed || cell.count === 0 || this.over) return;
      var self = this;
      var neighbors = this.neighbors(index);
      var flags = neighbors.filter(function (n) { return self.cells[n].flagged; }).length;
      if (flags !== cell.count) return;

      neighbors.forEach(function (n) {
        if (!self.cells[n].flagged && !self.cells[n].revealed) self.reveal(n);
      });
    }

    checkWin() {
      if (this.revealedCount === this.cells.length - this.mineCount) this.win();
    }

    win() {
      this.over = true;
      this.face = 'win';
      this.flags = this.mineCount;
      this.updateCounter();
      this.drawFace();
      this.stopTimer();
      this.saveBest();
      this.showOverlay({
        title: 'Wygrałeś!',
        text: 'Czas: ' + this.elapsed + ' s',
        actions: [{ label: 'Nowa gra', primary: true, onClick: () => this.newGame() }]
      });
    }

    lose(hitIndex) {
      this.over = true;
      this.face = 'dead';
      this.drawFace();
      this.stopTimer();

      for (var i = 0; i < this.cells.length; i++) {
        var cell = this.cells[i];
        if (cell.mine && !cell.flagged) cell.revealed = true;
        if (!cell.mine && cell.flagged) cell.revealed = true;
        this.paint(i);
      }

      if (this.buttons[hitIndex]) {
        this.buttons[hitIndex].style.backgroundColor = '#ff0000';
      }

      this.showOverlay({
        title: 'Trafiłeś minę!',
        text: 'Spróbuj jeszcze raz.',
        actions: [{ label: 'Nowa gra', primary: true, onClick: () => this.newGame() }]
      });
    }

    startTimer() {
      var self = this;
      clearInterval(this.timer);
      this.timer = setInterval(function () {
        self.elapsed++;
        self.updateTimer();
      }, 1000);
    }

    stopTimer() {
      clearInterval(this.timer);
      this.timer = null;
    }

    updateCounter() {
      var remaining = this.mineCount - this.flags;
      if (remaining < 0) {
        this.minesEl.textContent = '-' + pad(Math.min(99, Math.abs(remaining)), 2);
      } else {
        this.minesEl.textContent = pad(Math.min(999, remaining), 3);
      }
    }

    updateTimer() {
      this.timerEl.textContent = pad(Math.min(999, this.elapsed), 3);
    }

    drawFace() {
      drawFace(this.faceCtx, this.face);
      this.updateHud();
    }

    updateHud() {
      if (!this.hudEl) return;
      this.hudEl.innerHTML = '';
      this.hudEl.appendChild(this.stat('Poziom', LEVELS[this.level].label));
      this.hudEl.appendChild(this.stat('Czas', this.elapsed));
      this.hudEl.appendChild(this.stat('Pola', this.revealedCount + '/' + (this.cells.length - this.mineCount)));
    }

    _onClick(event) {
      var button = event.target.closest('.ms-cell');
      if (!button) return;
      if (this.longPress) {
        this.longPress = false;
        return;
      }
      if (this.paused || this.over) return;
      this.reveal(parseInt(button.getAttribute('data-index'), 10));
    }

    _onContext(event) {
      var button = event.target.closest('.ms-cell');
      if (!button) return;
      event.preventDefault();
      if (this.paused || this.over) return;
      this.toggleFlag(parseInt(button.getAttribute('data-index'), 10));
    }

    _onDouble(event) {
      var button = event.target.closest('.ms-cell');
      if (!button) return;
      if (this.paused || this.over) return;
      this.chord(parseInt(button.getAttribute('data-index'), 10));
    }

    _onTouchStart(event) {
      var button = event.target.closest('.ms-cell');
      if (!button) return;
      var self = this;
      this.touchIndex = parseInt(button.getAttribute('data-index'), 10);
      this.longPress = false;
      clearTimeout(this.pressTimer);
      this.pressTimer = setTimeout(function () {
        self.longPress = true;
        if (!self.over) self.toggleFlag(self.touchIndex);
      }, 450);
    }

    _onTouchEnd() {
      clearTimeout(this.pressTimer);
    }
  }

  ZFG.games.Minesweeper = Minesweeper;
})();
