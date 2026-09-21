/* ==========================================================================
   Strona „Galeria i ciekawostki” — siatka zdjęć (ilustracji) + ciekawostki
   ========================================================================== */
(function () {
  "use strict";
  var P = window.PINGWINY;
  if (!P) return;

  /* --- Galeria ------------------------------------------------------------ */
  var gallery = document.getElementById("gallery-grid");
  var lightbox = document.getElementById("lightbox");

  function openLightbox(s) {
    if (!lightbox) return;
    lightbox.querySelector("[data-lightbox-art]").innerHTML = P.penguinSVG(s, 260);
    lightbox.querySelector("[data-lightbox-title]").textContent = s.name;
    lightbox.querySelector("[data-lightbox-desc]").textContent =
      s.latin + " · " + s.habitat + ". " + s.fun;
    if (typeof lightbox.showModal === "function") lightbox.showModal();
    else window.alert(s.name + "\n\n" + s.fun);
  }

  if (gallery) {
    gallery.innerHTML = P.SPECIES.map(function (s) {
      return '' +
        '<figure class="gallery-item" role="button" tabindex="0" data-id="' + s.id + '" ' +
          'aria-label="Powiększ: ' + s.name + '">' +
          '<div class="art">' + P.penguinSVG(s, 200) + '</div>' +
          '<figcaption>' + s.name + '</figcaption>' +
          '<p>' + s.latin + '</p>' +
        '</figure>';
    }).join("");

    function handle(el) {
      var s = P.findSpecies(el.getAttribute("data-id"));
      if (s) openLightbox(s);
    }
    gallery.addEventListener("click", function (e) {
      var el = e.target.closest(".gallery-item");
      if (el) handle(el);
    });
    gallery.addEventListener("keydown", function (e) {
      var el = e.target.closest(".gallery-item");
      if (el && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        handle(el);
      }
    });
  }

  if (lightbox) {
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox || e.target.closest("[data-lightbox-close]")) lightbox.close();
    });
  }

  /* --- Ciekawostki -------------------------------------------------------- */
  var factGrid = document.getElementById("facts-grid");
  if (factGrid) {
    factGrid.innerHTML = P.FACTS.map(function (f, i) {
      var parts = f.split(" — ");
      var lead = parts.length > 1 ? parts[0] + " — " : "";
      var rest = parts.length > 1 ? parts.slice(1).join(" — ") : f;
      return '<article class="fact-card"><strong>Czy wiesz, że… #' + (i + 1) + '</strong><p class="mb-0">' +
        lead + rest + '</p></article>';
    }).join("");
  }
})();
