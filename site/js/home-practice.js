(function () {
  const homePage = document.querySelector('.home-page');
  if (!homePage) return;

  const db = window.GreekDB;
  const srs = window.GreekSRS;
  const flash = window.GreekFlashcard;
  if (!db || !srs || !flash) return;

  const catalogEl = document.getElementById('global-catalog');
  if (!catalogEl) return;

  let catalog;
  try {
    catalog = JSON.parse(catalogEl.textContent ?? '{}');
  } catch (e) {
    console.error('Global catalog parse error', e);
    return;
  }

  const deckId = catalog.deckId ?? 'global';
  const globalDeckId = db.GLOBAL_DECK_ID ?? 'global';
  const categoryLabels = catalog.categoryLabels ?? {};
  const catalogSlugs = catalog.words.map((w) => w.slug);
  const totalFormsByWord = Object.fromEntries(
    catalog.words.map((w) => [w.slug, w.formCount]),
  );

  const btnContinue = document.getElementById('btn-continue');
  const btnClose = document.getElementById('btn-close-practice');
  const practiceSection = document.getElementById('home-practice');
  const sectionsGrid = document.getElementById('sections-grid');
  const heroContinue = document.getElementById('hero-continue');
  const continueHint = document.getElementById('continue-hint');
  const directionBadge = document.getElementById('practice-direction-badge');
  const poolProgress = document.getElementById('practice-pool-progress');
  const poolDotsEl = document.getElementById('practice-pool-dots');
  const poolCountResting = document.getElementById('practice-pool-count-resting');
  const poolCountTotal = document.getElementById('practice-pool-count-total');
  const poolLabelLearned = document.getElementById('practice-pool-label-learned');
  const poolLabelActive = document.getElementById('practice-pool-label-active');
  const poolLabelResting = document.getElementById('practice-pool-label-resting');
  const poolLabelNew = document.getElementById('practice-pool-label-new');
  const wordSourceEl = document.getElementById('practice-word-source');
  const sessionBar = document.getElementById('practice-session-bar');
  const catalogComplete = document.getElementById('practice-catalog-complete');
  const btnRepeatCatalog = document.getElementById('btn-repeat-catalog');
  const btnHeaderSettings = document.getElementById('btn-header-settings');
  const settingsDialog = document.getElementById('home-settings-dialog');
  const btnResetAll = document.getElementById('btn-reset-all-progress');
  const inputGroupSize = document.getElementById('home-setting-group-size');
  const btnSaveHomeSettings = document.getElementById('btn-save-home-settings');

  let currentPick = null;
  let fc = null;
  let poolDotsSnapshot = { slugs: [], slugToState: new Map() };

  const practiceControls = practiceSection?.querySelector('.practice-controls');
  const btnWordLink = practiceControls?.querySelector('.btn-word-link');
  const btnExamples = practiceControls?.querySelector('.btn-examples');
  const examples = window.GreekExamples;

  const RESUME_KEY = 'greek3:home-practice-resume';

  function siteBasePrefix() {
    const logoHref = document.querySelector('.logo')?.getAttribute('href') ?? '/';
    return logoHref.replace(/\/?index\.html$/, '').replace(/\/$/, '');
  }

  function wordPageHref(href) {
    const base = siteBasePrefix();
    const encoded = href
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return `${base}/words/${encoded}`;
  }

  function saveResumeState() {
    if (!currentPick?.word?.slug) return;
    try {
      sessionStorage.setItem(
        RESUME_KEY,
        JSON.stringify({
          slug: currentPick.word.slug,
          direction: currentPick.direction ?? 'el-ru',
        }),
      );
    } catch (err) {
      console.warn('Could not save practice resume state', err);
    }
  }

  function clearResumeState() {
    try {
      sessionStorage.removeItem(RESUME_KEY);
    } catch (err) {
      console.warn('Could not clear practice resume state', err);
    }
  }

  function readResumeState() {
    try {
      const raw = sessionStorage.getItem(RESUME_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.slug) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function scrollToHeroContinue() {
    (heroContinue ?? btnContinue)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function syncWordLink(pick) {
    if (!btnWordLink) return;
    if (!pick?.word?.href) {
      btnWordLink.classList.add('hidden');
      btnWordLink.setAttribute('hidden', '');
      btnWordLink.setAttribute('aria-disabled', 'true');
      btnWordLink.removeAttribute('href');
      return;
    }
    btnWordLink.href = wordPageHref(pick.word.href);
    btnWordLink.classList.remove('hidden');
    btnWordLink.removeAttribute('hidden');
    btnWordLink.removeAttribute('aria-disabled');
  }

  function syncExamplesButton(word) {
    examples?.syncButton(btnExamples, word);
  }

  function hideExamplesButton() {
    examples?.hideButton(btnExamples);
  }

  function hideWordLink() {
    if (!btnWordLink) return;
    btnWordLink.classList.add('hidden');
    btnWordLink.setAttribute('hidden', '');
    btnWordLink.setAttribute('aria-disabled', 'true');
    btnWordLink.removeAttribute('href');
    hideExamplesButton();
  }

  function directionLabel(direction) {
    return direction === 'ru-el' ? 'Ру → Ελ' : 'Ελ → Ру';
  }

  function setWordSource(word, direction) {
    if (!wordSourceEl) return;
    const source = srs.wordSourceLabel(word, categoryLabels);
    wordSourceEl.textContent = direction
      ? `${source} · ${directionLabel(direction)}`
      : source;
    wordSourceEl.classList.remove('hidden');
    wordSourceEl.removeAttribute('hidden');
  }

  function hideWordSource() {
    wordSourceEl?.classList.add('hidden');
    wordSourceEl?.setAttribute('hidden', '');
  }

  function applyPoolDotsLayout(count) {
    if (!poolDotsEl) return;
    const rows = count > 12 ? 2 : 1;
    const perRow = Math.ceil(count / rows);
    const gapPx = count > 24 ? 3 : count > 15 ? 4 : 5;
    const dotPx = Math.min(11, Math.max(6, Math.floor((300 - gapPx * Math.max(0, perRow - 1)) / perRow)));
    poolDotsEl.style.setProperty('--pool-dot-size', `${dotPx}px`);
    poolDotsEl.style.setProperty('--pool-dot-gap', `${gapPx}px`);
    poolDotsEl.classList.toggle('pool-dots--compact', count > 12);
  }

  function createPoolDotEl(dot) {
    const el = document.createElement('span');
    el.className = 'pool-dot';
    el.classList.add(`pool-dot--${dot.state}`);
    if (dot.isCurrent) el.classList.add('pool-dot--current');
    el.dataset.slug = dot.slug;
    el.setAttribute('role', 'listitem');
    el.setAttribute('title', dot.label);
    el.style.setProperty('--pool-dot-progress', `${dot.progress}%`);
    return el;
  }

  function updatePoolDotEl(el, dot) {
    el.className = 'pool-dot';
    el.classList.add(`pool-dot--${dot.state}`);
    if (dot.isCurrent) el.classList.add('pool-dot--current');
    el.style.setProperty('--pool-dot-progress', `${dot.progress}%`);
    el.setAttribute('title', dot.label);
  }

  function animatePoolDotExit(el) {
    if (!el || el.classList.contains('pool-dot--exit')) return;
    el.classList.add('pool-dot--exit');
    const remove = () => el.remove();
    el.addEventListener('animationend', remove, { once: true });
    setTimeout(remove, 450);
  }

  function syncPoolDots(pool, cards, currentSlug) {
    if (!poolDotsEl) return;
    const dots = srs.getPoolDots(pool, cards, db, currentSlug);
    applyPoolDotsLayout(dots.length);

    const newSlugOrder = dots.map((d) => d.slug);
    const prevSlugs = new Set(poolDotsSnapshot.slugs);
    const prevStates = poolDotsSnapshot.slugToState;
    const newSlugs = new Set(newSlugOrder);

    for (const slug of prevSlugs) {
      if (newSlugs.has(slug)) continue;
      const oldEl = poolDotsEl.querySelector(`.pool-dot[data-slug="${slug}"]`);
      if (oldEl && !oldEl.classList.contains('pool-dot--exit')) {
        animatePoolDotExit(oldEl);
      }
    }

    const existingBySlug = new Map();
    poolDotsEl.querySelectorAll('.pool-dot').forEach((el) => {
      if (el.dataset.slug && !el.classList.contains('pool-dot--exit')) {
        existingBySlug.set(el.dataset.slug, el);
      }
    });

    const nextEls = [];
    for (const dot of dots) {
      const prevState = prevStates.get(dot.slug);
      let el = existingBySlug.get(dot.slug);

      if (el) {
        existingBySlug.delete(dot.slug);
        updatePoolDotEl(el, dot);
        if (dot.state === 'mastered' && prevState && prevState !== 'mastered') {
          el.classList.add('pool-dot--mastered-pop');
        }
      } else {
        el = createPoolDotEl(dot);
        if (!prevSlugs.has(dot.slug)) {
          el.classList.add('pool-dot--enter');
        }
      }
      nextEls.push(el);
    }

    for (const [, el] of existingBySlug) {
      el.remove();
    }

    const exitingEls = [...poolDotsEl.querySelectorAll('.pool-dot--exit')];
    poolDotsEl.replaceChildren(...nextEls, ...exitingEls);

    poolDotsSnapshot = {
      slugs: newSlugOrder,
      slugToState: new Map(dots.map((d) => [d.slug, d.state])),
    };
  }

  async function syncSessionInfo(settings, cards) {
    if (directionBadge && currentPick?.direction) {
      directionBadge.textContent = directionLabel(currentPick.direction);
    } else if (directionBadge) {
      directionBadge.textContent = 'По словам';
    }
    if (poolProgress) {
      const pool = srs.getActivePoolWords(catalog, cards, db, settings);
      const direction = currentPick?.direction ?? srs.resolveAutoDirection(catalog, cards, db, settings);
      const {
        learned,
        total,
        directionMastered,
        directionLearning,
        directionNew,
      } = srs.getPoolProgress(pool, cards, db, direction);

      const dots = srs.getPoolDots(pool, cards, db, currentPick?.word?.slug ?? null);
      const resting = dots.filter((d) => d.state === 'resting').length;

      syncPoolDots(pool, cards, currentPick?.word?.slug ?? null);

      if (poolCountResting) poolCountResting.textContent = String(resting);
      if (poolCountTotal) poolCountTotal.textContent = String(total);

      if (poolLabelLearned) {
        poolLabelLearned.textContent = `${directionMastered || learned} усвоено`;
      }
      if (poolLabelActive) {
        poolLabelActive.textContent = `${directionLearning} в работе`;
      }
      if (poolLabelResting) {
        poolLabelResting.textContent = `${resting} отдыхает`;
      }
      if (poolLabelNew) {
        poolLabelNew.textContent = `${directionNew} новых`;
      }
    }
  }

  function hideCompletionPanels() {
    catalogComplete?.classList.add('hidden');
    catalogComplete?.setAttribute('hidden', '');
    practiceControls?.classList.remove('hidden');
    practiceControls?.removeAttribute('hidden');
    sessionBar?.classList.remove('hidden');
    sessionBar?.removeAttribute('hidden');
  }

  function showCatalogCompleteUI() {
    catalogComplete?.classList.remove('hidden');
    catalogComplete?.removeAttribute('hidden');
    practiceControls?.classList.add('hidden');
    practiceControls?.setAttribute('hidden', '');
    hideWordSource();
    hideWordLink();
    sessionBar?.classList.add('hidden');
    sessionBar?.setAttribute('hidden', '');
    const card = initFlashcard();
    card?.showPair('—', 'Все слова пройдены!');
  }

  function syncCardDisplay(pick) {
    if (!fc || !pick) return;
    fc.startWithRussian = pick.direction === 'ru-el';
  }

  function initFlashcard() {
    if (fc) return fc;
    const root = document.getElementById('home-flashcard-root');
    if (!root) return null;
    fc = flash.init({
      root,
      onGrade: (remembered) => {
        gradeAndNext(remembered);
      },
    });
    return fc;
  }

  function greekSummaryLines(word) {
    if (word.baseForms?.length) return word.baseForms;
    if (word.forms?.length) return word.forms.slice(0, 3).map((f) => f.greek);
    return [];
  }

  function showCardContent(pick) {
    if (!fc || !pick) return;
    const word = pick.word;
    const greekLines = greekSummaryLines(word);
    syncCardDisplay(pick);
    if (pick.direction === 'ru-el') {
      fc.showMultiLine([word.translation], greekLines, false, true);
    } else {
      fc.showMultiLine(greekLines, [word.translation], true, false);
    }
    setWordSource(word, pick.direction);
    syncWordLink(pick);
    syncExamplesButton(word);
  }

  async function ensurePickCard(pick) {
    const direction = pick.direction ?? 'el-ru';
    return db.getOrCreateCard(db.cardId(pick.word.slug, 'summary', null, direction), {
      deckId: globalDeckId,
      wordSlug: pick.word.slug,
      type: 'summary',
      direction,
    });
  }

  async function gradeCurrent(remembered) {
    if (!currentPick) return;
    const slug = currentPick.word.slug;
    const cardsBefore = await db.getCardsForSlugs(catalogSlugs);
    const wasDone = srs.isWordDoneForPool(slug, cardsBefore, db);

    const card = await ensurePickCard(currentPick);
    const graded = srs.gradeCard(card, remembered);
    await db.putCard(graded);
    await db.flushBackup();
    if (remembered && currentPick.direction) {
      srs.recordSessionCorrect(slug, currentPick.direction);
    }

    if (remembered && !wasDone) {
      const cardsAfter = await db.getCardsForSlugs(catalogSlugs);
      const settings = await srs.loadDeckSettings(deckId, db);
      const hadProgress = cardsBefore.some(
        (c) =>
          c.wordSlug === slug &&
          c.type === 'summary' &&
          ((c.repetitions ?? 0) > 0 || (c.remembered ?? 0) > 0),
      );
      if (!hadProgress) {
        await srs.expandPoolOnFirstTouch(
          deckId,
          catalog,
          db,
          settings,
          slug,
          cardsBefore,
        );
      }
      if (srs.isWordDoneForPool(slug, cardsAfter, db)) {
        await srs.expandPoolOnWordLearned(deckId, catalog, db, settings);
      }
    }
  }

  async function updateContinueHint() {
    if (!continueHint) return;
    const cards = await db.getCardsForSlugs(catalogSlugs);
    const settings = await srs.loadDeckSettings(deckId, db);
    const pool = srs.getActivePoolWords(catalog, cards, db, settings);
    const direction = srs.resolveAutoDirection(catalog, cards, db, settings);
    const { learned, directionLearning, total, directionMastered } = srs.getPoolProgress(
      pool,
      cards,
      db,
      direction,
    );
    const inProgress = directionLearning;

    if (srs.isCatalogFullyMastered(catalog, cards, db)) {
      continueHint.textContent = `Все слова пройдены — можно повторить`;
      return;
    }

    const mastered = directionMastered || learned;
    if (mastered > 0) {
      continueHint.textContent =
        `В группе ${mastered} из ${total} усвоено, ${inProgress} в работе · всего в словаре ${catalogSlugs.length}`;
    } else if (inProgress > 0) {
      continueHint.textContent =
        `В группе ${inProgress} из ${total} в работе · всего в словаре ${catalogSlugs.length}`;
    } else if (total > 0) {
      continueHint.textContent =
        `Группа из ${total} слов · свайп вправо «Помню» после переворота`;
    }
  }

  async function loadHomeSettingsUI() {
    const s = await srs.loadDeckSettings(deckId, db);
    if (inputGroupSize) inputGroupSize.value = String(s.initialBatchSize);
  }

  async function saveHomeSettings() {
    const groupSize = parseInt(inputGroupSize?.value ?? '5', 10);
    const clamped = Math.max(1, Math.min(30, groupSize));
    await srs.saveDeckSettings(deckId, db, {
      initialBatchSize: clamped,
      activeLimit: clamped,
    });
    if (inputGroupSize) inputGroupSize.value = String(clamped);
    settingsDialog?.close();
    await updateContinueHint();
    if (!practiceSection?.classList.contains('hidden')) {
      await pickAndShowNext();
    }
  }

  async function pickAndShowNext() {
    const card = initFlashcard();
    if (!card) return;

    hideCompletionPanels();

    const settings = await srs.loadDeckSettings(deckId, db);
    const cards = await db.getCardsForSlugs(catalogSlugs);
    await syncSessionInfo(settings, cards);

    if (srs.isCatalogFullyMastered(catalog, cards, db)) {
      showCatalogCompleteUI();
      return;
    }

    try {
      currentPick = await srs.pickNextCard(deckId, catalog, db, {
        summaryOnly: true,
        perWordDirection: true,
      });
    } catch (err) {
      console.error('Home practice pick error', err);
      const pool = srs.getActivePoolWords(catalog, cards, db, settings);
      const fallback = pool[0];
      currentPick = fallback
        ? {
            word: fallback,
            isNew: true,
            type: 'summary',
            direction: srs.getWordPracticeDirection(fallback.slug, cards, db) ?? 'el-ru',
          }
        : null;
    }

    if (!currentPick) {
      card.showPair('—', 'Нет слов к повторению — загляните позже');
      hideWordSource();
      hideWordLink();
      return;
    }

    showCardContent(currentPick);
    await syncSessionInfo(settings, cards);
  }

  async function gradeAndNext(remembered) {
    await gradeCurrent(remembered);
    await updateContinueHint();
    await pickAndShowNext();
  }

  async function openPractice(resumePick) {
    const card = initFlashcard();
    if (!card) return;

    try {
      await db.init();
    } catch (err) {
      console.error('Home practice init error', err);
      if (continueHint) {
        continueHint.textContent = 'Не удалось загрузить прогресс — проверьте, что сайт не в режиме инкогнито';
      }
      return;
    }

    await srs.loadRecentPicks(db);
    srs.beginSession();
    hideCompletionPanels();
    practiceSection?.classList.remove('hidden');
    practiceSection?.setAttribute('aria-hidden', 'false');
    sectionsGrid?.classList.add('hidden');
    heroContinue?.classList.add('hidden');
    heroContinue?.setAttribute('hidden', '');

    if (resumePick) {
      currentPick = resumePick;
      showCardContent(currentPick);
      const settings = await srs.loadDeckSettings(deckId, db);
      const cards = await db.getCardsForSlugs(catalogSlugs);
      await syncSessionInfo(settings, cards);
      return;
    }

    await pickAndShowNext();
  }

  function closePractice() {
    srs.endSession(db);
    clearResumeState();
    practiceSection?.classList.add('hidden');
    practiceSection?.setAttribute('aria-hidden', 'true');
    sectionsGrid?.classList.remove('hidden');
    heroContinue?.classList.remove('hidden');
    heroContinue?.removeAttribute('hidden');
    hideCompletionPanels();
    updateContinueHint();
  }

  async function repeatCatalog() {
    await srs.loadRecentPicks(db);
    srs.beginSession();
    const fullSettings = {
      ...(await srs.loadDeckSettings(deckId, db)),
      activeLimit: catalog.words.length,
    };
    await srs.resetStudyPoolMastery(catalog, db, fullSettings);
    await srs.saveDeckSettings(deckId, db, {
      activeLimit: srs.DEFAULTS.initialBatchSize,
    });
    currentPick = null;
    await updateContinueHint();
    await pickAndShowNext();
  }

  btnContinue?.addEventListener('click', () => openPractice());
  btnClose?.addEventListener('click', closePractice);
  btnRepeatCatalog?.addEventListener('click', repeatCatalog);

  btnWordLink?.addEventListener('click', (event) => {
    if (!currentPick?.word?.href) {
      event.preventDefault();
      return;
    }
    saveResumeState();
  });

  btnExamples?.addEventListener('click', () => {
    if (currentPick?.word) examples?.show(currentPick.word);
  });

  btnHeaderSettings?.addEventListener('click', async () => {
    await loadHomeSettingsUI();
    settingsDialog?.showModal();
  });

  btnSaveHomeSettings?.addEventListener('click', saveHomeSettings);

  btnResetAll?.addEventListener('click', async () => {
    if (!confirm('Сбросить весь прогресс? Все выученные слова будут забыты.')) return;
    await db.resetAllProgress();
    currentPick = null;
    await updateContinueHint();
    settingsDialog?.close();
    if (!practiceSection?.classList.contains('hidden')) {
      await pickAndShowNext();
    }
  });

  async function tryResumePractice() {
    const state = readResumeState();
    if (!state) return;

    clearResumeState();

    const word = catalog.words.find((w) => w.slug === state.slug);
    if (!word) return;

    scrollToHeroContinue();

    await openPractice({
      word,
      direction: state.direction ?? srs.getWordPracticeDirection(word.slug, await db.getCardsForSlugs(catalogSlugs), db) ?? 'el-ru',
      type: 'summary',
      isNew: false,
    });
  }

  async function initHomePractice() {
    try {
      await db.init();
      await loadHomeSettingsUI();
      await updateContinueHint();
      await tryResumePractice();
    } catch (err) {
      console.error('Home practice init error', err);
      if (continueHint) {
        continueHint.textContent = 'Не удалось загрузить прогресс — проверьте, что сайт не в режиме инкогнито';
      }
    }
  }

  initHomePractice();
})();
