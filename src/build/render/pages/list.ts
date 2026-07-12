import type { IndexPage, VerbCatalog } from '../../types';
import { sitePath } from '../../site-path';
import { escapeHtml, embedJson } from '../html';
import { layout } from '../layout';
import {
  deckSettingsDialogMarkup,
  examplesDialogMarkup,
  favoriteButtonMarkup,
  flashcardMarkup,
  homePracticePanelMarkup,
  practiceCompleteMarkup,
} from '../fragments';
import { buildPageSectionId } from '../../favorites-id';
import { renderGroupedLinks } from '../index-links';

function isLessonPage(pageDir: string): boolean {
  return /^words\/lessons\/\d+$/i.test(pageDir.replace(/\/$/, ''));
}

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
  const lessonPage = isLessonPage(pageOutputDir);
  const pageFavoriteBtn =
    hasWords && pageId
      ? favoriteButtonMarkup({
          kind: 'page',
          id: buildPageSectionId(pageId),
          label: page.title,
          className: 'btn-favorite--page',
        })
      : '';

  const lessonLearnBtn =
    lessonPage && hasWords
      ? `<button type="button" class="btn btn-primary list-practice-btn" id="btn-lesson-learn">Обучение</button>`
      : '';

  const lessonLearningBlock =
    lessonPage && hasWords
      ? `
      <section class="home-practice list-practice hidden" id="lesson-practice" aria-hidden="true">
        <div class="practice-panel practice-panel--wide fade-in">
          ${homePracticePanelMarkup('lesson-flashcard-root')}
        </div>
        <button type="button" class="btn btn-secondary btn-close-practice" id="btn-close-lesson-practice">← К уроку</button>
      </section>`
      : '';

  const content = `
    <section class="verbs-list-page"${lessonPage && hasWords ? ` data-learning-practice data-learning-mode="lesson" data-practice-section-id="lesson-practice" data-flashcard-root-id="lesson-flashcard-root" data-open-btn-id="btn-lesson-learn" data-close-btn-id="btn-close-lesson-practice" data-nav-id="lesson-practice-immersive" data-session-key="greek3:lesson-practice-session" data-hide-on-open="#verbs-links,.list-practice-actions,.page-head,#list-practice"` : ''} data-deck-id="${escapeHtml(catalog?.deckId ?? '')}"${pageId ? ` data-page-id="${escapeHtml(pageId)}"` : ''}>
      <div class="page-head fade-in list-head">
        <div class="page-head-row">
          <h1>${escapeHtml(page.title)}</h1>
          ${pageFavoriteBtn}
        </div>
        ${intro}
        ${hasWords ? `<div class="list-practice-actions">
          ${lessonLearnBtn}
          <button type="button" class="btn btn-secondary list-practice-btn" id="btn-practice-el" data-practice-direction="ru-el" aria-pressed="false">Ру → Ελ</button>
          <button type="button" class="btn btn-secondary list-practice-btn" id="btn-practice-ru" data-practice-direction="el-ru" aria-pressed="false">Ελ → Ру</button>
          <button type="button" class="btn btn-secondary" id="btn-view-compact" aria-pressed="false">Компактно</button>
        </div>` : ''}
      </div>

      ${lessonLearningBlock}

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
      ? [
          'assets/js/list-controls.js',
          'assets/js/list-practice.js',
          ...(lessonPage
            ? [
                'assets/js/learning-ladder.js',
                'assets/js/quiz-step.js',
                'assets/js/spell-step.js',
                'assets/js/match-step.js',
                'assets/js/home-practice.js',
              ]
            : []),
        ]
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
): string {
  const links = renderGroupedLinks(page, pageOutputDir, catalog);
  const intro = page.intro
    ? `<p class="page-intro">${escapeHtml(page.intro).replace(/\n/g, '<br>')}</p>`
    : '';

  const catalogJson = catalog
    ? `<script type="application/json" id="verbs-catalog">${embedJson(catalog)}</script>`
    : '';

  const hasWords = Boolean(catalog && catalog.words.length > 0);

  const content = `
    <section class="verbs-list-page cases-page" data-deck-id="cases">
      <div class="page-head fade-in list-head">
        <h1>${escapeHtml(page.title)}</h1>
        ${intro || '<p class="page-intro">Три основных падежа: именительный (подлежащее), родительный (принадлежность), винительный (дополнение). Изучите правила выше — затем откройте тренировку для практики артиклей, окончаний и переводов.</p>'}
        <div class="cases-practice-launch fade-in">
          <a href="${escapeHtml(sitePath('words/cases/practice.html'))}" class="btn btn-primary cases-practice-launch-btn">Тренировать падежи</a>
          <p class="cases-practice-launch-hint">Артикли, окончания, переводы и сопоставление форм — в отдельной тренировке с прогрессом.</p>
        </div>
      </div>

      ${casesCheatSheetMarkup()}

      <section class="links-list" id="verbs-links">
        ${links}
      </section>
      ${catalogJson}
    </section>`;

  const scripts: string[] = [];
  if (catalog && catalog.words.length > 0) scripts.push('assets/js/list-practice.js');

  const hasDeckPractice = Boolean(catalog && catalog.words.length > 0);
  const layoutOptions = hasDeckPractice
    ? {
        showSettings: true,
        bodyEnd: `${examplesDialogMarkup()}${deckSettingsDialogMarkup(catalog!.words.length)}`,
      }
    : {};

  return layout(content, page.title, breadcrumbs, scripts, layoutOptions);
}