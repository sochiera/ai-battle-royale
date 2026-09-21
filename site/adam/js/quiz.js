/* ==========================================================================
   Quiz „Który to pingwin?” — silnik wielokrotnego wyboru (wiele instancji)
   ========================================================================== */
(function () {
  "use strict";
  var P = window.PINGWINY;
  if (!P) return;

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function createQuiz(mount) {
    var order = shuffle(P.QUIZ);
    var index = 0;
    var score = 0;

    function render() {
      if (index >= order.length) return renderSummary();
      var item = order[index];
      mount.innerHTML = '' +
        '<p class="quiz-progress">Pytanie ' + (index + 1) + ' z ' + order.length + ' · Punkty: ' + score + '</p>' +
        '<h3>' + item.q + '</h3>' +
        '<div class="quiz-options" role="group" aria-label="Odpowiedzi">' +
          item.options.map(function (opt, i) {
            return '<button type="button" class="quiz-option" data-i="' + i + '">' + opt + '</button>';
          }).join("") +
        '</div>' +
        '<p class="quiz-feedback" aria-live="polite"></p>' +
        '<div class="btn-row"><button type="button" class="btn btn--ghost" data-next hidden>Następne pytanie</button></div>';
    }

    function answer(btn) {
      var item = order[index];
      var chosen = Number(btn.getAttribute("data-i"));
      mount.querySelectorAll(".quiz-option").forEach(function (b) { b.disabled = true; });
      if (chosen === item.correct) {
        btn.classList.add("is-correct");
        score++;
        mount.querySelector(".quiz-feedback").textContent = "Dobrze! " + item.explain;
      } else {
        btn.classList.add("is-wrong");
        mount.querySelector('.quiz-option[data-i="' + item.correct + '"]').classList.add("is-correct");
        mount.querySelector(".quiz-feedback").textContent = "Niestety. " + item.explain;
      }
      var next = mount.querySelector("[data-next]");
      next.hidden = false;
      next.classList.remove("btn--ghost");
      next.classList.add("btn--primary");
      next.focus();
    }

    function renderSummary() {
      var pct = Math.round((score / order.length) * 100);
      var msg = pct === 100 ? "Perfekcyjnie! Jesteś ekspertem od pingwinów!"
        : pct >= 70 ? "Świetny wynik! Znasz pingwiny bardzo dobrze."
        : pct >= 40 ? "Niezły początek — poczytaj jeszcze o gatunkach!"
        : "Warto powtórzyć materiał. Zajrzyj do sekcji „O pingwinach”.";
      mount.innerHTML = '' +
        '<h3>Wynik: ' + score + ' / ' + order.length + ' (' + pct + '%)</h3>' +
        '<p>' + msg + '</p>' +
        '<div class="btn-row">' +
          '<button type="button" class="btn btn--primary" data-restart>Spróbuj ponownie</button>' +
          '<a class="btn btn--ghost" href="gatunki.html">Poznaj gatunki</a>' +
        '</div>';
    }

    mount.addEventListener("click", function (e) {
      var opt = e.target.closest(".quiz-option");
      if (opt && !opt.disabled) return answer(opt);
      if (e.target.closest("[data-next]")) { index++; render(); }
      if (e.target.closest("[data-restart]")) { order = shuffle(P.QUIZ); index = 0; score = 0; render(); }
    });

    render();
  }

  document.querySelectorAll("[data-quiz]").forEach(createQuiz);
})();
