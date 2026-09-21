/* ==========================================================================
   Dane i generatory treści — wspólne dla całej witryny
   ========================================================================== */
(function () {
  "use strict";

  /* --- Katalog gatunków --------------------------------------------------- */
  var SPECIES = [
    {
      id: "cesarski",
      name: "Pingwin cesarski",
      latin: "Aptenodytes forsteri",
      region: "antarktyda",
      regionLabel: "Antarktyda",
      height: 120,
      weight: 35,
      habitat: "Lód morski i szelfy Antarktydy",
      iucn: "NT",
      iucnLabel: "Bliski zagrożenia",
      population: "~ 250 000 par",
      diet: "Ryby, kryle, kałamarnice",
      look: { ear: "#f6c14b", earWide: true, faceGray: false, pinkEyes: false, browStripe: false, crownStripe: false, crest: false, eyeRing: false },
      fun: "Jest największym pingwinem świata — dorosły osobnik mierzy nawet 1,2 m i potrafi przetrwać antarktyczną zimę przy temperaturze −60 °C."
    },
    {
      id: "krolewski",
      name: "Pingwin królewski",
      latin: "Aptenodytes patagonicus",
      region: "antarktyda",
      regionLabel: "Antarktyda / Subantarktyka",
      height: 90,
      weight: 14,
      habitat: "Wyspy subantarktyczne, plaże i wydmy",
      iucn: "LC",
      iucnLabel: "Mniejszej troski",
      population: "~ 2,2 mln par",
      diet: "Latimeria, kałamarnice, kryle",
      look: { ear: "#f97316", earWide: true, faceGray: true, pinkEyes: false, browStripe: false, crownStripe: false, crest: false, eyeRing: false },
      fun: "Drugi pod względem wielkości pingwin — jest blisko spokrewniony z pingwinem cesarskim, ale gnieździ się na wilgotnych, trawiastych wyspach."
    },
    {
      id: "adeli",
      name: "Pingwin Adeli",
      latin: "Pygoscelis adeliae",
      region: "antarktyda",
      regionLabel: "Antarktyda",
      height: 65,
      weight: 5,
      habitat: "Wybrzeża Antarktydy i wyspy",
      iucn: "LC",
      iucnLabel: "Mniejszej troski",
      population: "~ 7,5 mln par",
      diet: "Kryl antarktyczny i ryby",
      look: { ear: null, earWide: false, faceGray: false, pinkEyes: false, browStripe: false, crownStripe: false, crest: false, eyeRing: true },
      fun: "Ma charakterystyczne białe obwódki wokół oczu i jako jedyny pingwin aktywnie buduje gniazda z kamyków."
    },
    {
      id: "afrykanski",
      name: "Pingwin białooki (afrykański)",
      latin: "Spheniscus demersus",
      region: "afryka",
      regionLabel: "Afryka",
      height: 65,
      weight: 3.2,
      habitat: "Piaszczyste plaże i wybrzeża Afryki Południowej",
      iucn: "EN",
      iucnLabel: "Zagrożony",
      population: "~ 20 000 par",
      diet: "Sardynki, anchois, kałamarnice",
      look: { ear: null, earWide: false, faceGray: false, pinkEyes: true, browStripe: false, crownStripe: false, crest: false, eyeRing: false },
      fun: "Nazywany „osiołkiem morskim”, bo jego głos przypomina ryk osła. To jedyny pingwin gniazdujący w Afryce."
    },
    {
      id: "grafitowy",
      name: "Pingwin grafitowy (gentoo)",
      latin: "Pygoscelis papua",
      region: "antarktyda",
      regionLabel: "Antarktyda / Subantarktyka",
      height: 80,
      weight: 6,
      habitat: "Wybrzeża subantarktyczne i antarktyczne",
      iucn: "LC",
      iucnLabel: "Mniejszej troski",
      population: "~ 387 000 par",
      diet: "Ryby, kryle, skorupiaki",
      look: { ear: null, earWide: false, faceGray: false, pinkEyes: false, browStripe: false, crownStripe: true, crest: false, eyeRing: false },
      fun: "Noszę białą „opaskę” nad oczami. Pływam najszybciej ze wszystkich pingwinów — do 36 km/h."
    },
    {
      id: "skalny",
      name: "Pingwin skalny",
      latin: "Eudyptes chrysocome",
      region: "ameryka",
      regionLabel: "Ameryka Południowa",
      height: 52,
      weight: 2.5,
      habitat: "Klifowe wyspy wokół przylądka Horn",
      iucn: "VU",
      iucnLabel: "Narażony",
      population: "~ 1,2 mln par",
      diet: "Kryl, małe ryby, skorupiaki",
      look: { ear: null, earWide: false, faceGray: false, pinkEyes: false, browStripe: false, crownStripe: false, crest: true, eyeRing: false },
      fun: "Ma żółte „brwi”, które sterczą jak czubek. Porusza się skacząc po skałach, stąd jego nazwa."
    },
    {
      id: "magellanski",
      name: "Pingwin magellański",
      latin: "Spheniscus magellanicus",
      region: "ameryka",
      regionLabel: "Ameryka Południowa",
      height: 70,
      weight: 3.6,
      habitat: "Wybrzeża Patagonii, Chile i Falklandów",
      iucn: "NT",
      iucnLabel: "Bliski zagrożenia",
      population: "~ 1,3 mln par",
      diet: "Ryby ławicowe, kałamarnice",
      look: { ear: null, earWide: false, faceGray: false, pinkEyes: false, browStripe: true, crownStripe: false, crest: false, eyeRing: false },
      fun: "Pokonuje w poszukiwaniu jedzenia tysiące kilometrów rocznie, a jego gniazda drąży w ziemi wykopane tunele."
    },
    {
      id: "maly",
      name: "Pingwin mały (niebieski)",
      latin: "Eudyptula minor",
      region: "australia",
      regionLabel: "Australia / Nowa Zelandia",
      height: 33,
      weight: 1.3,
      habitat: "Wybrzeża Australii i Nowej Zelandii",
      iucn: "LC",
      iucnLabel: "Mniejszej troski",
      population: "~ 500 000 par",
      diet: "Małe ryby, kalmary, skorupiaki",
      look: { ear: null, earWide: false, faceGray: false, pinkEyes: false, browStripe: false, crownStripe: false, crest: false, eyeRing: false, blue: true },
      fun: "Najmniejszy pingwin świata — mierzy zaledwie ok. 33 cm i nocą wraca z morza do gniazda, by uniknąć drapieżników."
    }
  ];

  /* --- Ciekawostki -------------------------------------------------------- */
  var FACTS = [
    "Pingwiny nie latają, ale pod wodą rozwijają prędkość do 36 km/h — pingwin grafitowy jest najszybszym pływakiem wśród ptaków.",
    "Pingwin cesarski potrafi nurkować na głębokość ponad 500 m i wytrzymać pod wodą nawet 20 minut.",
    "Co roku u pingwinów następuje linienie — wymieniają całe upierzenie w ciągu 2–3 tygodni i wtedy nie mogą wejść do wody.",
    "Pingwin białooki jest nazywany „osiołkiem morskim” z powodu głosu przypominającego ryk osła.",
    "Krew pingwinów zawiera dużo hemoglobiny, dzięki czemu transportuje więcej tlenu podczas długich nurkowań.",
    "Pingwiny mają gruczoł kuprowy, którego tłuszczem natłuszczają pióra, aby utrzymać ich wodoszczelność.",
    "Pingwin cesarski jest jedynym ptakiem, który zimuje i wysiaduje jaja podczas antarktycznej zimy.",
    "Pingwiny rozpoznają partnera i pisklę po głosie — w kolonii liczącej tysiące ptaków każdy głos jest unikalny.",
    "Największa kolonia pingwinów Adeli liczy ponad milion ptaków.",
    "Pingwin mały wychodzi na ląd wyłącznie nocą, aby uniknąć ataku ptaków drapieżnych.",
    "Pingwiny połykają kamienie — pomagają im one w rozcieraniu pokarmu i balastowaniu przy nurkowaniu.",
    "Pingwin królewski potrafi przebywać na lądzie bez jedzenia nawet 3 tygodnie, czekając na partnera.",
    "Pingwiny komunikują się za pomocą ruchów głowy, skrzydeł i różnorodnych dźwięków.",
    "Antarktyczny kryl, główne pożywienie wielu pingwinów, jest silnie zagrożony przez ocieplenie oceanów.",
    "Młode pingwiny mają miękkie, puchate upierzenie, które z czasem zastępują upierzeniem dorosłym, wodoszczelnym."
  ];

  /* --- Quiz --------------------------------------------------------------- */
  var QUIZ = [
    {
      q: "Który pingwin jest największy i potrafi nurkować na ponad 500 m?",
      options: ["Pingwin mały", "Pingwin cesarski", "Pingwin Adeli", "Pingwin skalny"],
      correct: 1,
      explain: "Pingwin cesarski dorasta do ok. 1,2 m i nurkuje nawet na 500 m."
    },
    {
      q: "Który gatunek jest nazywany „osiołkiem morskim”?",
      options: ["Pingwin królewski", "Pingwin grafitowy", "Pingwin białooki (afrykański)", "Pingwin magellański"],
      correct: 2,
      explain: "Pingwin białooki wydaje głos przypominający ryk osła."
    },
    {
      q: "Ile gatunków pingwinów uznaje się obecnie?",
      options: ["4", "8", "18", "ok. 50"],
      correct: 2,
      explain: "Współcześnie wyróżnia się około 18 gatunków pingwinów."
    },
    {
      q: "Do czego pingwiny używają kamieni?",
      options: ["Do budowy gniazd i balastu przy nurkowaniu", "Jako pokarmu dla piskląt", "Do walk z rywalami", "Nie używają kamieni"],
      correct: 0,
      explain: "Pingwin Adeli buduje gniazda z kamyków, a inne gatunki połykają je jako balast."
    },
    {
      q: "Jak nazywa się wymiana upierzenia, po której pingwin nie może wejść do wody?",
      options: ["Pierzenie (linienie)", "Zrzucanie puchu", "Migracja", "Kotlinie"],
      correct: 0,
      explain: "Podczas pierzenia pingwin wymienia pióra w ciągu 2–3 tygodni."
    },
    {
      q: "Który pingwin jest najmniejszy?",
      options: ["Pingwin skalny", "Pingwin mały (niebieski)", "Pingwin Adeli", "Pingwin magellański"],
      correct: 1,
      explain: "Pingwin mały mierzy tylko ok. 33 cm i waży ok. 1,3 kg."
    },
    {
      q: "Na jakim kontynencie NIE występują pingwiny lęgowo?",
      options: ["Antarktyda", "Afryka", "Europa", "Ameryka Południowa"],
      correct: 2,
      explain: "Pingwiny żyją na półkuli południowej — w Europie nie gniazdują dzikie populacje."
    },
    {
      q: "Co jest głównym zagrożeniem dla pingwinów?",
      options: ["Zmiany klimatu i przełowienie", "Zbyt dużo lodu", "Nadmiar kryl", "Turystyka piesza"],
      correct: 0,
      explain: "Ocieplenie oceanów, topnienie lodu i przełowienie zasobów to największe zagrożenia."
    }
  ];

  /* --- Generator ilustracji pingwina (SVG) -------------------------------- */
  function penguinSVG(s, size) {
    var look = s.look || {};
    var body = look.blue ? "#2f6f9f" : "#152130";
    var bodyDark = look.blue ? "#1f4f74" : "#0b141d";
    var belly = look.blue ? "#dfeefc" : "#ffffff";
    var beak = look.blue ? "#3a4a58" : "#f97316";
    var feet = look.blue ? "#e07b39" : "#f97316";
    var headY = 66;
    var s2 = size || 200;

    var marks = "";
    if (look.crest) {
      marks += '<ellipse cx="66" cy="30" rx="16" ry="8" fill="#f6c14b" transform="rotate(-28 66 30)"/>' +
               '<ellipse cx="134" cy="30" rx="16" ry="8" fill="#f6c14b" transform="rotate(28 134 30)"/>';
    }
    if (look.ear) {
      var rx = look.earWide ? 15 : 9;
      marks += '<ellipse cx="66" cy="84" rx="' + rx + '" ry="16" fill="' + look.ear + '"/>' +
               '<ellipse cx="134" cy="84" rx="' + rx + '" ry="16" fill="' + look.ear + '"/>';
    }
    if (look.crownStripe) {
      marks += '<path d="M48 44 Q100 8 152 44" stroke="#ffffff" stroke-width="10" fill="none" stroke-linecap="round"/>';
    }
    if (look.browStripe) {
      marks += '<path d="M34 70 Q58 60 66 90" stroke="#ffffff" stroke-width="9" fill="none" stroke-linecap="round"/>' +
               '<path d="M166 70 Q142 60 134 90" stroke="#ffffff" stroke-width="9" fill="none" stroke-linecap="round"/>';
    }
    if (look.faceGray) {
      marks += '<ellipse cx="100" cy="74" rx="40" ry="34" fill="#c9d3da" opacity=".55"/>';
    }
    if (look.pinkEyes) {
      marks += '<ellipse cx="66" cy="56" rx="15" ry="10" fill="#f5a6a6" transform="rotate(-12 66 56)"/>' +
               '<ellipse cx="134" cy="56" rx="15" ry="10" fill="#f5a6a6" transform="rotate(12 134 56)"/>';
    }
    var eyeRing = look.eyeRing
      ? '<circle cx="80" cy="66" r="12" fill="#fff"/><circle cx="120" cy="66" r="12" fill="#fff"/>'
      : '';

    return '' +
      '<svg viewBox="0 0 200 250" width="' + s2 + '" height="' + Math.round(s2 * 1.25) + '" role="img" aria-label="Ilustracja: ' + s.name + '">' +
        '<ellipse cx="100" cy="238" rx="62" ry="9" fill="rgba(0,0,0,.12)"/>' +
        '<ellipse cx="100" cy="152" rx="58" ry="82" fill="' + body + '"/>' +
        '<ellipse cx="60" cy="150" rx="16" ry="58" fill="' + bodyDark + '" transform="rotate(12 60 150)"/>' +
        '<ellipse cx="140" cy="150" rx="16" ry="58" fill="' + bodyDark + '" transform="rotate(-12 140 150)"/>' +
        '<ellipse cx="100" cy="168" rx="36" ry="60" fill="' + belly + '"/>' +
        '<circle cx="100" cy="' + headY + '" r="48" fill="' + body + '"/>' +
        marks +
        eyeRing +
        '<circle cx="80" cy="66" r="6.5" fill="#fff"/><circle cx="80" cy="66" r="3" fill="#101820"/>' +
        '<circle cx="120" cy="66" r="6.5" fill="#fff"/><circle cx="120" cy="66" r="3" fill="#101820"/>' +
        '<path d="M84 82 L100 104 L116 82 Z" fill="' + beak + '"/>' +
        '<ellipse cx="80" cy="212" rx="20" ry="10" fill="' + feet + '"/>' +
        '<ellipse cx="120" cy="212" rx="20" ry="10" fill="' + feet + '"/>' +
      '</svg>';
  }

  /* --- Pomocnicze --------------------------------------------------------- */
  function findSpecies(id) {
    for (var i = 0; i < SPECIES.length; i++) {
      if (SPECIES[i].id === id) return SPECIES[i];
    }
    return null;
  }

  var REGIONS = [
    { id: "all", label: "Wszystkie" },
    { id: "antarktyda", label: "Antarktyda" },
    { id: "ameryka", label: "Ameryka Południowa" },
    { id: "afryka", label: "Afryka" },
    { id: "australia", label: "Australia / Nowa Zelandia" }
  ];

  window.PINGWINY = {
    SPECIES: SPECIES,
    FACTS: FACTS,
    QUIZ: QUIZ,
    REGIONS: REGIONS,
    penguinSVG: penguinSVG,
    findSpecies: findSpecies
  };
})();
