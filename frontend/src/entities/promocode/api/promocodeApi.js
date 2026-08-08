import { apiRequest } from "../../../shared/commonApi";

export const getPromocodes = (filter = {}) => {
  return apiRequest({
    url: "/promocode/filter",
    method: "POST",
    body: filter,
  });
};

export const createPromocode = (data) => {
  return apiRequest({
    url: "/promocode/",
    method: "POST",
    body: data,
  });
};

export const updatePromocode = (data) => {
  return apiRequest({
    url: "/promocode/",
    method: "PATCH",
    body: data,
  });
};

export const deletePromocode = (promocodeId) => {
  return apiRequest({
    url: `/promocode/?promocode_id=${promocodeId}`,
    method: "DELETE",
  });
};

export const validatePromocode = (code, amountRub) =>
  apiRequest({
    url: "/promocode/validate",
    method: "POST",
    body: {
      code,
      amount_rub: String(amountRub),
    },
  });
