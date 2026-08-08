import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  exportOrdersAnalyticsExcel,
  getAdminDashboardAnalytics,
} from "../../entities/order/api/orderApi";
import { Spinner } from "../../shared/ui/Spinner/Spinner";
import styles from "./dashboard.module.css";

const formatMoney = (value) =>
  `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)} ₽`;

const formatNumber = (value) =>
  new Intl.NumberFormat("ru-RU").format(Number(value) || 0);

const formatShortDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const STATUS_CLASS = {
  created: styles.statusCreated,
  paid: styles.statusPaid,
  processing: styles.statusProcessing,
  completed: styles.statusCompleted,
  canceled: styles.statusCanceled,
};

const UsersIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

const OrdersIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v2H7v-2z" />
  </svg>
);

const RevenueIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z" />
  </svg>
);

const ProductsIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-2 .89-2 2v11c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z" />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
  </svg>
);

const DailyChart = ({ points }) => {
  const maxRevenue = useMemo(
    () => Math.max(...points.map((p) => p.revenue), 1),
    [points]
  );

  return (
    <div className={styles.chart}>
      <div className={styles.chartBars}>
        {points.map((point) => {
          const height = Math.max(6, Math.round((point.revenue / maxRevenue) * 100));
          return (
            <div key={point.date} className={styles.chartBarWrap}>
              <div
                className={styles.chartBar}
                style={{ height: `${height}%` }}
                title={`${formatShortDate(point.date)}: ${formatMoney(point.revenue)}, ${formatNumber(point.orders)} заказов`}
              />
              <span className={styles.chartLabel}>{formatShortDate(point.date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatusBars = ({ items, total }) => (
  <div className={styles.statusList}>
    {items.map((item) => {
      const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;
      return (
        <div key={item.status} className={styles.statusRow}>
          <div className={styles.statusMeta}>
            <span className={`${styles.statusBadge} ${STATUS_CLASS[item.status] || ""}`}>
              {item.label}
            </span>
            <span className={styles.statusCount}>{formatNumber(item.count)}</span>
          </div>
          <div className={styles.statusTrack}>
            <div
              className={`${styles.statusFill} ${STATUS_CLASS[item.status] || ""}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      );
    })}
  </div>
);

export const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const fetchStats = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const result = await getAdminDashboardAnalytics(14);
      setData(result);
    } catch (err) {
      setError(err?.message || "Не удалось загрузить аналитику");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const toIsoFromDatetimeLocal = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString();
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const onExport = async () => {
    setIsExporting(true);
    try {
      const blob = await exportOrdersAnalyticsExcel({
        dateFrom: toIsoFromDatetimeLocal(dateFrom),
        dateTo: toIsoFromDatetimeLocal(dateTo),
      });
      downloadBlob(blob, "orders_analytics.xlsx");
    } catch (err) {
      alert(err?.message || "Не удалось скачать Excel");
    } finally {
      setIsExporting(false);
    }
  };

  const overview = data?.overview;
  const ordersTotal = useMemo(
    () => (data?.orders_by_status || []).reduce((sum, item) => sum + item.count, 0),
    [data]
  );

  const kpiCards = overview
    ? [
        {
          key: "users",
          title: "Пользователи",
          value: formatNumber(overview.users_count),
          hint: `+${formatNumber(data.today.new_users)} сегодня`,
          icon: <UsersIcon />,
          tone: styles.kpiPink,
        },
        {
          key: "orders",
          title: "Заказы",
          value: formatNumber(overview.orders_count),
          hint: `${formatNumber(data.today.orders)} оплачено сегодня`,
          icon: <OrdersIcon />,
          tone: styles.kpiBlue,
        },
        {
          key: "paid",
          title: "Оплаченная выручка",
          value: formatMoney(overview.paid_revenue),
          hint: `Средний чек ${formatMoney(overview.avg_order_value)}`,
          icon: <RevenueIcon />,
          tone: styles.kpiGreen,
        },
        {
          key: "products",
          title: "Товары",
          value: `${formatNumber(overview.products_active)} / ${formatNumber(overview.products_total)}`,
          hint: `${formatNumber(overview.categories_count)} категорий`,
          icon: <ProductsIcon />,
          tone: styles.kpiPurple,
        },
      ]
    : [];

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <Spinner label="Загружаем дашборд..." />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={styles.errorBox}>
        <p>{error}</p>
        <button type="button" className={styles.refreshBtn} onClick={() => fetchStats()}>
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Админ-панель</p>
          <h1 className={styles.title}>Дашборд магазина</h1>
          <p className={styles.subtitle}>
            Ключевые метрики, динамика продаж и последние заказы в одном месте
          </p>
        </div>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={() => fetchStats(true)}
          disabled={refreshing}
        >
          {refreshing ? "Обновляем..." : "Обновить"}
        </button>
      </header>

      {overview?.attention_orders > 0 && (
        <div className={styles.alertCard}>
          <AlertIcon />
          <div>
            <strong>Требуют внимания: {formatNumber(overview.attention_orders)} заказов</strong>
            <p>Оплаченные и заказы в обработке ждут действий продавца</p>
          </div>
        </div>
      )}

      <section className={styles.kpiGrid}>
        {kpiCards.map((card) => (
          <article key={card.key} className={`${styles.kpiCard} ${card.tone}`}>
            <div className={styles.kpiIcon}>{card.icon}</div>
            <div className={styles.kpiBody}>
              <span className={styles.kpiTitle}>{card.title}</span>
              <span className={styles.kpiValue}>{card.value}</span>
              <span className={styles.kpiHint}>{card.hint}</span>
            </div>
          </article>
        ))}
      </section>

      <section className={styles.periodGrid}>
        {[
          { key: "today", label: "Сегодня", data: data?.today },
          { key: "week", label: "7 дней", data: data?.last_7_days },
          { key: "month", label: "30 дней", data: data?.last_30_days },
        ].map((period) => (
          <article key={period.key} className={styles.periodCard}>
            <h3>{period.label}</h3>
            <div className={styles.periodStats}>
              <div>
                <span>Заказы</span>
                <strong>{formatNumber(period.data?.orders || 0)}</strong>
              </div>
              <div>
                <span>Выручка</span>
                <strong>{formatMoney(period.data?.revenue || 0)}</strong>
              </div>
              <div>
                <span>Новые юзеры</span>
                <strong>{formatNumber(period.data?.new_users || 0)}</strong>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className={styles.mainGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Выручка по дням</h2>
            <span>14 дней, только оплаченные</span>
          </div>
          <DailyChart points={data?.daily_chart || []} />
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Статусы заказов</h2>
            <span>{formatNumber(ordersTotal)} всего</span>
          </div>
          <StatusBars items={data?.orders_by_status || []} total={ordersTotal} />
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Топ товаров</h2>
            <span>по оплаченным заказам</span>
          </div>
          {(data?.top_products || []).length === 0 ? (
            <p className={styles.emptyText}>Пока нет данных о продажах</p>
          ) : (
            <div className={styles.topList}>
              {data.top_products.map((product, index) => (
                <div key={`${product.product_id}-${index}`} className={styles.topItem}>
                  <div className={styles.topRank}>{index + 1}</div>
                  <div className={styles.topInfo}>
                    <strong>{product.product_name}</strong>
                    <span>
                      {formatNumber(product.orders_count)} заказов · {formatMoney(product.revenue)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Каталог</h2>
            <span>сводка</span>
          </div>
          <div className={styles.catalogStats}>
            <div>
              <span>Активные товары</span>
              <strong>{formatNumber(overview?.products_active || 0)}</strong>
            </div>
            <div>
              <span>Категории</span>
              <strong>{formatNumber(overview?.categories_count || 0)}</strong>
            </div>
            <div>
              <span>Промокоды</span>
              <strong>{formatNumber(overview?.promocodes_active || 0)}</strong>
            </div>
            <div>
              <span>Общая выручка</span>
              <strong>{formatMoney(overview?.total_revenue || 0)}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>Последние заказы</h2>
          <span>8 последних</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Товар</th>
                <th>Покупатель</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent_orders || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>
                    Заказов пока нет
                  </td>
                </tr>
              ) : (
                data.recent_orders.map((order) => (
                  <tr key={order.public_id}>
                    <td>{order.public_id}</td>
                    <td>{order.product_name || "—"}</td>
                    <td>{order.user_nickname || "—"}</td>
                    <td>{formatMoney(order.total_price)}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${STATUS_CLASS[order.status] || ""}`}>
                        {order.status_label}
                      </span>
                    </td>
                    <td>{formatDateTime(order.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.exportCard}>
        <div>
          <h2>Экспорт аналитики</h2>
          <p>Скачайте Excel с заказами за выбранный период. Без дат — за всё время.</p>
        </div>
        <div className={styles.exportForm}>
          <label>
            <span>Начало</span>
            <input
              type="datetime-local"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label>
            <span>Конец</span>
            <input
              type="datetime-local"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
          <button type="button" className={styles.exportBtn} onClick={onExport} disabled={isExporting}>
            {isExporting ? "Формируем..." : "Скачать Excel"}
          </button>
        </div>
      </section>
    </div>
  );
};
