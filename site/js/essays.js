// Озвучка греческих строк на страницах сочинений.
(function () {
  document.addEventListener('click', function (event) {
    const btn = event.target.closest('[data-speak-text]');
    if (!btn) return;

    const text = btn.getAttribute('data-speak-text');
    if (!text) return;

    const speak = window.GreekSpeak;
    if (!speak || !speak.isSupported || !speak.isSupported()) return;

    btn.classList.add('is-speaking');
    Promise.resolve(speak.speakGreek(text)).finally(function () {
      btn.classList.remove('is-speaking');
    });
  });
})();
