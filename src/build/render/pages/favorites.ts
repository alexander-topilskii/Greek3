import type { VerbCatalog } from '../../types';
import { sitePath } from '../../site-path';
import { embedJson } from '../html';
import { layout } from '../layout';
import {
  examplesDialogMarkup,
  homePracticePanelMarkup,
  settingsButtonHref,
} from '../fragments';
import { breadcrumbsForIndex } from '../../breadcrumbs';

export function renderFavorites(globalCatalog?: VerbCatalog): string {
  const catalogJson = globalCatalog
    ? `<script type="application/json" id="global-catalog">${embedJson(globalCatalog)}</script>`
    : '';

  const continueBlock =
    globalCatalog && globalCatalog.words.length > 0
      ? `
      <div class="hero-continue fade-in hidden" id="hero-continue" hidden>
        <button type="button" class="btn btn-primary btn-continue" id="btn-continue">
          <span class="btn-continue-label">Тренировка избранного</span>
          <span class="btn-continue-arrow" aria-hidden="true">→</span>
        </button>
        <p class="continue-hint" id="continue-hint"></p>
      </div>`
      : '';

  const practiceBlock =
    globalCatalog && globalCatalog.words.length > 0
      ? `
    <section class="home-practice list-practice hidden" id="home-practice" aria-hidden="true">
      <div class="practice-panel practice-panel--wide fade-in">
        ${homePracticePanelMarkup()}
      </div>
      <button type="button" class="btn btn-secondary btn-close-practice" id="btn-close-practice">← К списку избранного</button>
    </section>`
      : '';

  const content = `
    <section class="home-page verbs-list-page favorites-page" data-deck-id="global" data-learning-practice data-learning-mode="favorites" data-nav-id="favorites-practice-immersive" data-session-key="greek3:favorites-practice-session" data-hide-on-open="#favorites-main-content">
      <div id="favorites-main-content">
        <div class="page-head fade-in list-head">
          <div class="page-head-row">
            <h1>Избранное</h1>
          </div>
          <p class="page-intro" id="favorites-intro">Слова и разделы, сохранённые для изучения и повторения.</p>
          <div class="favorites-stats-bar" id="favorites-stats-bar">
            <p class="favorites-section-hint" id="favorites-section-hint">Загрузка избранного…</p>
            <button type="button" class="btn btn-secondary btn-sm btn-clear-favorites hidden" id="btn-clear-favorites" hidden>Очистить всё</button>
          </div>
          ${continueBlock}
        </div>
        <div class="favorites-content">
          <div class="favorites-list" id="favorites-list" role="list"></div>
          <p class="favorites-empty hidden" id="favorites-empty" hidden>Пока ничего не добавлено. Нажмите ★ у любого слова, раздела или подраздела, чтобы добавить его сюда.</p>
        </div>
      </div>
      ${practiceBlock}
      ${catalogJson}
    </section>`;

  const scripts = [
    'assets/js/learning-ladder.js',
    'assets/js/quiz-step.js',
    'assets/js/spell-step.js',
    'assets/js/match-step.js',
    'assets/js/cloze-step.js',
    'assets/js/build-step.js',
    'assets/js/favorites-page.js',
    'assets/js/home-practice.js',
  ];

  const layoutOptions = {
    showSettings: true,
    settingsHref: settingsButtonHref({ deck: 'global', from: 'words/favorites/index.html' }),
    bodyEnd: examplesDialogMarkup(),
  };

  return layout(
    content,
    'Избранное',
    breadcrumbsForIndex('favorites/readme.md', 'Избранное'),
    scripts,
    layoutOptions,
  );
}
