(function () {
  const listPage = document.querySelector('.verbs-list-page');
  if (!listPage) return;

  const searchInput = document.getElementById('list-search');
  const filterLevel = document.getElementById('list-filter-level');
  const filterStatus = document.getElementById('list-filter-status');
  const resultEl = document.getElementById('list-filter-result');
  const btnCompact = document.getElementById('btn-view-compact');
  const btnGrid = document.getElementById('btn-view-grid');
  const linksRoot = document.getElementById('verbs-links');
  const lessonTabs = document.querySelectorAll('.lesson-tab');
  const briefPanel = document.getElementById('lesson-brief');

  if (!linksRoot) return;

  const db = window.GreekDB;
  const srs = window.GreekSRS;

  function allWordLinks() {
    return [...document.querySelectorAll('.word-link[data-word-slug]')];
  }

  function linkStatus(slug, stats) {
    if (!slug || !stats) return 'new';
    const st = stats[slug] ?? { wordPct: 0, formsPct: 0 };
    const combined = (st.wordPct + st.formsPct) / 2;
    if (combined >= 95) return 'mastered';
    if (combined > 0) return 'learning';
    return 'new';
  }

  async function applyFilters() {
    const query = (searchInput?.value ?? '').trim().toLowerCase();
    const level = filterLevel?.value ?? '';
    const status = filterStatus?.value ?? '';
    let stats = {};

    if (status && db && srs) {
      const deckId = listPage.getAttribute('data-deck-id');
      if (deckId) {
        const catalogEl = document.getElementById('verbs-catalog');
        let formCounts = {};
        if (catalogEl) {
          try {
            const catalog = JSON.parse(catalogEl.textContent ?? '{}');
            formCounts = Object.fromEntries(
              (catalog.words ?? []).map((w) => [w.slug, w.formCount ?? 0]),
            );
          } catch (_) {
            formCounts = {};
          }
        }
        const cards = await db.getDeckCards(deckId);
        stats = srs.getProgressStats(cards, formCounts, db);
      }
    }

    let visible = 0;
    let total = 0;

    allWordLinks().forEach((link) => {
      total += 1;
      const slug = link.getAttribute('data-word-slug') ?? '';
      const haystack = link.getAttribute('data-search') ?? link.textContent ?? '';
      const linkLevel = link.getAttribute('data-level') ?? '';
      const st = linkStatus(slug, stats);

      const matchQuery = !query || haystack.toLowerCase().includes(query);
      const matchLevel = !level || linkLevel === level;
      const matchStatus = !status || st === status;
      const show = matchQuery && matchLevel && matchStatus;

      link.classList.toggle('is-filtered-out', !show);
      if (show) visible += 1;
    });

    document.querySelectorAll('.links-group, .links-subgroup').forEach((group) => {
      const hasVisible = [...group.querySelectorAll('.word-link')].some(
        (link) => !link.classList.contains('is-filtered-out'),
      );
      group.classList.toggle('is-filtered-empty', !hasVisible);
    });

    if (resultEl) {
      if (query || level || status) {
        resultEl.textContent = `Показано ${visible} из ${total}`;
      } else {
        resultEl.textContent = '';
      }
    }
  }

  searchInput?.addEventListener('input', applyFilters);
  filterLevel?.addEventListener('change', applyFilters);
  filterStatus?.addEventListener('change', applyFilters);

  btnCompact?.addEventListener('click', () => {
    const on = !linksRoot.classList.contains('links-list--compact');
    linksRoot.classList.toggle('links-list--compact', on);
    briefPanel?.classList.toggle('links-list--compact', on);
    btnCompact.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) {
      linksRoot.classList.remove('links-list--grid');
      btnGrid?.setAttribute('aria-pressed', 'false');
    }
  });

  btnGrid?.addEventListener('click', () => {
    const on = !linksRoot.classList.contains('links-list--grid');
    linksRoot.classList.toggle('links-list--grid', on);
    btnGrid.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) {
      linksRoot.classList.remove('links-list--compact');
      btnCompact?.setAttribute('aria-pressed', 'false');
    }
  });

  lessonTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const name = tab.getAttribute('data-lesson-tab');
      lessonTabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      const toolbar = document.getElementById('list-toolbar');
      const settings = document.getElementById('deck-settings');
      const practiceActions = document.querySelector('.list-practice-actions');
      const practiceSection = document.getElementById('list-practice');

      if (name === 'words') {
        linksRoot.classList.remove('hidden');
        briefPanel?.classList.add('hidden');
        toolbar?.classList.remove('hidden');
        settings?.classList.remove('hidden');
        practiceActions?.classList.remove('hidden');
        practiceSection?.classList.add('hidden');
      } else if (name === 'brief') {
        linksRoot.classList.add('hidden');
        briefPanel?.classList.remove('hidden');
        toolbar?.classList.add('hidden');
        settings?.classList.add('hidden');
        practiceActions?.classList.add('hidden');
        practiceSection?.classList.add('hidden');
      } else if (name === 'practice') {
        linksRoot.classList.add('hidden');
        briefPanel?.classList.add('hidden');
        toolbar?.classList.add('hidden');
        settings?.classList.add('hidden');
        practiceActions?.classList.remove('hidden');
        document.getElementById('btn-practice-el')?.click();
      }
    });
  });

  applyFilters();
})();
