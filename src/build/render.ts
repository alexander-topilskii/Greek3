import type { CatalogWord, IndexLink, IndexPage, SiteConfig, VerbCatalog, WordEntry } from './types';
import { renderMarkdown } from './markdown';
import { getSpecialSection } from './parse-word';

const RECORD_TYPE_LABELS: Record<string, string> = {
  verb: 'глагол',
  noun: 'сущ.',
  adjective: 'прил.',
  pronoun: 'мест.',
  number: 'число',
  case: 'падеж',
  particle: 'част.',
  phrase: 'фраза',
  word: 'слово',
};

const SITE_CONFIG: SiteConfig = {
  title: 'Greek3',
  description: 'Изучение и практика современного греческого языка',
  baseUrl: process.env.SITE_BASE_URL ?? '',
};

/** Bust browser cache for static assets after deploy. */
const ASSET_VERSION = process.env.BUILD_ID ?? '2';

const SHARED_SCRIPTS = [
  'assets/js/db.js',
  'assets/js/srs.js',
  'assets/js/speak.js',
  'assets/js/flashcard.js',
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Root-absolute path with per-segment encoding — works regardless of current URL. */
export function sitePath(relativePath: string): string {
  const base = SITE_CONFIG.baseUrl.replace(/\/$/, '');
  const normalized = relativePath.replace(/^\//, '');
  const encoded = normalized
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return base ? `${base}/${encoded}` : `/${encoded}`;
}

function embedJson(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/&/g, '\\u0026');
}

function progressBarMarkup(slug: string): string {
  return `
        <div class="word-progress" data-progress-slug="${escapeHtml(slug)}" title="Прогресс: Ελ→Ру · Ру→Ελ">
          <div class="word-progress-track">
            <div class="word-progress-half word-progress-half--left" title="Ελ → Ру">
              <div class="word-progress-fill progress-word" aria-label="Ελ → Ру"></div>
            </div>
            <div class="word-progress-half word-progress-half--right" title="Ру → Ελ">
              <div class="word-progress-fill progress-ru-el" aria-label="Ру → Ελ"></div>
            </div>
          </div>
        </div>`;
}

function homePracticePanelMarkup(): string {
  return `
        <div class="practice-session-bar" id="practice-session-bar">
          <span class="practice-direction-badge" id="practice-direction-badge">Ελ → Ру</span>
          <span class="practice-pool-progress" id="practice-pool-progress">
            <span class="practice-pool-hint" id="practice-pool-hint"></span>
            <span class="practice-pool-progress-bar" aria-hidden="true">
              <span class="practice-pool-progress-fill" id="practice-pool-progress-fill"></span>
            </span>
          </span>
        </div>
        ${flashcardMarkup('home-flashcard-root')}
        <p class="practice-word-source hidden" id="practice-word-source" hidden></p>
        <div class="practice-block-complete hidden" id="practice-block-complete" hidden>
          <p class="practice-block-complete-text" id="practice-block-complete-text"></p>
          <div class="practice-block-complete-actions">
            <button type="button" class="btn btn-primary" id="btn-repeat-block">Повторить блок</button>
            <button type="button" class="btn btn-secondary" id="btn-add-words">Добавить слова в набор</button>
          </div>
        </div>
        <div class="practice-catalog-complete hidden" id="practice-catalog-complete" hidden>
          <p class="practice-catalog-complete-text">Все слова каталога пройдены в обоих направлениях.</p>
          <button type="button" class="btn btn-primary" id="btn-repeat-catalog">Повторить с начала</button>
        </div>`;
}

function practiceCompleteMarkup(): string {
  return `
        <div class="practice-direction-prompt hidden" id="practice-direction-prompt" hidden>
          <p class="practice-direction-prompt-text" id="practice-direction-prompt-text"></p>
          <div class="practice-direction-prompt-actions">
            <button type="button" class="btn btn-primary" id="btn-switch-ru-el">Переключиться на Ру → Ελ</button>
            <button type="button" class="btn btn-secondary" id="btn-dismiss-ru-el-prompt">Позже</button>
          </div>
        </div>
        <div class="practice-complete hidden" id="practice-complete" hidden>
          <p class="practice-complete-text">Можно пройти ещё раз или вернуться к списку.</p>
          <button type="button" class="btn btn-primary" id="btn-repeat-session">Повторить ещё раз</button>
        </div>`;
}

function flashcardMarkup(id = 'flashcard-root'): string {
  return `
    <div class="flashcard-root" id="${id}">
      <div class="flashcard-hints" aria-hidden="true">
        <span class="flashcard-hint flashcard-hint--left">Не помню</span>
        <span class="flashcard-hint flashcard-hint--right">Помню</span>
      </div>
      <div class="flashcard" tabindex="0" role="button" aria-label="Карточка — тап перевернуть, свайп оценить">
        <div class="flashcard-drag">
          <div class="flashcard-inner">
            <div class="flashcard-front">
              <span class="flashcard-label" data-flash-front-label>Греческий</span>
              <p class="flashcard-text" data-flash-front-text>—</p>
            </div>
            <div class="flashcard-back">
              <span class="flashcard-label" data-flash-back-label>Перевод</span>
              <p class="flashcard-text" data-flash-back-text>—</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="practice-controls">
      <button type="button" class="btn btn-primary btn-random">Случайная</button>
      <button type="button" class="btn btn-secondary btn-lang" aria-pressed="false" title="Показывать сначала по-русски">⇄ RU</button>
      <button type="button" class="speak-switch btn-speak" role="switch" aria-checked="false" aria-label="Автоозвучка" title="Включить автоозвучку">
        <span class="speak-switch-track" aria-hidden="true">
          <span class="speak-switch-thumb">🔊</span>
        </span>
      </button>
    </div>`;
}

function settingsPanel(scope: 'word' | 'deck', maxWords = 999): string {
  if (scope === 'word') {
    return `
    <details class="settings-panel fade-in">
      <summary class="settings-summary">Настройки прогресса</summary>
      <div class="settings-body">
        <button type="button" class="btn btn-secondary btn-reset-word">Сбросить этот глагол</button>
      </div>
    </details>`;
  }
  return `
    <details class="settings-panel fade-in" id="deck-settings">
      <summary class="settings-summary">Настройки прогресса</summary>
      <div class="settings-body">
        <label class="settings-field">
          <span>Начальная группа</span>
          <input type="number" id="setting-initial-batch" min="1" max="30" value="5">
        </label>
        <label class="settings-field">
          <span>Активных слов</span>
          <input type="number" id="setting-active-limit" min="1" max="${maxWords}" value="5">
        </label>
        <p class="settings-hint">При выучивании слова в набор автоматически добавляется новое. Старые повторяются реже, но по расписанию SRS.</p>
        <div class="settings-actions">
          <button type="button" class="btn btn-secondary" id="btn-save-settings">Сохранить</button>
          <button type="button" class="btn btn-secondary" id="btn-reset-deck">Сбросить прогресс</button>
        </div>
      </div>
    </details>`;
}

function homeSettingsButtonMarkup(): string {
  return `
        <button type="button" class="btn-icon btn-header-settings" id="btn-home-settings" aria-label="Настройки" title="Настройки">
          <svg class="icon-gear" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>`;
}

function homeSettingsDialogMarkup(): string {
  return `
  <dialog class="settings-dialog" id="home-settings-dialog" aria-labelledby="home-settings-title">
    <form method="dialog" class="settings-dialog-inner">
      <header class="settings-dialog-header">
        <h2 class="settings-dialog-title" id="home-settings-title">Настройки</h2>
        <button type="submit" class="btn-icon btn-dialog-close" aria-label="Закрыть">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </header>
      <div class="settings-dialog-body">
        <label class="settings-field">
          <span>Слов в группе</span>
          <input type="number" id="home-setting-group-size" min="1" max="30" value="5">
        </label>
        <p class="settings-hint">Сколько слов одновременно в активном наборе. При выучивании слова в набор добавляется новое.</p>
        <div class="settings-actions">
          <button type="button" class="btn btn-secondary" id="btn-save-home-settings">Сохранить</button>
        </div>
        <hr class="settings-divider">
        <button type="button" class="btn btn-secondary btn-reset-all" id="btn-reset-all-progress">Сбросить весь прогресс</button>
        <p class="settings-hint">Удалит все данные о выученных словах и начнёт обучение сначала.</p>
      </div>
    </form>
  </dialog>`;
}

function layout(
  content: string,
  pageTitle: string,
  breadcrumbs?: { label: string; href?: string }[],
  extraScripts: string[] = [],
  options: { headerActions?: string; bodyEnd?: string } = {},
): string {
  const crumbs = breadcrumbs
    ?.map((c) =>
      c.href
        ? `<a href="${escapeHtml(c.href)}" class="crumb-link">${escapeHtml(c.label)}</a>`
        : `<span class="crumb-current">${escapeHtml(c.label)}</span>`,
    )
    .join('<span class="crumb-sep">/</span>') ?? '';

  const scripts = [...SHARED_SCRIPTS, ...extraScripts]
    .map((s) => `<script src="${sitePath(s)}?v=${ASSET_VERSION}" defer></script>`)
    .join('\n  ');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(SITE_CONFIG.description)}">
  <title>${escapeHtml(pageTitle)} · ${escapeHtml(SITE_CONFIG.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Noto+Sans:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${sitePath('assets/css/main.css')}?v=${ASSET_VERSION}">
</head>
<body>
  <div class="page-bg"></div>
  <header class="site-header">
    <div class="container header-inner">
      <a href="${sitePath('index.html')}" class="logo">
        <span class="logo-mark">α</span>
        <span class="logo-text">${escapeHtml(SITE_CONFIG.title)}</span>
      </a>
      <nav class="site-nav">
        <a href="${sitePath('words/index.html')}">Словарь</a>
        <a href="${sitePath('words/lessons/index.html')}">Уроки</a>
        ${options.headerActions ?? ''}
      </nav>
    </div>
  </header>
  <main class="site-main container">
    ${crumbs ? `<nav class="breadcrumbs" aria-label="Навигация">${crumbs}</nav>` : ''}
    ${content}
  </main>
  <footer class="site-footer">
    <div class="container">
      <p>Учим греческий вместе · ${escapeHtml(SITE_CONFIG.title)}</p>
    </div>
  </footer>
  ${options.bodyEnd ?? ''}
  ${scripts}
</body>
</html>`;
}

export function renderHome(
  sections: { title: string; href: string; description: string }[],
  globalCatalog?: VerbCatalog,
): string {
  const cards = sections
    .map(
      (s) => `
    <a href="${s.href.startsWith('#') ? s.href : escapeHtml(sitePath(s.href))}" class="section-card fade-in">
      <h2>${escapeHtml(s.title)}</h2>
      <p>${escapeHtml(s.description)}</p>
      <span class="card-arrow" aria-hidden="true">→</span>
    </a>`,
    )
    .join('');

  const catalogJson = globalCatalog
    ? `<script type="application/json" id="global-catalog">${embedJson(globalCatalog)}</script>`
    : '';

  const continueBlock =
    globalCatalog && globalCatalog.words.length > 0
      ? `
      <div class="hero-actions fade-in">
        <button type="button" class="btn btn-primary btn-continue" id="btn-continue">Продолжить</button>
        <p class="continue-hint" id="continue-hint">Загрузка прогресса…</p>
      </div>`
      : '';

  const practiceBlock =
    globalCatalog && globalCatalog.words.length > 0
      ? `
    <section class="home-practice list-practice hidden" id="home-practice" aria-hidden="true">
      <div class="practice-panel practice-panel--wide fade-in">
        ${homePracticePanelMarkup()}
      </div>
      <button type="button" class="btn btn-secondary btn-close-practice" id="btn-close-practice">← На главную</button>
    </section>`
      : '';

  const content = `
    <section class="home-page verbs-list-page" data-deck-id="global">
      <section class="hero fade-in">
        <p class="hero-label">Современный греческий</p>
        <h1>Изучай и практикуй<br><span class="hero-accent">ελληνικά</span></h1>
        ${continueBlock}
      </section>
      ${practiceBlock}
      <section class="sections-grid" id="sections-grid">
        ${cards}
      </section>
      ${catalogJson}
    </section>`;

  const hasHomePractice = Boolean(globalCatalog && globalCatalog.words.length > 0);
  const scripts = hasHomePractice ? ['assets/js/home-practice.js'] : [];
  const layoutOptions = hasHomePractice
    ? {
        headerActions: homeSettingsButtonMarkup(),
        bodyEnd: homeSettingsDialogMarkup(),
      }
    : {};

  return layout(content, 'Главная', undefined, scripts, layoutOptions);
}

function normalizeSitePath(...parts: string[]): string {
  const stack: string[] = [];
  for (const part of parts.join('/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

function renderBadges(word: CatalogWord | undefined): string {
  if (!word) return '';
  const parts: string[] = [];
  if (word.level) {
    parts.push(`<span class="word-badge word-badge--level">${escapeHtml(word.level)}</span>`);
  }
  if (word.recordType) {
    const label = RECORD_TYPE_LABELS[word.recordType] ?? word.recordType;
    parts.push(`<span class="word-badge word-badge--type">${escapeHtml(label)}</span>`);
  }
  for (const topic of word.topics.slice(0, 2)) {
    parts.push(`<span class="word-badge word-badge--topic">${escapeHtml(topic)}</span>`);
  }
  if (!parts.length) return '';
  return `<div class="word-link-badges">${parts.join('')}</div>`;
}

function renderMetaBadges(word: WordEntry): string {
  const parts: string[] = [];
  if (word.meta.level) {
    parts.push(`<span class="word-badge word-badge--level">${escapeHtml(word.meta.level)}</span>`);
  }
  if (word.meta.recordType) {
    const label = RECORD_TYPE_LABELS[word.meta.recordType] ?? word.meta.recordType;
    parts.push(`<span class="word-badge word-badge--type">${escapeHtml(label)}</span>`);
  }
  for (const topic of word.meta.topics.slice(0, 3)) {
    parts.push(`<span class="word-badge word-badge--topic">${escapeHtml(topic)}</span>`);
  }
  if (!parts.length) return '';
  return `<div class="word-header-badges">${parts.join('')}</div>`;
}

function renderContextSection(lines: string[]): string {
  const items: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('-')) continue;
    const content = trimmed.replace(/^-\s*/, '');
    const parts = content.split(/\s+[—–-]\s+/);
    if (parts.length >= 2) {
      const greek = parts[0].replace(/\*\*/g, '').trim();
      const ru = parts.slice(1).join(' — ').trim();
      items.push(`
        <div class="context-bubble">
          <p class="context-bubble-greek greek">${renderMarkdown(greek)}</p>
          <p class="context-bubble-ru">${escapeHtml(ru)}</p>
        </div>`);
    } else {
      items.push(`<div class="context-bubble"><div class="context-bubble-ru">${renderMarkdown(content)}</div></div>`);
    }
  }
  if (!items.length) return renderMarkdown(lines.join('\n'));
  return `<div class="context-bubbles">${items.join('')}</div>`;
}

function indexLinkSitePath(pageOutputDir: string, link: IndexLink): string {
  if (link.resolvedHref && !/^(https?:)?\/\//.test(link.resolvedHref)) {
    return sitePath(normalizeSitePath('words', link.resolvedHref));
  }
  return sitePath(normalizeSitePath(pageOutputDir, link.href));
}

function renderIndexLink(
  link: IndexLink,
  pageOutputDir: string,
  catalog: VerbCatalog | undefined,
): string {
  const catalogKey = link.resolvedHref ?? link.href;
  const word = catalog?.words.find((w) => w.href === catalogKey);
  const slug = word?.slug ?? '';
  return `
      <a href="${escapeHtml(indexLinkSitePath(pageOutputDir, link))}" class="word-link fade-in" data-word-slug="${escapeHtml(slug)}">
        <div class="word-link-main">
          <span class="word-link-label">${escapeHtml(link.label)}</span>
          <span class="word-link-arrow" aria-hidden="true">→</span>
        </div>
        ${renderBadges(word)}
        ${slug ? progressBarMarkup(slug) : ''}
      </a>`;
}

function reverseLessonsIndex(page: IndexPage): IndexPage {
  if (page.sourcePath.toLowerCase() !== 'lessons/readme.md') return page;
  return {
    ...page,
    sections: [...page.sections]
      .reverse()
      .map((section) => ({
        ...section,
        links: [...section.links].reverse(),
      })),
    links: [...page.links].reverse(),
  };
}

function renderGroupedLinks(
  page: IndexPage,
  pageOutputDir: string,
  catalog: VerbCatalog | undefined,
): string {
  const displayPage = reverseLessonsIndex(page);
  const sections =
    displayPage.sections.length > 0
      ? displayPage.sections.filter((s) => s.links.length > 0)
      : [{ title: '', links: displayPage.links }];

  if (!sections.length || !displayPage.links.length) {
    return '<p class="empty-state">Пока нет записей. Добавьте MD-файлы в этот раздел.</p>';
  }

  return sections
    .map((section) => {
      const items = section.links
        .map((link) => renderIndexLink(link, pageOutputDir, catalog))
        .join('');
      const heading = section.title
        ? `<h2 class="links-group-title">${escapeHtml(section.title)}</h2>`
        : '';
      return `
      <div class="links-group">
        ${heading}
        <div class="links-group-items">${items}</div>
      </div>`;
    })
    .join('');
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

  const content = `
    <section class="verbs-list-page" data-deck-id="${escapeHtml(catalog?.deckId ?? '')}">
      <div class="page-head fade-in list-head">
        <h1>${escapeHtml(page.title)}</h1>
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

      ${catalog ? settingsPanel('deck', catalog.words.length) : ''}

      <section class="links-list" id="verbs-links">
        ${links}
      </section>
      ${catalogJson}
    </section>`;

  const scripts =
    catalog && catalog.words.length > 0
      ? ['assets/js/list-controls.js', 'assets/js/list-practice.js']
      : [];

  return layout(content, page.title, breadcrumbs, scripts);
}

function casesCheatSheetCell(text: string): string {
  return `<td class="greek cases-cheatsheet-cell">${escapeHtml(text)}</td>`;
}

function casesCheatSheetRow(
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

function casesCheatSheetMarkup(): string {
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

  const content = `
    <section class="verbs-list-page cases-page" data-deck-id="cases">
      <div class="page-head fade-in list-head">
        <h1>${escapeHtml(page.title)}</h1>
        ${intro || '<p class="page-intro">Три основных падежа: именительный (подлежащее), родительный (принадлежность), винительный (дополнение). Изучите падежи и управление глаголов — затем потренируйтесь в мини-игре.</p>'}
      </div>

      ${casesCheatSheetMarkup()}

      <section class="links-list" id="verbs-links">
        ${links}
      </section>

      <section class="cases-game fade-in" id="cases-game" aria-label="Практика падежей">
        <div class="cases-game-head">
          <h2>Мини-игра: перевод фраз</h2>
          <p class="cases-game-desc">Русская фраза — выберите правильный греческий перевод. Простая лексика A1–A2.</p>
          <p class="cases-game-score">Счёт: <span data-cases-score>0 / 0</span></p>
        </div>
        <div class="cases-game-card">
          <p class="cases-game-ru" data-cases-ru>—</p>
          <div class="cases-game-options" data-cases-options></div>
          <div class="cases-game-meta" data-cases-meta hidden>
            <span class="cases-game-badge" data-cases-badge aria-hidden="true"></span>
            <p class="cases-game-hint" data-cases-hint></p>
          </div>
          <p class="cases-game-feedback" data-cases-feedback hidden></p>
          <div class="cases-game-actions">
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

      ${settingsPanel('word')}

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

  return layout(content, word.translation || word.title, breadcrumbs, ['assets/js/practice.js']);
}

export function wordOutputPath(slug: string): string {
  return `words/${slug}.html`;
}

export function outputDirFor(relativeHtmlPath: string): string {
  const dir = pathDirname(relativeHtmlPath);
  return dir === '.' ? '' : dir;
}

function pathDirname(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  return idx === -1 ? '.' : filePath.slice(0, idx);
}

export function depthForOutput(relativeHtmlPath: string): number {
  const dir = relativeHtmlPath.replace(/[^/]+$/, '');
  if (!dir) return 0;
  return dir.split('/').filter(Boolean).length;
}

export function buildCatalogWord(word: WordEntry, href: string, label: string): CatalogWord {
  return {
    slug: word.slug,
    translation: word.translation || word.title,
    verbType: word.verbType,
    baseForms: word.baseForms,
    href,
    label,
    formCount: word.forms.length,
    forms: word.forms,
    level: word.meta.level,
    topics: word.meta.topics,
    tags: word.meta.tags,
    recordType: word.meta.recordType,
    primaryGreek: word.primaryGreek,
    category: word.category,
  };
}

export function renderTopicLevelHub(
  title: string,
  items: { title: string; href: string; count: number; description?: string }[],
  breadcrumbs: { label: string; href?: string }[],
): string {
  const cards = items
    .map(
      (item) => `
    <a href="${escapeHtml(sitePath(item.href))}" class="section-card fade-in">
      <h2>${escapeHtml(item.title)}</h2>
      <p>${escapeHtml(item.description ?? `${item.count} записей`)}</p>
      <span class="card-arrow" aria-hidden="true">→</span>
    </a>`,
    )
    .join('');

  const content = `
    <section class="hub-page">
      <div class="page-head fade-in">
        <h1>${escapeHtml(title)}</h1>
      </div>
      <div class="sections-grid">${cards || '<p class="empty-state">Пока нет записей с метаданными.</p>'}</div>
    </section>`;

  return layout(content, title, breadcrumbs);
}

export function syntheticIndexFromCatalog(
  title: string,
  intro: string,
  catalog: VerbCatalog,
  sourcePath: string,
): IndexPage {
  const links = catalog.words.map((w) => ({
    label: w.label,
    href: w.href,
    resolvedHref: w.href,
  }));
  return {
    title,
    intro,
    sections: [{ title: 'Все записи', links }],
    links,
    sourcePath,
  };
}
