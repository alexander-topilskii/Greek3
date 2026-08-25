(function () {
  const page = document.querySelector('[data-settings-page]');
  if (!page) return;

  const db = window.GreekDB;
  const srs = window.GreekSRS;
  const appSettings = window.GreekAppSettings;
  if (!db || !srs || !appSettings) return;

  const params = new URLSearchParams(window.location.search);
  const deckId = params.get('deck');
  const wordSlug = params.get('word');
  const fromPath = params.get('from');

  const btnBack = document.getElementById('btn-settings-back');
  const contextHint = document.getElementById('settings-context-hint');
  const deckSection = document.getElementById('settings-deck-section');
  const wordSection = document.getElementById('settings-word-section');
  const homeGroupField = document.getElementById('settings-home-group-field');
  const deckFields = document.getElementById('settings-deck-fields');
  const homeHint = document.getElementById('settings-home-hint');
  const inputGroupSize = document.getElementById('home-setting-group-size');
  const inputInitial = document.getElementById('setting-initial-batch');
  const inputActive = document.getElementById('setting-active-limit');
  const btnSaveDeck = document.getElementById('btn-save-deck-settings');
  const btnResetDeck = document.getElementById('btn-reset-deck');
  const btnResetWord = document.getElementById('btn-reset-word');
  const btnResetAll = document.getElementById('btn-reset-all-progress');
  const simpleLearningSwitch = document.getElementById('setting-simple-learning');

  let activeDeckId = deckId || 'global';
  let catalog = null;

  function resolveBackHref() {
    if (!fromPath) return 'index.html';
    if (/^https?:\/\//i.test(fromPath)) return fromPath;
    return fromPath;
  }

  function showSection(el) {
    if (!el) return;
    el.hidden = false;
    el.classList.remove('hidden');
  }

  function hideSection(el) {
    if (!el) return;
    el.hidden = true;
    el.classList.add('hidden');
  }

  function setSwitchState(enabled) {
    if (!simpleLearningSwitch) return;
    simpleLearningSwitch.classList.toggle('is-on', enabled);
    simpleLearningSwitch.setAttribute('aria-checked', enabled ? 'true' : 'false');
  }

  function loadCatalogForDeck(id) {
    const catalogsEl = document.getElementById('settings-catalogs');
    if (!catalogsEl) return null;
    try {
      const all = JSON.parse(catalogsEl.textContent ?? '{}');
      return all[id] ?? all.global ?? null;
    } catch (err) {
      console.error('Settings catalog parse error', err);
      return null;
    }
  }

  function injectCatalogScript(catalogData) {
    if (!catalogData) return;
    let script = document.getElementById('verbs-catalog');
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/json';
      script.id = 'verbs-catalog';
      page.appendChild(script);
    }
    script.textContent = JSON.stringify(catalogData);
  }

  function configureDeckSection() {
    if (wordSlug && !deckId) {
      hideSection(deckSection);
      return;
    }

    const isGlobal = activeDeckId === 'global';
    catalog = loadCatalogForDeck(activeDeckId);
    if (!catalog?.words?.length) {
      hideSection(deckSection);
      return;
    }

    showSection(deckSection);
    injectCatalogScript(catalog);

    if (isGlobal) {
      showSection(homeGroupField);
      showSection(homeHint);
      hideSection(deckFields);
      hideSection(btnResetDeck);
      if (contextHint) {
        contextHint.textContent = 'Настройки обучения на главной';
      }
    } else {
      hideSection(homeGroupField);
      hideSection(homeHint);
      showSection(deckFields);
      showSection(btnResetDeck);
      if (contextHint) {
        contextHint.textContent = `Настройки раздела «${catalog.deckId ?? activeDeckId}»`;
      }
      if (inputActive) {
        inputActive.max = String(Math.max(catalog.words.length, 1));
      }
    }
  }

  function configureWordSection() {
    if (!wordSlug) {
      hideSection(wordSection);
      return;
    }
    showSection(wordSection);
    if (contextHint && !deckId) {
      contextHint.textContent = `Настройки слова`;
    }
  }

  async function loadDeckSettingsUI() {
    const settings = await srs.loadDeckSettings(activeDeckId, db);
    if (inputGroupSize) inputGroupSize.value = String(settings.initialBatchSize);
    if (inputInitial) inputInitial.value = String(settings.initialBatchSize);
    if (inputActive) inputActive.value = String(settings.activeLimit);
  }

  async function saveDeckSettings() {
    const isGlobal = activeDeckId === 'global';
    if (isGlobal) {
      const groupSize = parseInt(inputGroupSize?.value ?? '5', 10);
      const clamped = Math.max(1, Math.min(30, groupSize));
      await srs.saveDeckSettings(activeDeckId, db, {
        initialBatchSize: clamped,
        activeLimit: clamped,
      });
      if (inputGroupSize) inputGroupSize.value = String(clamped);
      return;
    }

    await srs.saveDeckSettings(activeDeckId, db, {
      initialBatchSize: parseInt(inputInitial?.value ?? '5', 10),
      activeLimit: parseInt(inputActive?.value ?? '5', 10),
    });
    await loadDeckSettingsUI();
  }

  async function loadSimpleLearningUI() {
    const enabled = await appSettings.isSimpleLearning(db);
    setSwitchState(enabled);
  }

  async function toggleSimpleLearning() {
    const next = !simpleLearningSwitch?.classList.contains('is-on');
    await appSettings.setSimpleLearning(db, next);
    if (next) {
      await appSettings.clearAllLearningLadderStates(db);
    }
    setSwitchState(next);
  }

  btnBack?.setAttribute('href', resolveBackHref());

  btnSaveDeck?.addEventListener('click', async () => {
    await saveDeckSettings();
    btnSaveDeck.textContent = 'Сохранено';
    setTimeout(() => {
      btnSaveDeck.textContent = 'Сохранить';
    }, 1200);
  });

  btnResetDeck?.addEventListener('click', async () => {
    if (!catalog?.words?.length) return;
    if (!confirm('Сбросить прогресс по словам этого раздела?')) return;
    const slugs = catalog.words.map((word) => word.slug);
    await db.deleteCardsForSlugs(slugs);
    await db.setSetting(
      `deck:${activeDeckId}:activeLimit`,
      parseInt(inputInitial?.value ?? inputGroupSize?.value ?? '5', 10),
    );
    btnResetDeck.textContent = 'Сброшено';
    setTimeout(() => {
      btnResetDeck.textContent = 'Сбросить прогресс раздела';
    }, 1200);
  });

  btnResetWord?.addEventListener('click', async () => {
    if (!wordSlug) return;
    if (!confirm('Сбросить прогресс этого слова?')) return;
    await db.deleteWordCards(wordSlug);
    btnResetWord.textContent = 'Сброшено';
    setTimeout(() => {
      btnResetWord.textContent = 'Сбросить прогресс слова';
    }, 1200);
  });

  btnResetAll?.addEventListener('click', async () => {
    if (!confirm('Сбросить весь прогресс? Все выученные слова будут забыты.')) return;
    await db.resetAllProgress();
    btnResetAll.textContent = 'Сброшено';
    setTimeout(() => {
      btnResetAll.textContent = 'Сбросить весь прогресс';
    }, 1200);
  });

  simpleLearningSwitch?.addEventListener('click', () => {
    toggleSimpleLearning().catch((err) => console.error('Simple learning toggle failed', err));
  });

  db.init()
    .then(async () => {
      configureDeckSection();
      configureWordSection();
      await loadSimpleLearningUI();
      if (catalog?.words?.length) {
        await loadDeckSettingsUI();
      }
    })
    .catch((err) => console.error('Settings init failed', err));
})();
