import type { EssayPair, EssayTopic } from '../../types';
import { renderMarkdown } from '../../markdown';
import { escapeHtml } from '../html';
import { layout } from '../layout';

function speakButton(text: string): string {
  return `<button type="button" class="essay-speak" data-speak-text="${escapeHtml(text)}" aria-label="Озвучить">
      <span aria-hidden="true">🔊</span>
    </button>`;
}

function pairRow(pair: EssayPair, extraClass = ''): string {
  return `
        <div class="essay-pair${extraClass ? ` ${extraClass}` : ''}">
          <div class="essay-pair-greek">
            <span class="greek">${escapeHtml(pair.greek)}</span>
            ${speakButton(pair.greek)}
          </div>
          <p class="essay-pair-ru">${escapeHtml(pair.translation)}</p>
        </div>`;
}

function questionsSection(topic: EssayTopic): string {
  if (!topic.questions.length) return '';
  const items = topic.questions.map((q) => pairRow(q, 'essay-pair--question')).join('');
  return `
      <section class="essay-section fade-in">
        <h2>Вопросы для сочинения</h2>
        <p class="essay-section-note">Ответьте на вопросы по порядку — получится готовое сочинение.</p>
        <div class="essay-pairs essay-pairs--questions">${items}</div>
      </section>`;
}

function vocabSection(topic: EssayTopic): string {
  if (!topic.vocab.length) return '';
  const items = topic.vocab.map((v) => pairRow(v)).join('');
  return `
      <section class="essay-section fade-in">
        <h2>Ключевая лексика</h2>
        <div class="essay-pairs essay-pairs--grid">${items}</div>
      </section>`;
}

function phrasesSection(topic: EssayTopic): string {
  if (!topic.phrases.length) return '';
  const items = topic.phrases.map((p) => pairRow(p)).join('');
  return `
      <section class="essay-section fade-in">
        <h2>Ключевые фразы и конструкции</h2>
        <div class="essay-pairs">${items}</div>
      </section>`;
}

function examplesSection(topic: EssayTopic): string {
  if (!topic.examples.length) return '';
  const samples = topic.examples
    .map((ex) => {
      const plain = ex.body.replace(/\s+/g, ' ').trim();
      return `
        <article class="essay-sample">
          <div class="essay-sample-head">
            <span class="word-badge word-badge--level">${escapeHtml(ex.level)}</span>
            <button type="button" class="essay-speak essay-sample-speak" data-speak-text="${escapeHtml(plain)}">
              <span aria-hidden="true">🔊</span> Озвучить
            </button>
          </div>
          <div class="essay-sample-body greek">${renderMarkdown(ex.body)}</div>
        </article>`;
    })
    .join('');
  return `
      <section class="essay-section fade-in">
        <h2>Примеры сочинений</h2>
        <p class="essay-section-note">От простого к сложному — образцы для разных уровней CEFR.</p>
        <div class="essay-samples">${samples}</div>
      </section>`;
}

export function renderEssay(
  topic: EssayTopic,
  breadcrumbs: { label: string; href?: string }[],
): string {
  const levelBadge = topic.level
    ? `<span class="word-badge word-badge--level">${escapeHtml(topic.level)}</span>`
    : '';
  const intro = topic.intro
    ? `<p class="page-intro">${escapeHtml(topic.intro).replace(/\n/g, '<br>')}</p>`
    : '';

  const content = `
    <article class="essay-page">
      <header class="page-head fade-in">
        <div class="page-head-row">
          <h1>${escapeHtml(topic.title)}</h1>
          ${levelBadge}
        </div>
        ${intro}
      </header>
      ${questionsSection(topic)}
      ${vocabSection(topic)}
      ${phrasesSection(topic)}
      ${examplesSection(topic)}
    </article>`;

  return layout(content, topic.title, breadcrumbs, ['assets/js/essays.js']);
}
