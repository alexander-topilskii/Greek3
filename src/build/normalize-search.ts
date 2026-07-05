/** Нормализация строки для поиска: регистр, ударения, ё → е. */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/ё/g, 'е');
}
