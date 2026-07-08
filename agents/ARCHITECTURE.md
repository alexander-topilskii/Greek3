# Архитектура

## Поток данных

```
words/**/*.md  ──►  src/build/  ──►  dist/**/*.html
site/css,js    ──►  (копирование) ──►  dist/assets/
```

## Генератор (`src/build/`)

| Модуль | Роль |
|--------|------|
| `index.ts` | Точка входа: сканирует `words/`, рендерит страницы, копирует ассеты |
| `constants.ts` | `CATEGORY_LABELS`, `HOME_SECTIONS`, `RECORD_TYPE_LABELS` |
| `fs.ts` | `walkMdFiles`, `copyDir`, `buildMainCss`, запись HTML/JSON |
| `catalog-build.ts` | Сборка глобального каталога, topic/level страницы |
| `breadcrumbs.ts` | Хлебные крошки |
| `render/` | Шаблоны: `layout.ts`, `fragments.ts`, `pages/*` |
| `parse-word.ts` | Парсит MD-файлы слов (секции «База», «Формы») |
| `parse-index.ts` | Парсит `readme.md` — оглавления разделов |
| `types.ts` | TypeScript-типы для контента |

## Клиентский JS (`site/js/`)

| Модуль | Роль |
|--------|------|
| `utils.js` | `escapeHtml`, `shuffle` |
| `practice-common.js` | Общая логика grading/display для home/list practice |
| `srs-schedule.js` / `srs-session.js` / `srs-pick.js` / `srs-progress.js` | Части SRS; фасад — `srs.js` |
| `normalize-search.js` | Нормализация запроса поиска (синхронно с `normalize-search.ts`) |

## CSS

Части в `site/css/parts/`; при сборке конкатенируются в `main.css` (`buildMainCss` в `fs.ts`).

## Интерактив на страницах слов

Клиентский JS (`site/js/practice.js`):

- **Карточки** — переворот (греческий ↔ перевод)
- **Практика** — случайная форма, ввод перевода, проверка
- **Таблица форм** — раскрытие строк с анимацией

## Дизайн-система

- CSS-переменные в `site/css/main.css`
- Mobile-first: базовые стили для узких экранов, `@media (min-width: 640px)` для планшета/десктопа
- Шрифты: DM Sans (UI) + Noto Sans (греческий текст) через Google Fonts
- Палитра: тёплый белый фон, синий акцент (#2563eb), мягкие тени

## Навигация

Все ссылки генерируются через `sitePath()` — абсолютные пути от корня с `encodeURIComponent` на каждый сегмент. Это нужно, потому что при URL вида `/words/verbs` (без `/index.html`) браузер ломает относительные ссылки вроде `закрываю κλείνω.html`.

Для GitHub Pages project site: `SITE_BASE_URL=/Greek3 npm run build:site`

## Расширение

1. Добавить MD в `words/<категория>/`
2. Обновить `readme.md` категории ссылкой на новый файл
3. `npm run build:site` — страница появится автоматически

Новые типы контента: расширить `parse-word.ts` и шаблон в `render.ts`.
