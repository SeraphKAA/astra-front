import React, { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../shared/commonApi";
import styles from "./admin.module.css";

export function PaymentsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setData(await apiRequest({ url: "/payment-sessions/admin/review" })); setError(""); }
    catch { setError("Не удалось загрузить платежи. Повторите попытку."); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const date = (value) => value ? new Date(value).toLocaleString("ru-RU") : "Проверок ещё не было";
  const outcomes = { review: "Требует проверки", extra_payment: "Повторный перевод", unmatched: "Заявка не найдена" };
  return <section>
    <h2>Платежи</h2>
    <button type="button" className={styles.adminButtonSecondary} onClick={load}>Обновить</button>
    {error && <p role="alert">{error}</p>}
    {data && <>
      <p>Автопроверка: {data.automation_enabled ? "включена" : "выключена"}</p>
      <p>Последняя проверка ПриватБанка: {date(data.last_bank_check)}</p>
      <p>Последняя проверка Bybit: {date(data.last_crypto_check)}</p>
      {data.bank_sync?.has_backlog && <p role="status">Банк: дочитываем пропущенные уведомления. Позиция сохранена.</p>}
      {data.bank_sync?.error && <p role="alert">Проверка Telegram временно недоступна. Продолжим с сохранённой позиции.</p>}
      {data.bank_sync?.retry_after && <p>Следующая попытка проверки: {date(data.bank_sync.retry_after)}</p>}
      {!!data.bank_sync?.unrecognized_count && <p role="alert">Банковских уведомлений на проверке: {data.bank_sync.unrecognized_count}. Оплата по ним автоматически не подтверждена.</p>}
      {(data.bank_notifications || []).map((item) => <p key={item.message_id}>Уведомление #{item.message_id} · {date(item.sent_at)} · {item.reason === "message_missing" ? "Сообщение недоступно в Telegram" : "Требуется проверка формата или изменения сообщения"}</p>)}
      <h3>Поступления, требующие разбора</h3>
      {!data.receipts.length && <p>Таких поступлений нет.</p>}
      {data.receipts.map((item) => <div key={item.id} className="payment-review-card">
        <strong>{item.amount} {item.currency} · {outcomes[item.outcome]}</strong>
        <p>{item.provider} · {date(item.received_at)}</p><p>Заявка: {item.payment_id || "не определена"}</p><p>Операция: {item.external_id}</p>
      </div>)}
      <h3>Выдача и уведомления</h3>
      {!data.jobs.length && <p>Заданий на проверку нет.</p>}
      {data.jobs.map((item) => <p key={item.id}>Заказ #{item.order_id} · {item.kind} · {item.status === "sending" ? "Обработка начата" : "Требует проверки"}</p>)}
    </>}
  </section>;
}
