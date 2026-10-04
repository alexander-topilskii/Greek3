import type { VerbAspect, VerbImperative, VerbParadigm, VerbTense, WordEntry } from '../types';
import { embedJson, escapeHtml } from './html';

export interface PersonMeta {
  key: string;
  ru: string;
  el: string;
  shortRu: string;
  title: string;
  subtitle: string;
  formIndex: number;
  group: 'sg' | 'pl';
}

export const PERSON_DEFINITIONS: PersonMeta[] = [
  {
    key: '1s',
    ru: 'я',
    el: 'εγώ',
    shortRu: 'я',
    title: 'Я (Εγώ)',
    subtitle: '1-е лицо · Единственное число',
    formIndex: 0,
    group: 'sg',
  },
  {
    key: '2s',
    ru: 'ты',
    el: 'εσύ',
    shortRu: 'ты',
    title: 'Ты (Εσύ)',
    subtitle: '2-е лицо · Единственное число',
    formIndex: 2,
    group: 'sg',
  },
  {
    key: '3s',
    ru: 'он / она / оно',
    el: 'αυτός / -ή / -ό',
    shortRu: 'он',
    title: 'Он / она / оно (Αυτός)',
    subtitle: '3-е лицо · Единственное число',
    formIndex: 4,
    group: 'sg',
  },
  {
    key: '1p',
    ru: 'мы',
    el: 'εμείς',
    shortRu: 'мы',
    title: 'Мы (Εμείς)',
    subtitle: '1-е лицо · Множественное число',
    formIndex: 1,
    group: 'pl',
  },
  {
    key: '2p',
    ru: 'вы',
    el: 'εσείς',
    shortRu: 'вы',
    title: 'Вы (Εσείς)',
    subtitle: '2-е лицо · Множественное число',
    formIndex: 3,
    group: 'pl',
  },
  {
    key: '3p',
    ru: 'они',
    el: 'αυτοί / -ές / -ά',
    shortRu: 'они',
    title: 'Они (Αυτοί)',
    subtitle: '3-е лицо · Множественное число',
    formIndex: 5,
    group: 'pl',
  },
];

const ASPECT_LABELS: Record<VerbAspect, string> = {
  simple: 'Разовое',
  continuous: 'Длительное',
  perfect: 'Завершённое',
};

const PERFECT_AUX = new Set([
  'έχω', 'έχουμε', 'έχεις', 'έχετε', 'έχει', 'έχουν',
  'είχα', 'είχαμε', 'είχες', 'είχατε', 'είχε', 'είχαν',
]);

function formatVerbHtml(text: string, aspect: VerbAspect | 'general'): string {
  const value = text.trim();
  if (!value || value === '—' || value === '-') return '<span class="verb-person-empty">—</span>';
  if (aspect === 'perfect') {
    const bits = value.split(/\s+/);
    let auxEnd = (bits[0] ?? '').toLowerCase() === 'θα' ? 1 : 0;
    if (PERFECT_AUX.has((bits[auxEnd] ?? '').toLowerCase()) && bits.length > auxEnd + 1) {
      const head = bits.slice(0, auxEnd + 1).join(' ');
      const tail = bits.slice(auxEnd + 1).join(' ');
      return `<span class="verb-aux">${escapeHtml(head)}</span><span class="verb-part">${escapeHtml(tail)}</span>`;
    }
  }
  return `<span class="verb-main">${escapeHtml(value)}</span>`;
}

function hasConjugations(paradigm: VerbParadigm): boolean {
  return (['past', 'present', 'future'] as VerbTense[]).some((tense) =>
    (['simple', 'continuous', 'perfect'] as VerbAspect[]).some((aspect) =>
      paradigm.conjugations[tense]?.[aspect]?.some(Boolean),
    ),
  );
}

function defaultPersonIndex(paradigm: VerbParadigm): number {
  const has1s = (['present', 'past', 'future'] as VerbTense[]).some((t) =>
    (['simple', 'continuous', 'perfect'] as VerbAspect[]).some((a) =>
      Boolean(paradigm.conjugations[t]?.[a]?.[0]),
    ),
  );
  if (has1s) return 0;
  for (let i = 0; i < PERSON_DEFINITIONS.length; i++) {
    const formIdx = PERSON_DEFINITIONS[i].formIndex;
    const hasForms = (['present', 'past', 'future'] as VerbTense[]).some((t) =>
      (['simple', 'continuous', 'perfect'] as VerbAspect[]).some((a) =>
        Boolean(paradigm.conjugations[t]?.[a]?.[formIdx]),
      ),
    );
    if (hasForms) return i;
  }
  return 0;
}

function chevron(direction: 'prev' | 'next'): string {
  const path = direction === 'prev' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7';
  return `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"></path></svg>`;
}

interface FormCell {
  aspect: VerbAspect | 'general';
  label: string;
  sublabel?: string;
  form: string;
  wide?: boolean;
}

function hasAspectAcrossVerb(paradigm: VerbParadigm, tense: VerbTense, aspect: VerbAspect): boolean {
  return Boolean(paradigm.conjugations[tense]?.[aspect]?.some(Boolean));
}

