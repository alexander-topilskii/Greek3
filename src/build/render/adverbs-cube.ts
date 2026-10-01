import type { WordEntry } from '../types';
import { sitePath } from '../site-path';
import { embedJson, escapeHtml } from './html';
import {
  ALL_ADVERB_PARADIGMS,
  ALL_ADVERB_THEMES,
  PLACE_ADVERB_PARADIGM,
  AdverbCell,
  AdverbFace,
  AdverbFacePosition,
  AdverbParadigm,
  AdverbRow,
  AdverbVariant,
  getAdverbThemeInfo,
  getParadigmForAdverbWordSlug,
} from '../adverbs-data';

const FACE_ORDER: AdverbFacePosition[] = ['left', 'center', 'right'];

function chevron(direction: 'prev' | 'next'): string {
  const path = direction === 'prev' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7';
  return `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"></path></svg>`;
}

function rotationForPosition(pos: AdverbFacePosition): number {
  if (pos === 'left') return 90;
  if (pos === 'right') return -90;
  return 0; // center
}

function renderCell(cell: AdverbCell, highlightForm?: string): string {
  const isEmpty = !cell.greek || cell.greek === '—';
  const isCurrent = Boolean(
    highlightForm &&
      cell.greek &&
      (cell.greek.toLowerCase().includes(highlightForm.toLowerCase()) ||
        cell.label.toLowerCase().includes(highlightForm.toLowerCase())),
  );

  return `
    <div class="adverbs-item${isCurrent ? ' is-current' : ''}${isEmpty ? ' is-empty' : ''}" data-greek="${escapeHtml(cell.greek)}">
      <div class="adverbs-item-info">
        <span class="adverbs-item-label">${escapeHtml(cell.label)}</span>
        ${cell.hint ? `<span class="adverbs-item-hint">${escapeHtml(cell.hint)}</span>` : ''}
      </div>
      <div class="adverbs-item-forms">
        <span class="adverbs-item-greek greek">${escapeHtml(cell.greek)}</span>
        ${cell.ru ? `<span class="adverbs-item-ru">${escapeHtml(cell.ru)}</span>` : ''}
      </div>
    </div>`;
}

function renderFace(
  face: AdverbFace,
  activePos: AdverbFacePosition,
  highlightForm?: string,
): string {
  const hidden = face.position === activePos ? 'false' : 'true';
  const rowsHtml = face.rows
    .map(
      (row: AdverbRow) => `
        ${renderCell(row.left, highlightForm)}
        ${renderCell(row.right, highlightForm)}`,
    )
    .join('');

  return `
    <div class="adverbs-cube-face adverbs-cube-face--${face.position}" data-pos="${face.position}" data-face-id="${escapeHtml(face.id)}" aria-hidden="${hidden}">
      <div class="adverbs-cube-grid">
        <div class="adverbs-col-label">${escapeHtml(face.colLeftTitle)}</div>
        <div class="adverbs-col-label">${escapeHtml(face.colRightTitle)}</div>
        ${rowsHtml}
      </div>
    </div>`;
}

function renderVariantSwitcher(
  variants: AdverbVariant[],
  activeVariantId: string,
): string {
  if (variants.length <= 1) return '';
  const index = Math.max(
    0,
    variants.findIndex((v) => v.id === activeVariantId),
  );
  const buttons = variants
    .map((v) => {
      const active = v.id === activeVariantId;
      return `<button type="button" class="adverbs-aspect-btn${active ? ' is-active' : ''}" data-variant="${v.id}" aria-pressed="${active ? 'true' : 'false'}" title="${escapeHtml(v.label)}">${escapeHtml(v.label)}</button>`;
    })
    .join('');

  return `
    <div class="adverbs-aspect" data-adverbs-aspect style="--n: ${variants.length}; --i: ${index}">
      <div class="adverbs-aspect-slider" aria-hidden="true"></div>
      ${buttons}
    </div>`;
}

