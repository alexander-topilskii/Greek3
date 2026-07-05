# Pull request и auto-merge

Cloud Agents открывают PR из веток `cursor/<описание>-b6d3`. После зелёного CI GitHub Actions одобряет PR и включает **auto-merge** — слияние в `main` происходит автоматически, когда выполнены правила защиты ветки.

## Что делает репозиторий

| Workflow | Когда | Что |
|----------|-------|-----|
| `CI` (`.github/workflows/ci.yml`) | PR и push в `main` | `npm ci` + `npm run build:site` |
| `Agent Auto-merge` (`.github/workflows/agent-automerge.yml`) | PR `cursor/*` → `main`, не draft | Best-effort: включить auto-merge сразу при открытии PR |
| `CI` → job `approve` | после зелёного `build` | Approve от `github-actions[bot]`; если auto-merge не включился — прямой merge + deploy |
| `Deploy Site` (`.github/workflows/deploy.yml`) | Push в `main` или `workflow_dispatch` | Сборка и публикация на GitHub Pages |

## Что настроить вручную (один раз)

### 1. GitHub → Settings → General

- **Allow auto-merge** — включить.

### 2. GitHub → Settings → Branches → Branch protection rules → `main`

Рекомендуемый минимум:

- **Require a pull request before merging** — включить (агенты всё равно работают через PR).
- **Require status checks to pass before merging** — включить.
  - Обязательный check: **`build`** (job из workflow **CI**). Имя должно совпадать точно — без `enable-automerge` и `approve`.
- **Require approvals** — включить (approve даёт job `approve` от `github-actions[bot]`).
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

**Почему auto-merge в отдельном workflow:** GitHub API часто отклоняет `enablePullRequestAutoMerge` с `unstable status`, если вызывать его после зелёного CI. Отдельный workflow `Agent Auto-merge` стартует сразу при открытии PR; job **не падает** при `unstable` — это нормально.

**Запасной путь:** если auto-merge так и не включился, job `approve` после зелёного `build` мержит PR напрямую и запускает `Deploy Site` через `workflow_dispatch` (merge от `GITHUB_TOKEN` не триггерит push-workflow).

Агент **не** мержит PR вручную — только создаёт и обновляет PR; merge выполняет GitHub Actions после checks и approve.
