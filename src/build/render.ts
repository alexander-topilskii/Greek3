import type {
  CatalogWord,
  HomeSection,
  IndexLink,
  IndexPage,
  IndexSection,
  SiteConfig,
  VerbCatalog,
  WordEntry,
} from './types';
import { renderMarkdown } from './markdown';
import { getSpecialSection } from './parse-word';

const SITE_CONFIG: SiteConfig = {
  title: 'Greek3',
  description: 'Изучение и практика современного греческого языка',
  baseUrl: process.env.SITE_BASE_URL ?? '',
};

const SHARED_SCRIPTS = ['assets/js/db.js', 'assets/js/srs.js', 'assets/js/flashcard.js'];

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

function anchorId(prefix: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .slice(0, 40);
  return `${prefix}-${slug || 'group'}`;
}

function progressBarMarkup(slug: string): string {
  return `
        <div class="word-progress" data-progress-slug="${escapeHtml(slug)}">
          <div class="word-progress-track">
            <div class="word-progress-half word-progress-half--left">
              <div class="word-progress-fill progress-word"></div>
            </div>
            <div class="word-progress-half word-progress-half--right">
              <div class="word-progress-fill progress-forms"></div>
            </div>
          </div>
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
      <button type="button" class="btn btn-secondary btn-forget" aria-label="Не помню">←</button>
      <button type="button" class="btn btn-primary btn-random">Случайная</button>
      <button type="button" class="btn btn-secondary btn-lang" aria-pressed="false" title="Показывать сначала по-русски">⇄ RU</button>
      <button type="button" class="btn btn-secondary btn-remember" aria-label="Помню">→</button>
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
        <p class="settings-hint">После выучивания группы новые слова добавляются автоматически. Старые повторяются реже, но по расписанию SRS.</p>
        <div class="settings-actions">
          <button type="button" class="btn btn-secondary" id="btn-save-settings">Сохранить</button>
          <button type="button" class="btn btn-secondary" id="btn-reset-deck">Сбросить прогресс</button>
        </div>
      </div>
    </details>`;
}

