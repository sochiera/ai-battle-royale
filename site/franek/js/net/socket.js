(function () {
  window.ZFG = window.ZFG || {};

  var socket = null;
  var clientPromise = null;

  function loadClient() {
    if (window.io) return Promise.resolve();
    if (clientPromise) return clientPromise;

    clientPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = ZFG.NET_URL + '/socket.io/socket.io.js';
      script.async = true;
      script.onload = function () {
        if (window.io) resolve();
        else reject(new Error('Nie udało się wczytać klienta Socket.IO.'));
      };
      script.onerror = function () {
        clientPromise = null;
        reject(new Error('Brak połączenia z serwerem gier (' + ZFG.NET_URL + ').'));
      };
      document.head.appendChild(script);
    });

    return clientPromise;
  }

  ZFG.Net = {
    url: ZFG.NET_URL,

    get connected() {
      return !!(socket && socket.connected);
    },

    connect: function () {
      if (socket && socket.connected) return Promise.resolve(socket);
      return loadClient().then(function () {
        if (!socket) {
          socket = window.io(ZFG.NET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            timeout: 8000
          });
        }
        return new Promise(function (resolve, reject) {
          if (socket.connected) return resolve(socket);
          var timer = setTimeout(function () {
            socket.off('connect', onConnect);
            reject(new Error('Przekroczono czas łączenia z serwerem.'));
          }, 9000);
          function onConnect() {
            clearTimeout(timer);
            socket.off('connect', onConnect);
            resolve(socket);
          }
          socket.on('connect', onConnect);
          if (!socket.connected) socket.connect();
        });
      });
    },

    socket: function () {
      return socket;
    },

    request: function (event, payload, timeout) {
      return new Promise(function (resolve) {
        if (!socket) return resolve({ ok: false, error: 'Brak połączenia z serwerem.' });
        var settled = false;
        var timer = setTimeout(function () {
          if (settled) return;
          settled = true;
          resolve({ ok: false, error: 'Serwer nie odpowiedział.' });
        }, timeout || 9000);
        socket.emit(event, payload || {}, function (response) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(response || { ok: false, error: 'Brak odpowiedzi serwera.' });
        });
      });
    },

    emit: function (event, payload) {
      if (socket) socket.emit(event, payload);
    },

    on: function (event, handler) {
      if (socket) socket.on(event, handler);
    },

    off: function (event, handler) {
      if (socket) socket.off(event, handler);
    },

    disconnect: function () {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    }
  };
})();
