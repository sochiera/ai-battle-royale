(function () {
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function showDialog(title, text) {
    var backdrop = document.createElement('div');
    backdrop.className = 'modal';

    var card = document.createElement('div');
    card.className = 'overlay-card';

    var heading = document.createElement('h2');
    heading.className = 'overlay-card__title';
    heading.textContent = title;

    var body = document.createElement('p');
    body.className = 'overlay-card__text';
    body.textContent = text;

    var actions = document.createElement('div');
    actions.className = 'overlay-card__actions';

    var ok = document.createElement('button');
    ok.className = 'btn btn--primary';
    ok.type = 'button';
    ok.textContent = 'OK';

    function close() {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }

    ok.addEventListener('click', close);
    backdrop.addEventListener('click', function (event) {
      if (event.target === backdrop) close();
    });

    actions.appendChild(ok);
    card.appendChild(heading);
    card.appendChild(body);
    card.appendChild(actions);
    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
    ok.focus();
  }

  function boot() {
    var grid = document.getElementById('games-grid');
    if (!grid) return;

    var filters = document.getElementById('filters');
    var statusText = document.getElementById('status-text');
    var statusCount = document.getElementById('status-count');

    function apply(filter) {
      ZFG.renderMenu(grid, filter);
      var shown = ZFG.filterGames(filter).length;
      if (statusCount) statusCount.textContent = 'Gry: ' + shown;
      if (statusText) statusText.textContent = filter === 'solo' ? 'Filtr: tylko solo' : 'Gotowe';
      if (filters) {
        Array.prototype.forEach.call(filters.querySelectorAll('.filter-btn'), function (button) {
          button.classList.toggle('is-active', button.getAttribute('data-filter') === filter);
        });
      }
    }

    if (filters) {
      filters.addEventListener('click', function (event) {
        var button = event.target.closest('.filter-btn');
        if (!button) return;
        apply(button.getAttribute('data-filter'));
      });
    }

    grid.addEventListener('click', function (event) {
      var item = event.target.closest('.game-item');
      if (!item || !statusText) return;
      var label = item.querySelector('.game-item__label');
      statusText.textContent = 'Uruchamiam: ' + (label ? label.textContent : 'gra') + '...';
    });

    apply('all');

    var clock = document.getElementById('clock');
    if (clock) {
      (function tick() {
        var now = new Date();
        var h = now.getHours();
        var m = now.getMinutes();
        clock.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
        setTimeout(tick, 15000);
      })();
    }

    var startBtn = document.getElementById('start-btn');
    var startMenu = document.getElementById('start-menu');
    var startItems = document.getElementById('start-menu-items');

    function closeStart() {
      if (startMenu) startMenu.classList.add('hidden');
    }

    if (startMenu && startItems) {
      startItems.innerHTML = '';

      ZFG.GAMES.forEach(function (game) {
        var link = document.createElement('a');
        link.className = 'start-menu__item';
        link.href = game.url;
        link.appendChild(ZFG.icons.create(game.icon, 16));
        var label = document.createElement('span');
        label.textContent = game.name;
        link.appendChild(label);
        startItems.appendChild(link);
      });

      var sep = document.createElement('div');
      sep.className = 'start-menu__sep';
      startItems.appendChild(sep);

      var about = document.createElement('button');
      about.className = 'start-menu__item';
      about.type = 'button';
      about.textContent = 'O stronie';
      about.addEventListener('click', function () {
        closeStart();
        showDialog('O stronie', 'Zbiórka Franka — Gry. Proste gry solo w przeglądarce. Bez instalacji i bez serwera.');
      });
      startItems.appendChild(about);
    }

    if (startBtn && startMenu) {
      startBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        startMenu.classList.toggle('hidden');
      });
      document.addEventListener('click', function (event) {
        if (startMenu.classList.contains('hidden')) return;
        if (startMenu.contains(event.target)) return;
        closeStart();
      });
    }

    var aboutMenu = document.getElementById('menu-about');
    if (aboutMenu) {
      aboutMenu.addEventListener('click', function () {
        showDialog('Pomoc', 'Kliknij ikonę gry, aby ją uruchomić. Wszystko działa w przeglądarce.');
      });
    }

    var winMin = document.getElementById('win-min');
    var winMax = document.getElementById('win-max');
    var winClose = document.getElementById('win-close');
    var taskBtn = document.getElementById('task-btn');

    if (winMin) {
      winMin.addEventListener('click', function () {
        document.body.classList.add('win-minimized');
      });
    }
    if (taskBtn) {
      taskBtn.addEventListener('click', function () {
        document.body.classList.toggle('win-minimized');
      });
    }
    if (winMax) {
      winMax.addEventListener('click', function () {
        var win = document.getElementById('main-window');
        if (!win) return;
        win.style.width = win.style.width === '100%' ? '' : '100%';
      });
    }
    if (winClose) {
      winClose.addEventListener('click', function () {
        showDialog('Uwaga', 'System nie może zamknąć tej aplikacji.');
      });
    }
  }

  ready(boot);
})();
