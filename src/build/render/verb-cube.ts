import type { VerbAspect, VerbImperative, VerbParadigm, VerbTense, WordEntry } from '../types';
import { embedJson, escapeHtml } from './html';

const ASPECTS: VerbAspect[] = ['simple', 'continuous', 'perfect'];
const FACE_ORDER: VerbTense[] = ['present', 'future', 'past'];
const PERSON_LABELS = ['я', 'мы', 'ты', 'вы', 'он', 'они'];

const ASPECT_LABELS: Record<VerbAspect, string> = {
  simple: 'Разовое',
  continuous: 'Длительное',
  perfect: 'Завершённое',
};

const TENSE_TITLES: Record<VerbTense, Record<VerbAspect, { title: string; subtitle: string }>> = {
  present: {
    simple: { title: 'Настоящее', subtitle: 'Ενεστώτας (общ.)' },
    continuous: { title: 'Настоящее Длит.', subtitle: 'Ενεστώτας' },
    perfect: { title: 'Настоящее Заверш.', subtitle: 'Παρακείμενος (Перфект)' },
  },
  past: {
    simple: { title: 'Прош. Разовое', subtitle: 'Αόριστος' },
    continuous: { title: 'Прош. Длит.', subtitle: 'Παρατατικός' },
    perfect: { title: 'Прош. Заверш.', subtitle: 'Υπερσυντέλικος (Плюсквамперфект)' },
  },
  future: {
    simple: { title: 'Будущее Разовое', subtitle: 'Συνοπτικός Μέλλοντας' },
    continuous: { title: 'Будущее Длит.', subtitle: 'Εξακολουθητικός' },
    perfect: { title: 'Будущее Заверш.', subtitle: 'Συντελεσμένος Μέλλοντας' },
  },
};

const FACE_CLASS: Record<VerbTense, string> = {
  present: 'verb-cube-face--present',
  future: 'verb-cube-face--future',
  past: 'verb-cube-face--past',
};

function usedAspects(paradigm: VerbParadigm): VerbAspect[] {
  return ASPECTS.filter((aspect) =>
    (['past', 'present', 'future'] as VerbTense[]).some((tense) =>
      paradigm.conjugations[tense]?.[aspect]?.some(Boolean),
    ),
  );
}

function hasConjugations(paradigm: VerbParadigm): boolean {
  return usedAspects(paradigm).length > 0;
}

function formsFor(paradigm: VerbParadigm, tense: VerbTense, aspect: VerbAspect): string[] {
  const forms = paradigm.conjugations[tense]?.[aspect];
  return forms && forms.length === 6 ? forms : ['', '', '', '', '', ''];
}

function formatVerbHtml(text: string, aspect: VerbAspect): string {
  const value = text.trim();
  if (!value) return '<span class="verb-person-empty">—</span>';
  if (aspect === 'perfect') {
    const bits = value.split(/\s+/);
    if (bits.length >= 2) {
      const tail = bits.pop() ?? '';
      const head = bits.join(' ');
      return `<span class="verb-aux">${escapeHtml(head)}</span><span class="verb-part">${escapeHtml(tail)}</span>`;
    }
  }
  return `<span class="verb-main">${escapeHtml(value)}</span>`;
}

function pickImperative(list: VerbImperative[], aspect: VerbAspect): VerbImperative | null {
  return (
    list.find((item) => item.aspect === aspect) ??
    list.find((item) => item.aspect === 'default') ??
    (list.length === 1 ? list[0] : null)
  );
}

function chevron(direction: 'prev' | 'next'): string {
  const path = direction === 'prev' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7';
  return `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"></path></svg>`;
}

function renderFace(paradigm: VerbParadigm, tense: VerbTense, aspect: VerbAspect): string {
  const forms = formsFor(paradigm, tense, aspect);
  const hidden = tense === 'present' ? 'false' : 'true';
  const cells = PERSON_LABELS.map(
    (label, index) => `
            <div class="verb-person">
              <span class="verb-person-label">${label}</span>
              <span class="verb-person-form greek">${formatVerbHtml(forms[index] ?? '', aspect)}</span>
            </div>`,
  ).join('');

  return `
          <div class="verb-cube-face ${FACE_CLASS[tense]}" data-tense="${tense}" aria-hidden="${hidden}">
            <div class="verb-cube-grid">
              <div class="verb-col-label">Единственное</div>
              <div class="verb-col-label">Множественное</div>
              ${cells}
            </div>
          </div>`;
}

function renderAspectSwitch(aspects: VerbAspect[], current: VerbAspect): string {
  if (aspects.length < 2) return '';
  const index = Math.max(0, aspects.indexOf(current));
  const buttons = aspects
    .map((aspect) => {
      const active = aspect === current;
      return `<button type="button" class="verb-aspect-btn${active ? ' is-active' : ''}" data-aspect="${aspect}" aria-pressed="${active ? 'true' : 'false'}">${ASPECT_LABELS[aspect]}</button>`;
    })
    .join('');
  return `
        <div class="verb-aspect" data-verb-aspect style="--n: ${aspects.length}; --i: ${index}">
          <div class="verb-aspect-slider" aria-hidden="true"></div>
          ${buttons}
        </div>`;
}

