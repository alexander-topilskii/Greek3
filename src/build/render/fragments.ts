import { sitePath } from '../site-path';
import { escapeHtml } from './html';

export function progressBarMarkup(slug: string): string {
  return `
        <div class="word-progress progress-toggle" data-progress-slug="${escapeHtml(slug)}" role="button" tabindex="0" aria-label="Прогресс по направлениям" aria-expanded="false">
          <div class="word-progress-row">
            <span class="word-progress-meta">
              <span class="word-progress-label">Ελ → Ру</span>
              <span class="word-progress-fraction progress-el-ru-fraction">0/2</span>
            </span>
            <div class="word-progress-track word-progress-track--single" aria-hidden="true">
              <div class="word-progress-fill progress-word"></div>
            </div>
          </div>
          <div class="word-progress-row">
            <span class="word-progress-meta">
              <span class="word-progress-label">Ру → Ελ</span>
              <span class="word-progress-fraction progress-ru-el-fraction">0/4</span>
            </span>
            <div class="word-progress-track word-progress-track--single" aria-hidden="true">
              <div class="word-progress-fill progress-ru-el"></div>
            </div>
          </div>
        </div>`;
}

export function homePracticePanelMarkup(): string {
  return `
        <div class="practice-session-bar" id="practice-session-bar">
          <button type="button" class="practice-pool-progress progress-toggle" id="practice-pool-progress" aria-label="Прогресс словаря" aria-expanded="false">
            <span class="pool-side-stat pool-side-stat--studying">
              <span class="progress-swatch progress-swatch--active" aria-hidden="true"></span>
              <span class="pool-side-stat-value" id="practice-pool-count-studying">0</span>
              <span class="pool-side-stat-label">на изучении</span>
            </span>
            <span class="pool-grid" id="practice-pool-dots" role="list" aria-hidden="true"></span>
            <span class="pool-side-stat pool-side-stat--total">
              <span class="progress-swatch progress-swatch--total" aria-hidden="true"></span>
              <span class="pool-side-stat-value" id="practice-pool-count-total">0</span>
              <span class="pool-side-stat-label">всего</span>
            </span>
            <span class="practice-pool-labels">
              <span class="practice-pool-label"><span class="progress-swatch progress-swatch--learned" aria-hidden="true"></span><span id="practice-pool-label-learned">0 усвоено</span></span>
              <span class="practice-pool-label"><span class="progress-swatch progress-swatch--active" aria-hidden="true"></span><span id="practice-pool-label-active">0 в работе</span></span>
              <span class="practice-pool-label practice-pool-label--resting"><span class="progress-swatch progress-swatch--resting" aria-hidden="true"></span><span id="practice-pool-label-resting">0 отдыхаем</span></span>
              <span class="practice-pool-label"><span class="progress-swatch progress-swatch--new" aria-hidden="true"></span><span id="practice-pool-label-new">0 новых</span></span>
            </span>
          </button>
        </div>
        <div class="learn-stage" id="learn-stage">
          <div class="learn-stage-body">
            <div class="learn-stage-view learn-stage-view--flashcard" id="learn-view-flashcard">
              ${flashcardMarkup('home-flashcard-root', 'word-link')}
            </div>
            <div class="learn-step learn-step--quiz hidden" id="learn-view-quiz" hidden>
              <div class="learn-step-card">
                <span class="learn-step-label" data-quiz-label>Выберите перевод</span>
                <p class="learn-step-prompt greek" data-quiz-prompt>—</p>
                <div class="learn-quiz-options" data-quiz-options></div>
                <p class="learn-quiz-feedback" data-quiz-feedback hidden></p>
              </div>
            </div>
            <div class="learn-step learn-step--match hidden" id="learn-view-match" hidden>
              <div class="learn-step-card learn-step-card--match">
                <span class="learn-step-label">Сопоставьте формы и переводы</span>
                <div class="learn-match-board">
                  <div class="learn-match-column">
                    <span class="learn-match-column-title">Ελληνικά</span>
                    <div class="learn-match-chips" data-match-greek></div>
                  </div>
                  <div class="learn-match-column">
                    <span class="learn-match-column-title">Русский</span>
                    <div class="learn-match-chips" data-match-ru></div>
                  </div>
                </div>
                <div class="learn-match-pairs" data-match-pairs aria-live="polite"></div>
                <p class="learn-match-feedback" data-match-feedback hidden></p>
              </div>
            </div>
          </div>
        </div>
        <p class="practice-word-source hidden" id="practice-word-source" hidden></p>
        <div class="practice-block-complete hidden" id="practice-block-complete" hidden>
          <p class="practice-block-complete-text" id="practice-block-complete-text"></p>
          <div class="practice-block-complete-actions">
            <button type="button" class="btn btn-primary" id="btn-repeat-block">Повторить блок</button>
            <button type="button" class="btn btn-secondary" id="btn-add-words">Добавить слова в набор</button>
          </div>
        </div>
        <div class="practice-catalog-complete hidden" id="practice-catalog-complete" hidden>
          <p class="practice-catalog-complete-text">Все слова каталога пройдены в обоих направлениях.</p>
          <button type="button" class="btn btn-primary" id="btn-repeat-catalog">Повторить с начала</button>
        </div>`;
}

