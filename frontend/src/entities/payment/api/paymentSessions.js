import { apiRequest } from "../../../shared/commonApi";

export const paymentMethods = () => apiRequest({ url: "/payment-sessions/methods" });
export const previewPayment = (body) => apiRequest({ url: "/payment-sessions/preview", method: "POST", body });
export const createPayment = (body) => apiRequest({ url: "/payment-sessions", method: "POST", body });
export const getPayment = (id) => apiRequest({ url: `/payment-sessions/${encodeURIComponent(id)}` });
export const claimPayment = (id) => apiRequest({ url: `/payment-sessions/${encodeURIComponent(id)}/claimed`, method: "POST" });
export const recentPayments = () => apiRequest({ url: "/payment-sessions/recent" });
