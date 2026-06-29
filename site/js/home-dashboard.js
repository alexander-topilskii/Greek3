(function () {
  const continueSection = document.getElementById('home-continue');
  if (!continueSection) return;

  const db = window.GreekDB;
  const srs = window.GreekSRS;
  const flash = window.GreekFlashcard;
  if (!db || !srs || !flash) return;

  const statsEl = continueSection.querySelector('[data-home-stats]');
  const btnPracticeEl = document.getElementById('btn-home-practice');
  const btnPracticeRu = document.getElementById('btn-home-practice-ru');
  const btnClose = document.getElementById('btn-close-home-practice');
  const practiceSection = document.getElementById('home-practice');
  const pathEl = document.getElementById('global-catalog-path');

  let catalog = null;
  let fc = null;
  let currentPick = null;
  let practiceDirection = null;

  async function loadCatalog() {
    if (!pathEl) return null;
    try {
      const meta = JSON.parse(pathEl.textContent ?? '{}');
      const res = await fetch(meta.url);
      if (!res.ok) throw new Error('catalog fetch failed');
      return res.json();
    } catch (err) {
      console.error('Global catalog load error', err);
      return null;
    }
  }

  function totalFormsByWord(words) {
    return Object.fromEntries(words.map((w) => [w.slug, w.formCount ?? 0]));
  }

  async function updateStats() {
    if (!catalog?.words?.length) {
      if (statsEl) statsEl.textContent = 'Каталог пуст — добавьте слова в words/.';
      return;
    }

    const cards = await db.getAllCards();
    const formCounts = totalFormsByWord(catalog.words);
    const stats = srs.getProgressStats(cards, formCounts, db);

    let mastered = 0;
    let learning = 0;
    let due = 0;
    const now = Date.now();

    for (const word of catalog.words) {
      const st = stats[word.slug] ?? { wordPct: 0, formsPct: 0 };
      const combined = (st.wordPct + st.formsPct) / 2;
      if (combined >= 95) mastered += 1;
      else if (combined > 0) learning += 1;

      for (const direction of srs.DIRECTIONS) {
        const id = db.cardId(word.slug, 'summary', null, direction);
        const card = cards.find((c) => c.id === id);
        if (card && srs.isDue(card, now) && (card.repetitions ?? 0) > 0) due += 1;
      }
    }

    const newCount = catalog.words.length - mastered - learning;
    if (statsEl) {
      statsEl.textContent = `${due} к повторению · ${learning} учу · ${newCount} новых · ${mastered} выучено`;
    }
  }

  function initFlashcard() {
    if (fc) return fc;
    const root = document.getElementById('home-flashcard-root');
    if (!root) return null;
    fc = flash.init({
      root,
      onGrade: (remembered) => gradeAndNext(remembered),
    });
    return fc;
  }

  function greekSummaryLines(word) {
    if (word.baseForms?.length) return word.baseForms;
    if (word.forms?.length) return word.forms.slice(0, 3).map((f) => f.greek);
    if (word.primaryGreek) return [word.primaryGreek];
    return [];
  }

  function showCardContent(pick) {
    if (!fc || !pick) return;
    const word = pick.word;
    const showRu = practiceDirection === 'ru-el';
    const greekLines = greekSummaryLines(word);

    if (showRu) {
      fc.showMultiLine([word.translation], greekLines, false, true);
    } else {
      fc.showMultiLine(greekLines, [word.translation], true, false);
    }
  }

  async function ensurePickCard(pick) {
    const direction = practiceDirection ?? 'ru-el';
    if (pick.isNew || !pick.card) {
      return db.getOrCreateCard(db.cardId(pick.word.slug, 'summary', null, direction), {
        deckId: 'global',
        wordSlug: pick.word.slug,
        type: 'summary',
        direction,
      });
    }
    return pick.card;
  }

  async function gradeAndNext(remembered) {
    if (!currentPick) return;
    const card = await ensurePickCard(currentPick);
    await db.putCard(srs.gradeCard(card, remembered));
    await updateStats();
    pickAndShowNext();
  }

  async function pickAndShowNext(options = {}) {
    const card = initFlashcard();
    if (!card || !catalog || !practiceDirection) return;

    try {
      currentPick = await srs.pickNextCard('global', catalog, db, {
        summaryOnly: true,
        direction: practiceDirection,
        dueOnly: options.dueOnly === true,
        crossDeck: true,
      });
    } catch (err) {
      console.error('Home practice pick error', err);
      currentPick = null;
    }

    if (!currentPick) {
      card.showPair('—', options.dueOnly
        ? 'Нет слов к повторению прямо сейчас.'
        : 'Весь словарь пройден. Повторения — по расписанию.');
      return;
    }

    showCardContent(currentPick);
  }

  function openPractice(direction) {
    const card = initFlashcard();
    if (!card || !catalog) return;
    practiceDirection = direction;
    practiceSection?.classList.remove('hidden');
    practiceSection?.setAttribute('aria-hidden', 'false');
    continueSection.querySelector('.home-continue-inner')?.classList.add('hidden');
    pickAndShowNext();
  }

  function closePractice() {
    practiceDirection = null;
    practiceSection?.classList.add('hidden');
    practiceSection?.setAttribute('aria-hidden', 'true');
    continueSection.querySelector('.home-continue-inner')?.classList.remove('hidden');
    updateStats();
  }

  btnPracticeEl?.addEventListener('click', () => openPractice('ru-el'));
  btnPracticeRu?.addEventListener('click', () => openPractice('el-ru'));
  btnClose?.addEventListener('click', closePractice);

  const practiceControls = practiceSection?.querySelector('.practice-controls');
  practiceControls?.querySelector('.btn-forget')?.addEventListener('click', () => gradeAndNext(false));
  practiceControls?.querySelector('.btn-remember')?.addEventListener('click', () => gradeAndNext(true));
  practiceControls?.querySelector('.btn-random')?.addEventListener('click', () => pickAndShowNext());

  db.migrateLegacyCards().then(async () => {
    catalog = await loadCatalog();
    await updateStats();
  });
})();
