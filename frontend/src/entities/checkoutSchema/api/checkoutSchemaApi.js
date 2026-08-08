import { apiRequest } from "../../../shared/commonApi";

export const getCheckoutSchemaByCategoryId = (categoryId) =>
  apiRequest({
    url: `/category-checkout-schemas/by-category/${categoryId}`,
    method: "GET",
    authorized: false,
  });

export const listActiveCheckoutSchemas = () =>
  apiRequest({
    url: "/category-checkout-schemas/active",
    method: "GET",
    authorized: false,
  });

export const createCategoryCheckoutSchema = (body) =>
  apiRequest({
    url: "/category-checkout-schemas/",
    method: "POST",
    body,
    authorized: true,
  });

export const updateCategoryCheckoutSchema = (schemaId, body) =>
  apiRequest({
    url: `/category-checkout-schemas/${schemaId}`,
    method: "PATCH",
    body,
    authorized: true,
  });

export const deleteCategoryCheckoutSchema = (schemaId) =>
  apiRequest({
    url: `/category-checkout-schemas/${schemaId}`,
    method: "DELETE",
    authorized: true,
  });

export const getCartCheckoutRequirements = () =>
  apiRequest({
    url: "/cart/checkout-requirements",
    method: "GET",
    authorized: true,
  });
