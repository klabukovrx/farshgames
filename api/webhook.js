import { tgApi, readBody, appUrl } from "../lib/telegram.js";
import { grant, revoke, savePayment, getPayment } from "../lib/store.js";
import { GAMES, lookup, itemsFor } from "../lib/catalog.js";

// Telegram присылает сюда обновления бота (адрес задаётся через /api/setup).
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!process.env.WEBHOOK_SECRET || req.headers["x-telegram-bot-api-secret-token"] !== process.env.WEBHOOK_SECRET) return res.status(401).end();
  const u = readBody(req);
  try {
    if (u.pre_checkout_query) await onPreCheckout(u.pre_checkout_query);
    else if (u.message?.successful_payment) await onPaid(u.message);
    else if (u.message?.refunded_payment) await onRefunded(u.message);
    else if (u.message?.text) await onCommand(u.message, req);
  } catch (e) {
    console.error("webhook", e);
  }
  res.status(200).json({ ok: true });
}

// Предпроверка: Telegram ждёт ответа не дольше 10 секунд.
async function onPreCheckout(q) {
  let ok = false;
  try {
    const p = JSON.parse(q.invoice_payload);
    const it = lookup(p.i);
    ok = !!it && q.currency === "XTR" && q.total_amount === it.stars && p.u === q.from.id;
  } catch {}
  await tgApi("answerPreCheckoutQuery", ok
    ? { pre_checkout_query_id: q.id, ok: true }
    : { pre_checkout_query_id: q.id, ok: false, error_message: "Этот предмет сейчас нельзя купить. Открой магазин в игре заново." });
}

async function onPaid(m) {
  const sp = m.successful_payment, uid = m.from.id;
  let p = {};
  try { p = JSON.parse(sp.invoice_payload); } catch {}
  const it = lookup(p.i);
  if (!it) { console.error("paid for unknown item", sp); return; }
  await savePayment(sp.telegram_payment_charge_id, { uid, item: p.i, stars: sp.total_amount, t: Date.now() });
  await grant(uid, itemsFor(p.i)); // повторная выдача безопасна
  await tgApi("sendMessage", { chat_id: m.chat.id, text: `Спасибо! «${it.title}» уже в ${it.gameTitle}. Открой магазин в игре, чтобы надеть.` }).catch(() => {});
}

async function onRefunded(m) {
  const pay = await getPayment(m.refunded_payment.telegram_payment_charge_id);
  if (pay) await revoke(pay.uid, itemsFor(pay.item));
}

async function onCommand(m, req) {
  const [cmd, arg] = m.text.trim().split(/\s+/);
  const c = cmd.split("@")[0].toLowerCase();
  const url = appUrl(req);
  if (c === "/start" || c === "/play") {
    const game = arg && Object.hasOwn(GAMES, arg) ? arg : null;
    const target = game ? `${url}/games/${game}/index.html` : url;
    await tgApi("sendMessage", {
      chat_id: m.chat.id,
      text: game ? `${GAMES[game].title} в FarshGames. Жми, чтобы играть.` : "FarshGames: игры во вселенной Ильяса Фарша. Сейчас в каталоге FlappyFarsh, новые игры будут появляться здесь же.",
      reply_markup: { inline_keyboard: [[{ text: game ? `▶ ${GAMES[game].title}` : "▶ Открыть FarshGames", web_app: { url: target } }]] },
    });
  } else if (c === "/paysupport") {
    await tgApi("sendMessage", {
      chat_id: m.chat.id,
      text: "Вопрос по оплате? " + (process.env.SUPPORT_CONTACT ? `Напиши ${process.env.SUPPORT_CONTACT} и укажи игру, предмет и дату покупки.` : "Ответь на это сообщение: игра, предмет и дата покупки.") +
        " Если предмет не появился, сначала закрой и снова открой игру.",
    });
  } else if (c === "/terms") {
    await tgApi("sendMessage", {
      chat_id: m.chat.id,
      text: "Все покупки в FarshGames — косметические цифровые предметы. Они привязаны к твоему аккаунту Telegram и не влияют на баланс игр. Вопросы по оплате: /paysupport",
    });
  }
}
