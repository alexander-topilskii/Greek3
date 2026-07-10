(function (global) {
  const GRAMMATICAL_MARKER_RE =
    /\s*\([^)]*(?:ед\.|мн\.|м\.р\.|ж\.р\.|с\.р\.)[^)]*\)\s*$/i;
  const PLURAL_MARKER_RE = /\(мн\.\)/i;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function stripGrammaticalMarkers(text) {
    return String(text ?? '')
      .replace(GRAMMATICAL_MARKER_RE, '')
      .trim();
  }

  /**
   * Heuristic Russian noun plural for quiz labels when MD has "слово (мн.)"
   * with the same stem as the singular form.
   */
  function pluralizeRu(word) {
    const w = String(word ?? '').trim();
    if (!w) return w;

    if (/ок$/i.test(w)) return w.slice(0, -2) + 'ки';
    if (/ец$/i.test(w)) return w.slice(0, -2) + 'цы';
    if (/мя$/i.test(w)) return w.slice(0, -2) + 'мена';
    if (/[ая]$/i.test(w)) {
      if (/[гкхжчшщ]а$/i.test(w)) return w.slice(0, -1) + 'и';
      if (/[бвгджзйклмнпрстфхцчшщ]а$/i.test(w)) return w.slice(0, -1) + 'ы';
      return w.slice(0, -1) + 'и';
    }
    if (/[ийь]$/i.test(w)) return w.slice(0, -1) + 'и';
    if (/о$/i.test(w)) return w.slice(0, -1) + 'а';
    if (/е$/i.test(w)) return w.slice(0, -1) + 'я';
    if (/[бвгджзйклмнпрстфхцчшщ]$/i.test(w)) return w + 'ы';
    return w + 'и';
  }

  /**
   * Human-readable Russian label for multiple-choice / match games.
   * @param {string} translation
   * @param {string[]} [siblingTranslations] other forms of the same word
   */
  function formatRuForChoice(translation, siblingTranslations) {
    const raw = String(translation ?? '');
    const stripped = stripGrammaticalMarkers(raw);
    if (!PLURAL_MARKER_RE.test(raw)) return stripped;

    const siblings = Array.isArray(siblingTranslations) ? siblingTranslations : [];
    const singulars = siblings
      .filter((t) => !PLURAL_MARKER_RE.test(t))
      .map(stripGrammaticalMarkers)
      .filter(Boolean);

    if (singulars.some((s) => s.toLowerCase() === stripped.toLowerCase())) {
      return pluralizeRu(stripped);
    }

    return stripped;
  }

  global.GreekUtils = {
    escapeHtml,
    shuffle,
    stripGrammaticalMarkers,
    pluralizeRu,
    formatRuForChoice,
  };
})(window);
