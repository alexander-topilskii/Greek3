import type { EssayPair, Song, VerbCatalog } from '../../types';
import { songLineOutputPath } from '../../song-line-path';
import { escapeHtml, embedJson } from '../html';
import { layout } from '../layout';
import { sitePath } from '../../site-path';
import {
  examplesDialogMarkup,
  homePracticePanelMarkup,
  settingsButtonHref,
} from '../fragments';

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
  catalog?: VerbCatalog,
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
      <section class="essay-section fade-in" id="song-lyrics">
        <h2>Текст</h2>
        <div class="essay-pairs song-pairs">${lyricItems}</div>
      </section>`
    : '';

  const hasWords = Boolean(catalog && catalog.words.length > 0);
  const catalogJson = hasWords
    ? `<script type="application/json" id="verbs-catalog">${embedJson(catalog!)}</script>`
    : '';

  const learnBtn = hasWords
    ? `<button type="button" class="btn btn-primary list-practice-btn" id="btn-song-learn">Учить слова</button>`
    : '';

  const practiceBlock = hasWords
    ? `
      <section class="home-practice list-practice hidden" id="song-practice" aria-hidden="true">
        <div class="practice-panel practice-panel--wide fade-in">
          ${homePracticePanelMarkup('song-flashcard-root')}
        </div>
        <button type="button" class="btn btn-secondary btn-close-practice" id="btn-close-song-practice">← К песне</button>
      </section>`
    : '';

  const learningAttrs = hasWords
    ? ` data-learning-practice data-learning-mode="song" data-practice-section-id="song-practice" data-flashcard-root-id="song-flashcard-root" data-open-btn-id="btn-song-learn" data-close-btn-id="btn-close-song-practice" data-nav-id="song-practice-immersive" data-session-key="greek3:song-practice-session" data-hide-on-open=".page-head,#song-lyrics,#song-practice-actions"`
    : '';

  const content = `
    <section class="verbs-list-page song-list-page"${learningAttrs} data-deck-id="${escapeHtml(catalog?.deckId ?? '')}"${catalog?.pageId ? ` data-page-id="${escapeHtml(catalog.pageId)}"` : ''}>
      <article class="essay-page song-page">
        <header class="page-head fade-in">
          <div class="page-head-row">
            <h1>${escapeHtml(song.title)}</h1>
            ${lessonLink}
          </div>
          ${intro}
          ${hasWords ? `<div class="list-practice-actions" id="song-practice-actions">${learnBtn}</div>` : ''}
        </header>
        ${lyricsBlock}
      </article>
      ${practiceBlock}
      ${catalogJson}
    </section>`;

  const scripts = hasWords
    ? [
        'assets/js/essays.js',
        'assets/js/learning-ladder.js',
        'assets/js/quiz-step.js',
        'assets/js/spell-step.js',
        'assets/js/match-step.js',
        'assets/js/cloze-step.js',
        'assets/js/build-step.js',
        'assets/js/home-practice.js',
      ]
    : ['assets/js/essays.js'];

  const fromPath = `words/${song.slug}.html`;
  const layoutOptions = hasWords
    ? {
        showSettings: true,
        settingsHref: settingsButtonHref({
          deck: catalog!.deckId,
          from: fromPath,
        }),
        bodyEnd: examplesDialogMarkup(),
      }
    : {};

  return layout(content, song.title, breadcrumbs, scripts, layoutOptions);
}