function layout(
  content: string,
  pageTitle: string,
  breadcrumbs?: { label: string; href?: string }[],
  extraScripts: string[] = [],
  bodyClass = '',
): string {
  const crumbs = breadcrumbs
    ?.map((c) =>
      c.href
        ? `<a href="${escapeHtml(c.href)}" class="crumb-link">${escapeHtml(c.label)}</a>`
        : `<span class="crumb-current">${escapeHtml(c.label)}</span>`,
    )
    .join('<span class="crumb-sep">/</span>') ?? '';

  const scripts = [...SHARED_SCRIPTS, ...extraScripts]
    .map((s) => `<script src="${sitePath(s)}" defer></script>`)
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
  <link rel="stylesheet" href="${sitePath('assets/css/main.css')}">
</head>
<body class="${escapeHtml(bodyClass)}">
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
        <a href="${sitePath('words/topics/index.html')}">Темы</a>
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
  ${scripts}
</body>
</html>`;
}

export function renderHome(sections: HomeSection[]): string {
  const primary = sections.filter((s) => s.group !== 'secondary');
  const secondary = sections.filter((s) => s.group === 'secondary');

  const renderCards = (items: HomeSection[]) =>
    items
      .map(
        (s) => `
    <a href="${s.href.startsWith('#') ? s.href : escapeHtml(sitePath(s.href))}" class="section-card fade-in">
      <h2>${escapeHtml(s.title)}</h2>
      <p>${escapeHtml(s.description)}</p>
      <span class="card-arrow" aria-hidden="true">→</span>
    </a>`,
      )
      .join('');

  const content = `
    <section class="hero fade-in">
      <p class="hero-label">Современный греческий</p>
      <h1>Изучай и практикуй<br><span class="hero-accent">ελληνικά</span></h1>
      <p class="hero-desc">Интерактивные карточки, таблицы форм и режим практики — всё из ваших Markdown-файлов.</p>
    </section>

    <section class="home-continue fade-in" id="home-continue" aria-label="Продолжить обучение">
      <div class="home-continue-inner">
        <div class="home-continue-text">
          <h2>Продолжить обучение</h2>
          <p class="home-continue-stats" data-home-stats>Загрузка прогресса…</p>
        </div>
        <div class="home-continue-actions">
          <button type="button" class="btn btn-primary" id="btn-home-practice" data-practice-direction="ru-el">Практика: греческий</button>
          <button type="button" class="btn btn-secondary" id="btn-home-practice-ru" data-practice-direction="el-ru">Практика: русский</button>
        </div>
      </div>
      <section class="home-practice hidden" id="home-practice" aria-hidden="true">
        <div class="practice-panel practice-panel--wide fade-in">
          ${flashcardMarkup('home-flashcard-root')}
        </div>
        <button type="button" class="btn btn-secondary btn-close-practice" id="btn-close-home-practice">← На главную</button>
      </section>
    </section>

    <section class="home-section-block">
      <h2 class="home-block-title">По типу слова</h2>
      <div class="sections-grid">${renderCards(primary)}</div>
    </section>

    ${
      secondary.length
        ? `<section class="home-section-block">
      <h2 class="home-block-title">По теме и уровню</h2>
      <div class="sections-grid sections-grid--secondary">${renderCards(secondary)}</div>
    </section>`
        : ''
    }

    <script type="application/json" id="global-catalog-path">${embedJson({ url: sitePath('assets/data/global-catalog.json') })}</script>`;

  return layout(content, 'Главная', undefined, ['assets/js/home-dashboard.js'], 'page-home');
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

function indexLinkSitePath(pageOutputDir: string, link: IndexLink): string {
  if (link.resolvedHref && !/^(https?:)?\/\//.test(link.resolvedHref)) {
    return sitePath(normalizeSitePath('words', link.resolvedHref));
  }
  return sitePath(normalizeSitePath(pageOutputDir, link.href));
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

function renderIndexLink(
  link: IndexLink,
  pageOutputDir: string,
  catalog: VerbCatalog | undefined,
  compact = false,
): string {
  const catalogKey = link.resolvedHref ?? link.href;
  const word = catalog?.words.find((w) => w.href === catalogKey);
  const slug = word?.slug ?? '';
  const greek = word?.primaryGreek ?? '';
  const formHint =
    word && word.recordType === 'phrase'
      ? 'фраза'
      : word && word.formCount > 0
        ? `${word.formCount} форм`
        : '';

  const searchText = [link.label, greek, word?.translation, word?.level, ...(word?.topics ?? [])]
    .filter(Boolean)
    .join(' ');

  return `
      <a href="${escapeHtml(indexLinkSitePath(pageOutputDir, link))}"
         class="word-link fade-in${compact ? ' word-link--compact' : ''}"
         data-word-slug="${escapeHtml(slug)}"
         data-level="${escapeHtml(word?.level ?? '')}"
         data-record-type="${escapeHtml(word?.recordType ?? '')}"
         data-search="${escapeHtml(searchText.toLowerCase())}">
        <div class="word-link-main">
          <div class="word-link-text">
            ${greek ? `<span class="word-link-greek greek">${escapeHtml(greek)}</span>` : ''}
            <span class="word-link-label">${escapeHtml(link.label)}</span>
            ${formHint ? `<span class="word-link-meta">${escapeHtml(formHint)}</span>` : ''}
          </div>
          <span class="word-link-arrow" aria-hidden="true">→</span>
        </div>
        ${renderBadges(word)}
        ${slug && !compact ? progressBarMarkup(slug) : ''}
      </a>`;
}

function sectionLinkCount(section: IndexSection): number {
  return (
    section.links.length +
    section.subsections.reduce((sum, sub) => sum + sub.links.length, 0)
  );
}

function renderSubsectionLinks(
  subsection: { title: string; links: IndexLink[] },
  pageOutputDir: string,
  catalog: VerbCatalog | undefined,
): string {
  if (!subsection.links.length) return '';
  const items = subsection.links
    .map((link) => renderIndexLink(link, pageOutputDir, catalog))
    .join('');
  return `
        <div class="links-subgroup">
          <h3 class="links-subgroup-title">${escapeHtml(subsection.title)}</h3>
          <div class="links-group-items">${items}</div>
        </div>`;
}

function renderGroupedLinks(
  page: IndexPage,
  pageOutputDir: string,
  catalog: VerbCatalog | undefined,
): string {
  const sections =
    page.sections.length > 0
      ? page.sections.filter((s) => sectionLinkCount(s) > 0)
      : [{ title: '', links: page.links, subsections: [] }];

  if (!sections.length || !page.links.length) {
    return '<p class="empty-state">Пока нет записей. Добавьте MD-файлы в этот раздел.</p>';
  }

  return sections
    .map((section, index) => {
      const count = sectionLinkCount(section);
      const directItems = section.links
        .map((link) => renderIndexLink(link, pageOutputDir, catalog))
        .join('');
      const subsections = section.subsections
        .map((sub) => renderSubsectionLinks(sub, pageOutputDir, catalog))
        .join('');
      const heading = section.title
        ? `<summary class="links-group-summary">
            <span class="links-group-title">${escapeHtml(section.title)}</span>
            <span class="links-group-count">${count}</span>
          </summary>`
        : '';
      const id = section.title ? ` id="${anchorId('group', section.title)}"` : '';
      const openAttr = index === 0 ? ' open' : '';

      if (!section.title) {
        return `<div class="links-group links-group--flat">
        <div class="links-group-items">${directItems}${subsections ? `<div class="links-subgroups">${subsections}</div>` : ''}</div>
      </div>`;
      }

      return `
      <details class="links-group links-group--accordion"${id}${openAttr}>
        ${heading}
        <div class="links-group-body">
          ${directItems ? `<div class="links-group-items">${directItems}</div>` : ''}
          ${subsections ? `<div class="links-subgroups">${subsections}</div>` : ''}
        </div>
      </details>`;
    })
    .join('');
}

function renderToc(page: IndexPage): string {
  const sections = page.sections.filter((s) => s.title && sectionLinkCount(s) > 0);
  if (sections.length < 4) return '';

  const items = sections
    .map(
      (s) =>
        `<a href="#${anchorId('group', s.title)}" class="list-toc-link">${escapeHtml(s.title)} <span>${sectionLinkCount(s)}</span></a>`,
    )
    .join('');

  return `
    <nav class="list-toc fade-in" aria-label="Группы">
      <p class="list-toc-label">Группы</p>
      <div class="list-toc-links">${items}</div>
    </nav>`;
}

function listToolbarMarkup(): string {
  return `
    <div class="list-toolbar fade-in" id="list-toolbar">
      <label class="list-search">
        <span class="visually-hidden">Поиск</span>
        <input type="search" id="list-search" placeholder="Поиск по греческому или русскому…" autocomplete="off">
      </label>
      <div class="list-toolbar-filters">
        <select id="list-filter-level" aria-label="Уровень">
          <option value="">Все уровни</option>
          <option value="A1">A1</option>
          <option value="A2">A2</option>
          <option value="B1">B1</option>
          <option value="B2">B2</option>
        </select>
        <select id="list-filter-status" aria-label="Статус">
          <option value="">Любой статус</option>
          <option value="new">Новые</option>
          <option value="learning">Учу</option>
          <option value="mastered">Выучено</option>
        </select>
      </div>
      <div class="list-toolbar-views">
        <button type="button" class="btn btn-secondary btn-view" id="btn-view-compact" aria-pressed="false">Компактно</button>
        <button type="button" class="btn btn-secondary btn-view" id="btn-view-grid" aria-pressed="false">Сетка</button>
      </div>
      <p class="list-toolbar-result" id="list-filter-result" aria-live="polite"></p>
    </div>`;
}

function deckSummaryMarkup(): string {
  return `<p class="deck-summary" id="deck-summary" aria-live="polite"></p>`;
}

function lessonTabsMarkup(isLesson: boolean): string {
  if (!isLesson) return '';
  return `
    <div class="lesson-tabs fade-in" role="tablist" aria-label="Режим урока">
      <button type="button" class="lesson-tab is-active" data-lesson-tab="words" role="tab" aria-selected="true">Слова</button>
      <button type="button" class="lesson-tab" data-lesson-tab="practice" role="tab" aria-selected="false">Практика</button>
      <button type="button" class="lesson-tab" data-lesson-tab="brief" role="tab" aria-selected="false">Кратко</button>
    </div>`;
}

function renderBriefList(
  page: IndexPage,
  pageOutputDir: string,
  catalog: VerbCatalog | undefined,
): string {
  const items = page.links
    .map((link) => renderIndexLink(link, pageOutputDir, catalog, true))
    .join('');
  return `<div class="links-list links-list--brief hidden" id="lesson-brief">${items}</div>`;
}

export function renderIndex(
  page: IndexPage,
  pageOutputDir: string,
  breadcrumbs: { label: string; href?: string }[],
  catalog?: VerbCatalog,
): string {
  const isLesson = page.pageKind === 'lesson';
  const links = renderGroupedLinks(page, pageOutputDir, catalog);
  const intro = page.intro
    ? `<p class="page-intro">${escapeHtml(page.intro).replace(/\n/g, '<br>')}</p>`
    : '';

  const catalogJson = catalog
    ? `<script type="application/json" id="verbs-catalog">${embedJson(catalog)}</script>`
    : '';

  const hasPractice = catalog && catalog.words.length > 0;

  const content = `
    <section class="verbs-list-page list-page-layout${isLesson ? ' lesson-page' : ''}" data-deck-id="${escapeHtml(catalog?.deckId ?? '')}" data-page-kind="${escapeHtml(page.pageKind)}">
      <div class="list-page-main">
        <div class="page-head fade-in list-head">
          <h1>${escapeHtml(page.title)}</h1>
          ${intro}
          ${hasPractice ? `<div class="list-practice-actions">
            <button type="button" class="btn btn-primary list-practice-btn" id="btn-practice-el" data-practice-direction="ru-el">Практика: греческий</button>
            <button type="button" class="btn btn-secondary list-practice-btn" id="btn-practice-ru" data-practice-direction="el-ru">Практика: русский</button>
            <button type="button" class="btn btn-secondary list-practice-btn" id="btn-practice-due" data-practice-mode="due">Только повторение</button>
          </div>` : ''}
        </div>

        ${lessonTabsMarkup(isLesson)}
        ${deckSummaryMarkup()}
        ${hasPractice ? listToolbarMarkup() : ''}

        <section class="list-practice hidden" id="list-practice" aria-hidden="true">
          <div class="practice-panel practice-panel--wide fade-in">
            ${flashcardMarkup('list-flashcard-root')}
          </div>
          <button type="button" class="btn btn-secondary btn-close-practice" id="btn-close-practice">← К списку</button>
        </section>

        ${catalog ? settingsPanel('deck', catalog.words.length) : ''}

        <section class="links-list" id="verbs-links" data-lesson-panel="words">
          ${links}
        </section>

        ${isLesson && hasPractice ? renderBriefList(page, pageOutputDir, catalog) : ''}
        ${catalogJson}
      </div>
      ${renderToc(page)}
    </section>`;

  const scripts = ['assets/js/list-controls.js'];
  if (hasPractice) scripts.push('assets/js/list-practice.js');

  return layout(
    content,
    page.title,
    breadcrumbs,
    scripts,
    hasPractice ? 'page-list' : '',
  );
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
    <section class="verbs-list-page cases-page list-page-layout" data-deck-id="cases">
      <div class="list-page-main">
        <div class="page-head fade-in list-head">
          <h1>${escapeHtml(page.title)}</h1>
          ${intro || '<p class="page-intro">Три основных падежа: именительный (подлежащее), родительный (принадлежность), винительный (дополнение). Изучите правила — затем потренируйтесь в мини-игре.</p>'}
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
      </div>
    </section>`;

  const scripts = ['assets/js/cases-game.js'];
  if (catalog && catalog.words.length > 0) {
    scripts.push('assets/js/list-controls.js', 'assets/js/list-practice.js');
  }

  return layout(content, page.title, breadcrumbs, scripts, 'page-list');
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

function renderRelatedSection(lines: string[], pageDir: string): string {
  const chips: string[] = [];
  for (const line of lines) {
    const match = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (!match) continue;
    const href = match[2].trim().replace(/\.md$/i, '.html');
    const label = match[1].trim();
    const url = sitePath(normalizeSitePath('words', href));
    chips.push(`<a href="${escapeHtml(url)}" class="related-chip">${escapeHtml(label)}</a>`);
  }
  if (!chips.length) return renderMarkdown(lines.join('\n'));
  return `<div class="related-chips">${chips.join('')}</div>`;
}

export function renderWord(
  word: WordEntry,
  breadcrumbs: { label: string; href?: string }[],
): string {
  const tenseLabels =
    word.category === 'cases'
      ? ['название', 'роль', 'артикли']
      : word.category === 'phrases'
        ? ['вариант', 'форма', '']
        : ['прош.', 'наст.', 'буд.'];
  const translation = word.translation || word.title;
  const deckId = word.category || 'default';
  const isPhrase = word.meta.recordType === 'phrase' || word.category === 'phrases';
  const showVerbSummary = word.baseForms.length > 0 && word.category !== 'numbers' && !isPhrase;
  const contextSection = getSpecialSection(word, 'контекст');
  const relatedSection = getSpecialSection(word, 'связанные слова');
  const skipTitles = new Set(['контекст', 'связанные слова', 'уровень']);

  const metaBadges = [
    word.meta.level ? `<span class="word-badge word-badge--level">${escapeHtml(word.meta.level)}</span>` : '',
    word.meta.recordType
      ? `<span class="word-badge word-badge--type">${escapeHtml(RECORD_TYPE_LABELS[word.meta.recordType] ?? word.meta.recordType)}</span>`
      : '',
    ...word.meta.topics.map((t) => `<span class="word-badge word-badge--topic">${escapeHtml(t)}</span>`),
  ]
    .filter(Boolean)
    .join('');

  const summaryHtml = showVerbSummary
    ? `
      <div class="verb-summary">
        <div class="verb-summary-head">
          <span class="verb-summary-translation">${escapeHtml(translation)}</span>${word.verbType ? `<span class="verb-summary-type"> (${escapeHtml(word.verbType)})</span>` : ''}
        </div>
        ${metaBadges ? `<div class="word-header-badges">${metaBadges}</div>` : ''}
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
        <p class="phrase-summary-greek greek">${escapeHtml(word.primaryGreek || word.baseForms[0] || translation)}</p>
        <p class="phrase-summary-ru">${escapeHtml(translation)}</p>
        ${metaBadges ? `<div class="word-header-badges">${metaBadges}</div>` : ''}
      </div>`
      : `<div class="word-title-block">
        <h1 class="word-title">${escapeHtml(translation)}</h1>
        ${word.primaryGreek ? `<p class="word-title-greek greek">${escapeHtml(word.primaryGreek)}</p>` : ''}
        ${metaBadges ? `<div class="word-header-badges">${metaBadges}</div>` : ''}
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
      let body: string;
      if (s.title.toLowerCase() === 'контекст') {
        body = renderContextSection(s.lines);
      } else if (s.title.toLowerCase() === 'связанные слова') {
        body = renderRelatedSection(s.lines, word.category);
      } else {
        body = renderMarkdown(s.lines.join('\n'));
      }
      return `
      <section class="extra-section fade-in${s.title.toLowerCase() === 'контекст' ? ' extra-section--context' : ''}">
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

  const relatedHtml = relatedSection
    ? `
      <section class="extra-section extra-section--related fade-in">
        <h2>Связанные слова</h2>
        <div class="extra-content">${renderRelatedSection(relatedSection.lines, word.category)}</div>
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
      ${relatedHtml}
      ${extraHtml}
    </article>`;

  return layout(content, word.translation || word.title, breadcrumbs, ['assets/js/practice.js']);
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

export function syntheticIndexFromCatalog(
  title: string,
  intro: string,
  catalog: VerbCatalog,
  sourcePath: string,
  pageKind: IndexPage['pageKind'],
): IndexPage {
  return {
    title,
    intro,
    sections: [{ title: 'Все записи', links: catalog.words.map((w) => ({
      label: w.label,
      href: w.href,
      resolvedHref: w.href,
    })), subsections: [] }],
    links: catalog.words.map((w) => ({
      label: w.label,
      href: w.href,
      resolvedHref: w.href,
    })),
    sourcePath,
    pageKind,
  };
}
