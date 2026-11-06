import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import "./review.css";
import {
  getReviews,
  getReviewStats,
  createReview,
  updateReview,
  deleteReview,
  moderateReview,
  restoreReview,
} from "../../entities/review/api/reviewApi";
import { useAuth } from "../../app/auth/AuthContext";
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import { Modal } from "../../shared/ui/Modal/Modal";
import { Spinner } from "../../shared/ui/Spinner/Spinner";
import { normalizeMediaUrl } from "../../shared/commonApi";

// Компонент звёзд (SVG)
const Star = ({ filled, size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? "#e2799b" : "none"}
    stroke="#e2799b"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

// Рендер звёзд для рейтинга
const RatingStars = ({ rating, max = 5 }) => (
  <span className="review-rating-stars">
    {Array.from({ length: max }, (_, i) => (
      <Star key={i} filled={i < rating} size={18} />
    ))}
  </span>
);

// Маппер статусов
const statusLabels = {
  pending: "На модерации",
  approved: "Одобрен",
  rejected: "Отклонён",
  deleted: "Удалён",
};

// Карточка отзыва (теперь только отображение, клик открывает детали)
const ReviewCard = ({ review, index, onClick }) => {
  return (
    <div
      className="review-card"
      style={{ animationDelay: `${index * 0.05}s` }}
      onClick={() => onClick(review)}
    >
      {/* Блок товара */}
      <div className="review-product">
        {review.product_image_url && (
          <img
            src={normalizeMediaUrl(review.product_image_url)}
            alt={review.product_name || "Товар"}
            className="review-product-image"
          />
        )}
        <span className="review-product-name text-none">
          {review.product_name || "Товар не указан"}
        </span>
      </div>

      <div className="review-card-header">
        <span className="review-author">
          {review.username || `Пользователь ${review.user_id}`}
        </span>
        <RatingStars rating={review.rating} />
      </div>
      <p className="review-text">{review.comment || "(без текста)"}</p>
    </div>
  );
};

// Детальная модалка
const ReviewDetailModal = ({
  isOpen,
  onClose,
  review,
  currentUser,
  isModerator,
  isAdmin,
  onModerate,
  onDelete,
  onRestore,
  onEdit,
}) => {
  if (!review) return null;

  const isAuthor = currentUser?.id === review.user_id;

  const showModerateButtons = (isModerator || isAdmin) && review.status === "pending";
  const showRestoreButton = (isModerator || isAdmin) && review.status === "deleted";
  const canEdit =
    isAuthor &&
    review.status !== "deleted" &&
    review.status !== "approved";
  const canDelete =
    (isAuthor && review.status !== "deleted" && review.status !== "approved") ||
    isModerator || isAdmin;

  const handleEdit = () => {
    onEdit(review);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Детали отзыва">
      <div className="review-detail">
        <div className="detail-row">
          <span className="detail-label">Покупатель:</span>
          <span>{review.username || `Пользователь ${review.user_id}`}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Рейтинг:</span>
          <RatingStars rating={review.rating} />
        </div>
        <div className="detail-row">
          <span className="detail-label">Текст:</span>
          <p>{review.comment || "(без текста)"}</p>
        </div>

        <div className="detail-row">
          <span className="detail-label">Товар:</span>
          {/* <div className="detail-product-info"> */}
            {/* {review.product_image_url && (
              <img
                src={normalizeMediaUrl(review.product_image_url)}
                alt={review.product_name || "Товар"}
                className="detail-product-image"
              />
            )} */}
          <p>{review.product_name || "Не указан"}</p>
          {/* </div> */}
        </div>

        {(isModerator || isAdmin) && (
          <>
            <div className="detail-row">
              <span className="detail-label">Статус:</span>
              <span className={`review-status status-${review.status}`}>
                {statusLabels[review.status] || review.status}
              </span>
            </div>
            {review.rejection_reason && (
              <div className="detail-row">
                <span className="detail-label">Причина отклонения:</span>
                <span>{review.rejection_reason}</span>
              </div>
            )}
            {review.moderator_note && (
              <div className="detail-row">
                <span className="detail-label">Заметка модератора:</span>
                <span>{review.moderator_note}</span>
              </div>
            )}
            {review.moderated_at && (
              <div className="detail-row">
                <span className="detail-label">Дата модерации:</span>
                <span>{new Date(review.moderated_at).toLocaleString()}</span>
              </div>
            )}
          </>
        )}

        <div className="detail-row">
          <span className="detail-label">Создан:</span>
          <span>{new Date(review.created_at).toLocaleString()}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Обновлён:</span>
          <span>{new Date(review.updated_at).toLocaleString()}</span>
        </div>

        <div className="review-detail-actions">
          {showModerateButtons && (
            <>
              <button
                className="btn-moderate approve"
                onClick={() => onModerate(review.id, { status: "approved" })}
              >
                Одобрить
              </button>
              <button
                className="btn-moderate reject"
                onClick={() => onModerate(review.id, { status: "rejected" })}
              >
                Отклонить
              </button>
            </>
          )}
          {showRestoreButton && (
            <button className="btn-restore" onClick={() => onRestore(review.id)}>
              Восстановить
            </button>
          )}
          {canEdit && (
            <button className="btn-edit" onClick={handleEdit}>
              Редактировать
            </button>
          )}
          {canDelete && (
            <button className="btn-delete" onClick={() => onDelete(review.id)}>
              Удалить
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

// Основной компонент
const Review = () => {
  const { user, isAuthenticated } = useAuth();
  const { pushToast } = useToast();

  // Все отзывы, загруженные с сервера
  const [allReviews, setAllReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  // Фильтры (только для модераторов/админов)
  const [filters, setFilters] = useState({
    user_username: "",
    status: "",
    min_rating: "",
    max_rating: "",
  });

  // Количество отображаемых отзывов (для бесконечной прокрутки)
  const [displayedCount, setDisplayedCount] = useState(20);
  const STEP = 20;

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [editData, setEditData] = useState({ rating: 5, comment: "" });
  const [isUpdating, setIsUpdating] = useState(false);

  // Детальная модалка
  const [selectedReview, setSelectedReview] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const observerRef = useRef();
  const loadingRef = useRef(false);

  // Роли
  const isModerator = user?.role === "moderator";
  const isAdmin = user?.role === "admin";
  const isCustomer = !isModerator && !isAdmin;

  // Загрузка статистики
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getReviewStats();
        setStats(data);
      } catch (err) {
        pushToast({ type: "error", message: `Ошибка загрузки статистики: ${err}` || "Ошибка загрузки статистики" });
      }
    };
    fetchStats();
  }, []);

  // Загрузка всех отзывов
  useEffect(() => {
    const loadAllReviews = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = {
          skip: 0,
          limit: 20,
        };
        if (!isAuthenticated || isCustomer) {
          params.status = "approved";
        }
        const data = await getReviews(params);
        setAllReviews(data || []);
        setDisplayedCount(20);
      } catch (err) {
        setError(err.message || "Не удалось загрузить отзывы");
      } finally {
        setLoading(false);
      }
    };

    loadAllReviews();
    // eslint-disable-next-line
  }, [isAuthenticated, isCustomer]);

  // Локальная фильтрация
  const filteredReviews = useMemo(() => {
    let result = [...allReviews];

    if (filters.user_username.trim()) {
      const query = filters.user_username.trim().toLowerCase();
      result = result.filter((r) => r.username?.toLowerCase().includes(query));
    }

    if ((isModerator || isAdmin) && filters.status) {
      result = result.filter((r) => r.status === filters.status);
    } else if (isCustomer || !isAuthenticated) {
      result = result.filter((r) => r.status === "approved");
    }

    if (filters.min_rating) {
      result = result.filter((r) => r.rating >= Number(filters.min_rating));
    }
    if (filters.max_rating) {
      result = result.filter((r) => r.rating <= Number(filters.max_rating));
    }

    return result;
  }, [allReviews, filters, isModerator, isAdmin, isCustomer, isAuthenticated]);

  // Отображаемая часть
  const visibleReviews = useMemo(() => {
    return filteredReviews.slice(0, displayedCount);
  }, [filteredReviews, displayedCount]);

  // Сброс displayedCount при изменении фильтров
  useEffect(() => {
    setDisplayedCount(20);
  }, [filters]);

  // Бесконечная прокрутка
  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    if (displayedCount >= filteredReviews.length) return;
    loadingRef.current = true;
    setTimeout(() => {
      setDisplayedCount((prev) => Math.min(prev + STEP, filteredReviews.length));
      loadingRef.current = false;
    }, 300);
  }, [displayedCount, filteredReviews.length]);

  const sentinelRef = useCallback(
    (node) => {
      if (loading) return;
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && displayedCount < filteredReviews.length) {
          loadMore();
        }
      });
      if (node) observerRef.current.observe(node);
    },
    [loading, displayedCount, filteredReviews.length, loadMore]
  );

  // Открытие детальной модалки
  const openDetailModal = (review) => {
    setSelectedReview(review);
    setIsDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedReview(null);
  };

  // Обработчики
  const handleModerate = async (id, data) => {
    try {
      const updated = await moderateReview(id, data);
      setAllReviews((prev) => prev.map((r) => (r.id === id ? updated : r)));
      pushToast({ type: "success", message: "Модерация выполнена" });
      closeDetailModal();
    } catch (err) {
      pushToast({ type: "error", message: err?.message || "Ошибка модерации" });
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteReview(id);
      setAllReviews((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "deleted" } : r))
      );
      pushToast({ type: "success", message: "Отзыв удалён" });
      closeDetailModal();
    } catch (err) {
      pushToast({ type: "error", message: err?.message || "Ошибка удаления" });
    }
  };

  const handleRestore = async (id) => {
    try {
      const restored = await restoreReview(id);
      setAllReviews((prev) => prev.map((r) => (r.id === id ? restored : r)));
      pushToast({ type: "success", message: "Отзыв восстановлен" });
      closeDetailModal();
    } catch (err) {
      pushToast({ type: "error", message: err?.message || "Ошибка восстановления" });
    }
  };

  const openEditModal = (review) => {
    setEditingReview(review);
    setEditData({ rating: review.rating, comment: review.comment || "" });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingReview) return;
    setIsUpdating(true);
    try {
      const updated = await updateReview(editingReview.id, {
        rating: editData.rating,
        comment: editData.comment.trim() || undefined,
      });
      setAllReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      pushToast({ type: "success", message: "Отзыв обновлён" });
      setIsEditModalOpen(false);
      setEditingReview(null);
    } catch (err) {
      pushToast({ type: "error", message: err?.message || "Ошибка обновления" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

   return (
    <div className="review-page">
      <div className="content review-content">
        <div className="review-header">
          <h2 className="review-title">Отзывы</h2>

          {stats && (
            <div className="review-stats">
              <div className="stat-item">
                <span className="stat-label">Средняя оценка</span>
                <span className="stat-value">{stats.average_rating?.toFixed(1) || "—"}</span>
              </div>
              <div className="stat-distribution">
                {stats.distribution &&
                  Object.entries(stats.distribution).map(([rating, count]) => (
                    <div key={rating} className="dist-item">
                      <span>{rating}★</span>
                      <span>{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {(isModerator || isAdmin) && (
          <div className="review-filters">
            <input
              name="user_username"
              placeholder="Имя пользователя"
              value={filters.user_username}
              onChange={handleFilterChange}
            />
            <select name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">Все статусы</option>
              <option value="pending">На модерации</option>
              <option value="approved">Одобренные</option>
              <option value="rejected">Отклонённые</option>
              <option value="deleted">Удалённые</option>
            </select>
            <input
              type="number"
              name="min_rating"
              placeholder="Рейтинг от"
              min="1"
              max="5"
              value={filters.min_rating}
              onChange={handleFilterChange}
            />
            <input
              type="number"
              name="max_rating"
              placeholder="Рейтинг до"
              min="1"
              max="5"
              value={filters.max_rating}
              onChange={handleFilterChange}
            />
          </div>
        )}

        <div className="review-grid">
          {loading && (
            <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Spinner color="#E2799B" size={44} label="Загрузка..." />
            </div>
          )}
          {error && <p className="review-error">{error}</p>}
          {!loading && !error && visibleReviews.length === 0 && (
            <p className="review-empty">Отзывы не найдены</p>
          )}
          {visibleReviews.map((review, index) => (
            <ReviewCard
              key={review.id}
              review={review}
              index={index}
              onClick={openDetailModal}
            />
          ))}
          {!loading && displayedCount < filteredReviews.length && (
            <div ref={sentinelRef} className="review-sentinel">
              {loadingRef.current ? "Загрузка..." : ""}
            </div>
          )}
        </div>
      </div>

      {/* Модалка создания */}
      {/* <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Создать отзыв"
      >
        <form
          className="review-modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
        >
          <div className="review-modal-field">
            <label>Оценка *</label>
            <input
              type="number"
              min="1"
              max="5"
              required
              value={newReview.rating}
              onChange={(e) =>
                setNewReview((p) => ({ ...p, rating: Number(e.target.value) }))
              }
            />
          </div>
          <div className="review-modal-field">
            <label>Текст отзыва</label>
            <textarea
              value={newReview.comment}
              onChange={(e) =>
                setNewReview((p) => ({ ...p, comment: e.target.value }))
              }
              rows={4}
              placeholder="Напишите ваш отзыв (необязательно)"
            />
          </div>
          <div className="review-modal-actions">
            <button type="button" onClick={() => setIsCreateModalOpen(false)}>
              Отмена
            </button>
            <button type="submit" disabled={isCreating}>
              {isCreating ? "Создание..." : "Создать"}
            </button>
          </div>
        </form>
      </Modal> */}

      {/* Модалка редактирования */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          if (!isUpdating) {
            setIsEditModalOpen(false);
            setEditingReview(null);
          }
        }}
        title="Редактировать отзыв"
      >
        <form
          className="review-modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleUpdate();
          }}
        >
          <div className="review-modal-field">
            <label>Оценка *</label>
            <input
              type="number"
              min="1"
              max="5"
              required
              value={editData.rating}
              onChange={(e) =>
                setEditData((p) => ({ ...p, rating: Number(e.target.value) }))
              }
            />
          </div>
          <div className="review-modal-field">
            <label>Текст отзыва</label>
            <textarea
              value={editData.comment}
              onChange={(e) =>
                setEditData((p) => ({ ...p, comment: e.target.value }))
              }
              rows={4}
              placeholder="Напишите ваш отзыв (необязательно)"
            />
          </div>
          <div className="review-modal-actions">
            <button
              type="button"
              onClick={() => {
                if (!isUpdating) {
                  setIsEditModalOpen(false);
                  setEditingReview(null);
                }
              }}
            >
              Отмена
            </button>
            <button type="submit" disabled={isUpdating}>
              {isUpdating ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Детальная модалка */}
      <ReviewDetailModal
        isOpen={isDetailModalOpen}
        onClose={closeDetailModal}
        review={selectedReview}
        currentUser={user}
        isModerator={isModerator}
        isAdmin={isAdmin}
        onModerate={handleModerate}
        onDelete={handleDelete}
        onRestore={handleRestore}
        onEdit={openEditModal}
      />
    </div>
  );
};

export default Review;