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
