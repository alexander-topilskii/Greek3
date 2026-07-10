(function () {
  const homePage = document.querySelector('.home-page');
  if (!homePage) return;

  const fav = window.GreekFavorites;
  if (!fav) return;

  const catalogEl = document.getElementById('global-catalog');
  if (!catalogEl) return;

  let catalog;
  try {
    catalog = JSON.parse(catalogEl.textContent ?? '{}');
  } catch (e) {
    console.error('Global catalog parse error for favorites', e);
    return;
  }

  const sectionEl = document.getElementById('favorites-section');
  const listEl = document.getElementById('favorites-list');
  const emptyEl = document.getElementById('favorites-empty');
  const hintEl = document.getElementById('favorites-section-hint');

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

    const label = document.createElement('span');
    label.className = 'favorites-item-label';
    label.textContent = entry.label;

    const meta = document.createElement('span');
    meta.className = 'favorites-item-meta';
    meta.textContent = `${entry.count} слов · раздел`;

    main.append(label, meta);
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

    if (sectionEl) {
      sectionEl.classList.toggle('hidden', !hasFavorites);
      sectionEl.toggleAttribute('hidden', !hasFavorites);
    }

    if (hintEl && hasFavorites) {
      hintEl.textContent = `Обучение на главной: ${favoriteWords.length} избранных слов`;
    }

    if (!listEl) return;

    listEl.replaceChildren();
    for (const entry of entries) {
      if (entry.kind === 'section') {
        listEl.appendChild(renderFavoriteSection(entry));
      } else {
        listEl.appendChild(renderFavoriteWord(entry));
      }
    }

    if (emptyEl) {
      const showEmpty = hasFavorites && entries.length === 0;
      emptyEl.classList.toggle('hidden', !showEmpty);
      emptyEl.toggleAttribute('hidden', !showEmpty);
    }
  }

  fav.onChange(render);
  document.addEventListener('greek3:favorites-change', render);
  render();
})();
