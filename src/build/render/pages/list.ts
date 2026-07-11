import type { IndexPage, VerbCatalog } from '../../types';
import { escapeHtml, embedJson } from '../html';
import { layout } from '../layout';
import {
  copyWordsToolbarMarkup,
  deckSettingsDialogMarkup,
  examplesDialogMarkup,
  favoriteButtonMarkup,
  flashcardMarkup,
  practiceCompleteMarkup,
} from '../fragments';
import { buildPageSectionId } from '../../favorites-id';
import { renderGroupedLinks } from '../index-links';

export function renderIndex(
  page: IndexPage,
  pageOutputDir: string,
  breadcrumbs: { label: string; href?: string }[],
  catalog?: VerbCatalog,
): string {
  const links = renderGroupedLinks(page, pageOutputDir, catalog);
  const intro = page.intro
    ? `<p class="page-intro">${escapeHtml(page.intro).replace(/\n/g, '<br>')}</p>`
    : '';

  const catalogJson = catalog
    ? `<script type="application/json" id="verbs-catalog">${embedJson(catalog)}</script>`
    : '';

  const hasWords = Boolean(catalog && catalog.words.length > 0);
  const pageId = catalog?.pageId ?? pageOutputDir.replace(/^words\/?/, '').replace(/\/$/, '');
  const pageFavoriteBtn =
    hasWords && pageId
      ? favoriteButtonMarkup({
          kind: 'page',
          id: buildPageSectionId(pageId),
          label: page.title,
          className: 'btn-favorite--page',
        })
      : '';

  const content = `
    <section class="verbs-list-page" data-deck-id="${escapeHtml(catalog?.deckId ?? '')}"${pageId ? ` data-page-id="${escapeHtml(pageId)}"` : ''}>
      ${hasWords ? copyWordsToolbarMarkup() : ''}
      <div class="page-head fade-in list-head">
        <div class="page-head-row">
          <h1>${escapeHtml(page.title)}</h1>
          ${pageFavoriteBtn}
        </div>
        ${intro}
        ${catalog && catalog.words.length > 0 ? `<div class="list-practice-actions">
          <button type="button" class="btn btn-secondary list-practice-btn" id="btn-practice-el" data-practice-direction="ru-el" aria-pressed="false">Ру → Ελ</button>
          <button type="button" class="btn btn-secondary list-practice-btn" id="btn-practice-ru" data-practice-direction="el-ru" aria-pressed="false">Ελ → Ру</button>
          <button type="button" class="btn btn-secondary" id="btn-view-compact" aria-pressed="false">Компактно</button>
        </div>` : ''}
      </div>

      <section class="list-practice hidden" id="list-practice" aria-hidden="true">
        <div class="practice-panel practice-panel--wide fade-in">
          ${flashcardMarkup('list-flashcard-root')}
          ${practiceCompleteMarkup()}
        </div>
        <button type="button" class="btn btn-secondary btn-close-practice" id="btn-close-practice">← К списку</button>
      </section>

      <section class="links-list" id="verbs-links">
        ${links}
      </section>
      ${catalogJson}
    </section>`;

  const scripts =
    catalog && catalog.words.length > 0
      ? ['assets/js/list-controls.js', 'assets/js/list-practice.js']
      : [];

  const hasDeckPractice = Boolean(catalog && catalog.words.length > 0);
  const layoutOptions = hasDeckPractice
    ? {
        showSettings: true,
        bodyEnd: `${examplesDialogMarkup()}${deckSettingsDialogMarkup(catalog!.words.length)}`,
      }
    : {};

  return layout(content, page.title, breadcrumbs, scripts, layoutOptions);
}

export function casesCheatSheetCell(text: string): string {
  return `<td class="greek cases-cheatsheet-cell">${escapeHtml(text)}</td>`;
}

export function casesCheatSheetRow(
  gender: string,
  nom: string,
  gen: string,
  acc: string,
): string {
  return `
            <tr>
              <td class="cases-cheatsheet-gender">${escapeHtml(gender)}</td>
              ${casesCheatSheetCell(nom)}
              ${casesCheatSheetCell(gen)}
              ${casesCheatSheetCell(acc)}
            </tr>`;
}

