import type { IndexPage, VerbCatalog } from '../../types';
import { sitePath } from '../../site-path';
import { escapeHtml, embedJson } from '../html';
import { layout } from '../layout';
import {
  copyWordsListButtonMarkup,
  examplesDialogMarkup,
  favoriteButtonMarkup,
  flashcardMarkup,
  homePracticePanelMarkup,
  practiceCompleteMarkup,
  settingsButtonHref,
} from '../fragments';
import { buildPageSectionId } from '../../favorites-id';
import { renderGroupedLinks } from '../index-links';

function isLessonPage(pageDir: string): boolean {
  return /^words\/lessons\/\d+$/i.test(pageDir.replace(/\/$/, ''));
}

function isBlockPage(pageDir: string): boolean {
  return /^words\/blocks\/\d+$/i.test(pageDir.replace(/\/$/, ''));
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
  const blockPage = isBlockPage(pageOutputDir);
  const learningPage = lessonPage || blockPage;
  const learningMode = lessonPage ? 'lesson' : blockPage ? 'block' : '';
  const learningLabel = lessonPage ? 'уроку' : 'блоку';
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
    learningPage && hasWords
      ? `<button type="button" class="btn btn-primary list-practice-btn" id="btn-lesson-learn">Обучение</button>`
      : '';

  const lessonLearningBlock =
    learningPage && hasWords
      ? `
      <section class="home-practice list-practice hidden" id="lesson-practice" aria-hidden="true">
        <div class="practice-panel practice-panel--wide fade-in">
          ${homePracticePanelMarkup('lesson-flashcard-root')}
        </div>
        <button type="button" class="btn btn-secondary btn-close-practice" id="btn-close-lesson-practice">← К ${learningLabel}</button>
      </section>`
      : '';

  const content = `
    <section class="verbs-list-page"${learningPage && hasWords ? ` data-learning-practice data-learning-mode="${learningMode}" data-practice-section-id="lesson-practice" data-flashcard-root-id="lesson-flashcard-root" data-open-btn-id="btn-lesson-learn" data-close-btn-id="btn-close-lesson-practice" data-nav-id="${learningMode}-practice-immersive" data-session-key="greek3:${learningMode}-practice-session" data-hide-on-open="#verbs-links,.list-practice-actions,.page-head,#list-practice"` : ''} data-deck-id="${escapeHtml(catalog?.deckId ?? '')}"${pageId ? ` data-page-id="${escapeHtml(pageId)}"` : ''}>
      <div class="page-head fade-in list-head">
        <div class="page-head-row">
          <h1>${escapeHtml(page.title)}</h1>
          ${pageFavoriteBtn}
        </div>
        ${intro}
        ${hasWords ? `<div class="list-practice-actions">
          ${copyWordsListButtonMarkup()}
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
          ...(learningPage
            ? [
                'assets/js/learning-ladder.js',
                'assets/js/quiz-step.js',
                'assets/js/spell-step.js',
                'assets/js/match-step.js',
                'assets/js/cloze-step.js',
                'assets/js/build-step.js',
                'assets/js/home-practice.js',
              ]
            : []),
        ]
      : [];

  const hasDeckPractice = Boolean(catalog && catalog.words.length > 0);
  const fromPath = pageOutputDir ? `${pageOutputDir}/index.html` : 'index.html';
  const layoutOptions = hasDeckPractice
    ? {
        showSettings: true,
        settingsHref: settingsButtonHref({
          deck: catalog?.deckId ?? pageId,
          from: fromPath,
        }),
        bodyEnd: examplesDialogMarkup(),
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

type CaseWordForms = {
  singular: [string, string];
  plural: [string, string];
};

type CaseGenderGroup = {
  gender: string;
  words: CaseWordForms[];
};

function casesNumberTableRows(groups: CaseGenderGroup[]): string {
  const lines: string[] = [];
  for (const group of groups) {
    const rowCount = group.words.length * 2;
    group.words.forEach((word, wordIndex) => {
      const rows = [
        { number: 'ед.', forms: word.singular, plural: false },
        { number: 'мн.', forms: word.plural, plural: true },
      ];
      rows.forEach((row, rowIndex) => {
        const genderCell =
          wordIndex === 0 && rowIndex === 0
            ? `<td class="cases-cheatsheet-gender" rowspan="${rowCount}">${escapeHtml(group.gender)}</td>`
            : '';
        const rowClass = row.plural ? ' class="cases-cheatsheet-row--plural"' : '';
        lines.push(
          '<tr' +
            rowClass +
            '>' +
            genderCell +
            `<td class="cases-cheatsheet-number">${escapeHtml(row.number)}</td>` +
            casesCheatSheetCell(row.forms[0]) +
            casesCheatSheetCell(row.forms[1]) +
            '</tr>',
        );
      });
    });
  }
  return lines.join('');
}

function casesNumberTable(
  caseClass: 'gen' | 'acc',
  caseTitle: string,
  caseHint: string,
  groups: CaseGenderGroup[],
): string {
  return `
      <div class="cases-cheatsheet-scroll">
        <table class="cases-cheatsheet-table cases-cheatsheet-table--detail">
          <thead>
            <tr>
              <th></th>
              <th class="cases-cheatsheet-number-col">число</th>
              <th class="cases-cheatsheet-th cases-cheatsheet-th--nom">Ονομ.<span>кто? что?</span></th>
              <th class="cases-cheatsheet-th cases-cheatsheet-th--${caseClass}">${caseTitle}<span>${caseHint}</span></th>
            </tr>
          </thead>
          <tbody>${casesNumberTableRows(groups)}</tbody>
        </table>
      </div>`;
}

const GENITIVE_EXAMPLES: CaseGenderGroup[] = [
  {
    gender: 'м.р.',
    words: [
      { singular: ['ο φίλος', 'του φίλου'], plural: ['οι φίλοι', 'των φίλων'] },
      { singular: ['ο γείτονας', 'του γείτονα'], plural: ['οι γείτονες', 'των γειτόνων'] },
      { singular: ['ο φοιτητής', 'του φοιτητή'], plural: ['οι φοιτητές', 'των φοιτητών'] },
    ],
  },
  {
    gender: 'ж.р.',
    words: [
      { singular: ['η γυναίκα', 'της γυναίκας'], plural: ['οι γυναίκες', 'των γυναικών'] },
      { singular: ['η αδερφή', 'της αδερφής'], plural: ['οι αδερφές', 'των αδερφών'] },
    ],
  },
  {
    gender: 'с.р.',
    words: [
      { singular: ['το μωρό', 'του μωρού'], plural: ['τα μωρά', 'των μωρών'] },
      { singular: ['το παιδί', 'του παιδιού'], plural: ['τα παιδιά', 'των παιδιών'] },
      { singular: ['το διαμέρισμα', 'του διαμερίσματος'], plural: ['τα διαμερίσματα', 'των διαμερισμάτων'] },
    ],
  },
];

const ACCUSATIVE_EXAMPLES: CaseGenderGroup[] = [
  {
    gender: 'м.р.',
    words: [
      { singular: ['ο φίλος', 'τον φίλο'], plural: ['οι φίλοι', 'τους φίλους'] },
      { singular: ['ο γείτονας', 'τον γείτονα'], plural: ['οι γείτονες', 'τους γείτονες'] },
      { singular: ['ο φοιτητής', 'τον φοιτητή'], plural: ['οι φοιτητές', 'τους φοιτητές'] },
    ],
  },
  {
    gender: 'ж.р.',
    words: [
      { singular: ['η γυναίκα', 'την γυναίκα'], plural: ['οι γυναίκες', 'τις γυναίκες'] },
      { singular: ['η αδερφή', 'την αδερφή'], plural: ['οι αδερφές', 'τις αδερφές'] },
    ],
  },
  {
    gender: 'с.р.',
    words: [
      { singular: ['το μωρό', 'το μωρό'], plural: ['τα μωρά', 'τα μωρά'] },
      { singular: ['το παιδί', 'το παιδί'], plural: ['τα παιδιά', 'τα παιδιά'] },
      { singular: ['το διαμέρισμα', 'το διαμέρισμα'], plural: ['τα διαμερίσματα', 'τα διαμερίσματα'] },
    ],
  },
];

export function casesGenitiveCheatsheetMarkup(): string {
  return `
    <section class="cases-cheatsheet cases-cheatsheet--genitive fade-in" aria-label="Родительный падеж — окончания">
      <h2>Родительный — окончания</h2>
      <p class="cases-cheatsheet-note">Типичные изменения: <strong>−ος → −ου</strong>, <strong>−ας → −α</strong>, <strong>−ης → −ή</strong>; <strong>−α → −ας</strong>, <strong>−η → −ης</strong>; <strong>−ο → −ου</strong>, <strong>−ι → −ιού</strong>, <strong>−μα → −ματος</strong>. Во мн. числе артикль родительного <strong>των</strong>, ударение часто на <strong>−ών</strong>.</p>
      ${casesNumberTable('gen', 'Γεν.', 'кого? чего?', GENITIVE_EXAMPLES)}
    </section>`;
}

export function casesAccusativeCheatsheetMarkup(): string {
  return `
    <section class="cases-cheatsheet cases-cheatsheet--accusative fade-in" aria-label="Винительный падеж — окончания">
      <h2>Винительный — окончания</h2>
      <p class="cases-cheatsheet-note">М.р. меняется: <strong>−ος → −ο</strong>, <strong>−ας → −α</strong>, <strong>−ης → −η</strong>. Ж.р. и с.р. в ед. числе часто <strong>совпадают с именительным</strong>. Во мн. числе: <strong>τους</strong> …−ους / −ες (м.), <strong>τις</strong> …−ες (ж.), <strong>τα</strong> …−α / −ια / −ματα (ср.).</p>
      ${casesNumberTable('acc', 'Αιτ.', 'кого? что?', ACCUSATIVE_EXAMPLES)}
    </section>`;
}

export function casesCheatSheetMarkup(): string {
  const rows: [string, string, string, string][] = [
    ['м.р. ед.', 'ο …−ος / −ας / −ης', 'του …−ου / −α / −ή', 'τον …−ο / −α / −η'],
    ['ж.р. ед.', 'η …−η / −α', 'της …−ης / −ας', 'την …−η / −α'],
    ['с.р. ед.', 'το …−ο / −ι / −μα', 'του …−ου / −ιού / −ματος', 'το …−ο / −ι / −μα'],
    ['м.р. мн.', 'οι …−οι / −ες', 'των …−ων / −ών', 'τους …−ους / −ες'],
    ['ж.р. мн.', 'οι …−ες', 'των …−ων / −ών', 'τις …−ες'],
    ['с.р. мн.', 'τα …−α / −ια / −ματα', 'των …−ων / −ιών / −μάτων', 'τα …−α / −ια / −ματα'],
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
      ${casesGenitiveCheatsheetMarkup()}
      ${casesAccusativeCheatsheetMarkup()}
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
          <div class="list-practice-actions cases-practice-actions">
            <a href="${escapeHtml(sitePath('words/cases/practice.html'))}" class="btn btn-primary cases-practice-launch-btn">Тренировать падежи</a>
            ${hasWords ? copyWordsListButtonMarkup() : ''}
          </div>
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
  const fromPath = pageOutputDir ? `${pageOutputDir}/index.html` : 'index.html';
  const layoutOptions = hasDeckPractice
    ? {
        showSettings: true,
        settingsHref: settingsButtonHref({ deck: 'cases', from: fromPath }),
        bodyEnd: examplesDialogMarkup(),
      }
    : {};

  return layout(content, page.title, breadcrumbs, scripts, layoutOptions);
}