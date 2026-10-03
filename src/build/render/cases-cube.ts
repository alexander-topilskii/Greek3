import type { WordEntry } from '../types';
import { embedJson, escapeHtml } from './html';
import { sitePath } from '../site-path';
import {
  ALL_CASE_PARADIGMS,
  ALL_CASE_THEMES,
  NOUNS_CASE_PARADIGM,
  CaseCell,
  CaseFace,
  CaseParadigm,
  CaseRow,
  CaseType,
  CaseVariant,
  getCaseThemeInfo,
  getParadigmForCaseWordSlug,
} from '../cases-data';

const CASE_ORDER: CaseType[] = ['nominative', 'accusative', 'genitive'];

function chevron(direction: 'prev' | 'next'): string {
  const path = direction === 'prev' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7';
  return `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"></path></svg>`;
}

function rotationForCase(cType: CaseType): number {
  if (cType === 'nominative') return 90;
  if (cType === 'genitive') return -90;
  return 0; // accusative is 0
}

function renderCell(cell: CaseCell, highlightForm?: string): string {
  const isEmpty = !cell.greek || cell.greek === '—';
  const isCurrent = Boolean(
    highlightForm &&
      cell.greek &&
      (cell.greek.toLowerCase().includes(highlightForm.toLowerCase()) ||
        cell.label.toLowerCase().includes(highlightForm.toLowerCase())),
  );

  const formsContent = cell.from && cell.to
    ? `
      <div class="cases-item-trans">
        <span class="cases-trans-from greek">${escapeHtml(cell.from)}</span>
        <span class="cases-trans-arrow" aria-hidden="true">→</span>
        <span class="cases-trans-to greek">${escapeHtml(cell.to)}</span>
      </div>`
    : `
      <span class="cases-item-greek greek">${escapeHtml(cell.greek)}</span>`;

  const hasSub = Boolean(cell.ru || cell.hint);

  return `
    <div class="cases-item${isCurrent ? ' is-current' : ''}${isEmpty ? ' is-empty' : ''}" data-greek="${escapeHtml(cell.greek)}">
      <div class="cases-item-main">
        <span class="cases-item-label">${escapeHtml(cell.label)}</span>
        <div class="cases-item-target">
          ${formsContent}
          ${cell.rule ? `<span class="cases-item-rule">${escapeHtml(cell.rule)}</span>` : ''}
        </div>
      </div>
      ${hasSub ? `
      <div class="cases-item-sub">
        ${cell.ru ? `<span class="cases-item-ru">${escapeHtml(cell.ru)}</span>` : '<span class="cases-item-ru-spacer"></span>'}
        ${cell.hint ? `<span class="cases-item-hint">${escapeHtml(cell.hint)}</span>` : ''}
      </div>` : ''}
    </div>`;
}

function renderFace(
  face: CaseFace,
  activeCase: CaseType,
  highlightForm?: string,
): string {
  const hidden = face.case === activeCase ? 'false' : 'true';
  let contentHtml = '';

  if (face.sections && face.sections.length > 0) {
    contentHtml = face.sections
      .map(
        (sec) => `
        <div class="cases-section">
          <div class="cases-section-head">
            <div class="cases-section-title-wrap">
              ${sec.icon ? `<span class="cases-section-icon" aria-hidden="true">${escapeHtml(sec.icon)}</span>` : ''}
              <h3 class="cases-section-title">${escapeHtml(sec.title)}</h3>
            </div>
            ${sec.badge ? `<span class="cases-section-badge">${escapeHtml(sec.badge)}</span>` : ''}
          </div>
          <div class="cases-section-items">
            ${sec.items.map((item) => renderCell(item, highlightForm)).join('')}
          </div>
        </div>`,
      )
      .join('');
  } else if (face.rows && face.rows.length > 0) {
    const colLabels = (face.colLeftTitle || face.colRightTitle)
      ? `
        <div class="cases-col-label">${escapeHtml(face.colLeftTitle || '')}</div>
        <div class="cases-col-label">${escapeHtml(face.colRightTitle || '')}</div>`
      : '';
    const rowsHtml = face.rows
      .map(
        (row: CaseRow) => `
          ${renderCell(row.left, highlightForm)}
          ${renderCell(row.right, highlightForm)}`,
      )
      .join('');
    contentHtml = colLabels + rowsHtml;
  }

  return `
    <div class="cases-cube-face cases-cube-face--${face.case}" data-case="${face.case}" aria-hidden="${hidden}">
      <div class="cases-cube-grid">
        ${contentHtml}
      </div>
    </div>`;
}

