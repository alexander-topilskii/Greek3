/** Разбивает греческую строку песни на отдельные слова (поверхностные формы). */
export function tokenizeGreekLine(text: string): string[] {
  return text
    .split(/\s+/)
    .map((word) =>
      word.replace(/^[.,;:!?«»""''()[\]{}…·]+|[.,;:!?«»""''()[\]{}…·]+$/g, ''),
    )
    .filter(Boolean);
}
