import type { CatalogWord, LevelAggregate, TopicAggregate, WordEntry, WordMeta } from './types';
import { topicSlug } from './parse-frontmatter';

const CATEGORY_DEFAULT_LEVEL: Record<string, string> = {
  numbers: 'A1',
  cases: 'A1',
  verbs: 'A2',
  nouns: 'A2',
  adjectives: 'A2',
  pronouns: 'A2',
  particles: 'A2',
  phrases: 'B1',
  lessons: 'A2',
};

const CATEGORY_RECORD_TYPE: Record<string, string> = {
  verbs: 'verb',
  nouns: 'noun',
  adjectives: 'adjective',
  pronouns: 'pronoun',
  numbers: 'number',
  cases: 'case',
  particles: 'particle',
  phrases: 'phrase',
};

export function inferRecordType(word: WordEntry): string {
  if (word.meta.recordType) return word.meta.recordType;
  return CATEGORY_RECORD_TYPE[word.category] ?? 'word';
}

export function resolveWordMeta(
  word: WordEntry,
  inferredTopics: string[] = [],
  inferredLevel = '',
): WordMeta {
  const level =
    word.meta.level ||
    inferredLevel ||
    CATEGORY_DEFAULT_LEVEL[word.category] ||
    'A2';

  const topics = word.meta.topics.length
    ? word.meta.topics
    : inferredTopics;

  return {
    level,
    topics,
    tags: word.meta.tags,
    recordType: inferRecordType(word),
  };
}

export function primaryGreekForm(word: WordEntry): string {
  if (word.baseForms.length >= 2) return word.baseForms[1];
  if (word.baseForms.length === 1) return word.baseForms[0];
  if (word.forms.length) return word.forms[0].greek;
  return '';
}

export function enrichWordEntry(
  word: WordEntry,
  inferredTopics: string[] = [],
  inferredLevel = '',
): WordEntry {
  const meta = resolveWordMeta(word, inferredTopics, inferredLevel);
  return {
    ...word,
    meta,
    primaryGreek: primaryGreekForm(word),
  };
}

export function topicTitleFromSlug(slug: string, fallbackWords: CatalogWord[]): string {
  for (const word of fallbackWords) {
    for (const topic of word.topics) {
      if (topicSlug(topic) === slug) return topic;
    }
  }
  return slug;
}

export function buildTopicAggregates(words: CatalogWord[]): TopicAggregate[] {
  const map = new Map<string, CatalogWord[]>();
  for (const word of words) {
    for (const topic of word.topics) {
      const slug = topicSlug(topic);
      const list = map.get(slug) ?? [];
      list.push(word);
      map.set(slug, list);
    }
  }

  return [...map.entries()]
    .map(([slug, topicWords]) => ({
      slug,
      title: topicTitleFromSlug(slug, topicWords),
      words: topicWords,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
}

export function buildLevelAggregates(words: CatalogWord[]): LevelAggregate[] {
  const order = ['A1', 'A2', 'B1', 'B2'];
  const map = new Map<string, CatalogWord[]>();
  for (const word of words) {
    const level = word.level || 'A2';
    const list = map.get(level) ?? [];
    list.push(word);
    map.set(level, list);
  }

  return [...map.entries()]
    .sort((a, b) => {
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    })
    .map(([level, levelWords]) => ({ level, words: levelWords }));
}
