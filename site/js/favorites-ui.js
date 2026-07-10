(function () {
  const fav = window.GreekFavorites;
  if (!fav) return;

  function resolveActive(btn) {
    const kind = btn.dataset.favoriteKind;
    const id = btn.dataset.favoriteId;
    if (!id) return false;
    if (kind === 'word') return fav.isSlugFavorite(id);
    return fav.isSectionFavorite(id);
  }

  function handleFavoriteClick(event) {
    const btn = event.currentTarget;
    if (!(btn instanceof HTMLButtonElement)) return;

    event.preventDefault();
    event.stopPropagation();

    const kind = btn.dataset.favoriteKind;
    const id = btn.dataset.favoriteId;
    const label = btn.dataset.favoriteLabel || id;
    if (!id) return;

    let added = false;
    if (kind === 'word') {
      added = fav.toggleSlug(id, label);
    } else {
      added = fav.toggleSection(id, label);
    }

    fav.syncButton(btn, added);
  }

  function initButton(btn) {
    if (!(btn instanceof HTMLButtonElement)) return;
    if (btn.dataset.favoriteInit) return;
    btn.dataset.favoriteInit = '1';

    fav.syncButton(btn, resolveActive(btn));
    btn.addEventListener('click', handleFavoriteClick);
  }

  function initAll(root = document) {
    root.querySelectorAll('.btn-favorite').forEach(initButton);
  }

  function refreshAll(root = document) {
    root.querySelectorAll('.btn-favorite').forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      fav.syncButton(btn, resolveActive(btn));
    });
  }

  fav.onChange(() => refreshAll());
  document.addEventListener('greek3:favorites-change', () => refreshAll());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAll());
  } else {
    initAll();
  }

  window.GreekFavoritesUI = { initAll, refreshAll, initButton };
})();