function renderExtraNotes(variant: AdverbVariant): string {
  if (!variant.extraNotes) return '';
  const notes = variant.extraNotes;
  const examplesHtml = (notes.examples || [])
    .map(
      (ex) => `
      <div class="adverbs-extra-example" data-greek="${escapeHtml(ex.greek)}">
        <span class="adverbs-extra-greek greek">${escapeHtml(ex.greek)}</span>
        <span class="adverbs-extra-ru">${escapeHtml(ex.ru)}</span>
      </div>`,
    )
    .join('');

  return `
    <div class="adverbs-extra-card">
      <h3 class="adverbs-extra-title">${escapeHtml(notes.title)}</h3>
      ${notes.description ? `<p class="adverbs-extra-desc">${escapeHtml(notes.description)}</p>` : ''}
      ${examplesHtml ? `<div class="adverbs-extra-examples">${examplesHtml}</div>` : ''}
    </div>`;
}

function renderHubTabs(
  paradigms: AdverbParadigm[],
  activeParadigmId: string,
): string {
  const buttons = paradigms
    .map((p) => {
      const active = p.id === activeParadigmId;
      return `<button type="button" role="tab" class="adverbs-tab${active ? ' is-active' : ''}" data-paradigm="${p.id}" aria-selected="${active ? 'true' : 'false'}">${escapeHtml(p.tabLabel)}</button>`;
    })
    .join('');

  return `<div class="adverbs-tabs" role="tablist">${buttons}</div>`;
}

function renderCubeInner(
  paradigm: AdverbParadigm,
  activePos: AdverbFacePosition,
  activeVariantId: string,
  highlightForm?: string,
  hubParadigms?: AdverbParadigm[],
): string {
  const variant =
    paradigm.variants.find((v) => v.id === activeVariantId) ??
    paradigm.variants[0];
  if (!variant) return '';

  const face = variant.faces[activePos];
  const initialRotation = rotationForPosition(activePos);

  const payload: Record<string, unknown> = {
    mode: hubParadigms ? 'hub' : 'word',
    currentParadigm: paradigm.id,
    currentVariant: variant.id,
    currentPos: activePos,
    highlightForm: highlightForm || '',
    paradigms: hubParadigms
      ? Object.fromEntries(hubParadigms.map((p) => [p.id, p]))
      : { [paradigm.id]: paradigm },
  };

  const hubTabsHtml = hubParadigms
    ? renderHubTabs(hubParadigms, paradigm.id)
    : '';
  const variantSwitcherHtml = renderVariantSwitcher(
    paradigm.variants,
    variant.id,
  );
  const extraNotesHtml = renderExtraNotes(variant);

  return `
    <section class="adverbs-paradigm" data-adverbs-cube data-paradigm="${paradigm.id}" data-variant="${variant.id}" data-pos="${activePos}">
      <script type="application/json" data-adverbs-data>${embedJson(payload)}</script>
      ${hubTabsHtml}
      ${variantSwitcherHtml}
      <div class="adverbs-cube-toolbar">
        <button type="button" class="adverbs-cube-nav" data-cube-dir="-1" aria-label="Предыдущая грань">${chevron('prev')}</button>
        <div class="adverbs-cube-heading">
          <h2 class="adverbs-cube-title">${escapeHtml(face.title)}</h2>
          <p class="adverbs-cube-subtitle">${escapeHtml(face.subtitle)}</p>
        </div>
        <button type="button" class="adverbs-cube-nav" data-cube-dir="1" aria-label="Следующая грань">${chevron('next')}</button>
      </div>
      <div class="adverbs-cube-timeline" aria-hidden="true">
        <span class="adverbs-cube-timeline-label">1</span>
        <span class="adverbs-cube-dot${activePos === 'left' ? ' is-active' : ''}" data-dot="left" title="Грань 1"></span>
        <span class="adverbs-cube-dot${activePos === 'center' ? ' is-active' : ''}" data-dot="center" title="Грань 2"></span>
        <span class="adverbs-cube-dot${activePos === 'right' ? ' is-active' : ''}" data-dot="right" title="Грань 3"></span>
        <span class="adverbs-cube-timeline-label">3</span>
      </div>
      <div class="adverbs-cube-clip">
        <div class="adverbs-cube-scene">
          <div class="adverbs-cube" style="transform: translateZ(calc(var(--adverbs-tz, 150px) * -1)) rotateY(${initialRotation}deg)">
            ${FACE_ORDER.map((pos) => renderFace(variant.faces[pos], activePos, highlightForm)).join('')}
          </div>
        </div>
      </div>
      <div class="adverbs-extra">${extraNotesHtml}</div>
    </section>`;
}

