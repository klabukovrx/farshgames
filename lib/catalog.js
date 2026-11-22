// Каталог платных предметов всех игр FarshGames. Сервер доверяет только этим ценам.
// Ключ предмета на сервере: "<игра>:<ключ в игре>", например "flappyfarsh:skin:neon".
// Новая игра: добавьте её сюда с ценами; ключи в игре должны совпадать.
export const GAMES = {
  flappyfarsh: {
    title: "FlappyFarsh",
    items: {
      "skin:neon":   { title: "Скин «Неон»",          stars: 25 },
      "skin:astro":  { title: "Скин «Космонавт»",     stars: 50 },
      "skin:fire":   { title: "Скин «Огненный»",      stars: 50 },
      "skin:vamp":   { title: "Скин «Вампир»",        stars: 75 },
      "skin:robot":  { title: "Скин «Робот»",         stars: 75 },
      "skin:dj":     { title: "Скин «Диджей»",        stars: 100 },
      "skin:ghost":  { title: "Скин «Призрак»",       stars: 100 },
      "skin:king":   { title: "Скин «Король Котлет»", stars: 150 },
      "world:space": { title: "Мир «Космос»",         stars: 50 },
      "world:hell":  { title: "Мир «Фаршевый ад»",    stars: 50 },
      "bundle:all":  { title: "Все премиум-скины",    stars: 399, bundle: true },
    },
  },
};

/** "flappyfarsh:skin:neon" → {game, id, title, stars, bundle} или null */
export function lookup(key) {
  if (typeof key !== "string") return null;
  const i = key.indexOf(":");
  if (i < 1) return null;
  const game = key.slice(0, i), id = key.slice(i + 1);
  const g = Object.hasOwn(GAMES, game) ? GAMES[game] : null;
  const it = g && Object.hasOwn(g.items, id) ? g.items[id] : null;
  return it ? { game, id, gameTitle: g.title, ...it } : null;
}
export const bundleKey = (game) => {
  const g = Object.hasOwn(GAMES, game) ? GAMES[game] : null;
  const id = g && Object.keys(g.items).find((k) => g.items[k].bundle);
  return id ? `${game}:${id}` : null;
};
export function priceMap() {
  const out = {};
  for (const [game, g] of Object.entries(GAMES)) for (const [id, it] of Object.entries(g.items)) out[`${game}:${id}`] = it.stars;
  return out;
}
/** Что выдать за покупку: набор раскрывается во все предметы своей игры. */
export function itemsFor(key) {
  const it = lookup(key);
  if (!it) return [];
  if (!it.bundle) return [key];
  return Object.keys(GAMES[it.game].items).map((id) => `${it.game}:${id}`);
}
export const description = (it) =>
  `Косметический предмет для игры ${it.gameTitle} в FarshGames. Меняет только внешний вид и не влияет на игровой баланс.`;
