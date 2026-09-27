import type { EssayPair, Song } from '../../types';
import { songLineOutputPath } from '../../song-line-path';
import { escapeHtml } from '../html';
import { layout } from '../layout';
import { sitePath } from '../../site-path';

function speakButton(text: string): string {
  return `<button type="button" class="essay-speak" data-speak-text="${escapeHtml(text)}" aria-label="Озвучить">
      <span aria-hidden="true">🔊</span>
    </button>`;
}

function pairRow(pair: EssayPair, songSlug: string, lineIndex: number): string {
  const lineHref = sitePath(songLineOutputPath(songSlug, lineIndex));
  return `
        <div class="essay-pair song-line">
          <a class="song-line-hit" href="${escapeHtml(lineHref)}">
            <div class="essay-pair-greek">
              <span class="greek">${escapeHtml(pair.greek)}</span>
            </div>
            <p class="essay-pair-ru">${escapeHtml(pair.translation)}</p>
          </a>
          ${speakButton(pair.greek)}
        </div>`;
}

function lessonBadge(lesson: number): string {
  const pad = lesson < 10 ? `0${lesson}` : String(lesson);
  const href = sitePath(`words/lessons/${pad}/index.html`);
  return `<a class="word-badge word-badge--lesson" href="${escapeHtml(href)}">Урок ${lesson}</a>`;
}

export function renderSong(
  song: Song,
  breadcrumbs: { label: string; href?: string }[],
): string {
  const lessonLink = song.lesson != null ? lessonBadge(song.lesson) : '';
  const intro = song.intro
    ? `<p class="page-intro">${escapeHtml(song.intro).replace(/\n/g, '<br>')}</p>`
    : '';

  const lyricItems = song.lines
    .map((line, index) => pairRow(line, song.slug, index))
    .join('');
  const lyricsBlock = song.lines.length
    ? `
      <section class="essay-section fade-in">
        <h2>Текст</h2>
        <div class="essay-pairs song-pairs">${lyricItems}</div>
      </section>`
    : '';

  const content = `
    <article class="essay-page song-page">
      <header class="page-head fade-in">
        <div class="page-head-row">
          <h1>${escapeHtml(song.title)}</h1>
          ${lessonLink}
        </div>
        ${intro}
      </header>
      ${lyricsBlock}
    </article>`;

  return layout(content, song.title, breadcrumbs, ['assets/js/essays.js']);
}
