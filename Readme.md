# Greek3

Сайт для изучения и практики современного греческого языка.

Контент хранится в Markdown (`words/`), при сборке генерируются интерактивные HTML-страницы с карточками и режимом практики.

## Быстрый старт

```bash
npm install
npm run dev        # сборка + локальный сервер http://localhost:3000
npm run build:site # только сборка в dist/
```

## Структура

- `words/` — исходные MD-файлы (слова, формы)
- `site/` — CSS и JS
- `src/build/` — генератор статического сайта
- `agents/` — документация для AI-агентов
- `dist/` — результат сборки (не коммитится)

## Добавление слова

1. Создайте `words/<категория>/<имя>.md` — см. формат в `agents/MD_FORMAT.md`
2. Добавьте ссылку в `readme.md` категории
3. Запустите `npm run build:site`

## Публикация

Push в `main` → GitHub Action собирает и публикует на **GitHub Pages**.

Настройки репозитория: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

CI автоматически задаёт `SITE_BASE_URL=/<имя-репозитория>` (для этого проекта: `/Greek3`).

Локальная разработка:

```bash
npm run dev          # сборка + http://localhost:3000/
npm run dev:pages    # как на GitHub Pages → http://localhost:3000/Greek3/
```

## Разделы

- [Словарь](words/readme.md)
- [Глаголы](words/verbs/readme.md)
- [Существительные](words/nouns/readme.md)
- [Прилагательные](words/adjectives/readme.md)
- [Местоимения](words/pronouns/readme.md)
- [Числа](words/numbers/readme.md)
- [Падежи](words/cases/readme.md)
- [Частицы](words/particles/readme.md)
- [Фразы](words/phrases/readme.md)
- [Темы](words/topics/readme.md) — генерируются при сборке
- [Уровни](words/levels/readme.md) — генерируются при сборке
