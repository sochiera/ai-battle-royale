(function () {
  window.ZFG = window.ZFG || {};

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  class Game {
    constructor(container, opts) {
      opts = opts || {};
      this.container = container;
      this.opts = opts;
      this.id = opts.id || 'game';
      this.hudEl = opts.hud || null;
      this.running = false;
      this.paused = false;
      this.score = 0;

      this.overlay = el('div', 'game-overlay hidden');
      this.container.appendChild(this.overlay);
    }

    init() {}

    start() {
      if (this.running) return;
      this.running = true;
      this.paused = false;
      this.hideOverlay();
      if (typeof this._start === 'function') this._start();
      this.updateHud();
    }

    stop() {
      if (!this.running) return;
      this.running = false;
      if (typeof this._stop === 'function') this._stop();
    }

    pause() {
      if (!this.running || this.paused) return;
      this.paused = true;
      if (typeof this._pause === 'function') this._pause();
    }

    resume() {
      if (!this.running || !this.paused) return;
      this.paused = false;
      if (typeof this._resume === 'function') this._resume();
      this.hideOverlay();
    }

    togglePause() {
      if (!this.running) {
        this.start();
        return;
      }
      if (this.paused) this.resume();
      else this.pause();
    }

    restart() {
      if (typeof this._restart === 'function') this._restart();
    }

    destroy() {
      this.stop();
      if (typeof this._destroy === 'function') this._destroy();
      if (this.overlay.parentNode) this.overlay.parentNode.removeChild(this.overlay);
    }

    setScore(value) {
      this.score = value;
      this.updateHud();
    }

    updateHud() {}

    best() {
      return ZFG.Storage.getBest(this.id);
    }

    saveBest() {
      return ZFG.Storage.setBest(this.id, this.score);
    }

    stat(label, value) {
      var item = el('div', 'hud__item');
      item.appendChild(el('span', 'hud__label', label));
      item.appendChild(el('span', 'hud__value', String(value)));
      return item;
    }

    showOverlay(config) {
      config = config || {};
      this.overlay.innerHTML = '';
      var card = el('div', 'overlay-card');

      if (config.title) card.appendChild(el('h2', 'overlay-card__title', config.title));
      if (config.text) card.appendChild(el('p', 'overlay-card__text', config.text));

      if (config.actions && config.actions.length) {
        var actions = el('div', 'overlay-card__actions');
        config.actions.forEach(function (action) {
          var button = el('button', 'btn' + (action.primary ? ' btn--primary' : ''), action.label);
          button.addEventListener('click', action.onClick);
          actions.appendChild(button);
        });
        card.appendChild(actions);
      }

      this.overlay.appendChild(card);
      this.overlay.classList.remove('hidden');
    }

    hideOverlay() {
      this.overlay.classList.add('hidden');
      this.overlay.innerHTML = '';
    }
  }

  ZFG.Game = Game;
  ZFG.el = el;
})();
