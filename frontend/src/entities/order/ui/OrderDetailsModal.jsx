import React, { useMemo } from "react";
import { Modal } from "../../../shared/ui/Modal/Modal";

const row = (label, value) => (
  <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, padding: "6px 0" }}>
    <div style={{ opacity: 0.75 }}>{label}</div>
    <div style={{ wordBreak: "break-word" }}>{value ?? "-"}</div>
  </div>
);

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
      .filter(([, val]) => val !== null && val !== undefined && String(val).trim() !== "")
      .map(([key, val]) => ({
        key,
        label: labelByKey[key] || key,
        value: String(val),
      }));
  }, [snapshot]);

  if (rows.length === 0) return null;

  const title = snapshot.schema_title || snapshot.profile_type || "Данные для выдачи";
  const confirmed = snapshot.confirmed_at
    ? new Date(snapshot.confirmed_at).toLocaleString()
    : null;

  return (
    <>
      <hr style={{ margin: "12px 0", opacity: 0.2 }} />
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Данные для выдачи</div>
      {row("Игра / платформа", title)}
      {confirmed ? row("Подтверждено", confirmed) : null}
      {rows.map((r) => (
        <React.Fragment key={r.key}>{row(r.label, r.value)}</React.Fragment>
      ))}
    </>
  );
};

export const OrderDetailsModal = ({ isOpen, onClose, order, loading, error }) => {
  const title = order?.public_id ? `Заказ ${order.public_id}` : "Детали заказа";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      {loading ? (
        <div>Загрузка...</div>
      ) : error ? (
        <div style={{ color: "#b91c1c" }}>{String(error)}</div>
      ) : !order ? (
        <div>Нет данных</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {row("Public ID", order.public_id)}
          {row("Статус", order.status)}
          {row("Тип", order.order_type)}
          {row("Товар", order.product_name)}
          {row("Цена товара", order.product_price)}
          {row("Количество", order.quantity)}
          {row("Итого", order.total_price)}
          {row("Создан", order.created_at ? new Date(order.created_at).toLocaleString() : "-")}
          <hr style={{ margin: "12px 0", opacity: 0.2 }} />
          {row("Покупатель", order.user_nickname || order.user_login || order.user_email || order.user_id)}
          {row("Продавец", order.seller_nickname || order.seller_login || order.assigned_seller_id)}
          <CheckoutDataBlock snapshot={order.customer_checkout_data} />
        </div>
      )}
    </Modal>
  );
};
