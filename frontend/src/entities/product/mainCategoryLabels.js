/**
 * Раздел каталога (ProductCategory / main_category) — значения с бэкенда → подписи для UI.
 */
export const MAIN_CATEGORY_LABELS = {
  all: "Все разделы",
  games: "Игры",
  services: "Сервисы",
  game_currency: "Игровая валюта",
  neural_networks: "Нейросети",
  subscriptions: "Подписки",
};

/** Порядок в фильтрах и селектах (без «all» — добавляется отдельно). */
export const MAIN_CATEGORY_OPTIONS = [
  { value: "games", label: MAIN_CATEGORY_LABELS.games },
  { value: "services", label: MAIN_CATEGORY_LABELS.services },
  { value: "game_currency", label: MAIN_CATEGORY_LABELS.game_currency },
  { value: "neural_networks", label: MAIN_CATEGORY_LABELS.neural_networks },
  { value: "subscriptions", label: MAIN_CATEGORY_LABELS.subscriptions },
];

/**
 * @param {string | null | undefined} value — код с API (games, services, …)
 * @returns {string} подпись на русском или исходное значение
 */
export const getMainCategoryLabel = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const key = String(value).trim().toLowerCase();
  return MAIN_CATEGORY_LABELS[key] ?? String(value);
};

/**
 * Название узла категории из дерева (БД): корневые разделы — по-русски, остальное без изменений.
 * @param {string | null | undefined} name
 */
export const getCategoryDisplayName = (name) => {
  if (name === null || name === undefined || name === "") return "";
  const raw = String(name).trim();
  const key = raw.toLowerCase();
  if (MAIN_CATEGORY_LABELS[key]) return MAIN_CATEGORY_LABELS[key];
  return raw;
};
