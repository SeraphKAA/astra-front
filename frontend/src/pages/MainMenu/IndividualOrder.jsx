import React, { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/auth/AuthContext";
import { MessageCircleIcon } from "../../shared/icons/lucide";
import { getApiErrorMessage } from "../../shared/commonApi";
import {
    createIndividualOrder, payIndividualOrder, openIndividualOrderPayment,
} from "../../entities/individualOrder/api/individualOrderApi";

const DRAFT_KEY = "astra:individual-order:draft";
const RETURN_KEY = "astra:individual-order:return";

export const consumeIndividualOrderReturn = () => {
    try {
        const shouldReturn = sessionStorage.getItem(RETURN_KEY) === "1";
        return shouldReturn;
    } catch { return false; }
};

const readDraft = () => {
    try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null") || {}; }
    catch { return {}; }
};

const newRequestId = () => window.crypto.randomUUID();

export const clearPaidIndividualOrder = (publicId) => {
    try {
        if (readDraft().order === publicId) sessionStorage.removeItem(DRAFT_KEY);
    } catch { /* No persisted draft. */ }
};

const IndividualOrder = () => {
    const initial = useRef(readDraft());
    const [interest, setInterest] = useState(initial.current.interest || "");
    const [serviceUrl, setServiceUrl] = useState(initial.current.service_url || "");
    const [price, setPrice] = useState(initial.current.subscription_price || "");
    const [currency, setCurrency] = useState(initial.current.currency === "EUR" ? "EUR" : "USD");
    const [requestId, setRequestId] = useState(initial.current.request_id || newRequestId);
    const [pendingOrder, setPendingOrder] = useState(initial.current.order || null);
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const submitting = useRef(false);
    const firstField = useRef(null);
    const id = useId();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        if (isAuthenticated) {
            try { sessionStorage.removeItem(RETURN_KEY); } catch { /* Storage unavailable. */ }
        }
    }, [isAuthenticated]);

    useEffect(() => {
        try {
            sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
                interest, service_url: serviceUrl, subscription_price: price, currency,
                request_id: requestId, order: pendingOrder,
            }));
        } catch { /* The live form still works when browser storage is unavailable. */ }
    }, [interest, serviceUrl, price, currency, requestId, pendingOrder]);

    const change = (setter, value, key) => {
        setter(value);
        setErrors((prev) => ({ ...prev, [key]: "" }));
        setError("");
        setPendingOrder(null);
        setRequestId(newRequestId());
    };

    const submit = async (event) => {
        event.preventDefault();
        if (submitting.current) return;
        const next = {};
        if (!interest.trim()) next.interest = "Укажите точное название услуги или срок подписки";
        try {
            const url = new URL(serviceUrl.trim());
            if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error();
        } catch { next.url = "Введите ссылку на сайт или сервис, начиная с https:// или http://"; }
        if (!/^\d+(?:[.,]\d{1,2})?$/.test(price) || Number(price.replace(",", ".")) <= 0 || Number(price.replace(",", ".")) > 99999999.99) {
            next.price = "Укажите стоимость больше нуля, не более двух знаков после запятой";
        }
        setErrors(next);
        if (Object.keys(next).length) {
            if (next.interest) firstField.current?.focus();
            return;
        }
        if (!isAuthenticated) {
            try { sessionStorage.setItem(RETURN_KEY, "1"); } catch { /* Draft remains in state. */ }
            navigate("/sign_in");
            return;
        }
        submitting.current = true;
        setBusy(true);
        setError("");
        try {
            // Repeat the same UUID after a timeout: the server returns the existing application.
            const order = await createIndividualOrder({
                request_id: requestId, interest: interest.trim(), service_url: serviceUrl.trim(),
                subscription_price: price.replace(",", "."), currency,
            });
            setPendingOrder(order.public_id);
            if (order.status === "canceled") {
                setPendingOrder(null);
                setRequestId(newRequestId());
                throw new Error("Эта заявка отменена. Нажмите «Оформить заявку» ещё раз, чтобы создать новую.");
            }
            const payment = await payIndividualOrder(order.public_id);
            if (order.is_paid || ["paid", "processing", "completed"].includes(payment.status)) {
                navigate(`/individual-order/payment?order=${encodeURIComponent(order.public_id)}`);
                return;
            }
            openIndividualOrderPayment(payment);
        } catch (err) {
            setError(getApiErrorMessage(err, "Не удалось оформить заявку. Попробуйте ещё раз."));
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    };

    return (
        <section className="mm-steam astra-liquid mm-individual" aria-labelledby={`${id}-title`}>
            <div className="mm-steam-info">
                <span className="mm-steam-glyphwrap" aria-hidden="true">
                    <span className="mm-steam-plate" />
                    <span className="mm-steam-glyph"><MessageCircleIcon width={40} height={40} /></span>
                </span>
                <div className="mm-steam-copy">
                    <h3 id={`${id}-title`} className="astra-h mm-steam-title">Индивидуальный заказ</h3>
                    <p className="mm-steam-sub">Расскажите, какую услугу или подписку вы хотите заказать.</p>
                </div>
            </div>
            <form className="mm-steam-form" onSubmit={submit} noValidate aria-busy={busy}>
                <div className="mm-field">
                    <label className="mm-field-label" htmlFor={`${id}-interest`}>Что вас интересует?</label>
                    <div className={`mm-input${errors.interest ? " has-error" : ""}`}>
                        <textarea id={`${id}-interest`} ref={firstField} className="mm-input-el mm-individual-textarea"
                            placeholder="Точное название услуги или срок подписки" maxLength={1000}
                            value={interest} disabled={busy} onChange={(e) => change(setInterest, e.target.value, "interest")}
                            aria-invalid={Boolean(errors.interest)} aria-describedby={errors.interest ? `${id}-interest-error` : undefined} />
                    </div>
                    {errors.interest && <p className="mm-field-error" id={`${id}-interest-error`} role="alert">{errors.interest}</p>}
                </div>
                <div className="mm-steam-fields">
                    <div className="mm-field">
                        <label className="mm-field-label" htmlFor={`${id}-url`}>Ссылка на сайт или сервис</label>
                        <div className={`mm-input${errors.url ? " has-error" : ""}`}>
                            <input id={`${id}-url`} className="mm-input-el" type="url" placeholder="https://example.com"
                                maxLength={2048} value={serviceUrl} disabled={busy}
                                onChange={(e) => change(setServiceUrl, e.target.value, "url")}
                                aria-invalid={Boolean(errors.url)} aria-describedby={errors.url ? `${id}-url-error` : undefined} />
                        </div>
                        {errors.url && <p className="mm-field-error" id={`${id}-url-error`} role="alert">{errors.url}</p>}
                    </div>
                    <div className="mm-field">
                        <label className="mm-field-label" htmlFor={`${id}-price`}>Стоимость подписки в $ / €</label>
                        <div className={`mm-amount${errors.price ? " has-error" : ""}`}>
                            <input id={`${id}-price`} className="mm-amount-input" inputMode="decimal" type="text"
                                placeholder="20.00" maxLength={12} value={price} disabled={busy}
                                onChange={(e) => change(setPrice, e.target.value, "price")}
                                aria-invalid={Boolean(errors.price)} aria-describedby={errors.price ? `${id}-price-error` : undefined} />
                            <span className="mm-amount-suffix" aria-hidden="true">{currency === "USD" ? "$" : "€"}</span>
                        </div>
                        {errors.price && <p className="mm-field-error" id={`${id}-price-error`} role="alert">{errors.price}</p>}
                        <div className="mm-steam-currencies" role="group" aria-label="Валюта стоимости подписки">
                            {[["USD", "$ Доллары"], ["EUR", "€ Евро"]].map(([code, label]) => (
                                <button key={code} type="button" className={`astra-chip${currency === code ? " is-active" : ""}`}
                                    disabled={busy} aria-pressed={currency === code} onClick={() => change(setCurrency, code, "price")}>{label}</button>
                            ))}
                        </div>
                    </div>
                </div>
                <p className="mm-field-hint">Вы будете перенаправлены для создания заявки на заказ</p>
                {error && <p className="mm-field-error" role="alert">{error}</p>}
                {pendingOrder && !busy && <Link className="mm-rules-link" to={`/individual-order/payment?order=${encodeURIComponent(pendingOrder)}`}>Открыть заявку {pendingOrder}</Link>}
                <div className="mm-steam-foot">
                    <p className="mm-steam-note">Оформление заявки — <span className="mm-steam-total">1 ₽</span>.
                        Стоимость услуги согласуем в чате. Продавец отправит отдельную ссылку на оплату Robokassa.</p>
                    <span className="astra-ring mm-steam-cta"><button className="astra-btn" type="submit" disabled={busy}>
                        {busy ? "Подготовка оплаты…" : "Оформить заявку за 1 ₽"}
                    </button></span>
                </div>
            </form>
        </section>
    );
};

export default IndividualOrder;
