import type { SiteConfig } from '../types';

export const SITE_CONFIG: SiteConfig = {
  title: 'Greek3',
  description: 'Изучение и практика современного греческого языка',
  baseUrl: process.env.SITE_BASE_URL ?? '',
};

/** Текст в шапке рядом с логотипом α */
export const LOGO_TITLE = 'Ελληνικά';
