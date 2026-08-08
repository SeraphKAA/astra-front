import { apiRequest } from "../../../shared/commonApi";
import { LS } from "../../../utilities/utilLocalStorage";
import { publicURL } from "../../../shared/commonApi";
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

export const createOrderFromCart = (checkoutProfiles = []) => {
    return apiRequest({
        url: "/orders/from-cart",
        method: "POST",
        body: { checkout_profiles: checkoutProfiles },
    });
};

export const initRobokassaPayment = (orderPublicId) => {
    return apiRequest({
        url: `/payments/robokassa/init?order_public_id=${encodeURIComponent(orderPublicId)}&use_balance=true`,
        method: "POST",
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

    const token = await LS.get("access_token");
    const resp = await fetch(`${publicURL}/orders/analytics/export?${params.toString()}`, {
        method: "GET",
        headers: token ? { Authorization: "Bearer " + token } : {},
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