function renderCell(cell: FormCell): string {
  const formatted = formatVerbHtml(cell.form, cell.aspect);
  const wideClass = cell.wide ? ' verb-form-cell--wide' : '';
  const sublabelHtml = cell.sublabel
    ? `<span class="verb-form-sublabel">${escapeHtml(cell.sublabel)}</span>`
    : '';

  return `
                <div class="verb-form-cell${wideClass}" data-aspect="${cell.aspect}">
                  <div class="verb-form-meta">
                    <span class="verb-form-label">${escapeHtml(cell.label)}</span>
                    ${sublabelHtml}
                  </div>
                  <span class="verb-form-value greek">${formatted}</span>
                </div>`;
}

function renderTenseBlock(
  title: string,
  greekTitle: string,
  tenseClass: string,
  cells: FormCell[],
): string {
  if (!cells.length) return '';
  return `
            <div class="verb-tense-block verb-tense-block--${tenseClass}">
              <div class="verb-tense-heading">
                <span class="verb-tense-badge">${escapeHtml(title)}</span>
                <span class="verb-tense-greek">${escapeHtml(greekTitle)}</span>
              </div>
              <div class="verb-tense-grid">
                ${cells.map(renderCell).join('')}
              </div>
            </div>`;
}

function renderPersonFace(
  paradigm: VerbParadigm,
  person: PersonMeta,
  faceIndex: number,
  initialIndex: number,
): string {
  const idx = person.formIndex;
  const isInitial = faceIndex === initialIndex;

  // Past
  const pastSimpleExist = hasAspectAcrossVerb(paradigm, 'past', 'simple');
  const pastContExist = hasAspectAcrossVerb(paradigm, 'past', 'continuous');
  const pastPerfExist = hasAspectAcrossVerb(paradigm, 'past', 'perfect');
  const pastCells: FormCell[] = [];

  const pastSimpleForm = paradigm.conjugations.past?.simple?.[idx] || '';
  const pastContForm = paradigm.conjugations.past?.continuous?.[idx] || '';
  const pastPerfForm = paradigm.conjugations.past?.perfect?.[idx] || '';

  if (pastSimpleExist && pastContExist) {
    pastCells.push({ aspect: 'simple', label: 'Разовое', sublabel: 'Αόριστος', form: pastSimpleForm });
    pastCells.push({ aspect: 'continuous', label: 'Длительное', sublabel: 'Παρατατικός', form: pastContForm });
  } else if (pastSimpleExist) {
    pastCells.push({ aspect: 'simple', label: 'Разовое', sublabel: 'Αόριστος', form: pastSimpleForm, wide: !pastPerfExist });
  } else if (pastContExist) {
    pastCells.push({ aspect: 'continuous', label: 'Длительное', sublabel: 'Παρατατικός', form: pastContForm, wide: !pastPerfExist });
  }

  if (pastPerfExist) {
    pastCells.push({ aspect: 'perfect', label: 'Завершённое', sublabel: 'Υπερσυντέλικος', form: pastPerfForm, wide: true });
  }

  // Present
  const presSimpleExist = hasAspectAcrossVerb(paradigm, 'present', 'simple');
  const presContExist = hasAspectAcrossVerb(paradigm, 'present', 'continuous');
  const presPerfExist = hasAspectAcrossVerb(paradigm, 'present', 'perfect');
  const presCells: FormCell[] = [];

  const presSimpleForm = paradigm.conjugations.present?.simple?.[idx] || '';
  const presContForm = paradigm.conjugations.present?.continuous?.[idx] || '';
  const presPerfForm = paradigm.conjugations.present?.perfect?.[idx] || '';

  if (presSimpleExist && presContExist && presSimpleForm !== presContForm) {
    presCells.push({ aspect: 'simple', label: 'Разовое', form: presSimpleForm });
    presCells.push({ aspect: 'continuous', label: 'Длительное', sublabel: 'Ενεστώτας', form: presContForm });
  } else if (presContExist || presSimpleExist) {
    presCells.push({
      aspect: 'continuous',
      label: 'Настоящее',
      sublabel: 'Ενεστώτας',
      form: presContForm || presSimpleForm,
      wide: !presPerfExist,
    });
  }

  if (presPerfExist) {
    presCells.push({
      aspect: 'perfect',
      label: 'Завершённое',
      sublabel: 'Παρακείμενος',
      form: presPerfForm,
      wide: presCells.length === 0,
    });
  }

  // Future
  const futSimpleExist = hasAspectAcrossVerb(paradigm, 'future', 'simple');
  const futContExist = hasAspectAcrossVerb(paradigm, 'future', 'continuous');
  const futPerfExist = hasAspectAcrossVerb(paradigm, 'future', 'perfect');
  const futCells: FormCell[] = [];

  const futSimpleForm = paradigm.conjugations.future?.simple?.[idx] || '';
  const futContForm = paradigm.conjugations.future?.continuous?.[idx] || '';
  const futPerfForm = paradigm.conjugations.future?.perfect?.[idx] || '';

  if (futSimpleExist && futContExist) {
    futCells.push({ aspect: 'simple', label: 'Разовое', sublabel: 'Συνοπτικός', form: futSimpleForm });
    futCells.push({ aspect: 'continuous', label: 'Длительное', sublabel: 'Εξακολουθητικός', form: futContForm });
  } else if (futSimpleExist) {
    futCells.push({ aspect: 'simple', label: 'Разовое', sublabel: 'Συνοπτικός', form: futSimpleForm, wide: !futPerfExist });
  } else if (futContExist) {
    futCells.push({ aspect: 'continuous', label: 'Длительное', sublabel: 'Εξακολουθητικός', form: futContForm, wide: !futPerfExist });
  }

  if (futPerfExist) {
    futCells.push({ aspect: 'perfect', label: 'Завершённое', sublabel: 'Συντελεσμένος', form: futPerfForm, wide: true });
  }

  return `
          <div class="verb-cube-face verb-cube-face--${faceIndex}" data-person-index="${faceIndex}" aria-hidden="${isInitial ? 'false' : 'true'}">
            <div class="verb-face-tenses">
              ${renderTenseBlock('Прошедшее', 'Παρελθόν', 'past', pastCells)}
              ${renderTenseBlock('Настоящее', 'Ενεστώτας', 'present', presCells)}
              ${renderTenseBlock('Будущее', 'Μέλλοντας', 'future', futCells)}
            </div>
          </div>`;
}

