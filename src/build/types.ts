export interface WordForm {
  greek: string;
  translation: string;
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
}

export interface IndexLink {
  label: string;
  href: string;
}

export interface IndexPage {
  title: string;
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