export function renderAdverbCube(word: WordEntry): {
  html: string;
  interactive: boolean;
} {
  if (word.category !== 'adverbs') {
    return { html: '', interactive: false };
  }

  const theme = getAdverbThemeInfo(word.slug);
  const themeLink = theme
    ? `<div class="adverbs-theme-back-wrap"><a href="${escapeHtml(sitePath(`words/adverbs/${theme.subDir}/index.html`))}" class="adverbs-theme-back-link">← Все наречия темы «${escapeHtml(theme.title)}»</a></div>`
    : '';

  const lookup = getParadigmForAdverbWordSlug(word.slug);
  if (!lookup) {
    const html = themeLink + renderCubeInner(
      PLACE_ADVERB_PARADIGM,
      'left',
      'coords',
      word.primaryGreek,
    );
    return { html, interactive: true };
  }

  const html = themeLink + renderCubeInner(
    lookup.paradigm,
    lookup.initialPosition,
    lookup.initialVariant,
    lookup.highlightForm,
  );
  return { html, interactive: true };
}

export function renderAdverbThemeCube(paradigm: AdverbParadigm): string {
  const initialVariant = paradigm.variants[0]?.id || 'default';
  return renderCubeInner(
    paradigm,
    'left',
    initialVariant,
    undefined,
    undefined,
  );
}

export function renderAdverbsThemesHub(): string {
  const cardsHtml = ALL_ADVERB_THEMES.map((theme) => {
    const hasCube = Boolean(theme.paradigm);
    const tagsHtml = theme.sampleTags
      .map((tag) => `<span class="adverbs-theme-tag greek">${escapeHtml(tag)}</span>`)
      .join('');

    return `
      <a href="${escapeHtml(sitePath(`words/adverbs/${theme.subDir}/index.html`))}" class="adverbs-theme-card">
        <div class="adverbs-theme-card-top">
          <span class="adverbs-theme-icon" aria-hidden="true">${theme.icon}</span>
          <div class="adverbs-theme-card-badges">
            <span class="adverbs-theme-badge">${theme.wordCount} слов</span>
            ${hasCube ? '<span class="adverbs-theme-badge adverbs-theme-badge--cube">3D-куб</span>' : ''}
          </div>
        </div>
        <h3 class="adverbs-theme-title">${escapeHtml(theme.title)}</h3>
        <p class="adverbs-theme-desc">${escapeHtml(theme.description)}</p>
        <div class="adverbs-theme-tags">${tagsHtml}</div>
        <div class="adverbs-theme-action">
          <span>Перейти к разделу</span>
          <span class="adverbs-theme-arrow" aria-hidden="true">→</span>
        </div>
      </a>`;
  }).join('');

  return `
    <section class="adverbs-themes-hub fade-in" aria-label="Тематические разделы наречий">
      <div class="adverbs-themes-intro">
        <p>Греческие наречия сгруппированы по 7 ключевым смысловым блокам. В основных разделах доступен интерактивный 3D-куб для пространственного и смыслового запоминания, а также отдельные тренировки (карточки и режим Ру → Ελ):</p>
      </div>
      <div class="adverbs-themes-grid">${cardsHtml}</div>
    </section>`;
}

export function renderAdverbsCubeHub(): string {
  return renderCubeInner(
    PLACE_ADVERB_PARADIGM,
    'left',
    'coords',
    undefined,
    ALL_ADVERB_PARADIGMS,
  );
}

