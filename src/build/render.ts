import type { IndexLink, IndexPage, SiteConfig, WordEntry } from './types';

const SITE_CONFIG: SiteConfig = {
  title: 'Greek3',
  description: 'Изучение и практика современного греческого языка',
  baseUrl: process.env.SITE_BASE_URL ?? '',
};

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

function layout(
  content: string,
  pageTitle: string,
  breadcrumbs?: { label: string; href?: string }[],
): string {
  const crumbs = breadcrumbs
    ?.map((c) =>
      c.href
        ? `<a href="${escapeHtml(c.href)}" class="crumb-link">${escapeHtml(c.label)}</a>`
        : `<span class="crumb-current">${escapeHtml(c.label)}</span>`,
    )
    .join('<span class="crumb-sep">/</span>') ?? '';

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
        <a href="${sitePath('words/verbs/index.html')}">Глаголы</a>
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
): string {
  const links = page.links
    .map(
      (link: IndexLink) => `
      <a href="${escapeHtml(sitePath(`${pageOutputDir}/${link.href}`))}" class="word-link fade-in">
        <span class="word-link-label">${escapeHtml(link.label)}</span>
        <span class="word-link-arrow" aria-hidden="true">→</span>
      </a>`,
    )
    .join('');

  const content = `
    <section class="page-head fade-in">
      <h1>${escapeHtml(page.title)}</h1>
    </section>
    <section class="links-list">
      ${links || '<p class="empty-state">Пока нет записей. Добавьте MD-файлы в этот раздел.</p>'}
    </section>`;

  return layout(content, page.title, breadcrumbs);
}

export function renderWord(
  word: WordEntry,
  breadcrumbs: { label: string; href?: string }[],
): string {
  const tenseLabels = ['прош.', 'наст.', 'буд.'];
  const translation = word.translation || word.title;

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
    <article class="word-page" data-forms="${formsJson}">
      <header class="word-header fade-in">
        ${summaryHtml}
      </header>

      <section class="practice-panel fade-in">
        <div class="flashcard" id="flashcard" tabindex="0" role="button" aria-label="Карточка — нажмите, чтобы перевернуть">
          <div class="flashcard-inner">
            <div class="flashcard-front">
              <span class="flashcard-label" id="flash-front-label">Греческий</span>
              <p class="flashcard-text greek" id="flash-front-text">—</p>
            </div>
            <div class="flashcard-back">
              <span class="flashcard-label" id="flash-back-label">Перевод</span>
              <p class="flashcard-text" id="flash-back-text">—</p>
            </div>
          </div>
        </div>
        <div class="practice-controls">
          <button type="button" class="btn btn-secondary" id="btn-prev" aria-label="Предыдущая форма">←</button>
          <button type="button" class="btn btn-primary" id="btn-random">Случайная</button>
          <button type="button" class="btn btn-secondary btn-lang" id="btn-lang" aria-pressed="false" title="Показывать сначала по-русски">⇄ RU</button>
          <button type="button" class="btn btn-secondary" id="btn-next" aria-label="Следующая форма">→</button>
        </div>
      </section>

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
    </article>
    <script src="${sitePath('assets/js/practice.js')}" defer></script>`;

  return layout(content, word.translation || word.title, breadcrumbs);
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