function renderVariantSwitcher(
  variants: CaseVariant[],
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
      return `<button type="button" class="cases-aspect-btn${active ? ' is-active' : ''}" data-variant="${v.id}" aria-pressed="${active ? 'true' : 'false'}" title="${escapeHtml(v.label)}">${escapeHtml(v.label)}</button>`;
    })
    .join('');

  return `
    <div class="cases-aspect" data-cases-aspect style="--n: ${variants.length}; --i: ${index}">
      <div class="cases-aspect-slider" aria-hidden="true"></div>
      ${buttons}
    </div>`;
}

function renderExtraNotes(variant: CaseVariant): string {
  if (!variant.extraNotes) return '';
  const notes = variant.extraNotes;
  const examplesHtml = (notes.examples || [])
    .map(
      (ex) => `
      <div class="cases-extra-example" data-greek="${escapeHtml(ex.greek)}">
        <span class="cases-extra-greek greek">${escapeHtml(ex.greek)}</span>
        <span class="cases-extra-ru">${escapeHtml(ex.ru)}</span>
      </div>`,
    )
    .join('');

  return `
    <div class="cases-extra-card">
      <h3 class="cases-extra-title">${escapeHtml(notes.title)}</h3>
      ${notes.description ? `<p class="cases-extra-desc">${escapeHtml(notes.description)}</p>` : ''}
      ${examplesHtml ? `<div class="cases-extra-examples">${examplesHtml}</div>` : ''}
    </div>`;
}

function renderHubTabs(
  paradigms: CaseParadigm[],
  activeParadigmId: string,
): string {
  const buttons = paradigms
    .map((p) => {
      const active = p.id === activeParadigmId;
      return `<button type="button" role="tab" class="cases-tab${active ? ' is-active' : ''}" data-paradigm="${p.id}" aria-selected="${active ? 'true' : 'false'}">${escapeHtml(p.tabLabel)}</button>`;
    })
    .join('');

  return `<div class="cases-tabs" role="tablist">${buttons}</div>`;
}

