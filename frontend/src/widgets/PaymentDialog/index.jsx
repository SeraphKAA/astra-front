import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/auth/AuthContext";
import { Modal } from "../../shared/ui/Modal/Modal";
import { paymentMethods, previewPayment, createPayment, getPayment, claimPayment, recentPayments } from "../../entities/payment/api/paymentSessions";
import "./payment.css";

export const openPayment = (options) => window.dispatchEvent(new CustomEvent("astra:open-payment", { detail: options }));
const active = (payment) => ["pending", "checking"].includes(payment?.status);
const labels = { 
  pending: "Ожидаем оплату", 
  checking: "Проверяем поступление", 
  confirmed: "Оплата подтверждена", 
  expired: "Время оплаты истекло", 
  review: "Платёж требует проверки"
};
const icons = { 
  russia: "🇷🇺", 
  ukraine: "🇺🇦", 
  crypto: "₮", 
  balance: "₽" 
};
const MethodIcon = ({ method }) => method === "russia" ? <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden="true"><rect width="28" height="20" rx="3" fill="#fff" /><path d="M0 7h28v6H0z" fill="#2456a6" /><path d="M0 13h28v4a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3z" fill="#da3541" /></svg> : method === "ukraine" ? <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden="true"><rect width="28" height="20" rx="3" fill="#2382d2" /><path d="M0 10h28v7a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3z" fill="#ffdc48" /></svg> : <span aria-hidden="true">{icons[method]}</span>;
const money = (value) => Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 8 });

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  return <div className="payment-field"><span>{label}</span><div className="payment-copy"><output>{value}</output><button type="button" className="astra-btn-ghost" onClick={async () => {
    try { await navigator.clipboard.writeText(String(value)); setCopied(true); } catch { setCopied(false); }
  }}>{copied ? "Скопировано" : "Копировать"}</button></div></div>;
}

