(function () {
  window.ZFG = window.ZFG || {};

  var KEY = 'zfg.storage.v1';

  function readAll() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      return {};
    }
  }

  function writeAll(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      /* storage unavailable */
    }
  }

  ZFG.Storage = {
    get: function (key, fallback) {
      var data = readAll();
      return data[key] !== undefined ? data[key] : (fallback === undefined ? null : fallback);
    },

    set: function (key, value) {
      var data = readAll();
      data[key] = value;
      writeAll(data);
      return value;
    },

    getBest: function (id) {
      var value = ZFG.Storage.get('best.' + id);
      return typeof value === 'number' ? value : null;
    },

    setBest: function (id, value) {
      if (typeof value !== 'number' || isNaN(value)) return false;
      var key = 'best.' + id;
      var current = ZFG.Storage.get(key);
      if (typeof current !== 'number' || value > current) {
        ZFG.Storage.set(key, value);
        return true;
      }
      return false;
    },

    getMin: function (id) {
      var value = ZFG.Storage.get('min.' + id);
      return typeof value === 'number' ? value : null;
    },

    setMin: function (id, value) {
      if (typeof value !== 'number' || isNaN(value)) return false;
      var key = 'min.' + id;
      var current = ZFG.Storage.get(key);
      if (typeof current !== 'number' || value < current) {
        ZFG.Storage.set(key, value);
        return true;
      }
      return false;
    },

    clear: function () {
      try {
        localStorage.removeItem(KEY);
      } catch (err) {
        /* noop */
      }
    }
  };
})();
