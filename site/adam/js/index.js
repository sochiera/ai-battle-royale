/* ==========================================================================
   Strona główna — polecane gatunki + ciekawostka dnia
   ========================================================================== */
(function () {
  "use strict";
  var P = window.PINGWINY;
  if (!P) return;

  var featured = ["cesarski", "krolewski", "maly"];

  var grid = document.getElementById("featured-grid");
  if (grid) {
    grid.innerHTML = featured.map(function (id) {
      var s = P.findSpecies(id);
      return '' +
        '<article class="card card--species">' +
          '<div class="species-art">' + P.penguinSVG(s, 150) + '</div>' +
          '<div class="species-body">' +
            '<h3>' + s.name + '</h3>' +
            '<p class="species-latin">' + s.latin + '</p>' +
            '<span class="badge iucn-' + s.iucn + '">IUCN: ' + s.iucn + ' · ' + s.iucnLabel + '</span>' +
            '<p class="text-muted mb-0">' + s.fun + '</p>' +
            '<p><a href="gatunki.html">Zobacz wszystkie gatunki</a></p>' +
          '</div>' +
        '</article>';
    }).join("");
  }

  var factEl = document.getElementById("fact-of-day");
  if (factEl) {
    var day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    factEl.textContent = P.FACTS[day % P.FACTS.length];
  }
})();
