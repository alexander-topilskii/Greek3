# Pull request и auto-merge

Cloud Agents открывают PR из веток `cursor/<описание>-b6d3`. После зелёного CI GitHub Actions одобряет PR и включает **auto-merge** — слияние в `main` происходит автоматически, когда выполнены правила защиты ветки.

## Что делает репозиторий

| Workflow | Когда | Что |
|----------|-------|-----|
| `CI` (`.github/workflows/ci.yml`) | PR и push в `main` | `npm ci` + `npm run build:site` |
| `CI` → job `enable-automerge` | PR в ветке `cursor/*` → `main`, не draft | Включить auto-merge **до** прохождения checks (GitHub ждёт `build` + approve) |
| `CI` → job `approve` | после зелёного `build` | Approve от `github-actions[bot]` |
| `Deploy Site` (`.github/workflows/deploy.yml`) | Push в `main` | Сборка и публикация на GitHub Pages |

## Что настроить вручную (один раз)

### 1. GitHub → Settings → General

- **Allow auto-merge** — включить.

### 2. GitHub → Settings → Branches → Branch protection rules → `main`

Рекомендуемый минимум:

- **Require a pull request before merging** — включить (агенты всё равно работают через PR).
- **Require status checks to pass before merging** — включить.
  - Обязательный check: **`build`** (job из workflow **CI**).
- **Require approvals** — включить (approve даёт workflow `automerge` от `github-actions[bot]`).
- **Allow specified actors to bypass required pull requests** — **не** включать для ботов, если хотите единый путь через PR.

Если после настройки merge не срабатывает — в PR на вкладке Checks посмотреть, какой check или правило блокирует.

### 3. Cursor → Cloud Agents (опционально)

- **Base branch**: `main`
- **Automatically fix CI Failures** — по желанию (агент чинит падения CI на своём PR)

Отдельная Cursor Automation для approve **не нужна** — это делает `.github/workflows/ci.yml`.

## Поведение агента

1. Ветка `cursor/<описание>-b6d3` от `main`
2. Коммиты, push, открытие PR (не draft)
3. Дождаться зелёного **CI**
4. Workflow включит auto-merge сразу при открытии PR, после зелёного CI — approve
5. GitHub смержит в `main`, когда выполнены checks и approve → запустится **Deploy Site**

**Почему auto-merge включается до CI:** GitHub API отклоняет `enablePullRequestAutoMerge`, если все требования уже выполнены (`unstable` / `clean status`). Поэтому auto-merge ставится в начале, а approve — после `build`.

Агент **не** мержит PR вручную — только создаёт и обновляет PR; merge выполняет GitHub после checks и approve.