export function PaymentLauncher() {
  const { user, isAuthenticated, loadUserProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [options, setOptions] = useState(null);
  const [methods, setMethods] = useState([]);
  const [method, setMethod] = useState("russia");
  const [amount, setAmount] = useState("");
  const [network, setNetwork] = useState("TRC20");
  const [useBalance, setUseBalance] = useState(true);
  const [quote, setQuote] = useState(null);
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const requestId = useRef(null);
  const submitted = useRef(false);
  const finished = useRef(null);
  const generation = useRef(0);

  const show = useCallback((value) => {
    generation.current += 1;
    requestId.current = window.crypto.randomUUID();
    submitted.current = false;
    finished.current = null;
    setPayment(null); setQuote(null); setError(""); setBusy(false);
    setAmount(""); setMethod("russia"); setUseBalance(true); setOptions({ ...value, ownerId: user?.id });
  }, [user?.id]);

  useEffect(() => {
    generation.current += 1;
    setOptions(null); setPayment(null); setQuote(null); setError("");
  }, [user?.id, isAuthenticated]);

  useEffect(() => {
    const handler = (event) => show(event.detail);
    window.addEventListener("astra:open-payment", handler);
    return () => window.removeEventListener("astra:open-payment", handler);
  }, [show]);

  useEffect(() => {
    const id = new URLSearchParams(location.search).get("payment");
    if (!id || !isAuthenticated) return;
    show({ paymentId: id });
    const params = new URLSearchParams(location.search); params.delete("payment");
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [location.search, location.pathname, isAuthenticated, navigate, show]);

  useEffect(() => {
    if (!options || !isAuthenticated) return;
    let cancelled = false;
    paymentMethods().then((data) => { if (!cancelled) setMethods(data); }).catch(() => { if (!cancelled) setError("Не удалось загрузить способы оплаты"); });
    if (options.paymentId) getPayment(options.paymentId).then((data) => { if (!cancelled) setPayment(data); }).catch(() => { if (!cancelled) setError("Не удалось открыть платёж"); });
    return () => { cancelled = true; };
  }, [options, isAuthenticated]);

  const orderKey = (options?.order_public_ids || []).join(",");
  const paymentId = payment?.id;
  const paymentStatus = payment?.status;
  const payload = useCallback(() => ({
    request_id: requestId.current, purpose: options?.purpose || "orders", method,
    ...(options?.purpose === "balance" ? { amount_rub: amount.replace(",", ".") } : { order_public_ids: orderKey.split(",").filter(Boolean) }),
    ...(method === "crypto" ? { network } : {}), use_balance: useBalance,
  }), [options?.purpose, method, amount, orderKey, network, useBalance]);

  useEffect(() => {
    setQuote(null);
    if (!options || options.paymentId || payment) return;
    if (options.purpose === "balance") {
      if (!amount) return;
      if (!/^\d+(?:[.,]\d{1,2})?$/.test(amount) || Number(amount.replace(",", ".")) <= 0) { setError("Введите сумму больше нуля, до двух знаков после запятой."); return; }
      if (Number(amount.replace(",", ".")) > 1000000) { setError("Максимальная сумма — 1 000 000 ₽."); return; }
    }
    let cancelled = false;
    const timer = setTimeout(() => previewPayment(payload()).then((data) => {
      if (!cancelled) setQuote(data);
    }).catch((e) => { if (!cancelled) setError(e?.message || "Не удалось рассчитать сумму"); }), 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [options, amount, payload, payment]);

  useEffect(() => {
    if (!paymentId || !["pending", "checking"].includes(paymentStatus)) return;
    let cancelled = false;
    let timer;
    const poll = async () => {
      try {
        const data = await getPayment(paymentId);
        if (!cancelled) { setPayment(data); setError(""); }
        if (!cancelled && active(data)) timer = setTimeout(poll, 5000);
      } catch {
        if (!cancelled) { setError("Не удалось проверить статус. Проверка продолжится автоматически."); timer = setTimeout(poll, 10000); }
      }
    };
    timer = setTimeout(poll, 2000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [paymentId, paymentStatus]);

  useEffect(() => {
    if (payment?.status !== "confirmed" || finished.current === payment.id) return;
    finished.current = payment.id;
    loadUserProfile?.();
    options?.onConfirmed?.();
    window.dispatchEvent(new Event("astra:payment-updated"));
  }, [payment, loadUserProfile, options]);

  useEffect(() => {
    if (!options) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [options]);

  const submit = async (event) => {
    event.preventDefault();
    if (submitted.current || !quote) return;
    submitted.current = true;
    const currentGeneration = generation.current;
    setBusy(true); setError("");
    try {
      const data = await createPayment(payload());
      if (generation.current === currentGeneration) {
        setPayment(data);
        window.dispatchEvent(new Event("astra:payment-updated"));
      }
    } catch (e) { if (generation.current === currentGeneration) setError(e?.message || "Не удалось создать платёж. Повторите попытку."); }
    finally { submitted.current = false; if (generation.current === currentGeneration) setBusy(false); }
  };

  const close = () => { if (!busy) { generation.current += 1; setOptions(null); setPayment(null); } };
  const change = (setter) => (value) => {
    setter(value); setError(""); requestId.current = window.crypto.randomUUID();
  };
  const remaining = payment ? Math.max(0, Math.ceil((new Date(payment.expires_at).getTime() - now) / 1000)) : 0;
  const timer = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  const available = method === "balance" || methods.find((item) => item.id === method)?.available;
  const details = payment?.details || {};
  const isOpen = Boolean(options) && options?.ownerId === user?.id && isAuthenticated;
  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={
        isOpen ? (
          <div className="order-modal-title-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <span>
              {payment
                ? labels[payment.status] || "Оплата"
                : options?.purpose === "balance"
                  ? "Пополнение баланса"
                  : (options?.order_public_ids?.length || 0) > 1
                    ? "Оплата заказов"
                    : "Оплата заказа"}
            </span>
            <button
              type="button"
              className="order-modal-close-btn"
              onClick={close}
              disabled={busy}
              aria-label="Закрыть окно оплаты"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        ) : "Оплата"
      }
      closeDisabled={busy}
    >
      {isOpen && (
      <div className="payment-dialog">
      {!payment && !options?.paymentId && <form onSubmit={submit}>
        <p className="payment-hint">Как {options?.purpose === "balance" ? "пополнить баланс" : "оплатить заказ"}?</p>
        <div className="payment-methods" role="group" aria-label="Способ оплаты">
          {methods.map((item) => 
          <button 
          key={item.id} 
          type="button" 
          className={`payment-method ${method === item.id ? "is-active" : ""}`} 
          aria-pressed={method === item.id} 
          disabled={busy} 
          onClick={() => change(setMethod)(item.id)}>
            <MethodIcon method={item.id} />{item.title}{!item.available && <small>Скоро</small>}
          </button>)}
        </div>
        {options?.purpose === "balance" && <label className="payment-field">Получите на баланс, ₽<input className="astra-field" inputMode="decimal" value={amount} onChange={(e) => change(setAmount)(e.target.value)} placeholder="Например: 500" required disabled={busy} /></label>}
        {options?.purpose === "orders" && <label className="payment-checkbox"><input type="checkbox" checked={useBalance} disabled={busy} onChange={(e) => change(setUseBalance)(e.target.checked)} />Использовать баланс ({money(user?.balance || 0)} ₽)</label>}
        {method === "crypto" && <label className="payment-field">Сеть USDT<select className="astra-field" value={network} onChange={(e) => change(setNetwork)(e.target.value)} disabled={busy}><option>TRC20</option><option>BEP20</option></select></label>}
        {quote && (
          <div className="payment-summary">
            <div className="payment-summary-row">
              <span>Итого: </span>
              <strong>{money(quote.amount_rub)} ₽</strong>
            </div>
            {Number(quote.balance_used) > 0 && (
              <div className="payment-summary-row payment-summary-row--muted">
                <span>С баланса: </span>
                <strong>− {money(quote.balance_used)} ₽</strong>
              </div>
            )}
            <div className="payment-summary-row payment-summary-row--total">
              <span>{quote.currency === "RUB" ? "К оплате: " : `К переводу (${quote.currency}):`}</span>
              <span className="payment-summary-amount">{money(quote.estimated_amount)} ₽</span>
            </div>
            {quote.currency !== "RUB" && (
              <p className="payment-summary-hint">
                Точная сумма появится в заявке. Курс: <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">ExchangeRate-API</a>{quote.currency === "USDT" ? " и Coinbase" : ""}.
              </p>
            )}
          </div>
        )}
        {!available && <p className="payment-hint">Этот способ оплаты ещё не подключён.</p>}
        <button className="astra-btn" type="submit" disabled={busy || !quote || (!available && Number(quote.external_rub) > 0)}>{busy ? "Создаём платёж…" : quote && Number(quote.external_rub) === 0 ? "Оплатить с баланса" : "Получить реквизиты"}</button>
      </form>}
      {payment && <>
        <p className="payment-total">{money(payment.amount_rub)} ₽{payment.purpose === "balance" ? " на баланс" : " за заказ"}</p>
        
        {details.orders?.length > 0 && 
          <p className="payment-hint text-none">
            заказы в этой заявке: {details.orders.map((order) => `${order.public_id} (${money(order.amount_rub)} ₽)`).join(", ")}
          </p>
        }
        
        {active(payment) && <>
          <p className="payment-hint">{payment.method === "crypto" ? "Курс и сумма действуют" : "Время на оплату"}: <strong>{timer}</strong></p>
          {remaining > 0 ? <>
            {payment.method === "russia" ? <a className="astra-btn" href={payment.payment_url} target="_blank" rel="noreferrer" onClick={(e) => {
              const tg = window.Telegram?.WebApp;
              if (tg?.initData) { e.preventDefault(); tg.openLink(payment.payment_url); }
            }}>Перейти в Robokassa</a> : <>
              <CopyField label={`Переведите точно, ${payment.currency}`} value={String(payment.amount).replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1")} />
              {payment.method === "ukraine" ? <><CopyField label="Карта" value={details.card} /><p>{details.bank} · {details.recipient}</p><p className="payment-hint">Переведите без комментария. Не округляйте сумму: копейки помогают найти ваш платёж.</p></> : <><p><strong>USDT · {details.network}</strong></p><CopyField label="Адрес" value={details.address} />{details.tag && <CopyField label="Memo / Tag" value={details.tag} />}<p className="payment-hint">Отправьте через указанную сеть. Сумма должна поступить целиком с учётом комиссии отправителя. Переводы по UID Bybit не поддерживаются. Для каждой оплаты создавайте новую заявку.</p></>}
              <button type="button" className="astra-btn" disabled={busy || payment.status === "checking"} onClick={async () => {
                if (submitted.current) return;
                submitted.current = true; setBusy(true);
                const currentGeneration = generation.current;
                try {
                  const result = await claimPayment(payment.id);
                  if (generation.current === currentGeneration) setPayment(result);
                } catch { if (generation.current === currentGeneration) setError("Не удалось отправить запрос. Повторите попытку."); }
                finally { submitted.current = false; if (generation.current === currentGeneration) setBusy(false); }
              }}>{payment.status === "checking" ? "Проверяем поступление…" : "Я оплатил"}</button>
            </>}
          </> : <p className="payment-hint">Не отправляйте перевод по этой заявке. Обновляем статус…</p>}
          <p className="payment-hint">Зачисление произойдёт после подтверждения платёжного сервиса. Можно закрыть это окно — проверка продолжится.</p>
        </>}
        {payment.status === "confirmed" && <p role="status">{payment.purpose === "balance" ? "Баланс пополнен." : "Заказ оплачен. Его статус доступен в разделе «Покупки»."}</p>}
        {["expired", "review"].includes(payment.status) && <p className="payment-hint">Если перевод уже отправлен, обратитесь в поддержку и укажите номер заявки. Не оплачивайте повторно до проверки.</p>}
        <small className="payment-id">Заявка: {payment.id}</small>
      </>}
      {error && <p role="alert" className="payment-error">{error}</p>}

      {payment && payment.purpose === "orders" && (
        <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--astra-line, #333)" }}>
          <button
            type="button"
            className="astra-btn"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => {
              close();
              navigate("/orders");
            }}
          >
            Перейти к заказам
          </button>
        </div>
      )}
    </div>
    )}
  </Modal>
)};

export function PaymentHistory() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let cancelled = false;
    const load = () => recentPayments().then((data) => { if (!cancelled) setItems(data); }).catch(() => {});
    load(); window.addEventListener("astra:payment-updated", load);
    return () => { cancelled = true; window.removeEventListener("astra:payment-updated", load); };
  }, []);
  if (!items.length) return null;
  return <section className="payment-history"><h2>Платежи</h2>{items.map((item) => <button key={item.id} type="button" onClick={() => openPayment({ paymentId: item.id })}><span>{money(item.amount_rub)} ₽ · {item.purpose === "balance" ? "Пополнение" : "Заказ"}</span><span>{labels[item.status]}</span></button>)}</section>;
}
