import { apiRequest } from "../../../shared/commonApi";

/* ========================
   CHAT
======================== */

export const getChat = (chatType, orderId = null) => {
    const orderQuery = orderId ? `?order_id=${encodeURIComponent(orderId)}` : "";
    return apiRequest({
        url: `/chats/${chatType}${orderQuery}`,
    });
};

/* ========================
   MESSAGES
======================== */

export const sendMessage = (chatType, data, orderId = null) => {
    const orderQuery = orderId ? `?order_id=${encodeURIComponent(orderId)}` : "";
    return apiRequest({
        url: `/chats/${chatType}/messages${orderQuery}`,
        method: "POST",
        body: data,
    });
};

export const getMessages = (chatType, limit = 50, offset = 0, orderId = null) => {
    const orderQuery = orderId ? `&order_id=${encodeURIComponent(orderId)}` : "";
    return apiRequest({
        url: `/chats/${chatType}/messages?limit=${limit}&offset=${offset}${orderQuery}`,
    });
};

export const getSupportChats = (limit = 50, offset = 0) => {
    return apiRequest({
        url: `/chats/support/chats?limit=${limit}&offset=${offset}`,
    });
};

export const getSupportMessages = (chatId, limit = 100, offset = 0) => {
    return apiRequest({
        url: `/chats/support/chats/${chatId}/messages?limit=${limit}&offset=${offset}`,
    });
};

export const sendSupportMessage = (chatId, data) => {
    return apiRequest({
        url: `/chats/support/chats/${chatId}/messages`,
        method: "POST",
        body: data,
    });
};

export const editMessage = (messageId, data) => {
    return apiRequest({
        url: `/chats/messages/${messageId}`,
        method: "PATCH",
        body: data,
    });
};

export const deleteMessage = (messageId) => {
    return apiRequest({
        url: `/chats/messages/${messageId}`,
        method: "DELETE",
    });
};


/* ========================
   ATTACHMENTS
======================== */

export const uploadImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest({
    url: '/upload-attachment/image',
    method: 'POST',
    body: formData,
    headers: {
      // Не указываем Content-Type, чтобы браузер сам выставил multipart/form-data с boundary
    },
  });
};