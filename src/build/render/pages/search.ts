import { embedJson } from '../html';
import { sitePath } from '../../site-path';
import { escapeHtml } from '../html';
import { layout } from '../layout';
import { normalizeSearchText } from '../../normalize-search';
import type { CatalogWord } from '../../types';

export interface SearchIndexEntry {
  slug: string;
  label: string;
  href: string;
  greek: string;
  searchText: string;
}

export interface SearchIndexEntry {
  slug: string;
  label: string;
  href: string;
  greek: string;
  searchText: string;
}

export function buildSearchIndex(words: CatalogWord[]): SearchIndexEntry[] {
  return words.map((word) => {
    const greekParts = [
      word.primaryGreek,
      ...word.baseForms,
      ...word.forms.map((f) => f.greek),
    ].filter(Boolean);
    const ruParts = [
      word.label,
      word.translation,
      ...word.forms.map((f) => f.translation),
    ].filter(Boolean);
    const greek = greekParts[0] ?? '';
    const searchText = normalizeSearchText(
      [...new Set([...greekParts, ...ruParts])].join(' '),
    );
    return {
      slug: word.slug,
      label: word.label,
      href: sitePath(`words/${word.href}`),
      greek,
      searchText,
    };
  });
}

export function renderSearch(searchIndex: SearchIndexEntry[]): string {
  const indexJson = `<script type="application/json" id="search-index">${embedJson(searchIndex)}</script>`;

  const content = `
    <section class="search-page fade-in">
      <div class="page-head">
        <h1>Поиск</h1>
        <p class="page-intro">Ищите по греческому или русскому тексту среди всех слов словаря.</p>
      </div>
      <div class="search-field-wrap">
        <input
          type="search"
          class="search-input"
          id="search-input"
          placeholder="Греческий или русский…"
          autocomplete="off"
          enterkeyhint="search"
          autofocus>
      </div>
      <p class="search-status" id="search-status" aria-live="polite"></p>
      <div class="search-results" id="search-results"></div>
      ${indexJson}
    </section>`;

  return layout(content, 'Поиск', [{ label: 'Главная', href: sitePath('index.html') }, { label: 'Поиск' }], [
    'assets/js/search.js',
  ]);
}