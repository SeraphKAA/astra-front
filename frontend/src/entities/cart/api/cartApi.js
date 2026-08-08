import { apiRequest } from "../../../shared/commonApi";

export const getCart = () => {
  return apiRequest({
    url: "/cart",
  });
};

export const addToCart = ({ productId, quantity = 1 }) => {
  return apiRequest({
    url: "/cart/items",
    method: "POST",
    body: { product_id: productId, quantity },
  });
};

export const updateCartItemQuantity = ({ itemId, quantity }) => {
  return apiRequest({
    url: `/cart/items/${itemId}`,
    method: "PATCH",
    body: { quantity },
  });
};

export const removeCartItem = ({ itemId }) => {
  return apiRequest({
    url: `/cart/items/${itemId}`,
    method: "DELETE",
  });
};

export const clearCart = () => {
  return apiRequest({
    url: "/cart/clear",
    method: "DELETE",
  });
};

