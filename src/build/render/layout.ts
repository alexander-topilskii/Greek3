import { pwaScope } from '../pwa';
import { ASSET_VERSION, sitePath } from '../site-path';
import { BUILD_VERSION } from '../build-version';
import { HOME_SECTIONS } from '../constants';
import { embedJson, escapeHtml } from './html';
import { SITE_CONFIG } from './config';
import { SHARED_SCRIPTS } from './scripts';
import { searchButtonMarkup, settingsButtonMarkup } from './fragments';

export { sitePath };

export function layout(
  content: string,
  pageTitle: string,
  breadcrumbs?: { label: string; href?: string }[],
  extraScripts: string[] = [],
  options: { showSettings?: boolean; bodyEnd?: string; showBuildVersion?: boolean } = {},
): string {
  const crumbs = breadcrumbs
    ?.map((c) =>
      c.href
        ? `<a href="${escapeHtml(c.href)}" class="crumb-link">${escapeHtml(c.label)}</a>`
        : `<span class="crumb-current">${escapeHtml(c.label)}</span>`,
    )
    .join('<span class="crumb-sep">/</span>') ?? '';

  const scripts = [...SHARED_SCRIPTS, ...extraScripts]
    .map((s) => `<script src="${sitePath(s)}?v=${ASSET_VERSION}" defer></script>`)
    .join('\n  ');

  const scope = pwaScope(SITE_CONFIG.baseUrl);
  const homeSectionsConfig = embedJson(
    HOME_SECTIONS.map((section, order) => ({
      href: section.href,
      order,
    })),
  );

  const logoText = options.showBuildVersion
    ? `Greek<sup class="logo-version" aria-label="Версия ${escapeHtml(BUILD_VERSION)}">${escapeHtml(BUILD_VERSION)}</sup>3`
    : escapeHtml(SITE_CONFIG.title);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(SITE_CONFIG.description)}">
  <meta id="pwa-meta" data-sw="${escapeHtml(sitePath('sw.js'))}" data-scope="${escapeHtml(scope)}" data-build="${ASSET_VERSION}">
  <meta name="theme-color" content="#2563eb">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="Greek3">
  <link rel="manifest" href="${sitePath('manifest.webmanifest')}">
  <link rel="icon" href="${sitePath('assets/icons/icon.svg')}" type="image/svg+xml">
  <link rel="apple-touch-icon" href="${sitePath('assets/icons/icon-192.png')}">
  <title>${escapeHtml(pageTitle)} · ${escapeHtml(SITE_CONFIG.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Noto+Sans:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${sitePath('assets/css/main.css')}?v=${ASSET_VERSION}">
</head>
<body>
  <div class="page-bg"></div>
  <header class="site-header">
    <div class="container header-inner">
      <a href="${sitePath('index.html')}" class="logo">
        <span class="logo-mark">α</span>
        <span class="logo-text">${logoText}</span>
      </a>
      <nav class="site-nav">
        ${searchButtonMarkup()}
        ${options.showSettings ? settingsButtonMarkup() : ''}
      </nav>
    </div>
  </header>
  <main class="site-main container">
    ${crumbs ? `<nav class="breadcrumbs" aria-label="Навигация">${crumbs}</nav>` : ''}
    ${content}
  </main>
  <footer class="site-footer">
    <div class="container">
      <p>Учим греческий вместе · ${escapeHtml(SITE_CONFIG.title)}</p>
    </div>
  </footer>
  ${options.bodyEnd ?? ''}
  <script type="application/json" id="home-sections-config">${homeSectionsConfig}</script>
  ${scripts}
</body>
</html>`;
}
