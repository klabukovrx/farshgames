import crypto from "node:crypto";

const token = () => process.env.BOT_TOKEN || "";

/** Вызов Bot API. Бросает ошибку, если Telegram вернул ok:false. */
export async function tgApi(method, params = {}) {
  if (!token()) throw new Error("BOT_TOKEN не задан");
  const r = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description || `Telegram ${method}: HTTP ${r.status}`);
  return j.result;
}

/**
 * Проверка подписи initData из Telegram.WebApp.initData.
 * Возвращает объект пользователя или null.
 * Алгоритм: secret = HMAC_SHA256(key="WebAppData", msg=bot_token);
 * hash = hex(HMAC_SHA256(key=secret, msg=data_check_string)).
 */
export function checkInitData(initData, botToken = token(), maxAgeSec = 24 * 3600) {
  if (!initData || typeof initData !== "string" || !botToken) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  p.delete("hash");
  const dataCheck = [...p.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calc = crypto.createHmac("sha256", secret).update(dataCheck).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(calc, "hex"), Buffer.from(hash, "hex"))) return null;
  const authDate = Number(p.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;
  try {
    const user = JSON.parse(p.get("user") || "null");
    return user && user.id ? user : null;
  } catch {
    return null;
  }
}

/** Тело запроса: Vercel обычно уже разбирает JSON, но подстрахуемся. */
export function readBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "string") {
    try { return JSON.parse(b); } catch { return {}; }
  }
  return b;
}

export const appUrl = (req) =>
  (process.env.APP_URL || `https://${req.headers["x-forwarded-host"] || req.headers.host}`).replace(/\/+$/, "");
