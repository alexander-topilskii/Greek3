import type { EssayPair, Song } from '../../types';
import type { GreekFormTarget } from '../../greek-lookup';
import { analyzeSongLineTokens } from '../../song-line-tokens';
import { escapeHtml } from '../html';
import { layout } from '../layout';
import { sitePath } from '../../site-path';
import { wordOutputPath } from '../paths-catalog';

function speakButton(text: string): string {
  return `<button type="button" class="essay-speak" data-speak-text="${escapeHtml(text)}" aria-label="Озвучить">
      <span aria-hidden="true">🔊</span>
    </button>`;
}

function tokenRow(
  surface: string,
  target: GreekFormTarget | null,
): string {
  if (target) {
    const href = sitePath(wordOutputPath(target.slug));
    return `
        <li class="song-line-token song-line-token--linked">
          <span class="greek song-line-token-greek">${escapeHtml(surface)}</span>
          <a class="song-line-token-link" href="${escapeHtml(href)}">${escapeHtml(target.label)}</a>
        </li>`;
  }

  return `
        <li class="song-line-token song-line-token--plain">
          <span class="greek song-line-token-greek">${escapeHtml(surface)}</span>
          <span class="song-line-token-missing">нет в словаре</span>
        </li>`;
}

export function renderSongLine(
  song: Song,
  lineIndex: number,
  pair: EssayPair,
  breadcrumbs: { label: string; href?: string }[],
  greekFormLookup: Map<string, GreekFormTarget[]>,
): string {
  const tokens = analyzeSongLineTokens(pair.greek, greekFormLookup);
  const tokenItems = tokens.map((t) => tokenRow(t.surface, t.target)).join('');
  const songHref = sitePath(`words/${song.slug}.html`);

  const content = `
    <article class="essay-page song-page song-line-page">
      <header class="page-head fade-in">
        <p class="song-line-back">
          <a href="${escapeHtml(songHref)}">← ${escapeHtml(song.title)}</a>
        </p>
        <div class="essay-pair song-line song-line--detail">
          <div class="essay-pair-greek">
            <span class="greek">${escapeHtml(pair.greek)}</span>
            ${speakButton(pair.greek)}
          </div>
          <p class="essay-pair-ru">${escapeHtml(pair.translation)}</p>
        </div>
      </header>
      <section class="essay-section fade-in">
        <h2>Слова в строке</h2>
        <p class="essay-section-note">Слова из словаря проекта — со ссылкой на карточку.</p>
        <ul class="song-line-tokens">${tokenItems}</ul>
      </section>
    </article>`;

  const pageTitle = `${song.title} — строка ${lineIndex + 1}`;
  return layout(content, pageTitle, breadcrumbs, ['assets/js/essays.js']);
}

export function songLineBreadcrumbLabel(pair: EssayPair): string {
  const short = pair.greek.length > 48 ? `${pair.greek.slice(0, 45)}…` : pair.greek;
  return short;
}
