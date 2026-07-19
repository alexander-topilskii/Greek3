import type { VerbCatalog } from '../../types';
import { sitePath } from '../../site-path';
import { escapeHtml, embedJson } from '../html';
import { layout } from '../layout';
import {
  examplesDialogMarkup,
  homePracticePanelMarkup,
  homeSettingsDialogMarkup,
} from '../fragments';

export function renderHome(
  sections: { title: string; href: string; description: string }[],
  globalCatalog?: VerbCatalog,
): string {
  const cards = sections
    .map(
      (s, order) => `
    <a href="${s.href.startsWith('#') ? s.href : escapeHtml(sitePath(s.href))}" class="section-card fade-in" data-section-href="${escapeHtml(s.href)}" data-section-order="${order}">
      <h2>${escapeHtml(s.title)}</h2>
      <p>${escapeHtml(s.description)}</p>
      <span class="card-arrow" aria-hidden="true">→</span>
    </a>`,
    )
    .join('');

  const catalogJson = globalCatalog
    ? `<script type="application/json" id="global-catalog">${embedJson(globalCatalog)}</script>`
    : '';

  const continueBlock =
    globalCatalog && globalCatalog.words.length > 0
      ? `
      <div class="hero-continue fade-in" id="hero-continue">
        <button type="button" class="btn btn-primary btn-continue" id="btn-continue">
          <span class="btn-continue-label">Продолжить</span>
          <span class="btn-continue-arrow" aria-hidden="true">→</span>
        </button>
        <p class="continue-hint" id="continue-hint">Загрузка прогресса…</p>
      </div>`
      : '';

  const practiceBlock =
    globalCatalog && globalCatalog.words.length > 0
      ? `
    <section class="home-practice list-practice hidden" id="home-practice" aria-hidden="true">
      <div class="practice-panel practice-panel--wide fade-in">
        ${homePracticePanelMarkup()}
      </div>
      <button type="button" class="btn btn-secondary btn-close-practice" id="btn-close-practice">← На главную</button>
    </section>`
      : '';

  const hasHomePractice = Boolean(globalCatalog && globalCatalog.words.length > 0);

  const content = `
    <section class="home-page verbs-list-page" data-deck-id="global" data-learning-practice data-learning-mode="home">
      <section class="hero fade-in">
        <p class="hero-label">Современный греческий</p>
        <h1>Изучай и практикуй<br><span class="hero-accent">ελληνικά</span></h1>
        ${continueBlock}
      </section>
      ${practiceBlock}
      <section class="favorites-section hidden" id="favorites-section" aria-labelledby="favorites-section-title" hidden>
        <div class="favorites-section-head">
          <h2 id="favorites-section-title">Избранное</h2>
          <p class="favorites-section-hint" id="favorites-section-hint">Обучение на главной использует только избранные слова</p>
        </div>
        <div class="favorites-list" id="favorites-list" role="list"></div>
        <p class="favorites-empty hidden" id="favorites-empty" hidden>Пока ничего не добавлено. Нажмите ★ у слова или раздела.</p>
      </section>
      <section class="sections-grid" id="sections-grid">
        ${cards}
      </section>
      ${catalogJson}
    </section>`;

  const scripts = hasHomePractice
    ? [
        'assets/js/learning-ladder.js',
        'assets/js/quiz-step.js',
        'assets/js/spell-step.js',
        'assets/js/match-step.js',
        'assets/js/cloze-step.js',
        'assets/js/home-favorites.js',
        'assets/js/home-practice.js',
      ]
    : [];
  const layoutOptions = hasHomePractice
    ? {
        showSettings: true,
        bodyEnd: `${examplesDialogMarkup()}${homeSettingsDialogMarkup()}`,
      }
    : {};

  return layout(content, 'Главная', undefined, scripts, layoutOptions);
}