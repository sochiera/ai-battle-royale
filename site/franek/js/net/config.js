(function () {
  window.ZFG = window.ZFG || {};

  function firstDefined() {
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i]) return arguments[i];
    }
    return '';
  }

  try {
    var params = new URLSearchParams(window.location.search);
    var fromQuery = params.get('server') || '';
  } catch (err) {
    fromQuery = '';
  }

  var meta = document.querySelector('meta[name="game-server"]');
  var fromMeta = meta ? meta.getAttribute('content') : '';

  var fromWindow = window.GAME_SERVER_URL || '';

  var fromStorage = '';
  try {
    fromStorage = localStorage.getItem('zfg.server') || '';
  } catch (err) {
    fromStorage = '';
  }

  var origin = '';
  if (window.location.origin && window.location.origin.indexOf('http') === 0) {
    origin = window.location.origin;
  }

  var resolved = firstDefined(fromQuery, fromWindow, fromMeta, fromStorage, origin, 'http://localhost:3000');

  if (fromQuery) {
    try {
      localStorage.setItem('zfg.server', fromQuery);
    } catch (err) {
      /* noop */
    }
  }

  ZFG.NET_URL = resolved.replace(/\/+$/, '');
})();
