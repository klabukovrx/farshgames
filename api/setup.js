import { tgApi, appUrl } from "../lib/telegram.js";

// Одноразовая настройка бота: GET /api/setup?key=ADMIN_KEY
export default async function handler(req, res) {
  const key = new URL(req.url, "http://x").searchParams.get("key");
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) return res.status(401).json({ ok: false });
  const url = appUrl(req);
  const out = {};
  try {
    out.webhook = await tgApi("setWebhook", {
      url: `${url}/api/webhook`,
      secret_token: process.env.WEBHOOK_SECRET,
      allowed_updates: ["message", "pre_checkout_query"],
    });
    out.commands = await tgApi("setMyCommands", {
      commands: [
        { command: "start", description: "Открыть FarshGames" },
        { command: "paysupport", description: "Помощь с оплатой" },
        { command: "terms", description: "Условия покупок" },
      ],
    });
    out.menu = await tgApi("setChatMenuButton", { menu_button: { type: "web_app", text: "FarshGames", web_app: { url } } });
    out.info = await tgApi("getWebhookInfo");
    res.status(200).json({ ok: true, appUrl: url, ...out });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, ...out });
  }
}
