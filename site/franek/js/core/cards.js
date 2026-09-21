(function () {
  window.ZFG = window.ZFG || {};

  var SUITS = [
    { id: 'S', symbol: '♠', color: 'black' },
    { id: 'H', symbol: '♥', color: 'red' },
    { id: 'D', symbol: '♦', color: 'red' },
    { id: 'C', symbol: '♣', color: 'black' }
  ];

  var RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  function suit(id) {
    for (var i = 0; i < SUITS.length; i++) {
      if (SUITS[i].id === id) return SUITS[i];
    }
    return SUITS[0];
  }

  function isRed(card) {
    return suit(card.suit).color === 'red';
  }

  function rankLabel(rank) {
    return RANKS[rank] || '?';
  }

  function createDeck(copies, suitIds) {
    var deck = [];
    var ids = suitIds || ['S', 'H', 'D', 'C'];
    for (var c = 0; c < copies; c++) {
      ids.forEach(function (id) {
        for (var rank = 1; rank <= 13; rank++) {
          deck.push({ suit: id, rank: rank, faceUp: false });
        }
      });
    }
    return deck;
  }

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  function element(card, faceUp) {
    var el = document.createElement('div');
    el.className = 'card';

    if (!faceUp) {
      el.classList.add('card--back');
      return el;
    }

    var s = suit(card.suit);
    if (s.color === 'red') el.classList.add('card--red');

    var tl = document.createElement('span');
    tl.className = 'card__corner card__corner--tl';
    tl.innerHTML = '<b>' + rankLabel(card.rank) + '</b><i>' + s.symbol + '</i>';

    var pip = document.createElement('span');
    pip.className = 'card__pip';
    pip.textContent = s.symbol;

    var br = document.createElement('span');
    br.className = 'card__corner card__corner--br';
    br.innerHTML = '<b>' + rankLabel(card.rank) + '</b><i>' + s.symbol + '</i>';

    el.appendChild(tl);
    el.appendChild(pip);
    el.appendChild(br);
    return el;
  }

  ZFG.cards = {
    SUITS: SUITS,
    RANKS: RANKS,
    suit: suit,
    isRed: isRed,
    rankLabel: rankLabel,
    createDeck: createDeck,
    shuffle: shuffle,
    element: element
  };
})();
