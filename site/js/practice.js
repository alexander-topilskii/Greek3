(function () {
  const page = document.querySelector('.word-page');
  if (!page) return;

  const raw = page.getAttribute('data-forms');
  if (!raw) return;

  let forms;
  try {
    forms = JSON.parse(raw);
  } catch {
    return;
  }

  if (!forms.length) return;

  let currentIndex = 0;
  let flipped = false;
  let startWithRussian = false;

  const flashcard = document.getElementById('flashcard');
  const flashFrontLabel = document.getElementById('flash-front-label');
  const flashBackLabel = document.getElementById('flash-back-label');
  const flashFrontText = document.getElementById('flash-front-text');
  const flashBackText = document.getElementById('flash-back-text');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnRandom = document.getElementById('btn-random');
  const btnLang = document.getElementById('btn-lang');
  const formRows = document.querySelectorAll('.form-row');

  function updateLangButton() {
    if (!btnLang) return;
    btnLang.textContent = startWithRussian ? '⇄ EL' : '⇄ RU';
    btnLang.setAttribute('aria-pressed', String(startWithRussian));
    btnLang.title = startWithRussian
      ? 'Показывать сначала по-гречески'
      : 'Показывать сначала по-русски';
  }

  function applyCardFaces(form) {
    const greek = form.greek;
    const translation = form.translation;

    if (startWithRussian) {
      if (flashFrontLabel) flashFrontLabel.textContent = 'Русский';
      if (flashBackLabel) flashBackLabel.textContent = 'Греческий';
      if (flashFrontText) {
        flashFrontText.textContent = translation;
        flashFrontText.classList.remove('greek');
      }
      if (flashBackText) {
        flashBackText.textContent = greek;
        flashBackText.classList.add('greek');
      }
    } else {
      if (flashFrontLabel) flashFrontLabel.textContent = 'Греческий';
      if (flashBackLabel) flashBackLabel.textContent = 'Перевод';
      if (flashFrontText) {
        flashFrontText.textContent = greek;
        flashFrontText.classList.add('greek');
      }
      if (flashBackText) {
        flashBackText.textContent = translation;
        flashBackText.classList.remove('greek');
      }
    }
  }

  function showForm(index) {
    currentIndex = ((index % forms.length) + forms.length) % forms.length;
    const form = forms[currentIndex];

    applyCardFaces(form);

    flipped = false;
    flashcard?.classList.remove('is-flipped');

    formRows.forEach((row, i) => {
      row.classList.toggle('is-active', i === currentIndex);
    });
  }

  function toggleFlip() {
    flipped = !flipped;
    flashcard?.classList.toggle('is-flipped', flipped);
  }

  function randomForm() {
    let next;
    do {
      next = Math.floor(Math.random() * forms.length);
    } while (next === currentIndex && forms.length > 1);
    showForm(next);
  }

  function toggleLang() {
    startWithRussian = !startWithRussian;
    updateLangButton();
    showForm(currentIndex);
  }

  flashcard?.addEventListener('click', toggleFlip);
  flashcard?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleFlip();
    }
  });

  btnPrev?.addEventListener('click', () => showForm(currentIndex - 1));
  btnNext?.addEventListener('click', () => showForm(currentIndex + 1));
  btnRandom?.addEventListener('click', randomForm);
  btnLang?.addEventListener('click', toggleLang);

  updateLangButton();
  showForm(0);
})();
