(function () {
  const page = document.querySelector('.word-page');
  if (!page) return;

  const db = window.GreekDB;
  const srs = window.GreekSRS;
  const flash = window.GreekFlashcard;
  if (!db || !srs || !flash) return;

  const wordSlug = page.getAttribute('data-word-slug') ?? '';
  const deckId = page.getAttribute('data-deck-id') ?? 'verbs';
  const translation = page.getAttribute('data-translation') ?? '';

  let forms;
  let baseForms;
  try {
    forms = JSON.parse(page.getAttribute('data-forms') ?? '[]');
    baseForms = JSON.parse(page.getAttribute('data-base-forms') ?? '[]');
  } catch {
    return;
  }
  if (!forms.length && !baseForms.length) return;
  if (!forms.length) {
    forms = baseForms.map((greek) => ({ greek, translation }));
  }

  const root = document.getElementById('flashcard-root');
  const panel = root?.closest('.practice-panel');
  const btnRandom = panel?.querySelector('.btn-random');
  const btnLang = panel?.querySelector('.btn-lang');
  const btnHeaderSettings = document.getElementById('btn-header-settings');
  const settingsDialog = document.getElementById('word-settings-dialog');
  const btnReset = document.getElementById('btn-reset-word');
  const formRows = document.querySelectorAll('.form-row');

  let currentIndex = 0;
  let mode = 'forms';

  const fc = flash.init({
    root,
    onGrade: (remembered) => {
      gradeAndNext(remembered);
    },
  });
  if (!fc) return;

  function getDirection() {
    return fc.startWithRussian ? 'ru-el' : 'el-ru';
  }

  async function ensureFormCard(index) {
    const direction = getDirection();
    const id = db.cardId(wordSlug, 'form', index, direction);
    return db.getOrCreateCard(id, {
      deckId: db.GLOBAL_DECK_ID ?? 'global',
      wordSlug,
      type: 'form',
      formIndex: index,
      direction,
    });
  }

  async function ensureSummaryCard() {
    const direction = getDirection();
    const id = db.cardId(wordSlug, 'summary', null, direction);
    return db.getOrCreateCard(id, {
      deckId: db.GLOBAL_DECK_ID ?? 'global',
      wordSlug,
      type: 'summary',
      direction,
    });
  }

  async function gradeCurrent(remembered) {
    if (mode === 'summary') {
      const card = await ensureSummaryCard();
      await db.putCard(srs.gradeCard(card, remembered));
      await db.flushBackup();
      return;
    }
    const card = await ensureFormCard(currentIndex);
    await db.putCard(srs.gradeCard(card, remembered));
    await db.flushBackup();
  }

  function highlightRow() {
    formRows.forEach((row, i) => {
      row.classList.toggle('is-active', mode === 'forms' && i === currentIndex);
    });
  }

  function showForm(index) {
    mode = 'forms';
    currentIndex = ((index % forms.length) + forms.length) % forms.length;
    const form = forms[currentIndex];
    fc.showPair(form.greek, form.translation);
    highlightRow();
  }

  function showSummary() {
    mode = 'summary';
    const greekLines = baseForms.length ? baseForms : forms.slice(0, 3).map((f) => f.greek);
    if (fc.startWithRussian) {
      fc.showMultiLine([translation], greekLines, false, true);
    } else {
      fc.showMultiLine(greekLines, [translation], true, false);
    }
    formRows.forEach((row) => row.classList.remove('is-active'));
  }

  function randomForm() {
    let next;
    do {
      next = Math.floor(Math.random() * forms.length);
    } while (next === currentIndex && forms.length > 1);
    showForm(next);
  }

  function randomMixed() {
    if (Math.random() < 0.3 && baseForms.length) showSummary();
    else randomForm();
  }

  async function gradeAndNext(remembered) {
    await gradeCurrent(remembered);
    await updateWordProgress();
    randomMixed();
  }

  async function updateWordProgress() {
    const cards = await db.getWordCards(wordSlug);
    const st = srs.statsForWord(cards, wordSlug, forms.length, db);
    const bar = document.querySelector('.word-header [data-progress-slug]');
    srs.applyProgressBar(bar, st);
  }

  btnRandom?.addEventListener('click', randomMixed);
  btnLang?.addEventListener('click', () => {
    fc.toggleLang(btnLang);
    if (mode === 'summary') showSummary();
    else showForm(currentIndex);
  });

  btnReset?.addEventListener('click', async () => {
    if (!confirm('Сбросить прогресс этого слова?')) return;
    await db.deleteWordCards(wordSlug);
    await updateWordProgress();
    randomMixed();
    settingsDialog?.close();
  });

  btnHeaderSettings?.addEventListener('click', () => {
    settingsDialog?.showModal();
  });

  fc.setLangButton(btnLang);
  randomMixed();

  db.init()
    .then(() => updateWordProgress())
    .catch(() => {});
})();
