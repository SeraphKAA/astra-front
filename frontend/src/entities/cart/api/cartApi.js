import { apiRequest } from "../../../shared/commonApi";
import { emitCartUpdated } from "../model/events";

export const getCart = () => {
  return apiRequest({
    url: "/cart",
  });
  // БЕЗ emit: это чтение. Иначе useCartCount зациклится.
};

export const addToCart = async ({ productId, quantity = 1 }) => {
  const result = await apiRequest({
    url: "/cart/items",
    method: "POST",
    body: { product_id: productId, quantity },
  });
  emitCartUpdated();
  return result;
};

export const updateCartItemQuantity = async ({ itemId, quantity }) => {
  const result = await apiRequest({
    url: `/cart/items/${itemId}`,
    method: "PATCH",
    body: { quantity },
  });
  emitCartUpdated();
  return result;
};

export const removeCartItem = async ({ itemId }) => {
  const result = await apiRequest({
    url: `/cart/items/${itemId}`,
    method: "DELETE",
  });
  emitCartUpdated();
  return result;
};

export const clearCart = async () => {
  const result = await apiRequest({
    url: "/cart/clear",
    method: "DELETE",
  });
  emitCartUpdated();
  return result;
};
