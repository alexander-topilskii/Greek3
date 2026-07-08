(function () {
  const searchPage = document.querySelector('.search-page');
  if (!searchPage) return;

  const indexEl = document.getElementById('search-index');
  const input = document.getElementById('search-input');
  const resultsEl = document.getElementById('search-results');
  const statusEl = document.getElementById('search-status');
  const utils = window.GreekUtils;
  const normalize = window.GreekNormalizeSearch;
  if (!utils || !normalize) return;

  let index;
  try {
    index = JSON.parse(indexEl.textContent ?? '[]');
  } catch {
    statusEl.textContent = 'Не удалось загрузить индекс поиска.';
    return;
  }

  function normalizeQuery(text) {
    return normalize.normalizeSearchText(text.trim());
  }

  function renderResults(items) {
    if (!items.length) {
      resultsEl.innerHTML = '';
      return;
    }

    resultsEl.innerHTML = items
      .map(
        (item) => `
      <a href="${item.href}" class="word-link search-result fade-in">
        <div class="word-link-main">
          <span class="word-link-label">${escapeHtml(item.label)}</span>
          <span class="word-link-arrow" aria-hidden="true">→</span>
        </div>
        ${item.greek ? `<span class="search-result-greek greek">${escapeHtml(item.greek)}</span>` : ''}
      </a>`,
      )
      .join('');
  }

  const { escapeHtml } = utils;

  function runSearch() {
    const query = normalizeQuery(input.value);
    if (!query) {
      statusEl.textContent = '';
      resultsEl.innerHTML = '';
      return;
    }

    const matches = index.filter((item) => item.searchText.includes(query));
    statusEl.textContent = matches.length
      ? `Найдено: ${matches.length}`
      : 'Ничего не найдено — попробуйте другой запрос';

    renderResults(matches.slice(0, 80));
  }

  input.addEventListener('input', runSearch);
  input.addEventListener('search', runSearch);
})();
