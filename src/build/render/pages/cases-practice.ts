import { sitePath } from '../../site-path';
import { escapeHtml, embedJson } from '../html';
import { layout } from '../layout';

export function renderCasesPractice(
  gameData: unknown,
  breadcrumbs: { label: string; href?: string }[],
): string {
  const gameJson = `<script type="application/json" id="cases-game-data">${embedJson(gameData)}</script>`;

  const content = `
    <section class="cases-practice-page" id="cases-practice-page" aria-label="Тренировка падежей">
      <div class="cases-practice-toolbar">
        <button type="button" class="practice-pool-progress cases-progress-toggle progress-toggle" id="cases-progress-toggle" aria-label="Прогресс по падежам" aria-expanded="false">
          <span class="cases-progress-summary">
            <span class="cases-progress-stat">
              <span class="progress-swatch progress-swatch--active" aria-hidden="true"></span>
              <span class="cases-progress-stat-value" id="cases-progress-studying">0</span>
              <span class="cases-progress-stat-label">в работе</span>
            </span>
            <span class="cases-progress-grid" id="cases-progress-grid" role="list" aria-hidden="true"></span>
            <span class="cases-progress-stat">
              <span class="progress-swatch progress-swatch--total" aria-hidden="true"></span>
              <span class="cases-progress-stat-value" id="cases-progress-total">0</span>
              <span class="cases-progress-stat-label">всего</span>
            </span>
          </span>
        </button>
        <p class="cases-practice-score">Счёт: <span id="cases-session-score">0 / 0</span></p>
      </div>

      <div class="progress-fullscreen cases-progress-fullscreen" id="cases-progress-fullscreen" hidden aria-hidden="true">
        <div class="progress-fullscreen-toolbar">
          <button type="button" class="progress-fullscreen-close" id="cases-progress-fullscreen-close" aria-label="Свернуть прогресс">← Назад</button>
          <h2 class="progress-fullscreen-title">Прогресс по падежам</h2>
        </div>
        <div class="progress-fullscreen-legend cases-progress-legend">
          <span class="practice-pool-label"><span class="progress-swatch progress-swatch--learned" aria-hidden="true"></span><span id="cases-legend-mastered">0 усвоено</span></span>
          <span class="practice-pool-label"><span class="progress-swatch progress-swatch--active" aria-hidden="true"></span><span id="cases-legend-learning">0 в работе</span></span>
          <span class="practice-pool-label"><span class="progress-swatch progress-swatch--new" aria-hidden="true"></span><span id="cases-legend-new">0 новых</span></span>
          <span class="practice-pool-label"><span class="progress-swatch progress-swatch--current" aria-hidden="true"></span><span>сейчас</span></span>
        </div>
        <div class="cases-progress-detail" id="cases-progress-detail" role="list"></div>
      </div>

      <div class="cases-practice-card fade-in">
        <p class="cases-game-prompt-label" id="cases-task-label">—</p>
        <p class="cases-context-ru hidden" id="cases-task-ru" hidden></p>
        <p class="cases-game-prompt" id="cases-task-prompt">—</p>
        <div class="cases-game-options" id="cases-task-options"></div>

        <div class="cases-review-match" id="cases-task-match" hidden>
          <div class="cases-review-match-cols">
            <div class="cases-review-match-col">
              <span class="cases-review-match-col-label" id="cases-match-col-left">Греческий</span>
              <div class="cases-review-match-list" id="cases-match-left"></div>
            </div>
            <div class="cases-review-match-col">
              <span class="cases-review-match-col-label" id="cases-match-col-right">Русский</span>
              <div class="cases-review-match-list" id="cases-match-right"></div>
            </div>
          </div>
        </div>

        <p class="cases-game-feedback" id="cases-task-feedback" hidden></p>
        <div class="cases-game-actions">
          <button type="button" class="btn btn-primary" id="cases-task-next" hidden>Дальше →</button>
          <button type="button" class="btn btn-secondary" id="cases-task-again" hidden>Новый раунд</button>
        </div>
      </div>

      <a href="${escapeHtml(sitePath('words/cases/index.html'))}" class="btn btn-secondary cases-practice-back">← К падежам</a>
      ${gameJson}
    </section>`;

  return layout(content, 'Тренировка падежей', breadcrumbs, ['assets/js/cases-practice.js']);
}
