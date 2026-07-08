(function () {
  const homePage = document.querySelector('.home-page');
  if (!homePage) return;

  const db = window.GreekDB;
  const srs = window.GreekSRS;
  const flash = window.GreekFlashcard;
  const ladder = window.GreekLearningLadder;
  const quizStep = window.GreekQuizStep;
  const matchStep = window.GreekMatchStep;
  const common = window.GreekPracticeCommon;
  if (!db || !srs || !flash || !ladder || !common) return;

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

  const learnViewFlashcard = document.getElementById('learn-view-flashcard');
  const learnViewQuiz = document.getElementById('learn-view-quiz');
  const learnViewMatch = document.getElementById('learn-view-match');
  let currentLearningStep = ladder.STEPS.SUMMARY;
  let quizUi = null;
  let matchUi = null;

  const SESSION_KEY = 'greek3:home-practice-session';

  function showLearningView(step) {
    currentLearningStep = step;

    const isSummary = step === ladder.STEPS.SUMMARY;
    const isQuiz = step === ladder.STEPS.QUIZ;
    const isMatch = step === ladder.STEPS.MATCH;

    learnViewFlashcard?.classList.toggle('hidden', !isSummary);
    learnViewFlashcard?.toggleAttribute('hidden', !isSummary);
    learnViewQuiz?.classList.toggle('hidden', !isQuiz);
    learnViewQuiz?.toggleAttribute('hidden', !isQuiz);
    learnViewMatch?.classList.toggle('hidden', !isMatch);
    learnViewMatch?.toggleAttribute('hidden', !isMatch);

    practiceControls?.classList.toggle('hidden', !isSummary);
    practiceControls?.toggleAttribute('hidden', !isSummary);

    if (isQuiz) {
      learnViewQuiz?.classList.remove('learn-step--visible');
      requestAnimationFrame(() => learnViewQuiz?.classList.add('learn-step--enter'));
    }
    if (isMatch) {
      learnViewMatch?.classList.remove('learn-step--visible');
      requestAnimationFrame(() => learnViewMatch?.classList.add('learn-step--enter'));
    }
  }

  async function usesLearningLadder(pick) {
    if (!pick?.word) return false;
    const card = await ensurePickCard(pick);
    return ladder.shouldUseLadder(card, srs);
  }

  async function setLearningStep(pick, stepIndex, extra = {}) {
    const card = await ensurePickCard(pick);
    await db.putCard({ ...card, learningStep: stepIndex, ...extra });
  }

  async function clearLearningLadderState(pick) {
    const card = await ensurePickCard(pick);
    await db.putCard({ ...card, learningStep: 0, learningPath: undefined });
  }

  async function ensureLearningPath(pick) {
    const card = await ensurePickCard(pick);
    if (Array.isArray(card.learningPath) && card.learningPath.length) {
      return card.learningPath;
    }
    const path = ladder.buildLearningPath(pick.word);
    await setLearningStep(pick, card.learningStep ?? 0, { learningPath: path });
    return path;
  }

  async function finishLadderCycle() {
    if (!currentPick) return;
    await clearLearningLadderState(currentPick);
    showLearningView(ladder.STEPS.SUMMARY);
    await updateContinueHint();
    await pickAndShowNext();
  }

  async function advanceLadderOrFinish(pick) {
    const card = await ensurePickCard(pick);
    const path = card.learningPath ?? (await ensureLearningPath(pick));
    const stepIdx = card.learningStep ?? 1;

    if (ladder.isLastLadderGame(stepIdx, path)) {
      await gradeCurrent(true);
      await finishLadderCycle();
      return;
    }

    await setLearningStep(pick, stepIdx + 1);
    await pickAndShowNext();
  }

  async function onLearningGamePassed() {
    if (!currentPick) return;
    await advanceLadderOrFinish(currentPick);
  }

  async function skipUnavailableLadderGame(pick) {
    const card = await ensurePickCard(pick);
    const path = card.learningPath ?? [];
    const stepIdx = card.learningStep ?? 1;
    const pathIndex = stepIdx - 1;
    const stepName = ladder.learningPathStepName(path, pathIndex);

    if (stepName === ladder.STEPS.MATCH) {
      const matchPairs = ladder.getMatchPairs(pick.word);
      if (matchPairs.length < 2) {
        await advanceLadderOrFinish(pick);
        return true;
      }
    }
    return false;
  }

  async function showQuizForPick(pick) {
    const word = pick.word;
    const direction = pick.direction ?? 'el-ru';
    const pairs = ladder.getBaseFormPairs(word);
    const pair = ladder.pickRandomPair(pairs);
    if (!pair) {
      if (await skipUnavailableLadderGame(pick)) return;
      await advanceLadderOrFinish(pick);
      return;
    }

    const settings = await srs.loadDeckSettings(deckId, db);
    const cards = await db.getCardsForSlugs(catalogSlugs);
    const pool = srs.getActivePoolWords(catalog, cards, db, settings);
    const optionPool = pool.length >= 4 ? pool : catalog.words;
    const options = ladder.buildQuizOptions(optionPool, word, pair, direction);

    if (!quizUi && learnViewQuiz && quizStep) {
      quizUi = quizStep.init({
        root: learnViewQuiz,
        onResult: (correct) => {
          if (correct) onLearningGamePassed();
          else failLearningLadder();
        },
      });
    }

    showLearningView(ladder.STEPS.QUIZ);

    setWordSource(word, direction);
    syncWordLink(pick);
    syncExamplesButton(word);

    const elRu = direction === 'el-ru';
    quizUi?.show({
      prompt: elRu ? pair.greek : pair.translation,
      promptIsGreek: elRu,
      options,
      correct: elRu ? pair.translation : pair.greek,
      promptLabel: elRu ? 'Выберите перевод' : 'Выберите греческую форму',
    });
  }

  async function showMatchForPick(pick) {
    const word = pick.word;
    const matchPairs = ladder.getMatchPairs(word);

    if (!matchUi && learnViewMatch && matchStep) {
      matchUi = matchStep.init({
        root: learnViewMatch,
        onResult: (correct) => {
          if (correct) onLearningGamePassed();
          else failLearningLadder();
        },
      });
    }

    showLearningView(ladder.STEPS.MATCH);
    setWordSource(word, pick.direction ?? 'el-ru');
    syncWordLink(pick);
    syncExamplesButton(word);
    matchUi?.show({ matchPairs });
  }

  async function failLearningLadder() {
    if (currentPick) await clearLearningLadderState(currentPick);
    showLearningView(ladder.STEPS.SUMMARY);
    await gradeCurrent(false);
    await updateContinueHint();
    await pickAndShowNext();
  }

  async function resumeLearningStep(pick) {
    const card = await ensurePickCard(pick);
    const stepIdx = card.learningStep ?? 0;

    if (ladder.isSummaryLearningStep(stepIdx)) {
      showCardContent(pick);
      showLearningView(ladder.STEPS.SUMMARY);
      return;
    }

    const path = card.learningPath?.length
      ? card.learningPath
      : await ensureLearningPath(pick);
    const pathIndex = stepIdx - 1;
    const stepName = ladder.learningPathStepName(path, pathIndex);

    if (stepName === ladder.STEPS.QUIZ) {
      await showQuizForPick(pick);
      return;
    }
    if (stepName === ladder.STEPS.MATCH) {
      const matchPairs = ladder.getMatchPairs(pick.word);
      if (matchPairs.length < 2) {
        await advanceLadderOrFinish(pick);
        return;
      }
      await showMatchForPick(pick);
      return;
    }

    await clearLearningLadderState(pick);
    showCardContent(pick);
    showLearningView(ladder.STEPS.SUMMARY);
  }

  async function onFlashcardGrade(remembered) {
    if (!currentPick) return;

    const useLadder = await usesLearningLadder(currentPick);
    if (!useLadder) {
      await gradeAndNext(remembered);
      return;
    }

    if (!remembered) {
      await failLearningLadder();
      return;
    }

    await gradeCurrent(true);

    const path = await ensureLearningPath(currentPick);
    if (!path.length) {
      await gradeCurrent(true);
      await finishLadderCycle();
      return;
    }

    await setLearningStep(currentPick, 1);
    await pickAndShowNext();
  }

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

  function isPracticeOpen() {
    return Boolean(
      practiceSection && !practiceSection.classList.contains('hidden'),
    );
  }

  function saveSessionState() {
    if (!isPracticeOpen()) return;
    try {
      const payload = { active: true };
      if (currentPick?.word?.slug) {
        payload.slug = currentPick.word.slug;
        payload.direction = currentPick.direction ?? 'el-ru';
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('Could not save practice session state', err);
    }
  }

  function clearSessionState() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem('greek3:home-practice-resume');
    } catch (err) {
      console.warn('Could not clear practice session state', err);
    }
  }

  function readSessionState() {
    try {
      let raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) {
        raw = sessionStorage.getItem('greek3:home-practice-resume');
      }
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.active && !parsed?.slug) return null;
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
    const rowWidth = perRow * dotPx + Math.max(0, perRow - 1) * gapPx;
    poolDotsEl.style.setProperty('--pool-dot-size', `${dotPx}px`);
    poolDotsEl.style.setProperty('--pool-dot-gap', `${gapPx}px`);
    poolDotsEl.style.setProperty('--pool-dots-cols', String(perRow));
    poolDotsEl.style.maxWidth = `${rowWidth}px`;
    poolDotsEl.classList.toggle('pool-dots--compact', count > 12);
    poolDotsEl.classList.toggle('pool-dots--multirow', rows > 1);
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
    showLearningView(ladder.STEPS.SUMMARY);
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
        onFlashcardGrade(remembered);
      },
    });
    return fc;
  }

  function showCardContent(pick) {
    common.showCardContent(fc, pick, {
      practiceDirection: pick.direction ?? 'el-ru',
    });
    const word = pick.word;
    setWordSource(word, pick.direction);
    syncWordLink(pick);
    syncExamplesButton(word);
  }

  async function ensurePickCard(pick) {
    return common.ensurePickCard(pick, db, {
      globalDeckId,
      practiceDirection: pick.direction ?? 'el-ru',
    });
  }

  async function gradeCurrent(remembered) {
    await common.gradeCurrentWithPoolExpand({
      currentPick,
      db,
      srs,
      deckId,
      catalog,
      getCards: () => db.getCardsForSlugs(catalogSlugs),
      remembered,
      practiceDirection: currentPick?.direction ?? 'el-ru',
    });
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

  function pickPendingLearningPick(settings, cards) {
    const pool = srs.getActivePoolWords(catalog, cards, db, settings);
    const candidates = [];

    for (const word of pool) {
      const direction = srs.getWordPracticeDirection(word.slug, cards, db) ?? 'el-ru';
      const card = cards.find(
        (c) =>
          c.wordSlug === word.slug &&
          c.type === 'summary' &&
          (c.direction ?? 'el-ru') === direction,
      );
      if (!card || !ladder.hasPendingLearningGame(card)) continue;
      if (!ladder.shouldUseLadder(card, srs)) continue;
      if (srs.isPickTooSoon(word.slug, direction)) continue;
      candidates.push({
        word,
        direction,
        type: 'summary',
        card,
        isNew: false,
      });
    }

    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
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

    const pendingPick = pickPendingLearningPick(settings, cards);
    if (pendingPick) {
      currentPick = pendingPick;
      srs.recordRecentPick(pendingPick.word.slug, pendingPick.direction, db);
      await resumeLearningStep(currentPick);
      await syncSessionInfo(settings, cards);
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

    await resumeLearningStep(currentPick);
    await syncSessionInfo(settings, cards);
    saveSessionState();
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
    practiceSection?.classList.add('home-practice--immersive');
    document.body.classList.add('practice-immersive-open');
    hideCompletionPanels();
    practiceSection?.classList.remove('hidden');
    practiceSection?.setAttribute('aria-hidden', 'false');
    sectionsGrid?.classList.add('hidden');
    heroContinue?.classList.add('hidden');
    heroContinue?.setAttribute('hidden', '');

    if (resumePick) {
      currentPick = resumePick;
      const settings = await srs.loadDeckSettings(deckId, db);
      const cards = await db.getCardsForSlugs(catalogSlugs);
      await resumeLearningStep(currentPick);
      await syncSessionInfo(settings, cards);
      saveSessionState();
      return;
    }

    await pickAndShowNext();
    saveSessionState();
  }

  function closePractice() {
    srs.endSession(db);
    practiceSection?.classList.remove('home-practice--immersive');
    document.body.classList.remove('practice-immersive-open');
    clearSessionState();
    practiceSection?.classList.add('hidden');
    practiceSection?.setAttribute('aria-hidden', 'true');
    sectionsGrid?.classList.remove('hidden');
    heroContinue?.classList.remove('hidden');
    heroContinue?.removeAttribute('hidden');
    hideCompletionPanels();
    updateContinueHint();
    window.GreekPWA?.consumePendingReload?.();
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
    saveSessionState();
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

  async function tryRestorePractice() {
    const state = readSessionState();
    if (!state) return;

    clearSessionState();

    if (state.slug) {
      const word = catalog.words.find((w) => w.slug === state.slug);
      if (!word) return;

      scrollToHeroContinue();

      await openPractice({
        word,
        direction:
          state.direction ??
          srs.getWordPracticeDirection(
            word.slug,
            await db.getCardsForSlugs(catalogSlugs),
            db,
          ) ??
          'el-ru',
        type: 'summary',
        isNew: false,
      });
      return;
    }

    if (state.active) {
      await openPractice();
    }
  }

  async function initHomePractice() {
    try {
      await db.init();
      await loadHomeSettingsUI();
      await updateContinueHint();
      await tryRestorePractice();
    } catch (err) {
      console.error('Home practice init error', err);
      if (continueHint) {
        continueHint.textContent = 'Не удалось загрузить прогресс — проверьте, что сайт не в режиме инкогнито';
      }
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveSessionState();
    }
  });

  initHomePractice();
})();
