export interface WordForm {
  greek: string;
  translation: string;
}

export interface WordExample {
  greek: string;
  translation: string;
}

export interface WordMeta {
  level: string;
  topics: string[];
  tags: string[];
  recordType: string;
}

export interface WordEntry {
  slug: string;
  title: string;
  category: string;
  translation: string;
  verbType: string;
  baseForms: string[];
  forms: WordForm[];
  extraSections: { title: string; lines: string[] }[];
  sourcePath: string;
  meta: WordMeta;
  primaryGreek: string;
}

export interface IndexLink {
  label: string;
  href: string;
  /** Path relative to words/ root, e.g. nouns/дом σπίτι.html */
  resolvedHref: string;
}

export interface IndexSection {
  title: string;
  links: IndexLink[];
}

export interface IndexPage {
  title: string;
  intro: string;
  sections: IndexSection[];
  links: IndexLink[];
  sourcePath: string;
}

export interface CatalogWord {
  slug: string;
  translation: string;
  verbType: string;
  baseForms: string[];
  href: string;
  label: string;
  formCount: number;
  forms: WordForm[];
  level: string;
  topics: string[];
  tags: string[];
  recordType: string;
  primaryGreek: string;
  category: string;
  /** Номер урока (1…), если слово из lessons/ */
  lesson?: number;
  /** Блок ~10 слов для подсказки смены направления */
  blockIndex?: number;
  /** Уровень чисел: 0 = 1–20, 1 = десятки, 2 = сотни, 3 = тысячи */
  numberTier?: number;
  /** Примеры из секции «Контекст» на странице слова */
  examples?: WordExample[];
}

export interface VerbCatalog {
  deckId: string;
  words: CatalogWord[];
  /** Размер блока для подсказки Ру → Εл (по умолчанию 10) */
  blockSize?: number;
  /** Подписи категорий для UI практики */
  categoryLabels?: Record<string, string>;
}

export interface SiteConfig {
  title: string;
  description: string;
  baseUrl: string;
}

export interface TopicAggregate {
  slug: string;
  title: string;
  words: CatalogWord[];
}

export interface LevelAggregate {
  level: string;
  words: CatalogWord[];
}
