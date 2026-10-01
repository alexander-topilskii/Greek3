import type { WordEntry } from '../types';
import { embedJson, escapeHtml } from './html';
import { sitePath } from '../site-path';
import { wordOutputPath } from './paths-catalog';
import {
  ALL_PRONOUN_PARADIGMS,
  PERSONAL_PARADIGM,
  PronounCase,
  PronounCell,
  PronounFace,
  PronounParadigm,
  PronounRow,
  PronounVariant,
  getParadigmForWordSlug,
} from '../pronoun-data';

const CASE_ORDER: PronounCase[] = ['nominative', 'accusative', 'genitive'];

function chevron(direction: 'prev' | 'next'): string {
  const path = direction === 'prev' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7';
  return `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"></path></svg>`;
}

function rotationForCase(pCase: PronounCase): number {
  if (pCase === 'nominative') return 90;
  if (pCase === 'genitive') return -90;
  return 0; // accusative is 0
}

function renderCell(cell: PronounCell, highlightForm?: string): string {
  const isEmpty = !cell.greek || cell.greek === '—';
  const isCurrent = Boolean(
    highlightForm &&
      cell.greek &&
      (cell.greek === highlightForm ||
        cell.greek.split('/').map((s) => s.trim().toLowerCase()).includes(highlightForm.toLowerCase()) ||
        cell.greek.split('(')[0]?.trim().toLowerCase() === highlightForm.toLowerCase()),
  );

  const cleanSlug = cell.slug ? cell.slug.replace(/^words\//, '') : '';
  const linkHref = cleanSlug ? sitePath(wordOutputPath(cleanSlug)) : '';

  return `
    <div class="pronoun-person${isCurrent ? ' is-current' : ''}${isEmpty ? ' is-empty' : ''}" data-greek="${escapeHtml(cell.greek)}"${cleanSlug ? ` data-slug="${escapeHtml(cleanSlug)}"` : ''}>
      <div class="pronoun-person-info">
        <span class="pronoun-person-label">${escapeHtml(cell.personLabel)}</span>
        ${cell.hint ? `<span class="pronoun-person-hint">${escapeHtml(cell.hint)}</span>` : ''}
      </div>
      <div class="pronoun-person-forms">
        <span class="pronoun-person-form greek">${escapeHtml(cell.greek)}</span>
        ${cell.ru ? `<span class="pronoun-person-ru">${escapeHtml(cell.ru)}</span>` : ''}
      </div>
      ${linkHref && !isCurrent ? `<a href="${escapeHtml(linkHref)}" class="pronoun-person-link" title="Перейти к «${escapeHtml(cell.greek)}»" aria-label="Перейти к ${escapeHtml(cell.greek)}">↗</a>` : ''}
    </div>`;
}

function renderFace(
  face: PronounFace,
  activeCase: PronounCase,
  highlightForm?: string,
): string {
  const hidden = face.case === activeCase ? 'false' : 'true';
  const rowsHtml = face.rows
    .map(
      (row: PronounRow) => `
        ${renderCell(row.left, highlightForm)}
        ${renderCell(row.right, highlightForm)}`,
    )
    .join('');

  return `
    <div class="pronoun-cube-face pronoun-cube-face--${face.case}" data-case="${face.case}" aria-hidden="${hidden}">
      <div class="pronoun-cube-grid">
        <div class="pronoun-col-label">${escapeHtml(face.colLeftTitle)}</div>
        <div class="pronoun-col-label">${escapeHtml(face.colRightTitle)}</div>
        ${rowsHtml}
      </div>
    </div>`;
}

function renderVariantSwitcher(
  variants: PronounVariant[],
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
      return `<button type="button" class="pronoun-aspect-btn${active ? ' is-active' : ''}" data-variant="${v.id}" aria-pressed="${active ? 'true' : 'false'}">${escapeHtml(v.label)}</button>`;
    })
    .join('');

  return `
    <div class="pronoun-aspect" data-pronoun-aspect style="--n: ${variants.length}; --i: ${index}">
      <div class="pronoun-aspect-slider" aria-hidden="true"></div>
      ${buttons}
    </div>`;
}

function renderExtraNotes(variant: PronounVariant): string {
  if (!variant.extraNotes) return '';
  const notes = variant.extraNotes;
  const examplesHtml = (notes.examples || [])
    .map(
      (ex) => `
      <div class="pronoun-extra-example" data-greek="${escapeHtml(ex.greek)}">
        <span class="pronoun-extra-greek greek">${escapeHtml(ex.greek)}</span>
        <span class="pronoun-extra-ru">${escapeHtml(ex.ru)}</span>
      </div>`,
    )
    .join('');

  return `
    <div class="pronoun-extra-card">
      <h3 class="pronoun-extra-title">${escapeHtml(notes.title)}</h3>
      ${notes.description ? `<p class="pronoun-extra-desc">${escapeHtml(notes.description)}</p>` : ''}
      ${examplesHtml ? `<div class="pronoun-extra-examples">${examplesHtml}</div>` : ''}
    </div>`;
}

