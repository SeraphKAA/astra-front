import React from "react";
import styles from "./pagination.module.css";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Пагинация для API с page/size (total, pages в ответе).
 */
export const Pagination = ({
  page = 1,
  pages = 1,
  total = 0,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
  loading = false,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}) => {
  const safePages = Math.max(1, pages || 1);
  const canPrev = page > 1 && !loading;
  const canNext = page < safePages && !loading;

  if (total <= 0 && !loading) {
    return null;
  }

  return (
    <div className={styles.pagination} role="navigation" aria-label="Пагинация">
      <div className={styles.paginationInfo}>
        {total > 0 ? (
          <>
            Показано{" "}
            <strong>
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
            </strong>{" "}
            из <strong>{total}</strong>
          </>
        ) : (
          "Нет записей"
        )}
      </div>

      <div className={styles.paginationControls}>
        {onPageSizeChange && (
          <label className={styles.pageSizeLabel}>
            На странице
            <select
              className={styles.pageSizeSelect}
              value={pageSize}
              disabled={loading}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          type="button"
          className={styles.pageButton}
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
        >
          Назад
        </button>
        <span className={styles.pageIndicator}>
          {page} / {safePages}
        </span>
        <button
          type="button"
          className={styles.pageButton}
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
        >
          Вперёд
        </button>
      </div>
    </div>
  );
};

/**
 * Пагинация для API с limit/offset (hasMore = items.length === limit).
 */
export const OffsetPagination = ({
  offset = 0,
  limit = 20,
  total,
  hasMore = false,
  onPrev,
  onNext,
  onLimitChange,
  loading = false,
  limitOptions = PAGE_SIZE_OPTIONS,
}) => {
  const from = total === 0 ? 0 : offset + 1;
  const to = offset + (total != null ? Math.min(limit, total - offset) : limit);

  return (
    <div className={styles.pagination} role="navigation" aria-label="Пагинация">
      <div className={styles.paginationInfo}>
        {total != null ? (
          <>
            Показано <strong>{from}–{Math.min(offset + limit, total)}</strong> из{" "}
            <strong>{total}</strong>
          </>
        ) : (
          <>Загружено записей: {offset + (hasMore ? limit : to)}</>
        )}
      </div>

      <div className={styles.paginationControls}>
        {onLimitChange && (
          <label className={styles.pageSizeLabel}>
            На странице
            <select
              className={styles.pageSizeSelect}
              value={limit}
              disabled={loading}
              onChange={(e) => onLimitChange(Number(e.target.value))}
            >
              {limitOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          type="button"
          className={styles.pageButton}
          disabled={offset <= 0 || loading}
          onClick={onPrev}
        >
          Назад
        </button>
        <button
          type="button"
          className={styles.pageButton}
          disabled={!hasMore || loading}
          onClick={onNext}
        >
          Вперёд
        </button>
      </div>
    </div>
  );
};
