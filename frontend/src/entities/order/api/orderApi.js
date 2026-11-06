import { apiRequest } from "../../../shared/commonApi";
import { publicURL } from "../../../shared/commonApi";
import {emitCartUpdated} from "../../cart/model/events";
/* ========================
   USER
======================== */

// Создать заказ
export const createOrder = (data) => {
    return apiRequest({
        url: "/orders/",
        method: "POST",
        body: data,
    });
};

// Получить мои заказы
export const getMyOrders = () => {
    return apiRequest({
        url: "/orders/me",
    });
};

// Получить заказ по public_id
export const getOrderByPublicId = (publicId) => {
    return apiRequest({
        url: `/orders/${encodeURIComponent(publicId)}`,
    });
};

export const createOrderFromCart = (payload = {}) => {
    const result = apiRequest({
        url: "/orders/from-cart",
        method: "POST",
        body: {
            checkout_profiles: payload.checkout_profiles ?? [],
            promocode_code: payload.promocode_code ?? null,
        },
    });
    emitCartUpdated();
    return result;
};

export const initRobokassaPayment = (orderPublicId, useBalance = true) => {
    return apiRequest({
        url: `/payments/robokassa/init`,
        method: "POST",
        body: {
            order_public_id: orderPublicId,
            use_balance: useBalance,
        },
    });
};

export const getOrdersByUserForStaff = (userId, limit = 100, offset = 0) => {
    return apiRequest({
        url: `/orders/filter?limit=${limit}&offset=${offset}`,
        method: "POST",
        body: { user_id: userId },
    });
};

/* ========================
   SELLER
======================== */

export const getUnassignedOrders = (limit = 50, offset = 0) => {
    return apiRequest({
        url: `/orders/unassigned/order?limit=${limit}&offset=${offset}`,
    });
};

export const assignMeToOrder = (publicId) => {
    return apiRequest({
        url: "/orders/assign-me",
        method: "POST",
        body: { public_id: publicId },
    });
};

export const unassignMeFromOrder = (publicId) => {
    return apiRequest({
        url: "/orders/unassign-me",
        method: "POST",
        body: { public_id: publicId },
    });
};

export const getMyAssignedOrders = (limit = 50, offset = 0) => {
    return apiRequest({
        url: `/orders/filter?limit=${limit}&offset=${offset}`,
        method: "POST",
        body: {},
    });
};

export const changeOrderStatus = (publicId, status) => {
    return apiRequest({
        url: "/orders/status",
        method: "PATCH",
        body: { public_id: publicId, status },
    });
};

export const exportOrdersAnalyticsExcel = async ({ dateFrom, dateTo } = {}) => {
    const params = new URLSearchParams();
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);

    const resp = await fetch(`${publicURL}/orders/analytics/export?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" }, // если бэкенд ожидает JSON
    });
    if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(text || "Не удалось выгрузить Excel");
    }
    return await resp.blob();
};

export const getAdminDashboardAnalytics = (chartDays = 14) => {
    return apiRequest({
        url: `/orders/analytics/dashboard?chart_days=${chartDays}`,
    });
};


export const refundOrder = (publicId, reason, amount = null) => {
    return apiRequest({
        url: `/orders/refund`,
        method: "POST",
        body: {
            public_id: publicId,
            reason: reason || null,
            amount: amount ?? null,
        },
    });
};

export const getOrdersByFilter = (filters = {}, limit = 50, offset = 0) => {
  return apiRequest({
    url: `/orders/filter?limit=${limit}&offset=${offset}`,
    method: "POST",
    body: filters,
  });
};

// Назначить продавца на заказ
export const assignSellerToOrder = (publicId, sellerId) => {
  return apiRequest({
    url: "/orders/assign-seller",
    method: "POST",
    body: { public_id: publicId, seller_id: sellerId },
  });
};