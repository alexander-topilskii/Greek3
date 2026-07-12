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
        <div class="cases-progress-panel">
          <div class="cases-progress-panel-head">
            <p class="cases-progress-overall">
              Прогресс: <span id="cases-progress-percent">0%</span>
            </p>
            <button type="button" class="cases-progress-expand progress-toggle" id="cases-progress-toggle" aria-label="Развернуть прогресс" aria-expanded="false">⋯</button>
          </div>
          <div class="cases-progress-board" id="cases-progress-board" role="img" aria-label="Прогресс по падежам"></div>
        </div>
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
          <span class="practice-pool-label cases-progress-legend-swatch"><span class="cases-progress-legend-sample" aria-hidden="true"></span><span>заполнение</span></span>
          <span class="practice-pool-label"><span class="progress-swatch progress-swatch--current" aria-hidden="true"></span><span>сейчас</span></span>
        </div>
        <p class="cases-progress-skill-hint">В каждой группе: формы · ελ→ру · ру→ελ</p>
        <div class="cases-progress-board cases-progress-board--detail" id="cases-progress-detail-board" role="img" aria-label="Детальный прогресс по падежам"></div>
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
