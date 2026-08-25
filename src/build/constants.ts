export const CATEGORY_LABELS: Record<string, string> = {
  verbs: 'Глаголы',
  nouns: 'Существительные',
  adjectives: 'Прилагательные',
  pronouns: 'Местоимения',
  numbers: 'Числа',
  cases: 'Падежи и управление',
  particles: 'Частицы',
  phrases: 'Фразы',
  lessons: 'Уроки',
  essays: 'Сочинения',
  topics: 'Темы',
  levels: 'Уровни',
};

export const RECORD_TYPE_LABELS: Record<string, string> = {
  verb: 'глагол',
  noun: 'сущ.',
  adjective: 'прил.',
  pronoun: 'мест.',
  number: 'число',
  case: 'падеж',
  particle: 'част.',
  phrase: 'фраза',
  word: 'слово',
};

export const HOME_SECTIONS = [
  { title: 'Уроки', href: 'words/lessons/index.html', description: 'Слова по занятиям с репетитором' },
  { title: 'Глаголы', href: 'words/verbs/index.html', description: 'Спряжения, времена и формы' },
  { title: 'Существительные', href: 'words/nouns/index.html', description: 'Род, число и падежные формы' },
  { title: 'Прилагательные', href: 'words/adjectives/index.html', description: 'Согласование и степени сравнения' },
  { title: 'Местоимения', href: 'words/pronouns/index.html', description: 'Личные, притяжательные и указательные' },
  { title: 'Фразы', href: 'words/phrases/index.html', description: 'Устойчивые выражения и обороты' },
  { title: 'Числа', href: 'words/numbers/index.html', description: 'Количественные и порядковые' },
  { title: 'Падежи и управление', href: 'words/cases/index.html', description: 'Падежи, управление глаголов и практика' },
  { title: 'Частицы', href: 'words/particles/index.html', description: 'Связки для письма: и, но, поэтому, потом…' },
  { title: 'Сочинения', href: 'words/essays/index.html', description: 'Темы для письма: вопросы, лексика и образцы' },
  { title: 'Темы', href: 'words/topics/index.html', description: 'Группировка по темам из метаданных' },
  { title: 'Уровни', href: 'words/levels/index.html', description: 'A1 → B2 по шкале CEFR' },
] as const;
