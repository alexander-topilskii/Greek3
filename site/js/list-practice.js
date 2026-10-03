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
    if (visible) {
      hideExamplesButton();
      hideWordLink();
    }
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
  const btnWordLink = practiceControls?.querySelector('.btn-word-link');
  const btnLang = practiceControls?.querySelector('.btn-lang');
  const btnExamples = practiceControls?.querySelector('.btn-examples');
  const examples = window.GreekExamples;
  const SESSION_KEY = `greek3:list-practice-session:${deckId}`;

  function isPracticeOpen() {
    return Boolean(practiceSection && !practiceSection.classList.contains('hidden'));
  }

  function saveSessionState() {
    if (!isPracticeOpen() || !practiceDirection) return;
    try {
      const payload = { active: true, direction: practiceDirection };
      if (currentPick?.word?.slug) {
        payload.slug = currentPick.word.slug;
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('Could not save list practice session state', err);
    }
  }

  function clearSessionState() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (err) {
      console.warn('Could not clear list practice session state', err);
    }
  }

  function readSessionState() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.active || !parsed?.direction) return null;
      return parsed;
    } catch {
      return null;
    }
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

  function syncWordLink(pick) {
    if (!btnWordLink) return;
    if (!pick?.word?.href) {
      btnWordLink.classList.add('hidden');
      btnWordLink.setAttribute('hidden', '');
      btnWordLink.setAttribute('aria-disabled', 'true');
      btnWordLink.removeAttribute('href');
      return;
    }
    const domLink = pick.word.slug
      ? document.querySelector(`#verbs-links .word-link[data-word-slug="${pick.word.slug}"]`)?.getAttribute('href')
      : null;
    btnWordLink.href = domLink || wordPageHref(pick.word.href);
    btnWordLink.classList.remove('hidden');
    btnWordLink.removeAttribute('hidden');
    btnWordLink.removeAttribute('aria-disabled');
  }

  function hideWordLink() {
    if (!btnWordLink) return;
    btnWordLink.classList.add('hidden');
    btnWordLink.setAttribute('hidden', '');
    btnWordLink.setAttribute('aria-disabled', 'true');
    btnWordLink.removeAttribute('href');
  }

  function syncExamplesButton(word) {
    examples?.syncButton(btnExamples, word);
  }

  function hideExamplesButton() {
    examples?.hideButton(btnExamples);
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

  }

  function sortWordLinksAlphabetically() {
    document.querySelectorAll('.links-group-items').forEach((container) => {
      const links = [...container.querySelectorAll('.word-link[data-word-slug]')].filter(
        (el) => el.getAttribute('data-word-slug'),
      );
      if (links.length < 2) return;

      links.sort((a, b) =>
        (a.querySelector('.word-link-label')?.textContent ?? '').localeCompare(
          b.querySelector('.word-link-label')?.textContent ?? '',
          'ru',
        ),
      );

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
      hideWordLink();
      setPracticeComplete(true);
      return;
    }

    await showCardContent(currentPick);
    syncExamplesButton(currentPick.word);
    syncWordLink(currentPick);
  }

  async function openPractice(direction, resumePick = null) {
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

    if (resumePick) {
      currentPick = resumePick;
      await showCardContent(currentPick);
      syncExamplesButton(currentPick.word);
      syncWordLink(currentPick);
      return;
    }

    await pickAndShowNext();
  }

  function closePractice(fromNav = false) {
    srs.endSession(db);
    clearSessionState();
    practiceSection?.classList.add('hidden');
    practiceSection?.setAttribute('aria-hidden', 'true');
    linksSection?.classList.remove('hidden');
    practiceActions?.classList.remove('hidden');
    hideWordLink();
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

  async function tryRestorePractice() {
    const state = readSessionState();
    if (!state) return;

    clearSessionState();

    let resumePick = null;
    if (state.slug) {
      const word = catalog.words.find((w) => w.slug === state.slug);
      if (word) {
        resumePick = {
          word,
          type: 'summary',
          direction: state.direction,
          isNew: false,
        };
      }
    }

    await openPractice(state.direction, resumePick);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveSessionState();
    }
  });

  db.init().then(async () => {
    sortWordLinksAlphabetically();
    updateProgressUI();
    await tryRestorePractice();
  });
})();