export function casesCheatSheetMarkup(): string {
  const rows: [string, string, string, string][] = [
    ['м.р. ед.', 'ο …−ος / −ας', 'του …−ου', 'τον …−ο'],
    ['ж.р. ед.', 'η …−η / −α', 'της …−ης / −ας', 'την …−η / −α'],
    ['с.р. ед.', 'το …−ο / −ι / −μα', 'του …−ου / −ιού', 'το …−ο / −ι / −μα'],
    ['м.р. мн.', 'οι …−οι / −ες', 'των …−ων', 'τους …−ους / −ες'],
    ['ж.р. мн.', 'οι …−ες', 'των …−ων', 'τις …−ες'],
    ['с.р. мн.', 'τα …−α / −ια / −ματα', 'των …−ων', 'τα …−α / −ια / −ματα'],
  ];

  const body = rows.map(([g, n, ge, a]) => casesCheatSheetRow(g, n, ge, a)).join('');

  return `
    <section class="cases-cheatsheet fade-in" aria-label="Шпаргалка по падежам">
      <h2>Шпаргалка</h2>
      <div class="cases-cheatsheet-scroll">
        <table class="cases-cheatsheet-table">
          <thead>
            <tr>
              <th></th>
              <th class="cases-cheatsheet-th cases-cheatsheet-th--nom">Ονομ.<span>кто? что?</span></th>
              <th class="cases-cheatsheet-th cases-cheatsheet-th--gen">Γεν.<span>кого? чего?</span></th>
              <th class="cases-cheatsheet-th cases-cheatsheet-th--acc">Αιτ.<span>кого? что?</span></th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>`;
}

export function renderCasesIndex(
  page: IndexPage,
  pageOutputDir: string,
  breadcrumbs: { label: string; href?: string }[],
  catalog: VerbCatalog | undefined,
  gameData: unknown,
): string {
  const links = renderGroupedLinks(page, pageOutputDir, catalog);
  const intro = page.intro
    ? `<p class="page-intro">${escapeHtml(page.intro).replace(/\n/g, '<br>')}</p>`
    : '';

  const catalogJson = catalog
    ? `<script type="application/json" id="verbs-catalog">${embedJson(catalog)}</script>`
    : '';

  const gameJson = `<script type="application/json" id="cases-game-data">${embedJson(gameData)}</script>`;

  const hasWords = Boolean(catalog && catalog.words.length > 0);

  const content = `
    <section class="verbs-list-page cases-page" data-deck-id="cases">
      ${hasWords ? copyWordsToolbarMarkup() : ''}
      <div class="page-head fade-in list-head">
        <h1>${escapeHtml(page.title)}</h1>
        ${intro || '<p class="page-intro">Три основных падежа: именительный (подлежащее), родительный (принадлежность), винительный (дополнение). Изучите правила выше — затем пройдите последовательное обучение: правило → окончания → слова в контексте.</p>'}
      </div>

      ${casesCheatSheetMarkup()}

      <section class="links-list" id="verbs-links">
        ${links}
      </section>

      <section class="cases-game fade-in" id="cases-game" aria-label="Практика падежей">
        <div class="cases-game-head">
          <p class="cases-game-progress" data-cases-progress>Блок 1 из 12</p>
          <span class="cases-game-badge" data-cases-badge hidden></span>
          <h2 data-cases-title>Именительный · мужской род</h2>
          <p class="cases-game-desc" data-cases-desc>Последовательное обучение: правило → окончания → слова в контексте.</p>
          <div class="cases-game-stages" data-cases-stages aria-label="Этапы блока"></div>
          <p class="cases-game-score">Счёт: <span data-cases-score>0 / 0</span></p>
        </div>
        <div class="cases-game-card">
          <div class="cases-game-view" data-cases-view="lesson">
            <h3 class="cases-game-lesson-title" data-cases-lesson-title>Правило</h3>
            <p class="cases-game-lesson-body" data-cases-lesson-body></p>
            <p class="cases-game-lesson-pattern greek" data-cases-lesson-pattern></p>
            <p class="cases-game-lesson-hint" data-cases-lesson-hint></p>
            <ul class="cases-game-lesson-examples" data-cases-lesson-examples></ul>
          </div>
          <div class="cases-game-view" data-cases-view="quiz" hidden>
            <p class="cases-game-prompt-label" data-cases-prompt-label></p>
            <p class="cases-game-prompt" data-cases-prompt>—</p>
            <div class="cases-game-options" data-cases-options></div>
          </div>
          <div class="cases-game-view cases-game-view--complete" data-cases-view="complete" hidden>
            <p class="cases-game-complete-text">Все блоки пройдены. Можно начать заново или вернуться к шпаргалке выше.</p>
          </div>
          <p class="cases-game-feedback" data-cases-feedback hidden></p>
          <div class="cases-game-actions">
            <button type="button" class="btn btn-primary" data-cases-continue>Понятно →</button>
            <button type="button" class="btn btn-primary" data-cases-next hidden>Дальше →</button>
            <button type="button" class="btn btn-secondary" data-cases-restart hidden>Начать заново</button>
          </div>
        </div>
      </section>
      ${catalogJson}
      ${gameJson}
    </section>`;

  const scripts = ['assets/js/cases-game.js'];
  if (catalog && catalog.words.length > 0) scripts.push('assets/js/list-practice.js');

  return layout(content, page.title, breadcrumbs, scripts);
}