import { checkInitData, readBody } from "../lib/telegram.js";
import { getOwned } from "../lib/store.js";
import { priceMap } from "../lib/catalog.js";

// POST /api/me {initData} → купленные предметы и актуальные цены
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });
  const user = checkInitData(readBody(req).initData);
  if (!user) return res.status(401).json({ ok: false, error: "bad initData" });
  try {
    const owned = await getOwned(user.id);
    res.status(200).json({ ok: true, user: { id: user.id, name: user.first_name || "" }, owned, prices: priceMap() });
  } catch (e) {
    console.error("me", e);
    res.status(500).json({ ok: false, error: "store" });
  }
}
