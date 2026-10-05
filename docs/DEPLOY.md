# Деплой игры на GitHub Pages

Главная инструкция по деплою. Читатель — владелец репозитория: настройки на GitHub включаются **один раз**, дальше всё работает автоматически.

## 1. Как это работает

Схема деплоя:

```text
push в main (или ручной запуск)
        │
        ▼
.github/workflows/deploy.yml
        │
        ├── npm ci                     — установка зависимостей
        ├── npm test                   — прогон vitest
        ├── npm run build              — vite build → dist/
        ├── actions/configure-pages    — активирует публикацию Pages (enablement: true)
        ├── actions/upload-pages-artifact — dist/ как артефакт Pages
        └── actions/deploy-pages       — публикация
        │
        ▼
https://mrderunov.github.io/dzoragyugh-game/
```

Параллельно `.github/workflows/ci.yml` на каждый push в `main` и на каждый PR прогоняет typecheck, тесты и сборку — без публикации. Ошибки отлавливаются до деплоя.

## 2. Что уже настроено в репозитории

- `.github/workflows/ci.yml` — проверки (typecheck + тесты + сборка) на push в `main` и на PR.
- `.github/workflows/deploy.yml` — тесты, сборка и публикация на GitHub Pages при push в `main` и при ручном запуске.
- `base: './'` в `vite.config.ts` — бандл работает от любого пути: `/dzoragyugh-game/`, кастомный домен, локальный preview, Telegram Mini App.
- `public/.nojekyll` — отключает Jekyll-обработку Pages.
- `public/favicon.svg` — favicon.
- GitHub Pages уже включена (`build_type: workflow`) — включена программно через GitHub API; вручную включать ничего не нужно.
- Репозиторий публичный — на бесплатном тарифе GitHub Pages работает только для публичных репозиториев.

> Для базового деплоя **никаких секретов и токенов не нужно** — используются только стандартные actions.

## 3. Разовые шаги на GitHub (проверить один раз)

Единственный разовый шаг:

1. **Settings → Actions → General → Workflow permissions** — убедиться, что выбрано **«Read and write permissions»** (это значение по умолчанию; оно нужно для `pages: write`).

Всё остальное уже настроено и ручной настройки не требует: GitHub Pages включена программно через GitHub API (`build_type: workflow`) — workflow публикует сайт сам через `actions/configure-pages` с `enablement: true`; Actions включены по умолчанию. Повторять эти шаги не нужно.

## 4. Первый деплой

1. Запушь изменения в `main` (или запусти workflow вручную, см. ниже).
2. Открой вкладку **Actions** → run **«Deploy to GitHub Pages»**.
3. Дождись зелёного статуса.
4. Сайт доступен по адресу: <https://mrderunov.github.io/dzoragyugh-game/>.

## 5. Как перевыпустить вручную

**Actions** → **«Deploy to GitHub Pages»** → **«Run workflow»** → выбрать ветку `main` → **«Run workflow»**. Новый прогон перезаписывает артефакт Pages — старая версия заменяется.

## 6. Локальная проверка перед пушем

```bash
npm run typecheck && npm test && npm run build
npm run preview   # просмотр собранного бандла
```

Если локально всё зелёное — CI и деплой почти наверняка тоже пройдут.

## 7. Кастомный домен

**Settings → Pages → Custom domain** — ввести домен и добавить `CNAME` (у DNS-провайдера — запись на GitHub Pages). Благодаря `base: './'` в `vite.config.ts` в коде менять ничего не нужно.

## 8. Устранение проблем

| Симптом | Что проверить |
| --- | --- |
| Сайт 404 или битые ассеты | `base` в `vite.config.ts` должен быть `'./'`; проверить, что последний run «Deploy to GitHub Pages» зелёный |
| Workflow не запустился | Settings → Actions → General → Workflow permissions: «Read and write permissions»; ветка называется `main` |
| Ошибки сборки | Логи в Actions (job `build`); локально `npm run build` |
| Push отклонён | SSH-ключ добавлен в GitHub, права на репозиторий позволяют запись |
| Pages показывает старую версию | Кэш браузера — hard refresh (Ctrl+Shift+R); убедиться, что последний run зелёный: новый деплой перезаписывает артефакт |

## 9. Секреты и окружение

Для GitHub Pages секреты не нужны. Переменные окружения появятся на этапе Vercel + Neon (геймдизайн, §60):

```text
TELEGRAM_BOT_TOKEN
DATABASE_URL
GAME_EVENT_ID=village2026
```

Они задаются в Vercel (Project → Settings → Environment Variables) и используются только server-side — во frontend-бандл не попадают.

## 10. Следующий шаг: Telegram Mini App + Vercel + Neon

Дальнейшее развитие по геймдизайну (§40–61) — для текущей версии на GitHub Pages переход не требуется. Путь:

- Бот **@GyughSurvivalBot**; у бота настраивается Mini App с HTTPS-URL приложения на Vercel. В группу отправляется прямая ссылка `https://t.me/GyughSurvivalBot?startapp=village2026` — параметр `startapp` задаёт `eventId` кампании.
- **Один Vercel-проект**: frontend + serverless API вместе; отдельный VPS или постоянно работающий backend не нужны.
- **Neon Postgres**: таблицы `players` и `game_runs`; лидерборд строится SQL-запросом по лучшему результату каждого игрока.
- Авторизация — Telegram: frontend отправляет подписанный `initData`, API валидирует подпись; отдельной регистрации нет.
- Минимальный API: `POST /api/bootstrap`, `POST /api/score`, `GET /api/leaderboard`.
- Интерфейс `LeaderboardService` в `src/services/types.ts` уже спроектирован так, чтобы заменить localStorage-реализацию на API-реализацию без переделки игры.
- Vercel подхватывает репозиторий с GitHub (импорт проекта) — деплой на Vercel тоже автоматический при push.

Подробности — в геймдизайне (§40–79) и [ARCHITECTURE.md](ARCHITECTURE.md).

## 11. Чек-лист деплоя

1. Склонировать репозиторий: `git clone https://github.com/MrDerunov/dzoragyugh-game.git`
2. `npm install`
3. Локальная проверка: `npm run typecheck && npm test && npm run build`
4. Проверить: Settings → Actions → General → Workflow permissions = «Read and write permissions» (по умолчанию; GitHub Pages уже включена, настраивать её не нужно)
5. `git push` в `main`
6. Actions → «Deploy to GitHub Pages» → зелёный статус
7. Открыть <https://mrderunov.github.io/dzoragyugh-game/>
