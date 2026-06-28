import type { CatalogWord, IndexLink, IndexPage, SiteConfig, VerbCatalog, WordEntry } from './types';

const SITE_CONFIG: SiteConfig = {
  title: 'Greek3',
  description: 'Изучение и практика современного греческого языка',
  baseUrl: process.env.SITE_BASE_URL ?? '',
};

const SHARED_SCRIPTS = ['assets/js/db.js', 'assets/js/srs.js', 'assets/js/flashcard.js'];

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
      <p class="flashcard-swipe-note">Свайп ← не помню · помню → · тап — перевернуть</p>
    </div>
    <div class="practice-controls">
      <button type="button" class="btn btn-secondary btn-forget" aria-label="Не помню">←</button>
      <button type="button" class="btn btn-primary btn-random">Случайная</button>
      <button type="button" class="btn btn-secondary btn-lang" aria-pressed="false" title="Показывать сначала по-русски">⇄ RU</button>
      <button type="button" class="btn btn-secondary btn-remember" aria-label="Помню">→</button>
    </div>`;
}

function settingsPanel(scope: 'word' | 'deck'): string {
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
          <input type="number" id="setting-active-limit" min="1" max="62" value="5">
        </label>
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

export function renderHome(sections: { title: string; href: string; description: string }[]): string {
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

  const content = `
    <section class="hero fade-in">
      <p class="hero-label">Современный греческий</p>
      <h1>Изучай и практикуй<br><span class="hero-accent">ελληνικά</span></h1>
      <p class="hero-desc">Интерактивные карточки, таблицы форм и режим практики — всё из ваших Markdown-файлов.</p>
    </section>
    <section class="sections-grid">
      ${cards}
    </section>`;

  return layout(content, 'Главная');
}

export function renderIndex(
  page: IndexPage,
  pageOutputDir: string,
  breadcrumbs: { label: string; href?: string }[],
  catalog?: VerbCatalog,
): string {
  const links = page.links
    .map((link: IndexLink) => {
      const word = catalog?.words.find((w) => w.href === link.href);
      const slug = word?.slug ?? '';
      return `
      <a href="${escapeHtml(sitePath(`${pageOutputDir}/${link.href}`))}" class="word-link fade-in" data-word-slug="${escapeHtml(slug)}">
        <div class="word-link-main">
          <span class="word-link-label">${escapeHtml(link.label)}</span>
          <span class="word-link-arrow" aria-hidden="true">→</span>
        </div>
        ${progressBarMarkup(slug)}
      </a>`;
    })
    .join('');

  const catalogJson = catalog
    ? `<script type="application/json" id="verbs-catalog">${embedJson(catalog)}</script>`
    : '';

  const content = `
    <section class="verbs-list-page" data-deck-id="${escapeHtml(catalog?.deckId ?? '')}">
      <div class="page-head fade-in list-head">
        <h1>${escapeHtml(page.title)}</h1>
        ${catalog && catalog.words.length > 0 ? `<button type="button" class="btn btn-primary list-practice-btn" id="btn-practice-all">Практиковать</button>` : ''}
      </div>

      <section class="list-practice hidden" id="list-practice" aria-hidden="true">
        <div class="practice-panel practice-panel--wide fade-in">
          ${flashcardMarkup('list-flashcard-root')}
        </div>
        <button type="button" class="btn btn-secondary btn-close-practice" id="btn-close-practice">← К списку</button>
      </section>

      ${catalog ? settingsPanel('deck') : ''}

      <section class="links-list" id="verbs-links">
        ${links || '<p class="empty-state">Пока нет записей. Добавьте MD-файлы в этот раздел.</p>'}
      </section>
      ${catalogJson}
    </section>`;

  return layout(content, page.title, breadcrumbs, catalog && catalog.words.length > 0 ? ['assets/js/list-practice.js'] : []);
}

export function renderCasesIndex(
  page: IndexPage,
  pageOutputDir: string,
  breadcrumbs: { label: string; href?: string }[],
  catalog: VerbCatalog | undefined,
  gameData: unknown,
): string {
  const links = page.links
    .map((link: IndexLink) => {
      const word = catalog?.words.find((w) => w.href === link.href);
      const slug = word?.slug ?? '';
      return `
      <a href="${escapeHtml(sitePath(`${pageOutputDir}/${link.href}`))}" class="word-link fade-in" data-word-slug="${escapeHtml(slug)}">
        <div class="word-link-main">
          <span class="word-link-label">${escapeHtml(link.label)}</span>
          <span class="word-link-arrow" aria-hidden="true">→</span>
        </div>
        ${progressBarMarkup(slug)}
      </a>`;
    })
    .join('');

  const catalogJson = catalog
    ? `<script type="application/json" id="verbs-catalog">${embedJson(catalog)}</script>`
    : '';

  const gameJson = `<script type="application/json" id="cases-game-data">${embedJson(gameData)}</script>`;

  const content = `
    <section class="verbs-list-page cases-page" data-deck-id="cases">
      <div class="page-head fade-in list-head">
        <h1>${escapeHtml(page.title)}</h1>
        <p class="page-intro">Три основных падежа: именительный (подлежащее), родительный (принадлежность), винительный (дополнение). Изучите правила — затем потренируйтесь в мини-игре.</p>
      </div>

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
          <span class="cases-game-badge" data-cases-badge>—</span>
          <p class="cases-game-hint" data-cases-hint></p>
          <p class="cases-game-ru" data-cases-ru>—</p>
          <div class="cases-game-options" data-cases-options></div>
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
  const tenseLabels =
    word.category === 'cases'
      ? ['название', 'роль', 'артикли']
      : ['прош.', 'наст.', 'буд.'];
  const translation = word.translation || word.title;
  const deckId = word.category || 'default';

  const summaryHtml = word.baseForms.length
    ? `
      <div class="verb-summary">
        <div class="verb-summary-head">
          <span class="verb-summary-translation">${escapeHtml(translation)}</span>${word.verbType ? `<span class="verb-summary-type"> (${escapeHtml(word.verbType)})</span>` : ''}
        </div>
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
    : `<h1 class="word-title">${escapeHtml(translation)}</h1>`;

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
    .map(
      (s) => `
      <section class="extra-section fade-in">
        <h2>${escapeHtml(s.title)}</h2>
        <pre class="extra-content">${escapeHtml(s.lines.join('\n').trim())}</pre>
      </section>`,
    )
    .join('');

  const content = `
    <article class="word-page"
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
        <h2>Все формы</h2>
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
  };
}
