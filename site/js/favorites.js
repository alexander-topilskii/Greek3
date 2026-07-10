(function (global) {
  const STORAGE_KEY = 'greek3:favorites-v1';

  /** @type {Set<(detail: object) => void>} */
  const listeners = new Set();

  function slugify(text) {
    return String(text ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9а-яё\-_/]/gi, '')
      .slice(0, 80);
  }

  function pageIdFromPath(pagePath) {
    return String(pagePath ?? '')
      .replace(/^words\/?/i, '')
      .replace(/\/index\.html$/i, '')
      .replace(/\/$/, '');
  }

  function buildPageSectionId(pageId) {
    return `page:${pageIdFromPath(pageId)}`;
  }

  function buildSubsectionId(pageId, title) {
    const pid = pageIdFromPath(pageId);
    const slug = slugify(title) || 'group';
    return `subsection:${pid}:${slug}`;
  }

  function emptyState() {
    return { slugs: [], sections: [] };
  }

  function readState() {
    if (typeof localStorage === 'undefined') return emptyState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      return {
        slugs: Array.isArray(parsed.slugs) ? [...new Set(parsed.slugs.filter(Boolean))] : [],
        sections: Array.isArray(parsed.sections)
          ? parsed.sections.filter((s) => s && s.id)
          : [],
      };
    } catch {
      return emptyState();
    }
  }

  function writeState(state) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          slugs: [...new Set(state.slugs)],
          sections: state.sections,
        }),
      );
    } catch (err) {
      console.warn('Could not save favorites', err);
    }
  }

  function emit(detail = {}) {
    for (const fn of listeners) {
      try {
        fn(detail);
      } catch (err) {
        console.warn('Favorites listener error', err);
      }
    }
    document.dispatchEvent(new CustomEvent('greek3:favorites-change', { detail }));
  }

  function hasAnyFavorites(state = readState()) {
    return state.slugs.length > 0 || state.sections.length > 0;
  }

  function isSlugFavorite(slug, state = readState()) {
    return state.slugs.includes(slug);
  }

  function isSectionFavorite(sectionId, state = readState()) {
    return state.sections.some((s) => s.id === sectionId);
  }

  function toggleSlug(slug, label) {
    if (!slug) return false;
    const state = readState();
    const idx = state.slugs.indexOf(slug);
    const added = idx === -1;
    if (added) {
      state.slugs.push(slug);
    } else {
      state.slugs.splice(idx, 1);
    }
    writeState(state);
    emit({ type: 'slug', slug, label, added });
    return added;
  }

  function toggleSection(sectionId, label) {
    if (!sectionId) return false;
    const state = readState();
    const idx = state.sections.findIndex((s) => s.id === sectionId);
    const added = idx === -1;
    if (added) {
      state.sections.push({ id: sectionId, label: label || sectionId });
    } else {
      state.sections.splice(idx, 1);
    }
    writeState(state);
    emit({ type: 'section', sectionId, label, added });
    return added;
  }

  function removeSlug(slug) {
    const state = readState();
    const idx = state.slugs.indexOf(slug);
    if (idx === -1) return;
    state.slugs.splice(idx, 1);
    writeState(state);
    emit({ type: 'slug', slug, added: false });
  }

  function removeSection(sectionId) {
    const state = readState();
    const idx = state.sections.findIndex((s) => s.id === sectionId);
    if (idx === -1) return;
    const removed = state.sections[idx];
    state.sections.splice(idx, 1);
    writeState(state);
    emit({ type: 'section', sectionId, label: removed.label, added: false });
  }

  function resolveSectionSlugs(sectionId, catalog) {
    const pages = catalog?.pages ?? {};
    const slugs = pages[sectionId];
    if (Array.isArray(slugs)) return slugs;
    return [];
  }

  function resolveFavoriteSlugs(catalog, state = readState()) {
    const result = new Set();
    for (const slug of state.slugs) result.add(slug);
    for (const section of state.sections) {
      for (const slug of resolveSectionSlugs(section.id, catalog)) {
        result.add(slug);
      }
    }
    return result;
  }

  function getFavoriteWords(catalog, state = readState()) {
    if (!catalog?.words?.length) return [];
    if (!hasAnyFavorites(state)) return [];
    const slugSet = resolveFavoriteSlugs(catalog, state);
    return catalog.words.filter((w) => slugSet.has(w.slug));
  }

  function filterCatalog(catalog, state = readState()) {
    if (!catalog) return catalog;
    if (!hasAnyFavorites(state)) return catalog;
    const favoriteWords = getFavoriteWords(catalog, state);
    return { ...catalog, words: favoriteWords };
  }

  function getFavoriteEntries(catalog, state = readState()) {
    const entries = [];
    const slugSet = resolveFavoriteSlugs(catalog, state);
    const wordsBySlug = new Map((catalog?.words ?? []).map((w) => [w.slug, w]));

    for (const section of state.sections) {
      const sectionSlugs = resolveSectionSlugs(section.id, catalog);
      entries.push({
        kind: 'section',
        id: section.id,
        label: section.label || section.id,
        count: sectionSlugs.length,
        slugs: sectionSlugs,
      });
    }

    for (const slug of state.slugs) {
      const word = wordsBySlug.get(slug);
      entries.push({
        kind: 'word',
        id: slug,
        label: word?.label || word?.translation || slug,
        href: word?.href,
        primaryGreek: word?.primaryGreek,
        slug,
      });
    }

    return entries;
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function syncButton(btn, active) {
    if (!btn) return;
    btn.classList.toggle('is-favorite', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    const label = btn.dataset.favoriteLabel || 'Избранное';
    btn.setAttribute(
      'aria-label',
      active ? `Убрать из избранного: ${label}` : `Добавить в избранное: ${label}`,
    );
    btn.setAttribute('title', active ? 'Убрать из избранного' : 'Добавить в избранное');
  }

  global.GreekFavorites = {
    STORAGE_KEY,
    slugify,
    pageIdFromPath,
    buildPageSectionId,
    buildSubsectionId,
    readState,
    hasAnyFavorites,
    isSlugFavorite,
    isSectionFavorite,
    toggleSlug,
    toggleSection,
    removeSlug,
    removeSection,
    resolveFavoriteSlugs,
    getFavoriteWords,
    filterCatalog,
    getFavoriteEntries,
    onChange,
    syncButton,
  };
})(window);
