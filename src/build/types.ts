export interface WordForm {
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

export interface IndexSubSection {
  title: string;
  links: IndexLink[];
}

export interface IndexSection {
  title: string;
  links: IndexLink[];
  subsections: IndexSubSection[];
}

export interface IndexPage {
  title: string;
  intro: string;
  sections: IndexSection[];
  links: IndexLink[];
  sourcePath: string;
  pageKind: 'default' | 'lesson' | 'topics' | 'levels';
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
}

export interface VerbCatalog {
  deckId: string;
  words: CatalogWord[];
}

export interface SiteConfig {
  title: string;
  description: string;
  baseUrl: string;
}

export interface HomeSection {
  title: string;
  href: string;
  description: string;
  group?: 'primary' | 'secondary';
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
