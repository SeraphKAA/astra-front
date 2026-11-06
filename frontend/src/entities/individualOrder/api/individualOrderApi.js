import { apiRequest } from "../../../shared/commonApi";

export const createIndividualOrder = (body) => apiRequest({
    url: "/individual-orders", method: "POST", body,
});

export const getIndividualOrder = (publicId) => apiRequest({
    url: `/individual-orders/${encodeURIComponent(publicId)}`,
});

export const payIndividualOrder = (publicId) => apiRequest({
    url: `/individual-orders/${encodeURIComponent(publicId)}/payment`, method: "POST",
});

export const openIndividualOrderPayment = (payment) => {
    if (!payment?.payment_action_url || payment.payment_method !== "POST") {
        throw new Error("Не удалось получить ссылку на оплату. Попробуйте ещё раз.");
    }
    const form = document.createElement("form");
    form.method = "POST";
    form.action = payment.payment_action_url;
    form.style.display = "none";
    document.body.appendChild(form);
    form.submit();
    form.remove();
};
