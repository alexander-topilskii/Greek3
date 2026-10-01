(function () {
  const homePage = document.querySelector('.home-page[data-learning-mode="home"]');
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

  const card = document.querySelector('.section-card[data-section-href*="favorites"]');
  if (!card) return;

  const descEl = card.querySelector('p');
  if (!descEl) return;

  const defaultDesc = descEl.textContent || 'Слова и разделы, сохранённые для повторения';

  function pluralize(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
  }

  function render() {
    const state = fav.readState();
    const hasFavorites = fav.hasAnyFavorites(state);
    if (!hasFavorites) {
      descEl.textContent = defaultDesc;
      return;
    }

    const favoriteWords = fav.getFavoriteWords(catalog, state);
    const sectionsCount = state.sections.length;
    const wordsCount = favoriteWords.length;

    let text = `${wordsCount} ${pluralize(wordsCount, 'слово', 'слова', 'слов')}`;
    if (sectionsCount > 0) {
      text += ` · ${sectionsCount} ${pluralize(sectionsCount, 'раздел', 'раздела', 'разделов')}`;
    }
    descEl.textContent = text;
  }

  fav.onChange(render);
  document.addEventListener('greek3:favorites-change', render);
  render();
})();
