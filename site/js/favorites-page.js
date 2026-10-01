(function () {
  const page = document.querySelector('.favorites-page');
  if (!page) return;

  const fav = window.GreekFavorites;
  if (!fav) return;

  const catalogEl = document.getElementById('global-catalog');
  if (!catalogEl) return;

  let catalog;
  try {
    catalog = JSON.parse(catalogEl.textContent ?? '{}');
  } catch (e) {
    console.error('Global catalog parse error for favorites page', e);
    return;
  }

  const listEl = document.getElementById('favorites-list');
  const emptyEl = document.getElementById('favorites-empty');
  const hintEl = document.getElementById('favorites-section-hint');
  const heroContinue = document.getElementById('hero-continue');
  const clearBtn = document.getElementById('btn-clear-favorites');

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

  function sectionPageHref(id) {
    const base = siteBasePrefix();
    if (!id) return base;
    let pagePath = '';
    if (id.startsWith('page:')) {
      pagePath = id.slice(5);
    } else if (id.startsWith('subsection:')) {
      const parts = id.split(':');
      pagePath = parts[1] || '';
    }
    if (!pagePath) return base;
    const encoded = pagePath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return `${base}/words/${encoded}/index.html`;
  }

  function pluralize(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
  }

  function createRemoveButton(label, onRemove) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-favorite-remove';
    btn.setAttribute('aria-label', `Убрать из избранного: ${label}`);
    btn.title = 'Убрать из избранного';
    btn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onRemove();
    });
    return btn;
  }

  function renderFavoriteWord(entry) {
    const item = document.createElement('div');
    item.className = 'favorites-item favorites-item--word';
    item.setAttribute('role', 'listitem');
    item.dataset.slug = entry.slug;

    const main = document.createElement('div');
    main.className = 'favorites-item-main';

    if (entry.href) {
      const link = document.createElement('a');
      link.className = 'favorites-item-link';
      link.href = wordPageHref(entry.href);
      link.innerHTML = `<span class="favorites-item-label">${entry.label}</span>${
        entry.primaryGreek
          ? `<span class="favorites-item-greek greek">${entry.primaryGreek}</span>`
          : ''
      }`;
      main.appendChild(link);
    } else {
      const label = document.createElement('span');
      label.className = 'favorites-item-label';
      label.textContent = entry.label;
      main.appendChild(label);
    }

    item.appendChild(main);
    item.appendChild(
      createRemoveButton(entry.label, () => fav.removeSlug(entry.slug)),
    );
    return item;
  }

  function renderFavoriteSection(entry) {
    const item = document.createElement('div');
    item.className = 'favorites-item favorites-item--section';
    item.setAttribute('role', 'listitem');
    item.dataset.sectionId = entry.id;

    const main = document.createElement('div');
    main.className = 'favorites-item-main';

    const href = sectionPageHref(entry.id);
    const link = document.createElement('a');
    link.className = 'favorites-item-link';
    link.href = href;

    const label = document.createElement('span');
    label.className = 'favorites-item-label';
    label.textContent = entry.label;

    const meta = document.createElement('span');
    meta.className = 'favorites-item-meta';
    meta.textContent = `${entry.count} ${pluralize(entry.count, 'слово', 'слова', 'слов')} · раздел`;

    link.append(label, meta);
    main.appendChild(link);
    item.appendChild(main);
    item.appendChild(
      createRemoveButton(entry.label, () => fav.removeSection(entry.id)),
    );
    return item;
  }

  function render() {
    const state = fav.readState();
    const hasFavorites = fav.hasAnyFavorites(state);
    const entries = fav.getFavoriteEntries(catalog, state);
    const favoriteWords = fav.getFavoriteWords(catalog, state);

    if (emptyEl) {
      emptyEl.classList.toggle('hidden', hasFavorites);
      emptyEl.toggleAttribute('hidden', hasFavorites);
    }

    if (heroContinue) {
      heroContinue.classList.toggle('hidden', !hasFavorites);
      heroContinue.toggleAttribute('hidden', !hasFavorites);
    }

    if (clearBtn) {
      clearBtn.classList.toggle('hidden', !hasFavorites);
      clearBtn.toggleAttribute('hidden', !hasFavorites);
    }

    if (hintEl) {
      if (!hasFavorites) {
        hintEl.textContent = 'В избранном пока нет записей';
      } else {
        const wordsCount = favoriteWords.length;
        const sectionsCount = state.sections.length;
        let hint = `Всего: ${wordsCount} ${pluralize(wordsCount, 'слово', 'слова', 'слов')}`;
        if (sectionsCount > 0) {
          hint += ` · ${sectionsCount} ${pluralize(sectionsCount, 'раздел', 'раздела', 'разделов')}`;
        }
        hintEl.textContent = hint;
      }
    }

    if (!listEl) return;

    listEl.replaceChildren();
    if (!hasFavorites) return;

    const sectionEntries = entries.filter((e) => e.kind === 'section');
    const wordEntries = entries.filter((e) => e.kind === 'word');

    if (sectionEntries.length > 0) {
      const sectionGroupHead = document.createElement('h2');
      sectionGroupHead.className = 'favorites-group-title';
      sectionGroupHead.textContent = 'Разделы';
      listEl.appendChild(sectionGroupHead);

      const sectionList = document.createElement('div');
      sectionList.className = 'favorites-sublist favorites-sublist--sections';
      for (const entry of sectionEntries) {
        sectionList.appendChild(renderFavoriteSection(entry));
      }
      listEl.appendChild(sectionList);
    }

    if (wordEntries.length > 0) {
      if (sectionEntries.length > 0) {
        const wordGroupHead = document.createElement('h2');
        wordGroupHead.className = 'favorites-group-title';
        wordGroupHead.textContent = 'Слова';
        listEl.appendChild(wordGroupHead);
      }

      const wordList = document.createElement('div');
      wordList.className = 'favorites-sublist favorites-sublist--words';
      for (const entry of wordEntries) {
        wordList.appendChild(renderFavoriteWord(entry));
      }
      listEl.appendChild(wordList);
    }
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Очистить всё избранное?')) {
        localStorage.removeItem(fav.STORAGE_KEY);
        document.dispatchEvent(new CustomEvent('greek3:favorites-change', { detail: { cleared: true } }));
      }
    });
  }

  fav.onChange(render);
  document.addEventListener('greek3:favorites-change', render);
  render();
})();
