import type { VerbCatalog } from '../../types';
import { BUILD_VERSION } from '../../build-version';
import { embedJson } from '../html';
import { layout } from '../layout';
import { copyWordsSettingsSectionMarkup, settingsButtonHref } from '../fragments';
import { sitePath } from '../../site-path';

export function renderSettings(deckCatalogs: Record<string, VerbCatalog>): string {
  const catalogsJson = embedJson(deckCatalogs);
  const maxWords = Math.max(
    30,
    ...Object.values(deckCatalogs).map((catalog) => catalog.words.length),
    1,
  );

  const content = `
    <section class="settings-page fade-in" data-settings-page data-build-version="${BUILD_VERSION}">
      <div class="settings-page-head">
        <div class="page-head">
          <h1>Настройки</h1>
          <p class="page-intro" id="settings-context-hint"></p>
        </div>
        <a href="${sitePath('index.html')}" class="btn btn-secondary" id="btn-settings-back">← Назад</a>
      </div>

      <div class="settings-screen">
        <section class="settings-card" aria-labelledby="settings-learning-title">
          <h2 class="settings-card-title" id="settings-learning-title">Обучение</h2>
          <div class="settings-card-body">
            <label class="settings-toggle">
              <span class="settings-toggle-label">
                <span class="settings-section-label">Простое обучение</span>
                <span class="settings-hint">Только карточки Ελ → Ру и Ру → Ελ, без викторин и мини-игр.</span>
              </span>
              <button
                type="button"
                class="settings-switch"
                id="setting-simple-learning"
                role="switch"
                aria-checked="false"
                aria-label="Простое обучение">
                <span class="settings-switch-track" aria-hidden="true">
                  <span class="settings-switch-thumb"></span>
                </span>
              </button>
            </label>
          </div>
        </section>

        <section class="settings-card hidden" id="settings-deck-section" aria-labelledby="settings-deck-title" hidden>
          <h2 class="settings-card-title" id="settings-deck-title">Набор слов</h2>
          <div class="settings-card-body">
            <label class="settings-field settings-field--home hidden" id="settings-home-group-field" hidden>
              <span>Слов в группе</span>
              <input type="number" id="home-setting-group-size" min="1" max="30" value="5">
            </label>
            <div class="settings-deck-fields hidden" id="settings-deck-fields" hidden>
              <label class="settings-field">
                <span>Начальная группа</span>
                <input type="number" id="setting-initial-batch" min="1" max="30" value="5">
              </label>
              <label class="settings-field">
                <span>Активных слов</span>
                <input type="number" id="setting-active-limit" min="1" max="${maxWords}" value="5">
              </label>
              <p class="settings-hint">При выучивании слова в набор автоматически добавляется новое. Старые повторяются реже, но по расписанию SRS.</p>
            </div>
            <p class="settings-hint settings-hint--home hidden" id="settings-home-hint" hidden>
              Сколько слов одновременно в активном наборе. При выучивании слова в набор добавляется новое.
            </p>
            <div class="settings-actions">
              <button type="button" class="btn btn-secondary" id="btn-save-deck-settings">Сохранить</button>
              <button type="button" class="btn btn-secondary hidden" id="btn-reset-deck" hidden>Сбросить прогресс раздела</button>
            </div>
            ${copyWordsSettingsSectionMarkup()}
          </div>
        </section>

        <section class="settings-card hidden" id="settings-word-section" aria-labelledby="settings-word-title" hidden>
          <h2 class="settings-card-title" id="settings-word-title">Слово</h2>
          <div class="settings-card-body">
            <button type="button" class="btn btn-secondary" id="btn-reset-word">Сбросить прогресс слова</button>
            <p class="settings-hint">Удалит прогресс только для этого слова.</p>
          </div>
        </section>

        <section class="settings-card" aria-labelledby="settings-app-title">
          <h2 class="settings-card-title" id="settings-app-title">Приложение</h2>
          <div class="settings-card-body">
            <div class="pwa-install-section" id="pwa-install-section" hidden>
              <button type="button" class="btn btn-secondary" id="btn-install-app">Установить приложение</button>
              <p class="settings-hint" id="pwa-install-hint">Добавьте Greek3 на главный экран для быстрого доступа и офлайн-режима.</p>
            </div>
            <p class="settings-hint settings-version-line">Версия ${BUILD_VERSION}</p>
          </div>
        </section>

        <section class="settings-card settings-card--danger" aria-labelledby="settings-danger-title">
          <h2 class="settings-card-title" id="settings-danger-title">Сброс</h2>
          <div class="settings-card-body">
            <button type="button" class="btn btn-secondary btn-reset-all" id="btn-reset-all-progress">Сбросить весь прогресс</button>
            <p class="settings-hint">Удалит все данные о выученных словах и начнёт обучение сначала.</p>
          </div>
        </section>
      </div>

      <script type="application/json" id="settings-catalogs">${catalogsJson}</script>
    </section>`;

  return layout(
    content,
    'Настройки',
    [
      { label: 'Главная', href: sitePath('index.html') },
      { label: 'Настройки' },
    ],
    ['assets/js/settings.js'],
    { settingsHref: settingsButtonHref({ from: 'settings.html' }) },
  );
}
