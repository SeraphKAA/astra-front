import { apiRequest } from "../../../shared/commonApi";

// ============ Отзывы (Reviews) ============

// Создание нового отзыва
export const createReview = (body) =>
  apiRequest({
    url: "/reviews/",
    method: "POST",
    body,
  });

// Получение списка отзывов с фильтрацией
export const getReviews = (params = {}) => {
  const queryParams = new URLSearchParams();
  
  if (params.user_id) queryParams.append("user_id", params.user_id);
  if (params.status) queryParams.append("status", params.status);
  if (params.min_rating) queryParams.append("min_rating", params.min_rating);
  if (params.max_rating) queryParams.append("max_rating", params.max_rating);
  if (params.skip !== undefined) queryParams.append("skip", params.skip);
  if (params.limit) queryParams.append("limit", params.limit);
  
  const queryString = queryParams.toString();
  return apiRequest({
    url: `/reviews/${queryString ? `?${queryString}` : ""}`,
  });
};

// Получение статистики по отзывам
export const getReviewStats = () =>
  apiRequest({
    url: "/reviews/stats",
  });

// Получение конкретного отзыва по ID
export const getReview = (reviewId) =>
  apiRequest({
    url: `/reviews/${reviewId}`,
  });

// Обновление отзыва
export const updateReview = (reviewId, body) =>
  apiRequest({
    url: `/reviews/${reviewId}`,
    method: "PUT",
    body,
  });

// Удаление отзыва (мягкое удаление)
export const deleteReview = (reviewId) =>
  apiRequest({
    url: `/reviews/${reviewId}`,
    method: "DELETE",
  });

// Модерация отзыва (только для модераторов и админов)
export const moderateReview = (reviewId, body) =>
  apiRequest({
    url: `/reviews/${reviewId}/moderate`,
    method: "PUT",
    body,
  });

// Восстановление удаленного отзыва (только для модераторов и админов)
export const restoreReview = (reviewId) =>
  apiRequest({
    url: `/reviews/${reviewId}/restore`,
    method: "POST",
  });