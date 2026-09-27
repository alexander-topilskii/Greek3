/**
 * В «База» формы глагола хранятся как прош. - наст. - буд.
 * На карточках и в блоке сводки показываем: наст. → прош. → буд.
 */
export function verbBaseFormsForDisplay(baseForms: string[]): string[] {
  if (baseForms.length < 3) return baseForms;
  return [baseForms[1], baseForms[0], baseForms[2]];
}
