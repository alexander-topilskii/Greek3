import type { WordEntry } from '../../types';
import type { BookChapter } from '../../parse-book';
import { normalizeSearchText } from '../../normalize-search';
import { RECORD_TYPE_LABELS } from '../../constants';
import { escapeHtml } from '../html';
import { layout } from '../layout';
import { sitePath } from '../../site-path';
import { wordOutputPath } from '../paths-catalog';

interface WordLookupItem {
  slug: string;
  translation: string;
  category: string;
  priority: number;
}

const FALLBACK_GRAMMAR_WORDS: Record<string, { translation: string; category: string }> = {
  'και': { translation: 'и / также', category: 'союз' },
  'κι': { translation: 'и', category: 'союз' },
  'αλλά': { translation: 'но / однако', category: 'союз' },
  'όμως': { translation: 'однако / но', category: 'союз' },
  'σε': { translation: 'в / на', category: 'предлог' },
  'στο': { translation: 'в / на (с.р.)', category: 'предлог' },
  'στη': { translation: 'в / на (ж.р.)', category: 'предлог' },
  'στην': { translation: 'в / на (ж.р.)', category: 'предлог' },
  'στον': { translation: 'в / на (м.р.)', category: 'предлог' },
  'στα': { translation: 'в / на (мн.ч.)', category: 'предлог' },
  'στους': { translation: 'в / на (мн.ч. м.р.)', category: 'предлог' },
  'στις': { translation: 'в / на (мн.ч. ж.р.)', category: 'предлог' },
  'με': { translation: 'с / вместе с', category: 'предлог' },
  'για': { translation: 'для / о', category: 'предлог' },
  'από': { translation: 'из / от', category: 'предлог' },
  'δεν': { translation: 'не', category: 'част.' },
  'δε': { translation: 'не', category: 'част.' },
  'μην': { translation: 'не (с глаголами)', category: 'част.' },
  'να': { translation: 'чтобы / частица сослагательного', category: 'част.' },
  'θα': { translation: 'частица будущего времени', category: 'част.' },
  'ο': { translation: 'он / опред. артикль (м.р.)', category: 'артикль' },
  'η': { translation: 'она / опред. артикль (ж.р.)', category: 'артикль' },
  'το': { translation: 'оно / опред. артикль (с.р.)', category: 'артикль' },
  'τον': { translation: 'его / артикль вин.п. (м.р.)', category: 'артикль' },
  'την': { translation: 'её / артикль вин.п. (ж.р.)', category: 'артикль' },
  'οι': { translation: 'они / артикль им.п. мн.ч.', category: 'артикль' },
  'τα': { translation: 'они / артикль им./вин.п. с.р.', category: 'артикль' },
  'τους': { translation: 'их / артикль вин.п. мн.ч.', category: 'артикль' },
  'τις': { translation: 'их / артикль вин.п. ж.р.', category: 'артикль' },
  'των': { translation: 'их / артикль род.п. мн.ч.', category: 'артикль' },
  'του': { translation: 'его / артикль род.п.', category: 'артикль' },
  'της': { translation: 'её / артикль род.п.', category: 'артикль' },
  'ένα': { translation: 'один / неопред. артикль', category: 'артикль' },
  'ένας': { translation: 'один / неопред. артикль', category: 'артикль' },
  'μια': { translation: 'одна / неопред. артикль', category: 'артикль' },
  'μου': { translation: 'мой / моя / мне', category: 'мест.' },
  'σου': { translation: 'твой / твоя / тебе', category: 'мест.' },
  'μας': { translation: 'наш / наша / нам', category: 'мест.' },
  'σας': { translation: 'ваш / ваша / вам', category: 'мест.' },
  'νιάου': { translation: 'мяу', category: 'звукоподражание' },
  'πιτ': { translation: 'Пит (рыжий кот)', category: 'имя' },
  'πετρόνιος': { translation: 'Петроний (полное имя кота)', category: 'имя' },
  'νταν': { translation: 'Дэн (Дэниел, инженер)', category: 'имя' },
  'ντάνιελ': { translation: 'Дэниел (Дэн)', category: 'имя' },
  'μάιλς': { translation: 'Майлс (партнёр)', category: 'имя' },
  'μπέλα': { translation: 'Белла (секретарь)', category: 'имя' },
  'σάλι': { translation: 'Салли (робот)', category: 'имя' },
  'κονέκτικατ': { translation: 'Коннектикут', category: 'имя' },
  'λος': { translation: 'Лос', category: 'имя' },
  'άντζελες': { translation: 'Анджелес', category: 'имя' },
  'τσάρλι': { translation: 'Чарли', category: 'имя' },
  'φρεντερίκα': { translation: 'Фредерика (Рикки)', category: 'имя' },
  'ρίκι': { translation: 'Рикки', category: 'имя' },
  'τζον': { translation: 'Джон', category: 'имя' },
  'τζέικ': { translation: 'Джейк', category: 'имя' },
};

