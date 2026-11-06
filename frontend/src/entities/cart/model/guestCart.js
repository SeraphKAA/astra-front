/* ============================================================
   ГОСТЕВАЯ КОРЗИНА
   Гость не авторизован — /cart отвечает 401, поэтому корзину
   гостя мы вообще не спрашиваем у сервера. Она живёт в
   sessionStorage этой вкладки как массив { productId, quantity },
   а карточки товаров подтягиваются публичным getProductById.
   Никакого «переноса в аккаунт» здесь НЕТ: сервер о такой корзине
   не знает, и обещать слияние после входа было бы ложью.

   Живёт в entities/cart, а не на странице «Корзина»: класть товар
   гостю умеет попап быстрой покупки (widgets/CategoryQuickBuy),
   и импорт из страницы тянул бы весь её модуль — вместе с Robokassa
   и модалкой оформления — в бандл шапки.
   ============================================================ */

/** Ключ гостевой корзины в sessionStorage. */
import { emitCartUpdated } from "./events";

export const GUEST_CART_KEY = "astra:guest-cart";

export const MIN_QTY = 1;
export const MAX_QTY = 999;

export const clampQty = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return MIN_QTY;
  return Math.max(MIN_QTY, Math.min(MAX_QTY, Math.trunc(n)));
};

export const sameId = (a, b) => String(a) === String(b);

/**
 * Прочитать гостевую корзину. Никогда не бросает: приватный режим,
 * битый JSON и чужие данные под тем же ключом дают пустой список.
 * @returns {{productId: (string|number), quantity: number}[]}
 */
export const readGuestCart = () => {
  if (typeof window === "undefined") return [];
  let raw = null;
  try {
    raw = window.sessionStorage?.getItem(GUEST_CART_KEY) ?? null;
  } catch (e) {
    return [];
  }
  if (!raw) return [];
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set();
  const rows = [];
  parsed.forEach((row) => {
    const productId = row?.productId ?? row?.product_id;
    if (productId === null || productId === undefined || productId === "") return;
    const key = String(productId);
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ productId, quantity: clampQty(row?.quantity ?? 1) });
  });
  return rows;
};

export const writeGuestCart = (rows) => {
  const clean = (Array.isArray(rows) ? rows : []).map((row) => ({
    productId: row.productId,
    quantity: clampQty(row.quantity),
  }));
  if (typeof window === "undefined") return clean;
  try {
    window.sessionStorage.setItem(GUEST_CART_KEY, JSON.stringify(clean));
    emitCartUpdated();
  } catch (e) {
    /* приватный режим — корзина доживёт только до перезагрузки вкладки,
       но событие всё равно имеет смысл: в памяти состояние изменилось */
    emitCartUpdated();
  }
  return clean;
};

/**
 * Положить товар в гостевую корзину (одинаковые товары складываются).
 * Публичный помощник: попап быстрой покупки может звать его вместо
 * addToCart, пока пользователь не вошёл.
 * @param {{productId: (string|number), quantity?: number}} input
 * @returns {{productId: (string|number), quantity: number}[]} новая корзина
 */
export const addToGuestCart = ({ productId, quantity = 1 } = {}) => {
  if (productId === null || productId === undefined || productId === "") {
    return readGuestCart();
  }
  const rows = readGuestCart();
  const index = rows.findIndex((row) => sameId(row.productId, productId));
  if (index >= 0) {
    rows[index] = {
      ...rows[index],
      quantity: clampQty(rows[index].quantity + clampQty(quantity)),
    };
  } else {
    rows.push({ productId, quantity: clampQty(quantity) });
  }
  return writeGuestCart(rows);
};

/* Количество правим точечно: строки, которые не удалось «оживить»
   (товар не загрузился), остаются в хранилище — их вернёт повтор. */
export const setGuestQuantity = (productId, quantity) => {
  const rows = readGuestCart();
  const index = rows.findIndex((row) => sameId(row.productId, productId));
  if (index < 0) return rows;
  rows[index] = { ...rows[index], quantity: clampQty(quantity) };
  return writeGuestCart(rows);
};

export const removeGuestRow = (productId) =>
  writeGuestCart(readGuestCart().filter((row) => !sameId(row.productId, productId)));

export const clearGuestRows = () => writeGuestCart([]);

export const guestItemId = (productId) => `guest-${productId}`;

/** Строка гостевой корзины в той же форме, что отдаёт /cart. */
export const buildGuestItem = (row, product) => {
  const price = Number(product?.price);
  const unit = Number.isFinite(price) ? price : 0;
  return {
    id: guestItemId(row.productId),
    productId: row.productId,
    quantity: row.quantity,
    total_price: unit * row.quantity,
    product,
  };
};
