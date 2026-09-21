/* ==========================================================================
   Strona „Gatunki” — karty, filtrowanie po regionie, porównywarka
   ========================================================================== */
(function () {
  "use strict";
  var P = window.PINGWINY;
  if (!P) return;

  var grid = document.getElementById("species-grid");
  var filterBar = document.getElementById("species-filters");
  var countEl = document.getElementById("species-count");
  var activeRegion = "all";

  function renderCards() {
    if (!grid) return;
    var list = P.SPECIES.filter(function (s) {
      return activeRegion === "all" || s.region === activeRegion;
    });
    grid.innerHTML = list.map(function (s) {
      return '' +
        '<article class="card card--species" data-region="' + s.region + '">' +
          '<div class="species-art">' + P.penguinSVG(s, 150) + '</div>' +
          '<div class="species-body">' +
            '<h3>' + s.name + '</h3>' +
            '<p class="species-latin">' + s.latin + '</p>' +
            '<span class="badge iucn-' + s.iucn + '">IUCN: ' + s.iucn + ' — ' + s.iucnLabel + '</span>' +
            '<dl>' +
              '<dt>Wysokość</dt><dd>' + s.height + ' cm</dd>' +
              '<dt>Masa</dt><dd>' + s.weight + ' kg</dd>' +
              '<dt>Region</dt><dd>' + s.regionLabel + '</dd>' +
              '<dt>Siedlisko</dt><dd>' + s.habitat + '</dd>' +
              '<dt>Populacja</dt><dd>' + s.population + '</dd>' +
            '</dl>' +
            '<p class="text-muted">' + s.fun + '</p>' +
          '</div>' +
        '</article>';
    }).join("");

    if (countEl) {
      countEl.textContent = "Wyświetlono " + list.length + " z " + P.SPECIES.length + " gatunków.";
    }
  }

  function renderFilters() {
    if (!filterBar) return;
    filterBar.innerHTML = P.REGIONS.map(function (r) {
      return '<button type="button" class="chip" data-region="' + r.id + '" aria-pressed="' +
        (r.id === activeRegion) + '">' + r.label + '</button>';
    }).join("");
    filterBar.addEventListener("click", function (e) {
      var btn = e.target.closest(".chip");
      if (!btn) return;
      activeRegion = btn.getAttribute("data-region");
      filterBar.querySelectorAll(".chip").forEach(function (c) {
        c.setAttribute("aria-pressed", String(c === btn));
      });
      renderCards();
    });
  }

  /* --- Porównywarka ------------------------------------------------------- */
  function fillSelect(sel, selected) {
    if (!sel) return;
    sel.innerHTML = P.SPECIES.map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === selected ? " selected" : "") + '>' + s.name + '</option>';
    }).join("");
  }

  function renderCompare() {
    var a = P.findSpecies(document.getElementById("compare-a").value);
    var b = P.findSpecies(document.getElementById("compare-b").value);
    if (!a || !b) return;
    var maxH = 120, maxW = 35;
    var out = document.getElementById("compare-result");
    out.innerHTML = [a, b].map(function (s) {
      return '' +
        '<div class="compare-col">' +
          '<div class="center">' + P.penguinSVG(s, 120) + '</div>' +
          '<h3 class="center">' + s.name + '</h3>' +
          '<p class="text-muted center"><em>' + s.latin + '</em></p>' +
          '<p><strong>Wysokość:</strong> ' + s.height + ' cm</p>' +
          '<div class="meter" role="img" aria-label="Wysokość ' + s.height + ' cm"><span style="width:' + (s.height / maxH * 100) + '%"></span></div>' +
          '<p><strong>Masa:</strong> ' + s.weight + ' kg</p>' +
          '<div class="meter" role="img" aria-label="Masa ' + s.weight + ' kg"><span style="width:' + (s.weight / maxW * 100) + '%"></span></div>' +
          '<p><strong>Status IUCN:</strong> ' + s.iucn + ' — ' + s.iucnLabel + '</p>' +
          '<p class="mb-0"><strong>Dieta:</strong> ' + s.diet + '</p>' +
        '</div>';
    }).join("");
  }

  var selA = document.getElementById("compare-a");
  var selB = document.getElementById("compare-b");
  if (selA && selB) {
    fillSelect(selA, "cesarski");
    fillSelect(selB, "maly");
    selA.addEventListener("change", renderCompare);
    selB.addEventListener("change", renderCompare);
    renderCompare();
  }

  renderFilters();
  renderCards();
})();
