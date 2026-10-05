import { escapeHtml } from '../html';
import { layout } from '../layout';
import { sitePath } from '../../site-path';

export interface BookSummary {
  id: string;
  title: string;
  author: string;
  greekTitle: string;
  level: string;
  description: string;
  chapters: { id: string; num: number; title: string; href: string }[];
}

export function renderBooksIndex(
  books: BookSummary[],
  breadcrumbs: { label: string; href?: string }[],
): string {
  const booksCards = books
    .map((book) => {
      const chapterLinks = book.chapters
        .map(
          (ch) => `
        <a href="${escapeHtml(ch.href)}" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:0.5rem; text-decoration:none;">
          <span>Читать: ${escapeHtml(ch.title)}</span>
          <span aria-hidden="true">→</span>
        </a>`,
        )
        .join('');

      return `
      <article class="section-card fade-in" style="cursor:default; margin-bottom:1.5rem; display:block;">
        <div class="reader-badge-wrap" style="margin-bottom:0.75rem;">
          <span class="reader-badge reader-badge--level">${escapeHtml(book.level)}</span>
          <span class="reader-badge">100% словарь Greek3</span>
          <span class="reader-badge">Параллельный текст</span>
        </div>
        <h2 style="margin:0 0 0.25rem; font-size:1.4rem;">${escapeHtml(book.title)}</h2>
        <p style="font-family:var(--font-greek); font-weight:600; color:var(--accent); margin:0 0 0.75rem;">${escapeHtml(
          book.greekTitle,
        )}</p>
        <p style="margin:0 0 1.25rem; color:var(--text-muted); line-height:1.5;">${escapeHtml(book.description)}</p>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          ${chapterLinks}
        </div>
      </article>`;
    })
    .join('');

  const content = `
  <section class="books-index-page">
    <header class="hero fade-in">
      <p class="hero-label">Чтение и закрепление языка</p>
      <h1>Книги для чтения<br><span class="hero-accent">βιβλία</span></h1>
      <p style="color:var(--text-muted); max-width:600px; margin:0.5rem auto 1.5rem;">
        Адаптированные книги мировой литературы (Graded Readers). Все предложения построены исключительно на базе словаря проекта, со встроенным переводом слов по клику и озвучкой.
      </p>
    </header>

    <div class="books-list" style="max-width:720px; margin:0 auto;">
      ${booksCards}
    </div>
  </section>`;

  return layout(content, 'Книги для чтения', breadcrumbs);
}
