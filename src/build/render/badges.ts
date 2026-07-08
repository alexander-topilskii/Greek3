import { RECORD_TYPE_LABELS } from '../constants';
import type { CatalogWord, WordEntry } from '../types';
import { escapeHtml } from './html';

export function renderBadges(word: CatalogWord | undefined): string {
  if (!word) return '';
  const parts: string[] = [];
  if (word.level) {
    parts.push(`<span class="word-badge word-badge--level">${escapeHtml(word.level)}</span>`);
  }
  if (word.recordType) {
    const label = RECORD_TYPE_LABELS[word.recordType] ?? word.recordType;
    parts.push(`<span class="word-badge word-badge--type">${escapeHtml(label)}</span>`);
  }
  for (const topic of word.topics.slice(0, 2)) {
    parts.push(`<span class="word-badge word-badge--topic">${escapeHtml(topic)}</span>`);
  }
  if (!parts.length) return '';
  return `<div class="word-link-badges">${parts.join('')}</div>`;
}

export function renderMetaBadges(word: WordEntry): string {
  const parts: string[] = [];
  if (word.meta.level) {
    parts.push(`<span class="word-badge word-badge--level">${escapeHtml(word.meta.level)}</span>`);
  }
  if (word.meta.recordType) {
    const label = RECORD_TYPE_LABELS[word.meta.recordType] ?? word.meta.recordType;
    parts.push(`<span class="word-badge word-badge--type">${escapeHtml(label)}</span>`);
  }
  for (const topic of word.meta.topics.slice(0, 3)) {
    parts.push(`<span class="word-badge word-badge--topic">${escapeHtml(topic)}</span>`);
  }
  if (!parts.length) return '';
  return `<div class="word-header-badges">${parts.join('')}</div>`;
}