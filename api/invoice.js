import crypto from "node:crypto";
import { checkInitData, readBody, tgApi } from "../lib/telegram.js";
import { getOwned, storeMode } from "../lib/store.js";
import { lookup, bundleKey, description } from "../lib/catalog.js";

// POST /api/invoice {initData, item:"<игра>:<предмет>"} → ссылка на счёт в звёздах
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });
  const body = readBody(req);
  const user = checkInitData(body.initData);
  if (!user) return res.status(401).json({ ok: false, error: "bad initData" });
  const key = String(body.item || "");
  const it = lookup(key);
  if (!it) return res.status(400).json({ ok: false, error: "unknown item" });
  if (storeMode === "memory" && process.env.VERCEL) return res.status(503).json({ ok: false, error: "хранилище не подключено" });
  try {
    const owned = await getOwned(user.id);
    if (owned.includes(key) || owned.includes(bundleKey(it.game))) return res.status(409).json({ ok: false, error: "already" });
    const payload = JSON.stringify({ u: user.id, i: key, n: crypto.randomBytes(4).toString("hex") });
    const link = await tgApi("createInvoiceLink", {
      title: it.title,
      description: description(it),
      payload,
      currency: "XTR",
      prices: [{ label: it.title, amount: it.stars }],
    });
    res.status(200).json({ ok: true, link });
  } catch (e) {
    console.error("invoice", e);
    res.status(502).json({ ok: false, error: e.message });
  }
}
