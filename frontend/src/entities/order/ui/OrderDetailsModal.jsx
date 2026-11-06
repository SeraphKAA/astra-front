import React, { useMemo, useState } from "react";
import { Modal } from "../../../shared/ui/Modal/Modal";
import styles from "./OrderDetailsModal.module.css";
import { useAuth } from "../../../app/auth/AuthContext";
import { useToast } from "../../../shared/ui/Toast/ToastProvider";
import { refundOrder } from "../../../entities/order/api/orderApi";

const STATUS_LABELS = {
  created: "Создан",
  paid: "Оплачен",
  processing: "В обработке",
  completed: "Выполнен",
  canceled: "Отменён",
};

const STATUS_TONE = {
  created: "neutral",
  paid: "info",
  processing: "info",
  completed: "ok",
  canceled: "danger",
};

const ORDER_TYPE_LABELS = {
  manual: "Ручной",
  auto: "Автоматический",
};

const FULFILLMENT_LABELS = {
  pending: "В ожидании",
  processing: "В обработке",
  success: "Успешно",
  failed: "Провайдер отклонил",
};

const formatPrice = (value) => {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${n.toLocaleString("ru-RU")} ₽`;
};

const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const userLabel = (order) =>
  order?.user_nickname ||
  order?.user_login ||
  order?.user_email ||
  (order?.user_id != null ? `ID ${order.user_id}` : "—");

const sellerLabel = (order) =>
  order?.seller_nickname ||
  order?.seller_login ||
  (order?.assigned_seller_id != null ? `ID ${order.assigned_seller_id}` : "—");

const productLabel = (order) =>
  order?.product_name ||
  (order?.product_id != null ? `Товар #${order.product_id}` : "—");

const isPlainObject = (v) => v && typeof v === "object" && !Array.isArray(v);

const JsonBlock = ({ value }) => {
  const text = useMemo(() => {
    if (value == null) return "";
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);

  if (!text) return null;
  return <pre className={styles.json}>{text}</pre>;
};

const InfoRow = ({ label, value, mono = false, tone }) => (
  <div className={styles.row}>
    <span className={styles.rowLabel}>{label}</span>
    <span
      className={[
        styles.rowValue,
        mono ? styles.mono : "",
        tone ? styles[tone] : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {value ?? "—"}
    </span>
  </div>
);

const Section = ({ title, children, tone = "default" }) => (
  <section className={`${styles.section} ${styles[`section_${tone}`]}`}>
    <h4 className={styles.sectionTitle}>{title}</h4>
    <div className={styles.sectionBody}>{children}</div>
  </section>
);

/* Данные, которые покупатель ввёл при оформлении (invite_url, email и т.п.).
   Схема приходит вместе со снапшотом, поэтому подписи берём из неё —
   так в модалке видно «Steam invite URL», а не invite_url. */
const CheckoutDataBlock = ({ snapshot }) => {
  const rows = useMemo(() => {
    if (!snapshot || typeof snapshot !== "object") return [];
    const data = snapshot.data;
    if (!data || typeof data !== "object") return [];

    const labelByKey = {};
    if (Array.isArray(snapshot.fields)) {
      for (const f of snapshot.fields) {
        if (f?.key) labelByKey[f.key] = f.label || f.key;
      }
    }

    return Object.entries(data)
      .filter(
        ([, val]) => val !== null && val !== undefined && String(val).trim() !== ""
      )
      .map(([key, val]) => ({
        key,
        label: labelByKey[key] || key,
        value: String(val),
      }));
  }, [snapshot]);

  if (rows.length === 0) return null;

  const title =
    snapshot.schema_title || snapshot.profile_type || "Данные для выдачи";

  return (
    <Section title="Данные для выдачи">
      <InfoRow label="Схема" value={title} />
      {snapshot.confirmed_at ? (
        <InfoRow label="Подтверждено" value={formatDate(snapshot.confirmed_at)} />
      ) : null}
      {rows.map((r) => (
        <InfoRow key={r.key} label={r.label} value={r.value} />
      ))}
    </Section>
  );
};

/* Форма возврата для сотрудников. Показывается, только если заказ
   оплачен и ещё не возвращён (order.can_refund). После успешного
   возврата зовём onRefunded (родитель обновит данные) и закрываем модалку. */
const RefundForm = ({ order, onRefunded, onClose }) => {
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  if (!order?.can_refund) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      pushToast({ type: "error", message: "Укажите причину возврата" });
      return;
    }

    let parsedAmount = null;
    if (amount.trim()) {
      const numeric = Number(amount.replace(",", "."));
      if (!Number.isFinite(numeric) || numeric <= 0) {
        pushToast({ type: "error", message: "Сумма должна быть положительным числом" });
        return;
      }
      parsedAmount = numeric;
    }

    setBusy(true);
    try {
      const result = await refundOrder(order.public_id, trimmedReason, parsedAmount);
      pushToast({
        type: "success",
        message: `Возврат ${result?.refunded_amount ?? ""} ₽ выполнен`,
      });
      setOpen(false);
      setReason("");
      setAmount("");
      onRefunded?.(result);
      onClose?.();
    } catch (err) {
      pushToast({
        type: "error",
        message: err?.message || "Не удалось оформить возврат",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Возврат средств" tone="danger">
      {!open ? (
        <div className={styles.refundIntro}>
          <p className={styles.refundHint}>
            Вернуть можно всю сумму или её часть. Деньги зачислятся на баланс покупателя.
          </p>
          <button
            type="button"
            className={styles.refundBtn}
            onClick={() => setOpen(true)}
          >
            Оформить возврат
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.refundForm}>
          <label className={styles.refundField}>
            <span className={styles.refundLabel}>Причина *</span>
            <textarea
              className={styles.refundInput}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Опишите причину — она попадёт в аудит"
              disabled={busy}
              required
            />
          </label>

          <label className={styles.refundField}>
            <span className={styles.refundLabel}>
              Сумма, ₽ (пусто — вся стоимость заказа)
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              className={styles.refundInput}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={order.total_price != null ? String(order.total_price) : ""}
              disabled={busy}
            />
          </label>

          <div className={styles.refundActions}>
            <button
              type="button"
              className={styles.refundCancel}
              onClick={() => {
                setOpen(false);
                setReason("");
                setAmount("");
              }}
              disabled={busy}
            >
              Отмена
            </button>
            <button
              type="submit"
              className={styles.refundSubmit}
              disabled={busy || !reason.trim()}
              aria-busy={busy || undefined}
            >
              {busy ? "Возвращаем…" : "Вернуть деньги"}
            </button>
          </div>
        </form>
      )}
    </Section>
  );
};

const   RefundBlock = ({ order }) => {
  if (!order?.refunded_at && order?.refund_amount == null) return null;

  return (
    <Section title="Возврат средств" tone="danger">
      <InfoRow label="Сумма" value={formatPrice(order.refund_amount)} />
      <InfoRow label="Когда" value={formatDate(order.refunded_at)} />
      {order.refunded_by_id != null ? (
        <InfoRow
          label="Кто оформил"
          value={`ID ${order.refunded_by_id}`}
          mono
        />
      ) : null}
      {order.refund_reason ? (
        <InfoRow label="Причина" value={order.refund_reason} />
      ) : null}
    </Section>
  );
};

export const OrderDetailsModal = ({
  isOpen,
  onClose,
  order,
  loading,
  error,
  onRefunded,
}) => {
  const { user } = useAuth();
  const isStaff = ["support", "seller", "moderator", "admin"].includes(user?.role);
  const title = order?.public_id ? `Заказ ${order.public_id}` : "Детали заказа";
  const statusKey = (order?.status || "").toLowerCase();
  const statusLabel = STATUS_LABELS[statusKey] || order?.status || "—";
  const statusTone = STATUS_TONE[statusKey] || "neutral";
  const typeLabel = ORDER_TYPE_LABELS[order?.order_type] || order?.order_type;

  const hasDelivered = isPlainObject(order?.delivered_payload);
  const hasProviderResponse = isPlainObject(order?.provider_last_response);

  return (
    <Modal 
    isOpen={isOpen} 
    onClose={onClose} 
    title={
        <div>
            <span style={ {textTransform: "none"} }>
                {title}
            </span>
            <button
                type="button"
                className={styles.orderDetailCloseBtn}
                onClick={onClose}
                aria-label="Закрыть"
            >
                <span aria-hidden="true">✕</span>
            </button>
        </div>
    }
    >
      {loading ? (
        <div className={styles.state} role="status" aria-live="polite">
          Загрузка…
        </div>
      ) : error ? (
        <div className={`${styles.state} ${styles.stateError}`} role="alert">
          {String(error)}
        </div>
      ) : !order ? (
        <div className={styles.state}>Нет данных</div>
      ) : (
        <div className={styles.root}>
          {/* Шапка: статус и тип — самая важная информация, читается первой */}
          <div className={styles.head}>
            <span className={`${styles.badge} ${styles[`badge_${statusTone}`]}`}>
              {statusLabel}
            </span>
            <span className={styles.headType}>{typeLabel}</span>
            {order.is_paid ? (
              <span className={`${styles.pill} ${styles.pill_ok}`}>Оплачен</span>
            ) : (
              <span className={`${styles.pill} ${styles.pill_warn}`}>
                Не оплачен
              </span>
            )}
            {order.has_seller_reply ? (
              <span className={`${styles.pill} ${styles.pill_info}`}>
                Ответ продавца
              </span>
            ) : null}
          </div>

          <Section title="Товар">
            <InfoRow label="Название" value={productLabel(order)} />
            <InfoRow
              label="Цена за единицу"
              value={formatPrice(order.product_price)}
            />
            <InfoRow label="Количество" value={order.quantity} />
            <InfoRow
              label="Итого"
              value={formatPrice(order.total_price)}
              tone="strong"
            />
          </Section>

          {isStaff && (
            <Section title="Финансы">
              <InfoRow label="Общая сумма" value={formatPrice(order.total_price)} tone="strong" />
              <InfoRow label="Списано с баланса" value={formatPrice(order.balance_used)} />
              <InfoRow label="Оплачено внешне" value={formatPrice(order.external_amount_due)} />
              <InfoRow 
                label="Промокод" 
                value={order.promocode_id ? `Использован (ID: ${order.promocode_id})` : "Не использован"} 
              />
            </Section>
          )}

          <Section title="Покупатель">
            <InfoRow label="Имя" value={userLabel(order)} />
            {order.user_email ? (
              <InfoRow label="Email" value={order.user_email} />
            ) : null}
            <InfoRow label="ID" value={order.user_id} mono />
          </Section>

          <Section title="Продавец">
            <InfoRow
              label="Назначен"
              value={order.assigned_seller_id != null ? sellerLabel(order) : "—"}
            />
            {order.assigned_seller_id != null ? (
              <InfoRow label="ID" value={order.assigned_seller_id} mono />
            ) : null}
          </Section>

          <CheckoutDataBlock snapshot={order.customer_checkout_data} />

          {hasDelivered && (
            <Section title="Что отдал провайдер">
              <JsonBlock value={order.delivered_payload} />
            </Section>
          )}

          {hasProviderResponse && (
            <Section title="Ответ провайдера" tone="muted">
              <JsonBlock value={order.provider_last_response} />
            </Section>
          )}
          {isStaff && (
            <RefundForm
              order={order}
              onRefunded={onRefunded}
              onClose={onClose}
            />
          )}

          <RefundBlock order={order} />

          <div className={styles.footer}>
            <span className={styles.footerItem}>
              <span className={styles.footerLabel}>Создан</span>
              <span className={styles.footerValue}>
                {formatDate(order.created_at)}
              </span>
            </span>
            <span className={styles.footerItem}>
              <span className={styles.footerLabel}>Public ID</span>
              <span className={`${styles.footerValue} ${styles.mono}`}>
                {order.public_id}
              </span>
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
};