export function practiceCompleteMarkup(): string {
  return `
        <div class="practice-direction-prompt hidden" id="practice-direction-prompt" hidden>
          <p class="practice-direction-prompt-text" id="practice-direction-prompt-text"></p>
          <div class="practice-direction-prompt-actions">
            <button type="button" class="btn btn-primary" id="btn-switch-ru-el">Переключиться на Ру → Ελ</button>
            <button type="button" class="btn btn-secondary" id="btn-dismiss-ru-el-prompt">Позже</button>
          </div>
        </div>
        <div class="practice-complete hidden" id="practice-complete" hidden>
          <p class="practice-complete-text">Можно пройти ещё раз или вернуться к списку.</p>
          <button type="button" class="btn btn-primary" id="btn-repeat-session">Повторить ещё раз</button>
        </div>`;
}

export type FlashcardControls = 'random' | 'word-link';

export function flashcardPrimaryControl(kind: FlashcardControls): string {
  if (kind === 'word-link') {
    return `<a href="#" class="btn btn-secondary btn-word-link hidden" id="btn-word-link" hidden aria-disabled="true">В слово →</a>`;
  }
  return `<button type="button" class="btn btn-primary btn-random">Случайная</button>`;
}

export function flashcardMarkup(id = 'flashcard-root', controls: FlashcardControls = 'random'): string {
  return `
    <div class="flashcard-root" id="${id}">
      <div class="flashcard-hints" aria-hidden="true">
        <span class="flashcard-hint flashcard-hint--left">Не помню</span>
        <span class="flashcard-hint flashcard-hint--right">Помню</span>
      </div>
      <div class="flashcard" tabindex="0" role="button" aria-label="Карточка — тап перевернуть, свайп оценить">
        <div class="flashcard-drag">
          <div class="flashcard-inner">
            <div class="flashcard-front">
              <span class="flashcard-label" data-flash-front-label>Греческий</span>
              <p class="flashcard-text" data-flash-front-text>—</p>
            </div>
            <div class="flashcard-back">
              <span class="flashcard-label" data-flash-back-label>Перевод</span>
              <p class="flashcard-text" data-flash-back-text>—</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="practice-controls">
      ${flashcardPrimaryControl(controls)}
      <button type="button" class="btn btn-secondary btn-examples hidden" hidden aria-label="Примеры использования">Примеры</button>
      <button type="button" class="btn btn-secondary btn-lang" aria-pressed="false" title="Показывать сначала по-русски">⇄ RU</button>
      <button type="button" class="speak-switch btn-speak" role="switch" aria-checked="false" aria-label="Автоозвучка" title="Включить автоозвучку">
        <span class="speak-switch-track" aria-hidden="true">
          <span class="speak-switch-thumb">🔊</span>
        </span>
      </button>
    </div>`;
}

export function searchButtonMarkup(): string {
  return `
        <a href="${sitePath('search.html')}" class="btn-icon btn-header-search" aria-label="Поиск" title="Поиск">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
        </a>`;
}

export function settingsButtonMarkup(): string {
  return `
        <button type="button" class="btn-icon btn-header-settings" id="btn-header-settings" aria-label="Настройки" title="Настройки">
          <svg class="icon-gear" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>`;
}

export function wordSettingsDialogMarkup(): string {
  return `
  <dialog class="settings-dialog" id="word-settings-dialog" aria-labelledby="word-settings-title">
    <form method="dialog" class="settings-dialog-inner">
      <header class="settings-dialog-header">
        <h2 class="settings-dialog-title" id="word-settings-title">Настройки прогресса</h2>
        <button type="submit" class="btn-icon btn-dialog-close" aria-label="Закрыть">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </header>
      <div class="settings-dialog-body">
        <button type="button" class="btn btn-secondary btn-reset-word" id="btn-reset-word">Сбросить слово</button>
      </div>
    </form>
  </dialog>`;
}