function renderHubTabs(
  paradigms: PronounParadigm[],
  activeParadigmId: string,
): string {
  const buttons = paradigms
    .map((p) => {
      const active = p.id === activeParadigmId;
      return `<button type="button" role="tab" class="pronoun-tab${active ? ' is-active' : ''}" data-paradigm="${p.id}" aria-selected="${active ? 'true' : 'false'}">${escapeHtml(p.tabLabel)}</button>`;
    })
    .join('');

  return `<div class="pronoun-tabs" role="tablist">${buttons}</div>`;
}

function renderCubeInner(
  paradigm: PronounParadigm,
  activeCase: PronounCase,
  activeVariantId: string,
  highlightForm?: string,
  hubParadigms?: PronounParadigm[],
): string {
  const variant =
    paradigm.variants.find((v) => v.id === activeVariantId) ??
    paradigm.variants[0];
  if (!variant) return '';

  const face = variant.faces[activeCase];
  const initialRotation = rotationForCase(activeCase);

  const payload: Record<string, unknown> = {
    mode: hubParadigms ? 'hub' : 'word',
    currentParadigm: paradigm.id,
    currentVariant: variant.id,
    currentCase: activeCase,
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
    <section class="pronoun-paradigm" data-pronoun-cube data-paradigm="${paradigm.id}" data-variant="${variant.id}" data-case="${activeCase}">
      <script type="application/json" data-pronoun-data>${embedJson(payload)}</script>
      ${hubTabsHtml}
      ${variantSwitcherHtml}
      <div class="pronoun-cube-toolbar">
        <button type="button" class="pronoun-cube-nav" data-cube-dir="-1" aria-label="Предыдущий падеж">${chevron('prev')}</button>
        <div class="pronoun-cube-heading">
          <h2 class="pronoun-cube-title">${escapeHtml(face.title)}</h2>
          <p class="pronoun-cube-subtitle">${escapeHtml(face.subtitle)}</p>
        </div>
        <button type="button" class="pronoun-cube-nav" data-cube-dir="1" aria-label="Следующий падеж">${chevron('next')}</button>
      </div>
      <div class="pronoun-cube-timeline" aria-hidden="true">
        <span class="pronoun-cube-timeline-label">Им.</span>
        <span class="pronoun-cube-dot${activeCase === 'nominative' ? ' is-active' : ''}" data-dot="nominative" title="Именительный"></span>
        <span class="pronoun-cube-dot${activeCase === 'accusative' ? ' is-active' : ''}" data-dot="accusative" title="Винительный"></span>
        <span class="pronoun-cube-dot${activeCase === 'genitive' ? ' is-active' : ''}" data-dot="genitive" title="Родительный"></span>
        <span class="pronoun-cube-timeline-label">Род.</span>
      </div>
      <div class="pronoun-cube-clip">
        <div class="pronoun-cube-scene">
          <div class="pronoun-cube" style="transform: translateZ(calc(var(--pronoun-tz, 150px) * -1)) rotateY(${initialRotation}deg)">
            ${CASE_ORDER.map((c) => renderFace(variant.faces[c], activeCase, highlightForm)).join('')}
          </div>
        </div>
      </div>
      <div class="pronoun-extra">${extraNotesHtml}</div>
    </section>`;
}

export function renderPronounCube(word: WordEntry): {
  html: string;
  interactive: boolean;
} {
  if (word.category !== 'pronouns') {
    return { html: '', interactive: false };
  }

  const lookup = getParadigmForWordSlug(word.slug);
  if (!lookup) {
    // If not in standard tables, fallback to Personal paradigm explorer reference
    const html = renderCubeInner(
      PERSONAL_PARADIGM,
      'accusative',
      'weak',
      word.primaryGreek,
    );
    return { html, interactive: true };
  }

  const html = renderCubeInner(
    lookup.paradigm,
    lookup.initialCase,
    lookup.initialVariant,
    lookup.highlightForm,
  );
  return { html, interactive: true };
}

export function renderPronounCubeHub(): string {
  return renderCubeInner(
    PERSONAL_PARADIGM,
    'accusative',
    'weak',
    undefined,
    ALL_PRONOUN_PARADIGMS,
  );
}