function renderCubeInner(
  paradigm: CaseParadigm,
  activeCase: CaseType,
  activeVariantId: string,
  highlightForm?: string,
  hubParadigms?: CaseParadigm[],
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
    <section class="cases-paradigm" data-cases-cube data-paradigm="${paradigm.id}" data-variant="${variant.id}" data-case="${activeCase}">
      <script type="application/json" data-cases-data>${embedJson(payload)}</script>
      ${hubTabsHtml}
      ${variantSwitcherHtml}
      <div class="cases-cube-toolbar">
        <button type="button" class="cases-cube-nav" data-cube-dir="-1" aria-label="Предыдущий падеж">${chevron('prev')}</button>
        <div class="cases-cube-heading">
          <h2 class="cases-cube-title">${escapeHtml(face.title)}</h2>
          <p class="cases-cube-subtitle">${escapeHtml(face.subtitle)}</p>
        </div>
        <button type="button" class="cases-cube-nav" data-cube-dir="1" aria-label="Следующий падеж">${chevron('next')}</button>
      </div>
      <div class="cases-cube-timeline" aria-hidden="true">
        <span class="cases-cube-timeline-label">Им.</span>
        <span class="cases-cube-dot${activeCase === 'nominative' ? ' is-active' : ''}" data-dot="nominative" title="Именительный"></span>
        <span class="cases-cube-dot${activeCase === 'accusative' ? ' is-active' : ''}" data-dot="accusative" title="Винительный"></span>
        <span class="cases-cube-dot${activeCase === 'genitive' ? ' is-active' : ''}" data-dot="genitive" title="Родительный"></span>
        <span class="cases-cube-timeline-label">Род.</span>
      </div>
      <div class="cases-cube-clip">
        <div class="cases-cube-scene">
          <div class="cases-cube" style="transform: translateZ(calc(var(--cases-tz, 150px) * -1)) rotateY(${initialRotation}deg)">
            ${CASE_ORDER.map((c) => renderFace(variant.faces[c], activeCase, highlightForm)).join('')}
          </div>
        </div>
      </div>
      <div class="cases-extra">${extraNotesHtml}</div>
    </section>`;
}

export function renderCasesCube(word: WordEntry): {
  html: string;
  interactive: boolean;
} {
  if (word.category !== 'cases') {
    return { html: '', interactive: false };
  }

  const theme = getCaseThemeInfo(word.slug);
  const themeLink = theme
    ? `<div class="cases-theme-back-wrap"><a href="${escapeHtml(sitePath(`words/cases/${theme.subDir}/index.html`))}" class="cases-theme-back-link">← Раздел «${escapeHtml(theme.title)}»</a></div>`
    : `<div class="cases-theme-back-wrap"><a href="${escapeHtml(sitePath('words/cases/index.html'))}" class="cases-theme-back-link">← Все разделы падежей</a></div>`;

  const lookup = getParadigmForCaseWordSlug(word.slug);
  if (!lookup) {
    const html = themeLink + renderCubeInner(
      NOUNS_CASE_PARADIGM,
      'nominative',
      'endings',
      word.primaryGreek,
    );
    return { html, interactive: true };
  }

  const html = themeLink + renderCubeInner(
    lookup.paradigm,
    lookup.initialCase,
    lookup.initialVariant,
    lookup.highlightForm,
  );
  return { html, interactive: true };
}

export function renderCaseThemeCube(paradigm: CaseParadigm): string {
  const initialVariant = paradigm.defaultVariant || paradigm.variants[0]?.id || 'default';
  const initialCase = paradigm.defaultCase || 'nominative';
  return renderCubeInner(
    paradigm,
    initialCase,
    initialVariant,
    undefined,
    undefined,
  );
}

export function renderCasesThemesHub(): string {
  const cardsHtml = ALL_CASE_THEMES.map((theme) => {
    const tagsHtml = theme.sampleTags
      .map((tag) => `<span class="cases-theme-tag greek">${escapeHtml(tag)}</span>`)
      .join('');

    return `
      <a href="${escapeHtml(sitePath(`words/cases/${theme.subDir}/index.html`))}" class="cases-theme-card">
        <div class="cases-theme-card-top">
          <span class="cases-theme-icon" aria-hidden="true">${theme.icon}</span>
        </div>
        <h3 class="cases-theme-title">${escapeHtml(theme.title)}</h3>
        <p class="cases-theme-desc">${escapeHtml(theme.description)}</p>
        <div class="cases-theme-tags">${tagsHtml}</div>
        <div class="cases-theme-action">
          <span>Перейти к разделу</span>
          <span class="cases-theme-arrow" aria-hidden="true">→</span>
        </div>
      </a>`;
  }).join('');

  return `
    <section class="cases-themes-hub fade-in" aria-label="Тематические разделы падежей">
      <div class="cases-themes-grid">${cardsHtml}</div>
    </section>`;
}

export function renderCasesCubeHub(): string {
  return renderCubeInner(
    NOUNS_CASE_PARADIGM,
    'nominative',
    'endings',
    undefined,
    ALL_CASE_PARADIGMS,
  );
}
