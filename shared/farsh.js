/* =====================================================================
   FarshGames SDK — общий модуль для каталога и всех игр.
   Подключение в игре (до кода игры):
     <script src="https://telegram.org/js/telegram-web-app.js"></script>
     <script src="../../shared/farsh.js" data-game="<id игры>"></script>
   Даёт window.Farsh: Telegram, тема, кнопки «Назад» и основная,
   вибрация, облачное сохранение, покупки за звёзды, переходы.
   ===================================================================== */
(function () {
  "use strict";
  const script = document.currentScript;
  const GAME = (script && script.dataset.game) || "";
  const ROOT = script ? new URL("../", script.src).href : location.origin + "/";
  const API = window.FARSH_API !== undefined ? window.FARSH_API : new URL("api/", ROOT).href;

  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  const inTg = !!(tg && tg.initData);
  const tgv = (v) => { try { return !!tg && tg.isVersionAtLeast(v); } catch (e) { return false; } };
  const html = document.documentElement;
  if (inTg) html.classList.add("tg");
  if (matchMedia("(pointer:coarse)").matches) html.classList.add("coarse");

  /* ---------- тема ---------- */
  const themeCbs = [];
  const isDark = () => { const t = html.dataset.theme; return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; };
  function applyTheme() {
    if (inTg && tg.colorScheme) html.dataset.theme = tg.colorScheme;
    if (inTg && tgv("6.1")) {
      const bg = isDark() ? "#2b2733" : "#c3bacb";
      try { tg.setHeaderColor(bg); tg.setBackgroundColor(bg); } catch (e) {}
      try { if (tgv("7.10")) tg.setBottomBarColor(bg); } catch (e) {}
    }
  }
  function setAppH() {
    const h = (inTg && tg.viewportStableHeight) || innerHeight;
    html.style.setProperty("--app-h", h + "px");
  }

  /* ---------- кнопки Telegram ---------- */
  let backFn = null, mainFn = null;
  const back = {
    /** fn — обработчик или null (кнопка скрыта) */
    set(fn) { backFn = fn || null; if (!inTg || !tgv("6.1")) return; try { fn ? tg.BackButton.show() : tg.BackButton.hide(); } catch (e) {} },
  };
  const main = {
    /** {text, onClick, color?} или null (кнопка скрыта) */
    set(o) {
      mainFn = o ? o.onClick : null;
      if (!inTg || !tgv("6.1")) return;
      try {
        if (!o) tg.MainButton.hide();
        else tg.MainButton.setParams({ text: o.text, color: o.color || "#e0584a", text_color: "#ffffff", is_active: true, is_visible: true });
      } catch (e) {}
    },
  };

  /* ---------- вибрация, сообщения ---------- */
  function haptic(k) {
    if (!inTg || !tg.HapticFeedback || !tgv("6.1")) return;
    try {
      if (k === "ok") tg.HapticFeedback.notificationOccurred("success");
      else if (k === "err") tg.HapticFeedback.notificationOccurred("error");
      else if (k === "sel") tg.HapticFeedback.selectionChanged();
      else tg.HapticFeedback.impactOccurred(k || "light");
    } catch (e) {}
  }
  function alertBox(t, fallback) {
    if (inTg && tgv("6.2")) { try { tg.showAlert(t); return; } catch (e) {} }
    if (fallback) fallback(t);
  }

  /* ---------- хранилище: localStorage + облако Telegram ---------- */
  const local = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const cloud = {
    ok: () => inTg && tgv("6.9") && !!tg.CloudStorage,
    get(k) { return new Promise((r) => { if (!cloud.ok()) return r(null); try { tg.CloudStorage.getItem(k, (e, v) => r(e ? null : v || null)); } catch (e) { r(null); } }); },
    set(k, v) { if (!cloud.ok() || v.length > 4096) return; try { tg.CloudStorage.setItem(k, v, () => {}); } catch (e) {} },
  };

  /* ---------- сервер ---------- */
  async function api(path, body) {
    const r = await fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ initData: tg ? tg.initData : "" }, body || {})),
    });
    let j = {};
    try { j = await r.json(); } catch (e) {}
    if (!r.ok || !j.ok) throw new Error(j.error || "HTTP " + r.status);
    return j;
  }

  /* ---------- покупки за звёзды (ключи игры без префикса: "skin:neon") ---------- */
  const pre = (id) => (GAME ? GAME + ":" + id : id);
  const strip = (list) => list.filter((k) => !GAME || k.startsWith(GAME + ":")).map((k) => (GAME ? k.slice(GAME.length + 1) : k));
  const store = {
    available: () => inTg && tgv("6.1"),
    /** {owned:[ключи игры], prices:{ключ:звёзды}} */
    async load() {
      const j = await api("me");
      const prices = {};
      for (const [k, v] of Object.entries(j.prices || {})) if (!GAME || k.startsWith(GAME + ":")) prices[GAME ? k.slice(GAME.length + 1) : k] = v;
      return { owned: strip(j.owned || []), prices, user: j.user };
    },
    /** открывает счёт; resolve("paid" | "cancelled" | "failed" | "pending") */
    async buy(id) {
      if (!store.available()) throw new Error("not_tg");
      const j = await api("invoice", { item: pre(id) });
      return new Promise((resolve) => tg.openInvoice(j.link, (st) => resolve(st)));
    },
    /** ждёт, пока сервер подтвердит покупку; true/false */
    async waitOwned(id, tries = 10) {
      for (let i = 0; i < tries; i++) {
        try { const s = await store.load(); if (s.owned.includes(id) || s.owned.includes("bundle:all")) return s; } catch (e) {}
        await new Promise((r) => setTimeout(r, 1500));
      }
      return null;
    },
  };

  /* ---------- переходы ---------- */
  const user = inTg && tg.initDataUnsafe ? tg.initDataUnsafe.user || null : null;
  const startParam = inTg && tg.initDataUnsafe ? tg.initDataUnsafe.start_param || "" : new URLSearchParams(location.search).get("game") || "";
  function goHub() { location.href = new URL("index.html", ROOT).href; }
  function openGame(id) { local.set("farsh_last_game", id); location.href = new URL("games/" + id + "/index.html", ROOT).href; }
  if (GAME) local.set("farsh_last_game", GAME);

  /* ---------- запуск ---------- */
  if (tg) {
    try { tg.ready(); tg.expand(); if (tgv("7.7")) tg.disableVerticalSwipes(); } catch (e) {}
    try {
      tg.onEvent("themeChanged", () => { applyTheme(); themeCbs.forEach((f) => f()); });
      tg.onEvent("viewportChanged", setAppH);
      if (tgv("6.1")) {
        tg.BackButton.onClick(() => { haptic("light"); if (backFn) backFn(); });
        tg.MainButton.onClick(() => { haptic("medium"); if (mainFn) mainFn(); });
        tg.BackButton.hide(); tg.MainButton.hide();
      }
    } catch (e) {}
  }
  applyTheme();
  addEventListener("resize", setAppH);
  setAppH();

  window.Farsh = {
    game: GAME, root: ROOT, tg, inTg, tgv, user, startParam,
    isDark, onTheme: (f) => themeCbs.push(f),
    back, main, haptic, alert: alertBox, local, cloud, api, store, goHub, openGame,
  };
})();
