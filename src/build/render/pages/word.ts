import type { WordEntry } from '../../types';
import { getSpecialSection } from '../../parse-word';
import { renderMarkdown } from '../../markdown';
import { escapeHtml } from '../html';
import { layout } from '../layout';
import { renderMetaBadges } from '../badges';
import { renderContextSection } from '../context';
import { flashcardMarkup, progressBarMarkup, wordSettingsDialogMarkup } from '../fragments';

export function renderWord(
  word: WordEntry,
  breadcrumbs: { label: string; href?: string }[],
): string {
  const isPhrase = word.meta.recordType === 'phrase' || word.category === 'phrases';
  const tenseLabels =
    word.category === 'cases'
      ? ['название', 'роль', 'артикли']
      : isPhrase
        ? ['вариант', 'форма', '']
        : ['прош.', 'наст.', 'буд.'];
  const translation = word.translation || word.title;
  const deckId = word.category || 'default';
  const showVerbSummary = word.baseForms.length > 0 && word.category !== 'numbers' && !isPhrase;
  const metaBadges = renderMetaBadges(word);
  const contextSection = getSpecialSection(word, 'контекст');
  const skipTitles = new Set(['контекст', 'уровень']);

  const summaryHtml = showVerbSummary
    ? `
      <div class="verb-summary">
        <div class="verb-summary-head">
          <span class="verb-summary-translation">${escapeHtml(translation)}</span>${word.verbType ? `<span class="verb-summary-type"> (${escapeHtml(word.verbType)})</span>` : ''}
        </div>
        ${metaBadges}
        <div class="verb-summary-grid">
          ${word.baseForms
            .map(
              (form, i) => `
            <div class="verb-summary-cell">
              <span class="verb-summary-tense">${tenseLabels[i] ?? ''}</span>
              <span class="verb-summary-form greek">${escapeHtml(form)}</span>
            </div>`,
            )
            .join('')}
        </div>
      </div>`
    : isPhrase
      ? `
      <div class="phrase-summary">
        <p class="phrase-summary-greek greek">${escapeHtml(word.primaryGreek || word.baseForms[0] || '')}</p>
        <p class="phrase-summary-ru">${escapeHtml(translation)}</p>
        ${metaBadges}
      </div>`
      : `<div class="word-title-block">
        <h1 class="word-title">${escapeHtml(translation)}</h1>
        ${word.primaryGreek ? `<p class="word-title-greek greek">${escapeHtml(word.primaryGreek)}</p>` : ''}
        ${metaBadges}
      </div>`;

  const formsJson = escapeHtml(JSON.stringify(word.forms));
  const baseFormsJson = escapeHtml(JSON.stringify(word.baseForms));

  const formsRows = word.forms
    .map(
      (f, i) => `
      <tr class="form-row" data-index="${i}">
        <td class="greek">${escapeHtml(f.greek)}</td>
        <td class="translation">${escapeHtml(f.translation)}</td>
      </tr>`,
    )
    .join('');

  const extraHtml = word.extraSections
    .filter((s) => !skipTitles.has(s.title.toLowerCase()))
    .map((s) => {
      const isContext = s.title.toLowerCase() === 'контекст';
      const body = isContext
        ? renderContextSection(s.lines)
        : renderMarkdown(s.lines.join('\n'));
      return `
      <section class="extra-section fade-in${isContext ? ' extra-section--context' : ''}">
        <h2>${escapeHtml(s.title)}</h2>
        <div class="extra-content">${body}</div>
      </section>`;
    })
    .join('');

  const contextHtml =
    contextSection && !extraHtml.includes('extra-section--context')
      ? `
      <section class="extra-section extra-section--context fade-in">
        <h2>Контекст</h2>
        <div class="extra-content">${renderContextSection(contextSection.lines)}</div>
      </section>`
      : '';

  const content = `
    <article class="word-page${isPhrase ? ' word-page--phrase' : ''}"
      data-word-slug="${escapeHtml(word.slug)}"
      data-deck-id="${escapeHtml(deckId)}"
      data-translation="${escapeHtml(translation)}"
      data-base-forms="${baseFormsJson}"
      data-forms="${formsJson}">
      <header class="word-header fade-in">
        ${summaryHtml}
        ${progressBarMarkup(word.slug)}
      </header>

      <section class="practice-panel practice-panel--wide fade-in">
        ${flashcardMarkup('flashcard-root')}
      </section>

      ${
        word.forms.length
          ? `
      <section class="forms-table-section fade-in">
        <h2>${isPhrase ? 'Варианты' : 'Все формы'}</h2>
        <div class="table-wrap">
          <table class="forms-table">
            <thead>
              <tr><th>Греческий</th><th>Перевод</th></tr>
            </thead>
            <tbody>${formsRows}</tbody>
          </table>
        </div>
      </section>`
          : ''
      }

      ${contextHtml}
      ${extraHtml}
    </article>`;

  return layout(content, word.translation || word.title, breadcrumbs, ['assets/js/practice.js'], {
    showSettings: true,
    bodyEnd: wordSettingsDialogMarkup(),
  });
}