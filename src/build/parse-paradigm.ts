import type {
  VerbAspect,
  VerbImperative,
  VerbParadigm,
  VerbParticiple,
  VerbPersonForms,
  VerbTense,
} from './types';

const PERSON_INDEX: Record<string, number> = {
  я: 0,
  мы: 1,
  ты: 2,
  вы: 3,
  он: 4,
  она: 4,
  оно: 4,
  они: 5,
};

const TENSE_ALIASES: Record<string, VerbTense> = {
  настоящее: 'present',
  наст: 'present',
  present: 'present',
  прошедшее: 'past',
  прошлое: 'past',
  прош: 'past',
  past: 'past',
  будущее: 'future',
  буд: 'future',
  future: 'future',
};

const ASPECT_ALIASES: Record<string, VerbAspect> = {
  разовое: 'simple',
  разовый: 'simple',
  разовые: 'simple',
  simple: 'simple',
  аорист: 'simple',
  длительное: 'continuous',
  длительный: 'continuous',
  длительные: 'continuous',
  continuous: 'continuous',
  незавершенное: 'continuous',
  несовершенное: 'continuous',
  завершенное: 'perfect',
  завершенный: 'perfect',
  завершенные: 'perfect',
  совершенное: 'perfect',
  совершенный: 'perfect',
  совершенные: 'perfect',
  perfect: 'perfect',
  перфект: 'perfect',
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

function tokenKey(value: string): string {
  return normalize(value).replace(/\./g, '');
}

function emptyPersons(): VerbPersonForms {
  return ['', '', '', '', '', ''];
}

function cleanForm(value: string): string {
  const text = value.replace(/\*\*/g, '').trim();
  if (!text || text === '—' || text === '-' || text === '–' || text === '...') return '';
  return text;
}

function stripBullet(raw: string): string {
  return raw.trim().replace(/^[-*]\s+/, '');
}

function parseHeading(raw: string): { tense?: VerbTense; aspect?: VerbAspect } {
  const text = normalize(raw);
  let tense: VerbTense | undefined;
  let aspect: VerbAspect | undefined;
  const tokens = text
    .split(/[/|]+|\s+-\s+|\s+[—–]\s+|\s+/)
    .map((part) => tokenKey(part))
    .filter(Boolean);

  for (const token of tokens) {
    if (TENSE_ALIASES[token]) tense = TENSE_ALIASES[token];
    if (ASPECT_ALIASES[token]) aspect = ASPECT_ALIASES[token];
  }

  if (!aspect) {
    if (text.includes('несовершен')) aspect = 'continuous';
    else if (text.includes('совершен') || text.includes('завершен') || text.includes('перфект')) {
      aspect = 'perfect';
    } else if (text.includes('длитель')) aspect = 'continuous';
    else if (text.includes('разов') || text.includes('аорист')) aspect = 'simple';
  }

  if (!tense) {
    if (text.includes('настоя')) tense = 'present';
    else if (text.includes('прошед') || text.includes('прошл')) tense = 'past';
    else if (text.includes('будущ')) tense = 'future';
  }

  return { tense, aspect };
}

function stripPersonLabel(cell: string): string {
  return cell.replace(/^(я|мы|ты|вы|он|она|оно|они)\s*[:—–-]\s*/i, '');
}

function splitPair(line: string): [string, string] | null {
  if (!line.includes('|')) return null;
  const parts = line.split('|').map((part) => cleanForm(stripPersonLabel(part)));
  if (parts.length < 2) return null;
  return [parts[0], parts[1]];
}

function parseLabeled(line: string): { index: number; form: string } | null {
  const match = line.match(/^(я|мы|ты|вы|он|она|оно|они)\s*[:—–-]\s*(.+)$/i);
  if (!match) return null;
  const index = PERSON_INDEX[match[1].toLowerCase()];
  if (index === undefined) return null;
  return { index, form: cleanForm(match[2]) };
}

function parseConjugation(lines: string[]): VerbParadigm['conjugations'] {
  const buckets = new Map<string, VerbPersonForms>();
  let tense: VerbTense | null = null;
  let aspect: VerbAspect = 'simple';
  let rowIndex = 0;

  const bucket = (): VerbPersonForms | null => {
    if (!tense) return null;
    const key = `${tense}:${aspect}`;
    let forms = buckets.get(key);
    if (!forms) {
      forms = emptyPersons();
      buckets.set(key, forms);
    }
    return forms;
  };

  for (const raw of lines) {
    const line = stripBullet(raw);
    if (!line) continue;

    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      const parsed = parseHeading(heading[2]);
      if (heading[1].length === 2) {
        if (parsed.tense) tense = parsed.tense;
        aspect = parsed.aspect ?? 'simple';
      } else {
        if (parsed.tense) tense = parsed.tense;
        if (parsed.aspect) aspect = parsed.aspect;
      }
      rowIndex = 0;
      continue;
    }

    const forms = bucket();
    if (!forms) continue;

    const pair = splitPair(line);
    if (pair && rowIndex < 3) {
      forms[rowIndex * 2] = pair[0];
      forms[rowIndex * 2 + 1] = pair[1];
      rowIndex += 1;
      continue;
    }

    const labeled = parseLabeled(line);
    if (labeled) forms[labeled.index] = labeled.form;
  }

  const conjugations: VerbParadigm['conjugations'] = {};
  for (const [key, forms] of buckets) {
    if (!forms.some(Boolean)) continue;
    const [tenseKey, aspectKey] = key.split(':') as [VerbTense, VerbAspect];
    const tenseBucket = conjugations[tenseKey] ?? {};
    tenseBucket[aspectKey] = forms;
    conjugations[tenseKey] = tenseBucket;
  }
  return conjugations;
}

