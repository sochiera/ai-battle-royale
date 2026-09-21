(function () {
  window.ZFG = window.ZFG || {};

  var GRID = 16;
  var SIZE = 48;

  function set(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w || 1, h || 1);
  }

  function line(ctx, color, x0, y0, x1, y1) {
    var dx = Math.abs(x1 - x0);
    var dy = -Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1;
    var sy = y0 < y1 ? 1 : -1;
    var err = dx + dy;
    ctx.fillStyle = color;
    while (true) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  var DRAW = {
    mine: function (ctx) {
      var spikes = [
        [8, 1, 8, 5], [8, 10, 8, 14],
        [1, 8, 5, 8], [10, 8, 14, 8],
        [3, 3, 5, 5], [10, 10, 12, 12],
        [10, 5, 12, 3], [3, 12, 5, 10]
      ];
      spikes.forEach(function (s) { line(ctx, '#000000', s[0], s[1], s[2], s[3]); });

      set(ctx, '#1a1a1a', 6, 5, 4, 6);
      set(ctx, '#1a1a1a', 5, 6, 6, 4);
      set(ctx, '#1a1a1a', 7, 4, 2, 8);
      set(ctx, '#666666', 6, 5, 2, 2);
      set(ctx, '#cccccc', 6, 5, 1, 1);
      set(ctx, '#000000', 7, 7, 2, 2);
    },

    solitaire: function (ctx) {
      set(ctx, '#000080', 2, 3, 8, 11);
      set(ctx, '#ffffff', 3, 4, 6, 9);
      set(ctx, '#000080', 3, 4, 6, 9);
      set(ctx, '#6ea8ff', 4, 5, 4, 7);

      set(ctx, '#000000', 6, 4, 8, 11);
      set(ctx, '#ffffff', 7, 5, 6, 9);

      set(ctx, '#c00000', 10, 6, 1, 1);
      set(ctx, '#c00000', 9, 7, 3, 1);
      set(ctx, '#c00000', 10, 8, 1, 1);
    },

    spider: function (ctx) {
      line(ctx, '#111111', 6, 6, 2, 3);
      line(ctx, '#111111', 6, 7, 2, 6);
      line(ctx, '#111111', 6, 8, 2, 10);
      line(ctx, '#111111', 6, 9, 3, 12);
      line(ctx, '#111111', 9, 6, 13, 3);
      line(ctx, '#111111', 9, 7, 13, 6);
      line(ctx, '#111111', 9, 8, 13, 10);
      line(ctx, '#111111', 9, 9, 12, 12);

      set(ctx, '#222222', 6, 6, 4, 5);
      set(ctx, '#444444', 6, 6, 4, 2);
      set(ctx, '#c00000', 7, 6, 1, 1);
      set(ctx, '#c00000', 8, 6, 1, 1);
    },

    computer: function (ctx) {
      set(ctx, '#404040', 1, 2, 14, 9);
      set(ctx, '#008080', 2, 3, 12, 7);
      set(ctx, '#00c0c0', 2, 3, 12, 2);
      set(ctx, '#c0c0c0', 2, 8, 12, 2);
      set(ctx, '#404040', 7, 11, 2, 2);
      set(ctx, '#404040', 5, 13, 6, 1);
    },

    unknown: function (ctx) {
      set(ctx, '#404040', 2, 2, 12, 12);
      set(ctx, '#c0c0c0', 3, 3, 10, 10);
      set(ctx, '#008080', 5, 5, 6, 6);
    }
  };

  function create(id, size) {
    var canvas = document.createElement('canvas');
    canvas.width = GRID;
    canvas.height = GRID;
    canvas.className = 'pixel-icon';
    canvas.style.width = (size || SIZE) + 'px';
    canvas.style.height = (size || SIZE) + 'px';

    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    (DRAW[id] || DRAW.unknown)(ctx);
    return canvas;
  }

  ZFG.icons = {
    create: create,

    fill: function (target, id, size) {
      if (!target) return;
      target.innerHTML = '';
      target.appendChild(create(id, size));
    },

    init: function () {
      var nodes = document.querySelectorAll('[data-pixel-icon]');
      Array.prototype.forEach.call(nodes, function (node) {
        var size = parseInt(node.getAttribute('data-pixel-size'), 10);
        ZFG.icons.fill(node, node.getAttribute('data-pixel-icon'), size || undefined);
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { ZFG.icons.init(); });
  } else {
    ZFG.icons.init();
  }
})();
