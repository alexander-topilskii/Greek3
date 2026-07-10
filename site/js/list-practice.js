(function () {
  const listPage = document.querySelector('.verbs-list-page');
  if (!listPage) return;

  const db = window.GreekDB;
  const srs = window.GreekSRS;
  const flash = window.GreekFlashcard;
  const common = window.GreekPracticeCommon;
  if (!db || !srs || !flash || !common) return;

  const catalogEl = document.getElementById('verbs-catalog');
  if (!catalogEl) return;

  let catalog;
  try {
    catalog = JSON.parse(catalogEl.textContent ?? '{}');
  } catch (e) {
    console.error('Catalog parse error', e);
    return;
  }

  const deckId = catalog.deckId ?? listPage.getAttribute('data-deck-id') ?? 'verbs';
  const globalDeckId = db.GLOBAL_DECK_ID ?? 'global';
  const PRACTICE_NAV_ID = 'list-practice';
  const navBack = () => window.GreekNavBack;
  const catalogSlugs = catalog.words.map((w) => w.slug);
  const totalFormsByWord = Object.fromEntries(
    catalog.words.map((w) => [w.slug, w.formCount]),
  );

  const practiceActions = document.querySelector('.list-practice-actions');
  const btnPracticeEl = document.getElementById('btn-practice-el');
  const btnPracticeRu = document.getElementById('btn-practice-ru');
  const btnClose = document.getElementById('btn-close-practice');
  const practiceSection = document.getElementById('list-practice');
  const linksSection = document.getElementById('verbs-links');
  const btnHeaderSettings = document.getElementById('btn-header-settings');
  const settingsDialog = document.getElementById('deck-settings-dialog');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnResetDeck = document.getElementById('btn-reset-deck');
  const inputInitial = document.getElementById('setting-initial-batch');
  const inputActive = document.getElementById('setting-active-limit');
  const practiceComplete = document.getElementById('practice-complete');
  const btnRepeatSession = document.getElementById('btn-repeat-session');

  let currentPick = null;
  /** Fixed for the session: 'el-ru' (русский) or 'ru-el' (греческий). */
  let practiceDirection = null;
  let fc = null;

  function showRussianFirst() {
    return practiceDirection === 'ru-el';
  }

  function syncPracticeButtons() {
    [btnPracticeEl, btnPracticeRu].forEach((btn) => {
      if (!btn) return;
      const active = btn.getAttribute('data-practice-direction') === practiceDirection;
      btn.classList.toggle('btn-primary', active);
      btn.classList.toggle('btn-secondary', !active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function syncCardDisplay() {
    if (!fc) return;
    fc.startWithRussian = showRussianFirst();
    fc.setLangButton(btnLang);
  }

  function setPracticeComplete(visible) {
    practiceComplete?.classList.toggle('hidden', !visible);
    practiceComplete?.toggleAttribute('hidden', !visible);
    practiceControls?.classList.toggle('hidden', visible);
    practiceControls?.toggleAttribute('hidden', visible);
    if (visible) hideExamplesButton();
  }

  function initFlashcard() {
    if (fc) return fc;
    const root = document.getElementById('list-flashcard-root');
    if (!root) return null;
    fc = flash.init({
      root,
      onGrade: (remembered) => {
        gradeAndNext(remembered);
      },
    });
    return fc;
  }

  async function gradeAndNext(remembered) {
    await gradeCurrent(remembered);
    await updateProgressUI();
    pickAndShowNext();
  }

  const practiceControls = practiceSection?.querySelector('.practice-controls');
  const btnRandom = practiceControls?.querySelector('.btn-random');
  const btnLang = practiceControls?.querySelector('.btn-lang');
  const btnExamples = practiceControls?.querySelector('.btn-examples');
  const examples = window.GreekExamples;

  function syncExamplesButton(word) {
    examples?.syncButton(btnExamples, word);
  }

  function hideExamplesButton() {
    examples?.hideButton(btnExamples);
  }

  async function loadSettingsUI() {
    const s = await srs.loadDeckSettings(deckId, db);
    if (inputInitial) inputInitial.value = String(s.initialBatchSize);
    if (inputActive) inputActive.value = String(s.activeLimit);
  }

  async function getCatalogCards() {
    return db.getCardsForSlugs(catalogSlugs);
  }

  async function updateProgressUI() {
    const cards = await getCatalogCards();
    const stats = srs.getProgressStats(cards, totalFormsByWord, db);

    document.querySelectorAll('[data-progress-slug]').forEach((el) => {
      const slug = el.getAttribute('data-progress-slug');
      if (!slug || !catalogSlugs.includes(slug)) return;
      const st = stats[slug] ?? { wordPct: 0, formsPct: 0, elRuReps: 0, ruElReps: 0, elRuMax: 5, ruElMax: 5 };
      srs.applyProgressBar(el, st);
    });

    sortWordLinks(stats, cards);
  }

  /** Lower rank = higher in list (unknown first, mastered last). */
  function wordSortRank(slug, stats, cards) {
    const st = stats[slug] ?? { wordPct: 0, formsPct: 0 };
    const combined = (st.wordPct + st.formsPct) / 2;
    const elRu = cards.find(
      (c) =>
        c.wordSlug === slug &&
        c.type === 'summary' &&
        (c.direction ?? 'el-ru') === 'el-ru',
    );
    const ruEl = cards.find(
      (c) => c.wordSlug === slug && c.type === 'summary' && c.direction === 'ru-el',
    );
    const hasAny = (elRu?.repetitions ?? 0) > 0 || (ruEl?.repetitions ?? 0) > 0;

    if (!elRu && !ruEl) return combined;
    if (!hasAny) return combined;
    if (elRu && ruEl && srs.isMastered(elRu) && srs.isMastered(ruEl)) {
      return 20000 + combined;
    }
    return 1000 + combined;
  }

  function sortWordLinks(stats, cards) {
    document.querySelectorAll('.links-group-items').forEach((container) => {
      const links = [...container.querySelectorAll('.word-link[data-word-slug]')].filter(
        (el) => el.getAttribute('data-word-slug'),
      );
      if (links.length < 2) return;

      links.sort((a, b) => {
        const slugA = a.getAttribute('data-word-slug');
        const slugB = b.getAttribute('data-word-slug');
        const diff = wordSortRank(slugA, stats, cards) - wordSortRank(slugB, stats, cards);
        if (diff !== 0) return diff;
        return (a.querySelector('.word-link-label')?.textContent ?? '').localeCompare(
          b.querySelector('.word-link-label')?.textContent ?? '',
          'ru',
        );
      });

      links.forEach((link) => container.appendChild(link));
    });
  }

  async function showCardContent(pick) {
    await common.showCardContent(fc, pick, {
      practiceDirection: practiceDirection,
      supportsForms: true,
      db,
    });
  }

  async function ensurePickCard(pick) {
    return common.ensurePickCard(pick, db, {
      globalDeckId,
      practiceDirection,
      supportsForms: true,
    });
  }

  async function gradeCurrent(remembered) {
    await common.gradeCurrentWithPoolExpand({
      currentPick,
      db,
      srs,
      deckId,
      catalog,
      getCards: getCatalogCards,
      remembered,
      practiceDirection,
      supportsForms: true,
    });
  }

  async function pickAndShowNext() {
    const card = initFlashcard();
    if (!card || !practiceDirection) return;

    setPracticeComplete(false);
    syncCardDisplay();

    try {
      currentPick = await srs.pickNextCard(deckId, catalog, db, {
        summaryOnly: true,
        direction: practiceDirection,
      });
      const s = await srs.loadDeckSettings(deckId, db);
      if (inputActive) inputActive.value = String(s.activeLimit);
    } catch (err) {
      console.error('Practice pick error', err);
      currentPick = catalog.words[0]
        ? { word: catalog.words[0], isNew: true, type: 'summary', direction: practiceDirection }
        : null;
    }

    if (!currentPick) {
      const sessionDone = srs.isSessionActive();
      card.showPair(
        '—',
        sessionDone
          ? 'Направление пройдено в этой сессии — смените режим или закройте практику'
          : 'Все слова пройдены!',
      );
      hideExamplesButton();
      setPracticeComplete(true);
      return;
    }

    await showCardContent(currentPick);
    syncExamplesButton(currentPick.word);
  }

  async function openPractice(direction) {
    const card = initFlashcard();
    if (!card) return;

    await srs.loadRecentPicks(db);
    srs.beginSession();
    practiceDirection = direction;
    db.setSetting('practice:lastDirection', direction);
    syncPracticeButtons();
    practiceSection?.classList.remove('hidden');
    practiceSection?.setAttribute('aria-hidden', 'false');
    linksSection?.classList.add('hidden');
    practiceActions?.classList.add('hidden');
    navBack()?.push(PRACTICE_NAV_ID, () => closePractice(true));
    syncCardDisplay();
    pickAndShowNext();
  }

  function closePractice(fromNav = false) {
    srs.endSession(db);
    practiceSection?.classList.add('hidden');
    practiceSection?.setAttribute('aria-hidden', 'true');
    linksSection?.classList.remove('hidden');
    practiceActions?.classList.remove('hidden');
    setPracticeComplete(false);
    updateProgressUI();
    if (!fromNav) navBack()?.dismiss(PRACTICE_NAV_ID);
  }

  async function repeatSession() {
    if (!practiceDirection) return;
    await srs.loadRecentPicks(db);
    srs.beginSession();
    await srs.repeatCatalogSession(deckId, catalog, db, practiceDirection);
    await pickAndShowNext();
  }

  btnPracticeEl?.addEventListener('click', () => openPractice('ru-el'));
  btnPracticeRu?.addEventListener('click', () => openPractice('el-ru'));
  btnClose?.addEventListener('click', closePractice);
  btnRepeatSession?.addEventListener('click', repeatSession);

  btnRandom?.addEventListener('click', pickAndShowNext);

  btnExamples?.addEventListener('click', () => {
    if (currentPick?.word) examples?.show(currentPick.word);
  });

  btnSaveSettings?.addEventListener('click', async () => {
    await srs.saveDeckSettings(deckId, db, {
      initialBatchSize: parseInt(inputInitial?.value ?? '5', 10),
      activeLimit: parseInt(inputActive?.value ?? '5', 10),
    });
    await loadSettingsUI();
    updateProgressUI();
    settingsDialog?.close();
  });

  btnResetDeck?.addEventListener('click', async () => {
    if (!confirm('Сбросить прогресс по словам этого раздела?')) return;
    await db.deleteCardsForSlugs(catalogSlugs);
    await db.setSetting(`deck:${deckId}:activeLimit`, parseInt(inputInitial?.value ?? '5', 10));
    updateProgressUI();
    if (!practiceSection?.classList.contains('hidden')) pickAndShowNext();
    settingsDialog?.close();
  });

  btnHeaderSettings?.addEventListener('click', async () => {
    await loadSettingsUI();
    settingsDialog?.showModal();
  });

  db.init().then(() => {
    loadSettingsUI();
    updateProgressUI();
  });
})();
