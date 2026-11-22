// Хранилище покупок: Upstash Redis через REST (подключается в Vercel → Storage → Upstash Redis).
// Без переменных окружения работает в памяти — только для локальной проверки.
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
export const storeMode = URL_ && TOKEN ? "redis" : "memory";

const mem = new Map();
function memCmd([c, key, ...a]) {
  switch (c) {
    case "SADD": { const s = mem.get(key) || new Set(); let n = 0; for (const v of a) if (!s.has(v)) { s.add(v); n++; } mem.set(key, s); return n; }
    case "SREM": { const s = mem.get(key) || new Set(); let n = 0; for (const v of a) if (s.delete(v)) n++; return n; }
    case "SMEMBERS": return [...(mem.get(key) || [])];
    case "SET": { const nx = a.includes("NX"); if (nx && mem.has(key)) return null; mem.set(key, a[0]); return "OK"; }
    case "GET": return mem.has(key) ? mem.get(key) : null;
    case "LPUSH": { const l = mem.get(key) || []; l.unshift(...a); mem.set(key, l); return l.length; }
    case "LRANGE": { const l = mem.get(key) || []; const e = Number(a[1]); return l.slice(Number(a[0]), e < 0 ? undefined : e + 1); }
    case "LTRIM": { const l = mem.get(key) || []; mem.set(key, l.slice(Number(a[0]), Number(a[1]) + 1)); return "OK"; }
    default: throw new Error("memory store: " + c);
  }
}
export async function cmd(...args) {
  if (storeMode === "memory") return memCmd(args);
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const j = await r.json().catch(() => ({}));
  if (j.error) throw new Error("Redis: " + j.error);
  return j.result;
}
export const getOwned = async (uid) => (await cmd("SMEMBERS", `owned:${uid}`)) || [];
export const grant = (uid, items) => cmd("SADD", `owned:${uid}`, ...items);
export const revoke = (uid, items) => cmd("SREM", `owned:${uid}`, ...items);
/** Запись о платеже по charge_id. Возвращает true, если запись новая. */
export async function savePayment(chargeId, data) {
  const r = await cmd("SET", `pay:${chargeId}`, JSON.stringify(data), "NX");
  if (r === "OK") {
    await cmd("LPUSH", `payments:${data.uid}`, chargeId);
    await cmd("LPUSH", "payments:all", chargeId);
    await cmd("LTRIM", "payments:all", 0, 499);
  }
  return r === "OK";
}
export async function getPayment(chargeId) {
  const v = await cmd("GET", `pay:${chargeId}`);
  return v ? JSON.parse(v) : null;
}
/** Последние платежи (новые сверху) с номерами для возврата. */
export async function recentPayments(limit = 30) {
  const ids = (await cmd("LRANGE", "payments:all", 0, limit - 1)) || [];
  const out = [];
  for (const id of ids) out.push({ charge: id, ...((await getPayment(id)) || {}) });
  return out;
}
export const _memForTests = mem;
