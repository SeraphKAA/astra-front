/** Маршруты, на которых нужен WebSocket чата (/chats/ws/...). */
const CHAT_WS_ROUTE = /^\/(?:support|order-chat\/[^/]+)\/?$/;

/** Маршрут WebSocket заказов продавца (/orders/ws). */
const ORDER_WS_ROUTE = /^\/seller-chat\/?$/;

export const isChatWsRoute = (pathname = "") => CHAT_WS_ROUTE.test(pathname);

export const isOrderWsRoute = (pathname = "") => ORDER_WS_ROUTE.test(pathname);