function stripImpLabel(cell: string): string {
  return cell.replace(
    /^(?:ед(?:инственное)?(?:\.ч)?\.?|мн(?:ожественное)?(?:\.ч)?\.?)\s*[:—–-]\s*/i,
    '',
  );
}

function parseImperative(lines: string[]): VerbImperative[] {
  const result: VerbImperative[] = [];
  let aspect: VerbAspect | 'default' = 'default';
  let current = { sg: '', pl: '' };

  const flush = () => {
    if (!current.sg && !current.pl) return;
    result.push({ aspect, sg: current.sg, pl: current.pl });
    current = { sg: '', pl: '' };
  };

  for (const raw of lines) {
    const line = stripBullet(raw);
    if (!line) continue;
    const heading = line.match(/^#{2,3}\s+(.+)$/);
    if (heading) {
      flush();
      aspect = parseHeading(heading[1]).aspect ?? 'default';
      continue;
    }

    if (line.includes('|')) {
      const parts = line.split('|');
      current.sg = cleanForm(stripImpLabel(stripPersonLabel(parts[0] ?? '')));
      current.pl = cleanForm(stripImpLabel(stripPersonLabel(parts[1] ?? '')));
      continue;
    }

    const labeled = line.match(
      /^(ед(?:инственное)?(?:\.ч)?\.?|мн(?:ожественное)?(?:\.ч)?\.?)\s*[:—–-]\s*(.+)$/i,
    );
    if (!labeled) continue;
    const form = cleanForm(labeled[2]);
    if (labeled[1].toLowerCase().startsWith('ед')) current.sg = form;
    else current.pl = form;
  }
  flush();
  return result;
}

function parseParticiples(lines: string[]): VerbParticiple[] {
  const participles: VerbParticiple[] = [];
  for (const raw of lines) {
    const line = stripBullet(raw);
    if (!line || line.startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) {
      const form = cleanForm(line);
      if (form) participles.push({ label: '', form });
      continue;
    }
    const label = line.slice(0, colon).trim();
    const form = cleanForm(line.slice(colon + 1));
    if (form) participles.push({ label, form });
  }
  return participles;
}

export function parseVerbParadigm(input: {
  conjugation?: string[];
  imperative?: string[];
  participle?: string[];
}): VerbParadigm | null {
  const conjugations = parseConjugation(input.conjugation ?? []);
  const imperative = parseImperative(input.imperative ?? []);
  const participles = parseParticiples(input.participle ?? []);
  const hasConjugation = Object.values(conjugations).some((bucket) =>
    Object.values(bucket ?? {}).some((forms) => forms?.some(Boolean)),
  );
  if (!hasConjugation && imperative.length === 0 && participles.length === 0) return null;
  return { conjugations, imperative, participles };
}
