/* ==========================================================================
   Strona „Siedliska” — interaktywna mapa występowania
   ========================================================================== */
(function () {
  "use strict";

  var PLACES = [
    {
      id: "antarktyda", label: "Antarktyda", x: 50, y: 87,
      title: "Kontynent Antarktyczny",
      text: "Najzimniejsze miejsce na Ziemi. Gnieżdżą się tu pingwin cesarski, Adeli i grafitowy. Kolonie zakładane są na lodzie morskim i skalistych wybrzeżach."
    },
    {
      id: "subantarktyka", label: "Subantarktyka", x: 62, y: 74,
      title: "Wyspy subantarktyczne",
      text: "Wilgotne, trawiaste wyspy (m.in. Georgia Południowa, Macquarie). Dom pingwinów królewskich i dużych kolonii pingwina grafitowego."
    },
    {
      id: "afryka", label: "Afryka Płd.", x: 53, y: 72,
      title: "Wybrzeże Afryki Południowej",
      text: "Ciepłe wody Bengueli i piaszczyste plaże. Jedyny rejon lęgowy pingwina białookiego, gatunku silnie zagrożonego wyginięciem."
    },
    {
      id: "patagonia", label: "Patagonia", x: 30, y: 76,
      title: "Patagonia i Falklandy",
      text: "Pingwin magellański drąży nory na stepie i wybrzeżach. Zimą migruje na północ, aż do wybrzeży Brazylii."
    },
    {
      id: "horn", label: "Przylądek Horn", x: 27, y: 84,
      title: "Przylądek Horn i wyspy",
      text: "Skaliste, sztormowe klify zamieszkane przez pingwina skalnego, który skacze po skałach i gnieździ się w szczelinach."
    },
    {
      id: "australia", label: "Australia / NZ", x: 86, y: 78,
      title: "Australia i Nowa Zelandia",
      text: "Umiarkowane wody Oceanu Spokojnego. Nocą na plaże wracają pingwiny małe (niebieskie), najmniejsze pingwiny świata."
    }
  ];

  var map = document.getElementById("world-map");
  if (!map) return;

  var tip = document.createElement("div");
  tip.className = "map-tooltip";
  tip.hidden = true;
  map.appendChild(tip);

  PLACES.forEach(function (p) {
    var pin = document.createElement("button");
    pin.type = "button";
    pin.className = "map-pin";
    pin.style.left = p.x + "%";
    pin.style.top = p.y + "%";
    pin.textContent = p.label;
    pin.setAttribute("aria-label", p.title + " — pokaż szczegóły");
    pin.addEventListener("click", function (e) {
      e.stopPropagation();
      tip.innerHTML = "<strong>" + p.title + "</strong>" + p.text;
      tip.style.left = p.x + "%";
      tip.style.top = p.y + "%";
      tip.hidden = false;
    });
    map.appendChild(pin);
  });

  document.addEventListener("click", function () { tip.hidden = true; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") tip.hidden = true; });
})();
