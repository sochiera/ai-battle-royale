(function () {
  window.ZFG = window.ZFG || {};

  ZFG.GAMES = [
    {
      id: 'minesweeper',
      name: 'Saper',
      icon: 'mine',
      type: 'solo',
      url: 'games/saper/',
      tag: 'Klasyk',
      desc: 'Odsłoń wszystkie pola i nie traf na minę.'
    },
    {
      id: 'klondike',
      name: 'Pasjans',
      icon: 'solitaire',
      type: 'solo',
      url: 'games/pasjans/',
      tag: 'Karty',
      desc: 'Klondyk — ułóż wszystkie karty na czterech stosach.'
    },
    {
      id: 'spider',
      name: 'Pasjans: Pająk',
      icon: 'spider',
      type: 'solo',
      url: 'games/pasjans-pajak/',
      tag: 'Karty',
      desc: 'Pająk — ułóż osiem sekwencji od króla do asa.'
    }
  ];

  ZFG.getGame = function (id) {
    for (var i = 0; i < ZFG.GAMES.length; i++) {
      if (ZFG.GAMES[i].id === id) return ZFG.GAMES[i];
    }
    return null;
  };

  ZFG.filterGames = function (filter) {
    return ZFG.GAMES.filter(function (game) {
      return !filter || filter === 'all' || game.type === filter;
    });
  };

  ZFG.renderMenu = function (grid, filter) {
    grid.innerHTML = '';
    var games = ZFG.filterGames(filter);

    if (!games.length) {
      var empty = document.createElement('p');
      empty.className = 'games-empty';
      empty.textContent = 'Brak gier w tej kategorii.';
      grid.appendChild(empty);
      return;
    }

    games.forEach(function (game) {
      var item = document.createElement('a');
      item.className = 'game-item';
      item.href = game.url;
      item.title = game.desc;

      var icon = document.createElement('span');
      icon.className = 'game-item__icon';
      icon.appendChild(ZFG.icons.create(game.icon, 48));

      var label = document.createElement('span');
      label.className = 'game-item__label';
      label.textContent = game.name;

      var meta = document.createElement('span');
      meta.className = 'game-item__meta';
      var best = ZFG.Storage.getBest(game.id);
      meta.textContent = best == null ? 'Solo' : 'Solo · rekord ' + best;

      item.appendChild(icon);
      item.appendChild(label);
      item.appendChild(meta);
      grid.appendChild(item);
    });
  };
})();
