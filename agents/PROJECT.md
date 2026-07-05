# Greek3 — обзор проекта

## Назначение

Сайт для изучения и практики современного греческого языка. Контент (слова, формы, грамматика) хранится в Markdown-файлах; при сборке из них генерируются интерактивные HTML-страницы.

## Ключевые требования

| # | Требование |
|---|------------|
| 1 | Светлая тема |
| 2 | Анимации (плавные переходы, микро-интерактив) |
| 3 | Современный UI |
| 4 | Mobile-first, адаптивная вёрстка |
| 5 | Тематика — греческий язык |
| 6 | База слов задаётся в `.md` |
| 7 | GitHub Actions собирает и публикует сайт на GitHub Pages |

## Структура репозитория

```
Greek3/
├── agents/           # Документация для AI-агентов
├── words/            # Исходные MD-файлы (словарь, грамматика)
├── site/             # Статические ресурсы (CSS, JS, шаблоны)
├── src/build/        # Генератор статического сайта (TypeScript)
├── dist/             # Результат сборки (публикуется на Pages)
└── .github/workflows/deploy.yml
```

## Команды

```bash
npm install
npm run build:site   # Сборка dist/ из words/ + site/
npm run dev          # Сборка + локальный сервер на :3000
```

## Публикация

Push в `main` → GitHub Action `Deploy Site` → GitHub Pages.

В настройках репозитория: **Settings → Pages → Source: GitHub Actions**.

PR от Cloud Agents (`cursor/*`) → workflow **CI** → approve + auto-merge → push в `main` → deploy. Подробнее: `agents/PR_WORKFLOW.md`.