export function deckSettingsDialogMarkup(maxWords: number): string {
  return `
  <dialog class="settings-dialog" id="deck-settings-dialog" aria-labelledby="deck-settings-title">
    <form method="dialog" class="settings-dialog-inner">
      <header class="settings-dialog-header">
        <h2 class="settings-dialog-title" id="deck-settings-title">Настройки прогресса</h2>
        <button type="submit" class="btn-icon btn-dialog-close" aria-label="Закрыть">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </header>
      <div class="settings-dialog-body">
        <label class="settings-field">
          <span>Начальная группа</span>
          <input type="number" id="setting-initial-batch" min="1" max="30" value="5">
        </label>
        <label class="settings-field">
          <span>Активных слов</span>
          <input type="number" id="setting-active-limit" min="1" max="${maxWords}" value="5">
        </label>
        <p class="settings-hint">При выучивании слова в набор автоматически добавляется новое. Старые повторяются реже, но по расписанию SRS.</p>
        <div class="settings-actions">
          <button type="button" class="btn btn-secondary" id="btn-save-settings">Сохранить</button>
          <button type="button" class="btn btn-secondary" id="btn-reset-deck">Сбросить прогресс</button>
        </div>
      </div>
    </form>
  </dialog>`;
}

export function examplesDialogMarkup(): string {
  return `
  <dialog class="settings-dialog examples-dialog" id="examples-dialog" aria-labelledby="examples-dialog-title">
    <div class="settings-dialog-inner">
      <header class="settings-dialog-header">
        <h2 class="settings-dialog-title" id="examples-dialog-title">Примеры</h2>
        <button type="button" class="btn-icon btn-dialog-close" id="btn-close-examples" aria-label="Закрыть">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </header>
      <div class="settings-dialog-body examples-dialog-body" id="examples-dialog-body"></div>
    </div>
  </dialog>`;
}

export function homeSettingsDialogMarkup(): string {
  return `
  <dialog class="settings-dialog" id="home-settings-dialog" aria-labelledby="home-settings-title">
    <form method="dialog" class="settings-dialog-inner">
      <header class="settings-dialog-header">
        <h2 class="settings-dialog-title" id="home-settings-title">Настройки</h2>
        <button type="submit" class="btn-icon btn-dialog-close" aria-label="Закрыть">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </header>
      <div class="settings-dialog-body">
        <label class="settings-field">
          <span>Слов в группе</span>
          <input type="number" id="home-setting-group-size" min="1" max="30" value="5">
        </label>
        <p class="settings-hint">Сколько слов одновременно в активном наборе. При выучивании слова в набор добавляется новое.</p>
        <div class="settings-actions">
          <button type="button" class="btn btn-secondary" id="btn-save-home-settings">Сохранить</button>
        </div>
        <hr class="settings-divider">
        <div class="pwa-install-section" id="pwa-install-section" hidden>
          <button type="button" class="btn btn-secondary" id="btn-install-app">Установить приложение</button>
          <p class="settings-hint" id="pwa-install-hint">Добавьте Greek3 на главный экран для быстрого доступа и офлайн-режима.</p>
        </div>
        <hr class="settings-divider">
        <button type="button" class="btn btn-secondary btn-reset-all" id="btn-reset-all-progress">Сбросить весь прогресс</button>
        <p class="settings-hint">Удалит все данные о выученных словах и начнёт обучение сначала.</p>
      </div>
    </form>
  </dialog>`;
}

export function copyWordsToolbarMarkup(): string {
  return `
    <div class="copy-words-toolbar fade-in" role="group" aria-label="Копировать слова для AI-практики">
      <button type="button" class="btn btn-secondary btn-copy-words" data-copy-mode="studied" title="Скопировать слова в работе и выученные">
        <span class="btn-copy-icon" aria-hidden="true">📋</span> В работе
      </button>
      <button type="button" class="btn btn-secondary btn-copy-words" data-copy-mode="all" title="Скопировать все слова раздела">
        <span class="btn-copy-icon" aria-hidden="true">📋</span> Все
      </button>
      <span class="copy-words-feedback" id="copy-words-feedback" role="status" aria-live="polite"></span>
    </div>`;
}

const FAVORITE_ICON = `<svg class="favorite-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path class="favorite-icon-outline" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="none" stroke="currentColor" stroke-width="1.75"/>
  <path class="favorite-icon-filled" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor" stroke="none"/>
</svg>`;

export function favoriteButtonMarkup(options: {
  kind: 'word' | 'section' | 'page';
  id: string;
  label: string;
  className?: string;
}): string {
  const extraClass = options.className ? ` ${options.className}` : '';
  return `<button type="button" class="btn-favorite${extraClass}" data-favorite-kind="${escapeHtml(options.kind)}" data-favorite-id="${escapeHtml(options.id)}" data-favorite-label="${escapeHtml(options.label)}" aria-pressed="false" aria-label="Добавить в избранное: ${escapeHtml(options.label)}" title="Добавить в избранное">${FAVORITE_ICON}</button>`;
}