function renderImperativeCard(item: VerbImperative | null, show: boolean): string {
  if (!show || !item) return '';
  return `
        <div class="verb-extra-card">
          <h3>Повелительное</h3>
          <div class="verb-extra-row">
            <span class="verb-extra-label">ед.ч.</span>
            <span class="verb-extra-form greek" data-imp="sg">${escapeHtml(item.sg || '—')}</span>
          </div>
          <div class="verb-extra-row">
            <span class="verb-extra-label">мн.ч.</span>
            <span class="verb-extra-form greek" data-imp="pl">${escapeHtml(item.pl || '—')}</span>
          </div>
        </div>`;
}

function renderParticipleCard(paradigm: VerbParadigm): string {
  if (!paradigm.participles.length) return '';
  const rows = paradigm.participles
    .map((item) => {
      const label = item.label
        ? `<span class="verb-extra-label">${escapeHtml(item.label)}</span>`
        : '';
      return `<div class="verb-participle">${label}<span class="verb-extra-form greek">${escapeHtml(item.form)}</span></div>`;
    })
    .join('');
  return `
        <div class="verb-extra-card">
          <h3>Причастие</h3>
          ${rows}
        </div>`;
}

function renderStaticImperatives(paradigm: VerbParadigm): string {
  if (!paradigm.imperative.length) return '';
  const blocks = paradigm.imperative
    .map((item) => {
      const label =
        item.aspect === 'default' ? '' : `<p class="verb-extra-aspect">${ASPECT_LABELS[item.aspect]}</p>`;
      return `${label}
          <div class="verb-extra-row">
            <span class="verb-extra-label">ед.ч.</span>
            <span class="verb-extra-form greek">${escapeHtml(item.sg || '—')}</span>
          </div>
          <div class="verb-extra-row">
            <span class="verb-extra-label">мн.ч.</span>
            <span class="verb-extra-form greek">${escapeHtml(item.pl || '—')}</span>
          </div>`;
    })
    .join('');
  return `
        <div class="verb-extra-card">
          <h3>Повелительное</h3>
          ${blocks}
        </div>`;
}

export function renderVerbParadigm(word: WordEntry): { html: string; interactive: boolean } {
  const paradigm = word.paradigm;
  if (!paradigm) return { html: '', interactive: false };

  const interactive = hasConjugations(paradigm);
  const aspects = usedAspects(paradigm);
  const aspect = aspects[0] ?? 'simple';
  const title = TENSE_TITLES.present[aspect];
  const imperative = pickImperative(paradigm.imperative, aspect);
  const extra = interactive
    ? `${renderImperativeCard(imperative, paradigm.imperative.length > 0)}${renderParticipleCard(paradigm)}`
    : `${renderStaticImperatives(paradigm)}${renderParticipleCard(paradigm)}`;
  const extraHtml = extra.trim() ? `<div class="verb-extra">${extra}</div>` : '';

  if (!interactive) {
    if (!extraHtml) return { html: '', interactive: false };
    return { html: `<section class="verb-paradigm">${extraHtml}</section>`, interactive: false };
  }

  const payload = {
    aspects,
    titles: TENSE_TITLES,
    conjugations: paradigm.conjugations,
    imperative: paradigm.imperative,
  };

  const html = `
      <section class="verb-paradigm" data-verb-cube data-aspect="${aspect}">
        <script type="application/json" data-verb-paradigm>${embedJson(payload)}</script>
        ${renderAspectSwitch(aspects, aspect)}
        <div class="verb-cube-toolbar">
          <button type="button" class="verb-cube-nav" data-cube-dir="-1" aria-label="Прошедшее время">${chevron('prev')}</button>
          <div class="verb-cube-heading">
            <h2 class="verb-cube-title">${escapeHtml(title.title)}</h2>
            <p class="verb-cube-subtitle">${escapeHtml(title.subtitle)}</p>
          </div>
          <button type="button" class="verb-cube-nav" data-cube-dir="1" aria-label="Будущее время">${chevron('next')}</button>
        </div>
        <div class="verb-cube-timeline" aria-hidden="true">
          <span class="verb-cube-timeline-label">Прошлое</span>
          <span class="verb-cube-dot" data-dot="past"></span>
          <span class="verb-cube-dot is-active" data-dot="present"></span>
          <span class="verb-cube-dot" data-dot="future"></span>
          <span class="verb-cube-timeline-label">Будущее</span>
        </div>
        <div class="verb-cube-clip">
          <div class="verb-cube-scene">
            <div class="verb-cube">
              ${FACE_ORDER.map((tense) => renderFace(paradigm, tense, aspect)).join('')}
            </div>
          </div>
        </div>
        ${extraHtml}
      </section>`;

  return { html, interactive: true };
}
