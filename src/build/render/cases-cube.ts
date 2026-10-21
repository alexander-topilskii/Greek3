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
  faceIdx: number,
  activeFaceIdx: number,
  numFaces: number,
  highlightForm?: string,
): string {
  const hidden = faceIdx === activeFaceIdx ? 'false' : 'true';
  const faceId = face.id || face.case || String(faceIdx);
  const rot = numFaces === 6
    ? faceIdx * 60
    : (faceIdx === 0 ? -90 : faceIdx === 1 ? 0 : 90);
  const defaultTz = numFaces === 6 ? '260px' : '150px';

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
    <div class="cases-cube-face cases-cube-face--${escapeHtml(faceId)} cases-cube-face--${faceIdx}"
         data-face="${escapeHtml(faceId)}"
         data-face-index="${faceIdx}"
         data-case="${escapeHtml(faceId)}"
         style="transform: rotateY(${rot}deg) translateZ(var(--cases-tz, ${defaultTz}));"
         aria-hidden="${hidden}">
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

function renderFaceTabs(faces: CaseFace[], faceOrder: string[], activeIndex: number): string {
  if (faceOrder.length !== 6) return '';

  const renderTab = (f: CaseFace, idx: number) => {
    const active = idx === activeIndex;
    return `
      <button type="button" class="cases-face-tab${active ? ' is-active' : ''}" data-face-id="${escapeHtml(f.id || '')}" data-face-index="${idx}" role="tab" aria-selected="${active ? 'true' : 'false'}" title="${escapeHtml(f.title)}">
        ${f.icon ? `<span class="cases-face-tab-icon" aria-hidden="true">${escapeHtml(f.icon)}</span>` : ''}
        <span class="cases-face-tab-label">${escapeHtml(f.shortLabel || f.title)}</span>
        ${f.badge ? `<span class="cases-face-tab-badge">${escapeHtml(f.badge)}</span>` : ''}
      </button>`;
  };

  const sgTabs = faceOrder.slice(0, 3).map((fId, idx) => {
    const face = faces.find((f) => f.id === fId) || faces[idx];
    return renderTab(face, idx);
  }).join('');

  const plTabs = faceOrder.slice(3, 6).map((fId, idx) => {
    const face = faces.find((f) => f.id === fId) || faces[idx + 3];
    return renderTab(face, idx + 3);
  }).join('');

  return `
    <div class="cases-face-tabs" role="tablist" aria-label="Род и число">
      <div class="cases-face-tabs-group" data-group="sg">
        ${sgTabs}
      </div>
      <div class="cases-face-tabs-divider" aria-hidden="true"></div>
      <div class="cases-face-tabs-group" data-group="pl">
        ${plTabs}
      </div>
    </div>`;
}

function renderTimeline(faceOrder: string[], faces: CaseFace[], activeIndex: number): string {
  const numFaces = faceOrder.length;
  if (numFaces === 6) {
    const dotsSg = faceOrder.slice(0, 3).map((fId, idx) => {
      const active = idx === activeIndex;
      const face = faces.find((f) => f.id === fId) || faces[idx];
      return `<span class="cases-cube-dot${active ? ' is-active' : ''}" data-dot-index="${idx}" data-dot="${escapeHtml(fId)}" title="${escapeHtml(face?.shortLabel || fId)}"></span>`;
    }).join('');

    const dotsPl = faceOrder.slice(3, 6).map((fId, idx) => {
      const globalIdx = idx + 3;
      const active = globalIdx === activeIndex;
      const face = faces.find((f) => f.id === fId) || faces[globalIdx];
      return `<span class="cases-cube-dot${active ? ' is-active' : ''}" data-dot-index="${globalIdx}" data-dot="${escapeHtml(fId)}" title="${escapeHtml(face?.shortLabel || fId)}"></span>`;
    }).join('');

    return `
      <div class="cases-cube-timeline" aria-hidden="true">
        <span class="cases-cube-timeline-label">Ед.</span>
        ${dotsSg}
        <span class="cases-cube-timeline-sep">·</span>
        ${dotsPl}
        <span class="cases-cube-timeline-label">Мн.</span>
      </div>`;
  }

  return `
    <div class="cases-cube-timeline" aria-hidden="true">
      <span class="cases-cube-timeline-label">Им.</span>
      <span class="cases-cube-dot${activeIndex === 0 ? ' is-active' : ''}" data-dot-index="0" data-dot="nominative" title="Именительный"></span>
      <span class="cases-cube-dot${activeIndex === 1 ? ' is-active' : ''}" data-dot-index="1" data-dot="accusative" title="Винительный"></span>
      <span class="cases-cube-dot${activeIndex === 2 ? ' is-active' : ''}" data-dot-index="2" data-dot="genitive" title="Родительный"></span>
      <span class="cases-cube-timeline-label">Род.</span>
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

  const faceOrder = variant.faceOrder || Object.keys(variant.faces);
  const numFaces = faceOrder.length;
  let activeFaceId = activeCase;
  if (!faceOrder.includes(activeFaceId)) {
    activeFaceId = paradigm.defaultFace || paradigm.defaultCase || faceOrder[0];
  }
  let activeIndex = faceOrder.indexOf(activeFaceId);
  if (activeIndex < 0) activeIndex = 0;
  activeFaceId = faceOrder[activeIndex];

  const face = variant.faces[activeFaceId];
  const initialRotation = numFaces === 6
    ? activeIndex * -60
    : rotationForCase(activeFaceId);

  const payload: Record<string, unknown> = {
    mode: hubParadigms ? 'hub' : 'word',
    currentParadigm: paradigm.id,
    currentVariant: variant.id,
    currentFace: activeFaceId,
    currentFaceIndex: activeIndex,
    currentCase: activeFaceId,
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
  const faceTabsHtml = renderFaceTabs(Object.values(variant.faces), faceOrder, activeIndex);
  const timelineHtml = renderTimeline(faceOrder, Object.values(variant.faces), activeIndex);
  const extraNotesHtml = renderExtraNotes(variant);

  const defaultTz = numFaces === 6 ? '260px' : '150px';

  return `
    <section class="cases-paradigm" data-cases-cube data-paradigm="${paradigm.id}" data-variant="${variant.id}" data-case="${activeFaceId}" data-face="${activeFaceId}" data-face-index="${activeIndex}">
      <script type="application/json" data-cases-data>${embedJson(payload)}</script>
      ${hubTabsHtml}
      ${variantSwitcherHtml}
      ${faceTabsHtml}
      <div class="cases-cube-toolbar">
        <button type="button" class="cases-cube-nav" data-cube-dir="-1" aria-label="Предыдущий род/падеж"${activeIndex === 0 ? ' disabled' : ''}>${chevron('prev')}</button>
        <div class="cases-cube-heading">
          <h2 class="cases-cube-title">${escapeHtml(face.title)}</h2>
          <p class="cases-cube-subtitle">${escapeHtml(face.subtitle)}</p>
        </div>
        <button type="button" class="cases-cube-nav" data-cube-dir="1" aria-label="Следующий род/падеж"${activeIndex === numFaces - 1 ? ' disabled' : ''}>${chevron('next')}</button>
      </div>
      ${timelineHtml}
      <div class="cases-cube-clip">
        <div class="cases-cube-scene">
          <div class="cases-cube cases-cube--${numFaces}" style="transform: translateZ(calc(var(--cases-tz, ${defaultTz}) * -1)) rotateY(${initialRotation}deg)">
            ${faceOrder.map((fId, idx) => renderFace(variant.faces[fId], idx, activeIndex, numFaces, highlightForm)).join('')}
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
