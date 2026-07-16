import type { WordEntry } from './types';
import { inferRecordType } from './meta';

const VERB_LABELS = ['прош.', 'наст.', 'буд.'] as const;
const GENDER_LABELS = ['муж.', 'жен.', 'средн.'] as const;
const CASE_LABELS = ['название', 'роль', 'артикли'] as const;
const PHRASE_LABELS = ['вариант', 'форма', ''] as const;

/** Подписи колонок в блоке «База» на странице слова. */
export function baseFormLabels(word: WordEntry, isPhrase: boolean): string[] {
  if (word.category === 'cases') return [...CASE_LABELS];
  if (isPhrase) return [...PHRASE_LABELS];

  const recordType = inferRecordType(word);
  if (recordType === 'verb') return [...VERB_LABELS];
  if (recordType === 'adjective' || recordType === 'pronoun') return [...GENDER_LABELS];

  return ['', '', ''];
}