function renderPersonTabs(initialIndex: number): string {
  const renderTab = (p: PersonMeta, index: number) => {
    const active = index === initialIndex;
    return `
      <button type="button" class="verb-person-tab${active ? ' is-active' : ''}" data-person-index="${index}" role="tab" aria-selected="${active ? 'true' : 'false'}" title="${escapeHtml(p.title)}">
        <span class="verb-person-tab-ru">${escapeHtml(p.shortRu)}</span>
        <span class="verb-person-tab-el greek">${escapeHtml(p.el)}</span>
      </button>`;
  };

  const sgTabs = PERSON_DEFINITIONS.slice(0, 3).map((p, idx) => renderTab(p, idx)).join('');
  const plTabs = PERSON_DEFINITIONS.slice(3, 6).map((p, idx) => renderTab(p, idx + 3)).join('');

  return `
        <div class="verb-person-tabs" role="tablist" aria-label="Лицо глагола">
          <div class="verb-person-tabs-group" data-group="sg">
            ${sgTabs}
          </div>
          <div class="verb-person-tabs-divider" aria-hidden="true"></div>
          <div class="verb-person-tabs-group" data-group="pl">
            ${plTabs}
          </div>
        </div>`;
}

function renderImperatives(paradigm: VerbParadigm): string {
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

export function renderVerbParadigm(word: WordEntry): { html: string; interactive: boolean } {
  const paradigm = word.paradigm;
  if (!paradigm) return { html: '', interactive: false };

  const interactive = hasConjugations(paradigm);
  const extra = `${renderImperatives(paradigm)}${renderParticipleCard(paradigm)}`;
  const extraHtml = extra.trim() ? `<div class="verb-extra">${extra}</div>` : '';

  if (!interactive) {
    if (!extraHtml) return { html: '', interactive: false };
    return { html: `<section class="verb-paradigm">${extraHtml}</section>`, interactive: false };
  }

  const initialIndex = defaultPersonIndex(paradigm);
  const activePerson = PERSON_DEFINITIONS[initialIndex];

  const payload = {
    initialIndex,
    persons: PERSON_DEFINITIONS.map((p, idx) => ({
      index: idx,
      title: p.title,
      subtitle: p.subtitle,
      ru: p.ru,
      el: p.el,
    })),
  };

  const initialRotation = initialIndex * -60;

  const html = `
      <section class="verb-paradigm" data-verb-cube>
        <script type="application/json" data-verb-paradigm>${embedJson(payload)}</script>
        ${renderPersonTabs(initialIndex)}
        <div class="verb-cube-toolbar">
          <button type="button" class="verb-cube-nav" data-cube-dir="-1" aria-label="Предыдущее лицо"${initialIndex === 0 ? ' disabled' : ''}>${chevron('prev')}</button>
          <div class="verb-cube-heading">
            <h2 class="verb-cube-title">${escapeHtml(activePerson.title)}</h2>
            <p class="verb-cube-subtitle">${escapeHtml(activePerson.subtitle)}</p>
          </div>
          <button type="button" class="verb-cube-nav" data-cube-dir="1" aria-label="Следующее лицо"${initialIndex === 5 ? ' disabled' : ''}>${chevron('next')}</button>
        </div>
        <div class="verb-cube-clip">
          <div class="verb-cube-scene">
            <div class="verb-cube" style="transform: translateZ(calc(var(--verb-tz, 300px) * -1)) rotateY(${initialRotation}deg)">
              ${PERSON_DEFINITIONS.map((p, idx) => renderPersonFace(paradigm, p, idx, initialIndex)).join('')}
            </div>
          </div>
        </div>
        ${extraHtml}
      </section>`;

  return { html, interactive: true };
}