function cleanToken(token: string): string {
  return token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function stripArticle(text: string): string {
  return text.replace(/^(ο|η|το|οι|τα|τον|την|του|της|των|τους|τις)\s+/i, '');
}

function categoryRank(cat: string): number {
  const ranks: Record<string, number> = {
    verbs: 1,
    nouns: 2,
    adjectives: 3,
    adverbs: 4,
    pronouns: 5,
    particles: 6,
    phrases: 10,
  };
  return ranks[cat] ?? 8;
}

export function buildReaderWordMap(words: WordEntry[]): Map<string, WordLookupItem> {
  const map = new Map<string, WordLookupItem>();

  function register(key: string, slug: string, translation: string, category: string, priority: number) {
    if (!key) return;
    const existing = map.get(key);
    if (
      !existing ||
      priority < existing.priority ||
      (priority === existing.priority && categoryRank(category) < categoryRank(existing.category))
    ) {
      map.set(key, { slug, translation, category, priority });
    }
  }

  for (const w of words) {
    const slug = w.slug;
    const translation = w.translation || '';
    const catName = w.category || '';

    const defs = [
      { text: stripArticle(w.primaryGreek || ''), tr: translation },
      ...w.baseForms.map((bf) => ({ text: stripArticle(bf), tr: translation })),
      ...w.forms.map((f) => ({ text: stripArticle(f.greek || ''), tr: f.translation || translation })),
    ];

    for (const item of defs) {
      for (const rawTok of item.text.split(/\s+/)) {
        const tok = cleanToken(rawTok);
        if (!tok || !/[\u0370-\u03ff\u1f00-\u1fff]/i.test(tok)) continue;
        const key = normalizeSearchText(tok);
        register(key, slug, item.tr, catName, 1);

        if (catName === 'nouns') {
          if (key.endsWith('ας') || key.endsWith('ης') || key.endsWith('ος')) {
            const stem = key.slice(0, -2);
            register(stem + 'α', slug, translation, catName, 2);
            register(stem + 'ο', slug, translation, catName, 2);
            register(stem + 'ες', slug, translation, catName, 2);
            register(stem + 'ους', slug, translation, catName, 2);
          }
        }

        if (catName === 'adjectives') {
          if (key.endsWith('ος')) {
            const stem = key.slice(0, -2);
            register(stem + 'α', slug, translation, catName, 2);
            register(stem + 'η', slug, translation, catName, 2);
            register(stem + 'ο', slug, translation, catName, 2);
            register(stem + 'οι', slug, translation, catName, 2);
            register(stem + 'ες', slug, translation, catName, 2);
            register(stem + 'ους', slug, translation, catName, 2);
          }
        }
      }
    }

    if (w.paradigm) {
      const conj = w.paradigm.conjugations;
      for (const t of Object.values(conj)) {
        if (!t) continue;
        for (const forms of Object.values(t)) {
          if (!forms) continue;
          for (const form of forms) {
            if (!form) continue;
            for (const rawTok of form.split(/\s+/)) {
              const tok = cleanToken(rawTok);
              if (!tok || !/[\u0370-\u03ff\u1f00-\u1fff]/i.test(tok)) continue;
              const key = normalizeSearchText(tok);
              register(key, slug, translation, 'verbs', 2);
            }
          }
        }
      }
    }
  }

  // Examples (fallback)
  for (const w of words) {
    const slug = w.slug;
    const translation = w.translation || '';
    const catName = w.category || '';
    for (const ex of w.forms) {
      for (const rawTok of (ex.greek || '').split(/\s+/)) {
        const tok = cleanToken(rawTok);
        if (!tok || !/[\u0370-\u03ff\u1f00-\u1fff]/i.test(tok)) continue;
        const key = normalizeSearchText(tok);
        register(key, slug, translation, catName, 4);
      }
    }
  }

  return map;
}

function wrapGreekSentenceWords(text: string, lookup: Map<string, WordLookupItem>): string {
  const tokens = text.split(/([\u0370-\u03ff\u1f00-\u1fff]+)/gi);
  return tokens
    .map((part) => {
      if (!/[\u0370-\u03ff\u1f00-\u1fff]/.test(part)) {
        return escapeHtml(part);
      }
      const raw = part;
      const key = normalizeSearchText(raw);

      let slug = '';
      let translation = '';
      let catLabel = '';
      let href = '';

      if (FALLBACK_GRAMMAR_WORDS[key]) {
        const fb = FALLBACK_GRAMMAR_WORDS[key];
        translation = fb.translation;
        catLabel = fb.category;
        const match = lookup.get(key);
        if (
          match &&
          (match.category === 'pronouns' ||
            match.category === 'particles' ||
            match.category === 'numbers' ||
            match.category === 'verbs')
        ) {
          slug = match.slug;
          href = sitePath(wordOutputPath(match.slug));
        }
      } else {
        const match = lookup.get(key);
        if (match) {
          slug = match.slug;
          translation = match.translation;
          catLabel = RECORD_TYPE_LABELS[match.category] || match.category;
          href = sitePath(wordOutputPath(match.slug));
        }
      }

      return `<span class="reader-word" data-greek="${escapeHtml(raw)}" data-translation="${escapeHtml(
        translation,
      )}" data-category="${escapeHtml(catLabel)}" data-href="${escapeHtml(href)}">${escapeHtml(raw)}</span>`;
    })
    .join('');
}

export function renderBookChapter(
  chapter: BookChapter,
  words: WordEntry[],
  breadcrumbs: { label: string; href?: string }[],
  nav?: { prev?: { href: string; label: string }; next?: { href: string; label: string } },
): string {
  const lookup = buildReaderWordMap(words);

  const scenesHtml = chapter.scenes
    .map((scene) => {
      const parasHtml = scene.paragraphs
        .map((p) => {
          const wrappedGreek = wrapGreekSentenceWords(p.greek, lookup);
          return `
          <article class="reader-paragraph" id="para-${p.index}" data-index="${p.index}">
            <div class="reader-para-header">
              <span class="reader-para-num">#${p.index}</span>
              <div class="reader-para-actions">
                <button type="button" class="reader-para-btn btn-para-speak" aria-label="Озвучить" title="Озвучить абзац">🔊</button>
                <button type="button" class="reader-para-btn btn-para-check" aria-label="Отметить как прочитано" title="Отметить как прочитано">✓</button>
              </div>
            </div>
            <div class="reader-greek">${wrappedGreek}</div>
            <div class="reader-ru" title="Нажмите, чтобы показать/скрыть перевод">
              <div class="reader-ru-hint">
                <span aria-hidden="true">👁️</span>
                <span>Нажмите, чтобы увидеть перевод</span>
              </div>
              <p class="reader-ru-text">${escapeHtml(p.russian)}</p>
            </div>
          </article>`;
        })
        .join('');

      return `
      <section class="reader-scene">
        <header class="reader-scene-header">
          <h2 class="reader-scene-title">${escapeHtml(scene.title)}</h2>
        </header>
        <div class="reader-scene-body">
          ${parasHtml}
        </div>
      </section>`;
    })
    .join('');

  const content = `
  <main class="reader-page mode-reveal" data-book-id="${escapeHtml(chapter.bookId)}" data-chapter-id="${escapeHtml(
    chapter.chapterId,
  )}">
    <header class="reader-hero">
      <div class="reader-badge-wrap">
        <span class="reader-badge reader-badge--level">${escapeHtml(chapter.level)}</span>
        <span class="reader-badge">100% словарь Greek3</span>
      </div>
      <h1 class="reader-title">${escapeHtml(chapter.bookTitle)}</h1>
      <p class="reader-subtitle">${escapeHtml(chapter.chapterTitle)}</p>
    </header>

    <div class="reader-resume-banner" id="reader-resume-banner">
      <span>Вы остановились на абзаце #<strong id="resume-para-num">1</strong></span>
      <button type="button" class="reader-resume-btn" id="btn-resume-reading">Продолжить чтение →</button>
    </div>

    <!-- Sticky Toolbar -->
    <div class="reader-controls">
      <div class="reader-controls-top">
        <div class="reader-btn-group">
          <button type="button" class="reader-tool-btn is-active" id="btn-mode-reveal" title="По клику на строку">👁️ По клику</button>
          <button type="button" class="reader-tool-btn" id="btn-mode-parallel" title="Параллельный текст">📖 Параллельно</button>
        </div>
        <div class="reader-btn-group">
          <button type="button" class="reader-tool-btn" id="btn-font-smaller" title="Уменьшить шрифт">A−</button>
          <button type="button" class="reader-tool-btn" id="btn-font-larger" title="Увеличить шрифт">A+</button>
        </div>
      </div>
      <div class="reader-progress-info">
        <div class="reader-progress-track">
          <div class="reader-progress-fill" id="reader-progress-fill"></div>
        </div>
        <span id="reader-progress-text">0 / ${chapter.totalParagraphs} (0%)</span>
      </div>
    </div>

    <!-- Chapter Content -->
    <div class="reader-content">
      ${scenesHtml}
    </div>

    <!-- Chapter Navigation -->
    <nav class="reader-nav-footer">
      ${
        nav?.prev
          ? `<a href="${nav.prev.href}" class="btn btn-secondary">← ${escapeHtml(nav.prev.label)}</a>`
          : `<a href="${sitePath('books/index.html')}" class="btn btn-secondary">← Все книги</a>`
      }
      <span class="text-muted">${escapeHtml(chapter.chapterTitle)}</span>
      ${
        nav?.next
          ? `<a href="${nav.next.href}" class="btn btn-primary">${escapeHtml(nav.next.label)} →</a>`
          : `<a href="${sitePath('books/index.html')}" class="btn btn-secondary">В каталог книг →</a>`
      }
    </nav>

    <!-- Floating Word Tooltip / Card -->
    <div class="reader-popup" id="reader-popup" role="dialog" aria-modal="false">
      <div class="reader-popup-header">
        <div class="reader-popup-greek" id="reader-popup-greek">λέξη</div>
        <button type="button" class="reader-popup-close" id="reader-popup-close" aria-label="Закрыть">×</button>
      </div>
      <div class="reader-popup-body">
        <div class="reader-popup-trans" id="reader-popup-trans">перевод</div>
        <div class="reader-popup-meta">
          <span id="reader-popup-category"></span>
        </div>
      </div>
      <div class="reader-popup-footer">
        <button type="button" class="reader-popup-speak-btn" id="reader-popup-speak">
          <span aria-hidden="true">🔊</span> Произнести
        </button>
        <a href="#" class="reader-popup-card-link" id="reader-popup-card-link">Карточка слова →</a>
      </div>
    </div>
  </main>`;

  return layout(content, `${chapter.chapterTitle} · ${chapter.bookTitle}`, breadcrumbs, ['assets/js/reader.js']);
}
