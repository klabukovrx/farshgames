# FarshGames

Telegram Mini App с играми во вселенной Ильяса Фарша. Каталог игр, общий профиль Telegram и общий магазин за **Telegram Stars**. Первая игра — **FlappyFarsh**.

## Устройство

```
index.html                     каталог игр (главная страница Mini App)
games/registry.js              список игр для каталога
games/flappyfarsh/index.html   игра FlappyFarsh
games/flappyfarsh/cover*.jpg   обложки для карточки
shared/farsh.js                общий модуль: Telegram, тема, кнопки, вибрация, сохранение, покупки
api/me.js                      купленные предметы и цены
api/invoice.js                 счёт в звёздах
api/webhook.js                 оплата от Telegram и команды бота
api/setup.js                   одноразовая настройка бота
api/admin.js                   поддержка: посмотреть, выдать, вернуть звёзды
lib/catalog.js                 ЦЕНЫ всех игр (сервер доверяет только им)
lib/telegram.js, lib/store.js  подпись Telegram, Bot API, хранилище Upstash Redis
test/run.mjs                   проверка сервера: npm test
docs/botfather-640x360.png     картинка для настройки Mini App в @BotFather
```

Как ведёт себя приложение в Telegram:
- Каталог: имя игрока из Telegram, тема Telegram, основная кнопка «Продолжить: <последняя игра>».
- Игра: кнопка «Назад» Telegram закрывает окна, останавливает полёт и в конце возвращает в каталог. Основная кнопка — «Играть» и «Ещё раз».
- Ссылка `https://t.me/<бот>/<приложение>?startapp=flappyfarsh` сразу открывает игру. Команда `/start flappyfarsh` в боте делает то же.
- Покупки хранятся на сервере с ключом игры: `flappyfarsh:skin:neon`. Прогресс игры (уровень, монеты, рекорд) — в облаке Telegram у игрока.

## Как добавить новую игру

1. Создайте папку `games/<id>/` с `index.html`. В `<head>` подключите:
   ```html
   <script src="https://telegram.org/js/telegram-web-app.js"></script>
   <script src="../../shared/farsh.js" data-game="<id>"></script>
   ```
2. В игре используйте `window.Farsh`:
   - `Farsh.back.set(fn)` — кнопка «Назад» (в меню игры вызывайте `Farsh.goHub()`);
   - `Farsh.main.set({text, onClick})` или `Farsh.main.set(null)` — основная кнопка;
   - `Farsh.haptic("light" | "medium" | "heavy" | "ok" | "err" | "sel")`;
   - `Farsh.cloud.get(key)` / `Farsh.cloud.set(key, value)` — облачное сохранение (до 4 КБ);
   - `Farsh.store.load()` → `{owned, prices}`; `Farsh.store.buy("skin:x")` → `"paid" | "cancelled" | "failed" | "pending"`; `Farsh.store.waitOwned("skin:x")`;
   - `Farsh.user`, `Farsh.inTg`, `Farsh.isDark()`, `Farsh.onTheme(fn)`.
   Рекорд храните в `localStorage["farsh_<id>_v1"]` как `{best: N, ...}` — каталог покажет его на карточке.
3. Положите обложку `games/<id>/cover-small.jpg` (600×315).
4. Добавьте игру в `games/registry.js`.
5. Если в игре есть покупки, добавьте цены в `lib/catalog.js` под `<id>` и выполните `npm test`.

## Запуск

### 1. Бот
1. В Telegram откройте **@BotFather** → `/newbot` → получите токен.
2. `/newapp` → выберите бота → название **FarshGames**, описание, картинка `docs/botfather-640x360.png`, адрес — после шага 2. Короткое имя приложения, например `play`, даст ссылку `https://t.me/<бот>/play`.

### 2. Vercel
1. Загрузите эту папку в новый репозиторий GitHub.
2. vercel.com → **Add New → Project** → репозиторий → **Deploy**.
3. **Storage → Create → Upstash Redis** (бесплатный план) → подключите к проекту.
4. **Settings → Environment Variables**: `BOT_TOKEN`, `WEBHOOK_SECRET`, `ADMIN_KEY` (см. `.env.example`), по желанию `SUPPORT_CONTACT`.
5. **Deployments → Redeploy**.

### 3. Связать бота и сайт
1. Откройте `https://<адрес>.vercel.app/api/setup?key=<ADMIN_KEY>` — должно вернуться `"ok": true`.
2. В @BotFather укажите адрес Mini App: `https://<адрес>.vercel.app`.

### 4. Проверка
- Откройте бота → **FarshGames** → FlappyFarsh → купите самый дешёвый скин.
- Вернуть звёзды себе: `/api/admin?key=<ADMIN_KEY>&action=refund&charge=<charge_id>` (номер платежа — в логах Vercel).

## Поддержка игроков
- `/api/admin?key=…&action=owned&uid=<id>` — что куплено.
- `/api/admin?key=…&action=grant&uid=<id>&item=flappyfarsh:skin:neon` — выдать вручную.
- `/api/admin?key=…&action=refund&charge=<charge_id>` — вернуть звёзды и забрать предмет.
- Telegram требует от продающих ботов отвечать на `/paysupport`.

## Ограничения
- Прогресс игр хранится у игрока и сервером не проверяется. Купленные предметы выдаёт только сервер.
- Рейтинг пока свой у каждого игрока. Общая таблица лидеров — следующий этап на том же сервере.
