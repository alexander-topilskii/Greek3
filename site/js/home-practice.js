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

  const favorites = window.GreekFavorites;
  const fullCatalog = catalog;
  const PRACTICE_NAV_ID = 'home-practice-immersive';
  const navBack = () => window.GreekNavBack;

  function getPracticeCatalog() {
    if (!favorites?.hasAnyFavorites()) return fullCatalog;
    return favorites.filterCatalog(fullCatalog);
  }

  function refreshCatalogRefs() {
    const active = getPracticeCatalog();
    catalog = active;
    catalogSlugs = active.words.map((w) => w.slug);
    totalFormsByWord = Object.fromEntries(
      active.words.map((w) => [w.slug, w.formCount]),
    );
  }

  const deckId = fullCatalog.deckId ?? 'global';
  const globalDeckId = db.GLOBAL_DECK_ID ?? 'global';
  const categoryLabels = fullCatalog.categoryLabels ?? {};
  let catalogSlugs = catalog.words.map((w) => w.slug);
  let totalFormsByWord = Object.fromEntries(
    catalog.words.map((w) => [w.slug, w.formCount]),
  );

  refreshCatalogRefs();

  if (favorites) {
    favorites.onChange(() => {
      refreshCatalogRefs();
      updateContinueHint();
    });
    document.addEventListener('greek3:favorites-change', () => {
      refreshCatalogRefs();
      updateContinueHint();
    });
  }

  const btnContinue = document.getElementById('btn-continue');
  const btnClose = document.getElementById('btn-close-practice');
  const practiceSection = document.getElementById('home-practice');
  const sectionsGrid = document.getElementById('sections-grid');
  const heroContinue = document.getElementById('hero-continue');
  const continueHint = document.getElementById('continue-hint');
  const poolProgress = document.getElementById('practice-pool-progress');
  const poolDotsEl = document.getElementById('practice-pool-dots');
  const poolCountStudying = document.getElementById('practice-pool-count-studying');
  const poolCountTotal = document.getElementById('practice-pool-count-total');
  const poolDotsDetailEl = document.getElementById('practice-pool-dots-detail');
  const poolFullscreenStudying = document.getElementById('practice-pool-fullscreen-studying');
  const poolFullscreenTotal = document.getElementById('practice-pool-fullscreen-total');
  const poolFullscreenCurrent = document.getElementById('practice-pool-fullscreen-current');
  const poolLabelLearned = document.getElementById('practice-pool-fullscreen-label-learned');
  const poolLabelActive = document.getElementById('practice-pool-fullscreen-label-active');
  const poolLabelResting = document.getElementById('practice-pool-fullscreen-label-resting');
  const poolLabelNew = document.getElementById('practice-pool-fullscreen-label-new');
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
  let poolDotsDetailSnapshot = { slugs: [], slugToState: new Map() };

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

  window.addEventListener('resize', () => {
    if (!poolDotsEl?.dataset.gridCount) return;
    applyPoolGridLayout(Number(poolDotsEl.dataset.gridCount));
  });

  if (poolDotsEl && typeof ResizeObserver !== 'undefined') {
    const poolGridObserver = new ResizeObserver(() => {
      if (!poolDotsEl.dataset.gridCount) return;
      applyPoolGridLayout(Number(poolDotsEl.dataset.gridCount));
    });
    poolGridObserver.observe(poolDotsEl);
  }

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
    const ruFormLabels = word.forms?.map((f) => f.translation).filter(Boolean) ?? [];
    quizUi?.show({
      prompt: elRu ? pair.greek : pair.translation,
      promptIsGreek: elRu,
      options,
      correct: elRu ? pair.translation : pair.greek,
      promptLabel: elRu ? 'Выберите перевод' : 'Выберите греческую форму',
      ruFormLabels: elRu ? ruFormLabels : [],
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
      await showCardContent(pick);
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
    await showCardContent(pick);
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

  const POOL_GRID_MAX = 1000;

  function getGridWords() {
    return catalog.words.slice(0, POOL_GRID_MAX);
  }

  function measurePoolGridWidth(el = poolDotsEl) {
    if (!el) return 280;
    const ownWidth = el.clientWidth;
    if (ownWidth > 0) return ownWidth;
    return el.parentElement?.clientWidth ?? 280;
  }

  function fitPoolGridColumns(cellPx, gapPx, hostWidth, count) {
    let cols = Math.max(1, Math.floor((hostWidth + gapPx) / (cellPx + gapPx)));
    while (cols > 1 && cols * cellPx + (cols - 1) * gapPx > hostWidth) {
      cols -= 1;
    }
    return Math.min(cols, count);
  }

  function applyPoolGridLayout(count, el = poolDotsEl, options = {}) {
    if (!el) return;
    const gapPx = options.gapPx ?? 2;
    const minCellPx = options.minCellPx ?? 2;
    const maxCellPx = options.maxCellPx ?? 5;
    const maxRows = options.maxRows ?? (count > 500 ? 3 : count > 200 ? 4 : 5);
    const hostWidth = measurePoolGridWidth(el);

    let cellPx = minCellPx;
    let cols = 1;
    for (let candidate = maxCellPx; candidate >= minCellPx; candidate -= 1) {
      const nextCols = fitPoolGridColumns(candidate, gapPx, hostWidth, count);
      const rows = Math.ceil(count / nextCols);
      if (rows <= maxRows) {
        cellPx = candidate;
        cols = nextCols;
        break;
      }
      if (candidate === minCellPx) {
        cellPx = candidate;
        cols = nextCols;
      }
    }

    el.style.setProperty('--pool-cell-size', `${cellPx}px`);
    el.style.setProperty('--pool-cell-gap', `${gapPx}px`);
    el.style.setProperty('--pool-grid-cols', String(cols));
    el.dataset.gridCount = String(count);
  }

  function applyPoolGridLayoutDetail(count) {
    applyPoolGridLayout(count, poolDotsDetailEl, {
      gapPx: 3,
      minCellPx: 6,
      maxCellPx: 14,
      maxRows: Math.ceil(count / 8),
    });
  }

  function poolCellRenderKey(dot) {
    return `${dot.state}:${dot.progress}:${dot.isCurrent ? 1 : 0}`;
  }

  function createPoolCellEl(dot) {
    const el = document.createElement('span');
    el.className = 'pool-cell';
    el.classList.add(`pool-cell--${dot.state}`);
    if (dot.isCurrent) el.classList.add('pool-cell--current');
    el.dataset.slug = dot.slug;
    el.setAttribute('role', 'listitem');
    el.setAttribute('title', dot.label);
    el.style.setProperty('--pool-cell-progress', `${dot.progress}%`);
    return el;
  }

  function updatePoolCellEl(el, dot) {
    el.className = 'pool-cell';
    el.classList.add(`pool-cell--${dot.state}`);
    if (dot.isCurrent) el.classList.add('pool-cell--current');
    el.style.setProperty('--pool-cell-progress', `${dot.progress}%`);
    el.setAttribute('title', dot.label);
  }

  function syncPoolGrid(gridWords, cards, currentSlug, targetEl = poolDotsEl, snapshotRef = 'compact') {
    if (!targetEl) return;
    const dots = srs.getPoolDots(gridWords, cards, db, currentSlug);
    const isDetail = targetEl === poolDotsDetailEl;
    if (isDetail) {
      applyPoolGridLayoutDetail(dots.length);
    } else {
      applyPoolGridLayout(dots.length);
    }

    const snapshot = snapshotRef === 'detail' ? poolDotsDetailSnapshot : poolDotsSnapshot;
    const existingBySlug = new Map();
    targetEl.querySelectorAll('.pool-cell').forEach((el) => {
      if (el.dataset.slug) existingBySlug.set(el.dataset.slug, el);
    });

    const nextEls = [];
    let structureChanged = dots.length !== snapshot.slugs.length;

    for (let i = 0; i < dots.length; i += 1) {
      const dot = dots[i];
      let el = existingBySlug.get(dot.slug);
      const prevState = snapshot.slugToState.get(dot.slug);

      if (el) {
        if (snapshot.slugs[i] !== dot.slug) structureChanged = true;
        if (prevState !== poolCellRenderKey(dot)) {
          updatePoolCellEl(el, dot);
        }
      } else {
        el = createPoolCellEl(dot);
        structureChanged = true;
      }
      nextEls.push(el);
    }

    if (structureChanged) {
      targetEl.replaceChildren(...nextEls);
    }

    const nextSnapshot = {
      slugs: dots.map((d) => d.slug),
      slugToState: new Map(dots.map((d) => [d.slug, poolCellRenderKey(d)])),
    };
    if (isDetail) {
      poolDotsDetailSnapshot = nextSnapshot;
    } else {
      poolDotsSnapshot = nextSnapshot;
    }

    requestAnimationFrame(() => {
      if (!targetEl?.dataset.gridCount) return;
      if (isDetail) {
        applyPoolGridLayoutDetail(Number(targetEl.dataset.gridCount));
      } else {
        applyPoolGridLayout(Number(targetEl.dataset.gridCount));
      }
    });
  }

  async function syncSessionInfo(settings, cards) {
    if (poolProgress) {
      const pool = srs.getActivePoolWords(catalog, cards, db, settings);
      const gridWords = getGridWords();
      const projectTotal = catalog.words.length;
      const direction = currentPick?.direction ?? srs.resolveAutoDirection(catalog, cards, db, settings);
      const {
        learned,
        directionMastered,
        directionLearning,
        directionNew,
      } = srs.getPoolProgress(gridWords, cards, db, direction);

      const dots = srs.getPoolDots(gridWords, cards, db, currentPick?.word?.slug ?? null);
      const resting = dots.filter((d) => d.state === 'resting').length;

      syncPoolGrid(gridWords, cards, currentPick?.word?.slug ?? null);

      if (poolCountStudying) poolCountStudying.textContent = String(pool.length);
      if (poolCountTotal) poolCountTotal.textContent = String(projectTotal);
      if (poolFullscreenStudying) poolFullscreenStudying.textContent = String(pool.length);
      if (poolFullscreenTotal) poolFullscreenTotal.textContent = String(projectTotal);

      const currentDot = dots.find((d) => d.isCurrent);
      if (poolFullscreenCurrent) {
        if (currentDot) {
          poolFullscreenCurrent.textContent = `Сейчас: ${currentDot.label}`;
          poolFullscreenCurrent.classList.remove('hidden');
          poolFullscreenCurrent.removeAttribute('hidden');
        } else {
          poolFullscreenCurrent.textContent = '';
          poolFullscreenCurrent.classList.add('hidden');
          poolFullscreenCurrent.setAttribute('hidden', '');
        }
      }

      if (poolLabelLearned) {
        poolLabelLearned.textContent = `${directionMastered || learned} усвоено`;
      }
      if (poolLabelActive) {
        poolLabelActive.textContent = `${directionLearning} в работе`;
      }
      if (poolLabelResting) {
        poolLabelResting.textContent = `${resting} отдыхаем`;
      }
      if (poolLabelNew) {
        poolLabelNew.textContent = `${directionNew} новых`;
      }

      if (window.GreekProgressUI?.isPoolFullscreenOpen?.()) {
        syncPoolGrid(gridWords, cards, currentPick?.word?.slug ?? null, poolDotsDetailEl, 'detail');
      }
    }
  }

  document.addEventListener('greek3:progress-fullscreen-open', async () => {
    const settings = await srs.loadDeckSettings(deckId, db);
    const cards = await db.getCardsForSlugs(catalogSlugs);
    const gridWords = getGridWords();
    syncPoolGrid(gridWords, cards, currentPick?.word?.slug ?? null, poolDotsDetailEl, 'detail');
    await syncSessionInfo(settings, cards);
  });

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

  async function showCardContent(pick) {
    await common.showCardContent(fc, pick, {
      practiceDirection: pick.direction ?? 'el-ru',
      db,
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

    if (favorites?.hasAnyFavorites() && catalogSlugs.length === 0) {
      continueHint.textContent = 'В избранном нет слов — добавьте слова или разделы';
      return;
    }

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
      if (favorites?.hasAnyFavorites()) {
        continueHint.textContent = `Все избранные слова пройдены — можно повторить`;
      } else {
        continueHint.textContent = `Все слова пройдены — можно повторить`;
      }
      return;
    }

    const favoritesMode = favorites?.hasAnyFavorites();
    const scopeLabel = favoritesMode ? 'избранных' : 'в словаре';
    const scopeTotal = favoritesMode ? catalogSlugs.length : fullCatalog.words.length;

    const mastered = directionMastered || learned;
    if (mastered > 0) {
      continueHint.textContent =
        `В группе ${mastered} из ${total} усвоено, ${inProgress} в работе · всего ${scopeLabel} ${scopeTotal}`;
    } else if (inProgress > 0) {
      continueHint.textContent =
        `В группе ${inProgress} из ${total} в работе · всего ${scopeLabel} ${scopeTotal}`;
    } else if (total > 0) {
      continueHint.textContent = favoritesMode
        ? `Группа из ${total} избранных слов · свайп вправо «Помню» после переворота`
        : `Группа из ${total} слов · свайп вправо «Помню» после переворота`;
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
    navBack()?.push(PRACTICE_NAV_ID, () => closePractice(true));
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

  function closePractice(fromNav = false) {
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
    if (!fromNav) navBack()?.dismiss(PRACTICE_NAV_ID);
  }

  async function repeatCatalog() {
    await srs.loadRecentPicks(db);
    srs.beginSession();
    const fullSettings = {
      ...(await srs.loadDeckSettings(deckId, db)),
      activeLimit: getPracticeCatalog().words.length,
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
      const resolvedWord = word ?? fullCatalog.words.find((w) => w.slug === state.slug);
      if (!resolvedWord) return;

      scrollToHeroContinue();

      await openPractice({
        word: resolvedWord,
        direction:
          state.direction ??
          srs.getWordPracticeDirection(
            resolvedWord.slug,
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
