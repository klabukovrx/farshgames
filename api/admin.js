import { tgApi } from "../lib/telegram.js";
import { getOwned, grant, getPayment, revoke, storeMode } from "../lib/store.js";
import { lookup, itemsFor } from "../lib/catalog.js";

// Поддержка: GET /api/admin?key=ADMIN_KEY&action=...
//   action=owned&uid=123                           — что куплено у игрока
//   action=grant&uid=123&item=flappyfarsh:skin:neon — выдать предмет вручную
//   action=refund&charge=<charge_id>                — вернуть звёзды и забрать предмет
export default async function handler(req, res) {
  const q = new URL(req.url, "http://x").searchParams;
  if (!process.env.ADMIN_KEY || q.get("key") !== process.env.ADMIN_KEY) return res.status(401).json({ ok: false });
  try {
    const action = q.get("action");
    if (action === "owned") return res.json({ ok: true, store: storeMode, owned: await getOwned(q.get("uid")) });
    if (action === "grant") {
      const item = q.get("item");
      if (!lookup(item)) return res.status(400).json({ ok: false, error: "unknown item" });
      await grant(q.get("uid"), itemsFor(item));
      return res.json({ ok: true, owned: await getOwned(q.get("uid")) });
    }
    if (action === "refund") {
      const pay = await getPayment(q.get("charge"));
      if (!pay) return res.status(404).json({ ok: false, error: "payment not found" });
      await tgApi("refundStarPayment", { user_id: Number(pay.uid), telegram_payment_charge_id: q.get("charge") });
      await revoke(pay.uid, itemsFor(pay.item));
      return res.json({ ok: true, refunded: pay });
    }
    res.status(400).json({ ok: false, error: "action" });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
