(function (global) {
  /** Нормализация строки для поиска: регистр, ударения, ё → е. */
  function normalizeSearchText(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .replace(/ё/g, 'е');
  }

  global.GreekNormalizeSearch = { normalizeSearchText };
})(window);
