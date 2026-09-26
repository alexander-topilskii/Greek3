export type VerbTense = 'past' | 'present' | 'future';
export type VerbAspect = 'simple' | 'continuous' | 'perfect';

/** Шесть форм: я, мы, ты, вы, он, они. */
export type VerbPersonForms = string[];

export interface VerbImperative {
  /** `default` — одна пара, не зависит от переключателя вида. */
  aspect: VerbAspect | 'default';
  sg: string;
  pl: string;
}

export interface VerbParticiple {
  label: string;
  form: string;
}

export interface VerbParadigm {
  conjugations: Partial<Record<VerbTense, Partial<Record<VerbAspect, VerbPersonForms>>>>;
  imperative: VerbImperative[];
  participles: VerbParticiple[];
}

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
  /** Спряжение для куба времён; null, если секции нет. */
  paradigm: VerbParadigm | null;
  forms: WordForm[];
  extraSections: { title: string; lines: string[] }[];
  sourcePath: string;
  meta: WordMeta;
  primaryGreek: string;
  /** Номер блока учебника (1…20), если слово есть в blocks/ */
  block?: number;
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
  /** Номер блока учебника (1…20), если слово из blocks/ */
  block?: number;
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
  /** Путь страницы под words/ (verbs, lessons/01, topics/food) */
  pageId?: string;
  /** Карта раздел/подраздел → slug[] для избранного (глобальный каталог) */
  pages?: Record<string, string[]>;
}

export interface SiteConfig {
  title: string;
  description: string;
  baseUrl: string;
}

/** Пара «греческий — перевод» на странице сочинения. */
export interface EssayPair {
  greek: string;
  translation: string;
}

/** Пример сочинения для конкретного уровня (A1, A2, …). */
export interface EssayExample {
  level: string;
  body: string;
}

/** Песня в разделе «Песни». */
export interface Song {
  slug: string;
  title: string;
  intro: string;
  /** Номер урока, если указан в frontmatter */
  lesson: number | null;
  lines: EssayPair[];
  sourcePath: string;
}

/** Тема раздела «Сочинения». */
export interface EssayTopic {
  slug: string;
  title: string;
  intro: string;
  level: string;
  questions: EssayPair[];
  vocab: EssayPair[];
  phrases: EssayPair[];
  examples: EssayExample[];
  sourcePath: string;
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
