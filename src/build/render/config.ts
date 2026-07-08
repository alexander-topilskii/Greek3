import type { SiteConfig } from '../types';

export const SITE_CONFIG: SiteConfig = {
  title: 'Greek3',
  description: 'Изучение и практика современного греческого языка',
  baseUrl: process.env.SITE_BASE_URL ?? '',
};
