import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMyOrders } from "../../entities/order/model/useOrders";
import { NavLink, useSearchParams    } from "react-router-dom";
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import { initRobokassaPayment } from "../../entities/order/api/orderApi";
import { openPayment } from "../../widgets/PaymentDialog";
import { createReview } from "../../entities/review/api/reviewApi";
import { Modal } from "../../shared/ui/Modal/Modal";
import "./orders.css";
import { useUnreadCounts } from "../../app/unread/UnreadContext";

/* ---------- данные → смысл ----------
   Раньше «Оплачено/Не оплачено» и статус висели двумя плашками, которые
   спорили друг с другом. Для покупателя это ОДИН факт: что с заказом
   сейчас и нужно ли что-то сделать. Тон плашки берётся из статусной
   палитры DESIGN.md (ok / warn / err / нейтральный). */

const isOrderPaid = (o) => {
    if (typeof o.is_paid === "boolean") return o.is_paid;
    return ["paid", "processing", "completed"].includes(o.status);
};

const getOrderState = (o) => {
    const status = String(o?.status || "").toLowerCase();
    if (status === "canceled") return { label: "Отменён", tone: "err" };
    if (status === "completed") return { label: "Выполнен", tone: "ok" };
    if (!isOrderPaid(o)) return { label: "Ждёт оплаты", tone: "warn" };
    return { label: "В обработке", tone: "neutral" };
};

const needsPayment = (o) => !isOrderPaid(o) && o.status === "created" && Boolean(o.public_id);

const isSteamRefill = (o) => o?.product_name === "Пополнение Steam";

const TABS = [
    ["all", "Все"],
    ["processing", "В процессе"],
    ["completed", "Завершённые"],
    ["canceled", "Отменённые"],
];

const TAB_VALUES = new Set(TABS.map(([key]) => key));

/* «В процессе» — всё, что ещё не закончилось: ждёт оплаты, оплачен,
   в обработке. Раньше сюда попадал только status === "processing", и
   только что оплаченный заказ не находился ни в одной вкладке, кроме «Все». */
const matchesTab = (o, tab) => {
    if (tab === "processing") return ["created", "paid", "processing"].includes(o.status);
    if (tab === "completed") return o.status === "completed";
    if (tab === "canceled") return o.status === "canceled";
    return true;
};

const EMPTY_TEXT = {
    all: "Здесь появятся ваши покупки.",
    processing: "Незавершённых заказов нет.",
    completed: "Завершённых заказов пока нет.",
    canceled: "Отменённых заказов нет.",
};

/* Дата без секунд: «26.09.2026, 14:05» — секунды покупателю не нужны. */
const formatDate = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const formatMoney = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return value == null ? "—" : `${value} ₽`;
    const digits = Number.isInteger(n) ? 0 : 2;
    return `${n.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits })} ₽`;
};

const productTitle = (o) => o?.product_name || (o?.product_id != null ? `Товар #${o.product_id}` : "Товар");

const orderNumber = (o) => o?.public_id || (o?.id != null ? `ID ${o.id}` : "");

const payloadKeyMap = {
    code: "Код активации",
    link: "Ссылка",
    product: "Товар",
    message: "Сообщение",
    gift_url: "Ссылка на подарок",
    steam_code: "Код Steam",
    voucher: "Ваучер",
    order_id: "ID заказа",
    vouchers: "Ваучеры",
    serialNumber: "Серийный номер",
    expiration: "Срок действия",
    pin: "Код ваучера",
};

/* ПИН-код не показываем (решение владельца) — ни подпись, ни поле. */
const excludedKeys = ["serialNumber", "root_id", "variant_id", "variant_name", "quantity"];

/* ---------- мелкие компоненты ----------
   Вынесены из тела страницы: объявленные внутри, они пересоздавались на
   каждый рендер — ховер звёзд и «Скопировано» сбрасывались. */

const StatusPill = ({ order }) => {
    const { label, tone } = getOrderState(order);
    return <span className={`orders-status orders-status--${tone}`}>{label}</span>;
};

const RatingStarsInput = ({ rating, onChange, disabled }) => {
    const [hover, setHover] = useState(0);
    const max = 5;
    return (
        <div
            className="order-rating-stars"
            role="radiogroup"
            aria-label="Оценка покупки"
            onMouseLeave={() => setHover(0)}
        >
            {Array.from({ length: max }, (_, i) => {
                const starIndex = i + 1;
                const filled = starIndex <= (hover || rating);
                return (
                    <button
                        key={starIndex}
                        type="button"
                        role="radio"
                        aria-checked={rating === starIndex}
                        aria-label={`${starIndex} из ${max}`}
                        className={`order-star ${filled ? "is-filled" : ""}`}
                        disabled={disabled}
                        onMouseEnter={() => setHover(starIndex)}
                        onFocus={() => setHover(starIndex)}
                        onBlur={() => setHover(0)}
                        onClick={() => onChange(starIndex)}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                    </button>
                );
            })}
        </div>
    );
};

const CopyButton = ({ value, label, onError }) => {
    const [copied, setCopied] = useState(false);
    const timerRef = useRef(null);
    useEffect(() => () => clearTimeout(timerRef.current), []);

    const handleCopy = async (e) => {
        e.stopPropagation();
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
            } else {
                /* небезопасный контекст — Clipboard API недоступен */
                const ta = document.createElement("textarea");
                ta.value = value;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
            }
            setCopied(true);
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setCopied(false), 1600);
        } catch {
            onError?.();
        }
    };

    return (
        <button
            type="button"
            className={`order-copy-btn ${copied ? "is-copied" : ""}`}
            onClick={handleCopy}
            aria-label={copied ? "Скопировано" : `Скопировать: ${label}`}
        >
            {copied ? (
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M4 12.8 9.2 18 20 6.6" />
                </svg>
            ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
                    <path d="M15 8.5V6.5A2 2 0 0 0 13 4.5H6.5A2 2 0 0 0 4.5 6.5V13a2 2 0 0 0 2 2H8.5" />
                </svg>
            )}
        </button>
    );
};

/* Выданные данные: ключ → подпись, код активации — моноширинный с кнопкой
   копирования (только их покупатель реально копирует). Вложенность
   объектов/массивов сохранена, инлайн-стили заменены классами. */
const PayloadValue = ({ value, onCopyError }) => {
    if (value === null || value === undefined) return null;

    if (typeof value !== "object") return <span className="order-payload-text">{String(value)}</span>;

    if (Array.isArray(value)) {
        if (value.length === 0) return <span className="order-payload-text">—</span>;
        return (
            <div className="order-payload-list">
                {value.map((item, idx) => (
                    <div className="order-payload-item" key={idx}>
                        <PayloadValue value={item} onCopyError={onCopyError} />
                    </div>
                ))}
            </div>
        );
    }

    const entries = Object.entries(value).filter(
        ([key, sub]) => !excludedKeys.includes(key) && !(key === "expiration" && (sub == null || sub === ""))
    );
    if (entries.length === 0) return <span className="order-payload-text">—</span>;

    return (
        <dl className="order-payload">
            {entries.map(([key, sub]) => {
                const label = payloadKeyMap[key] || key;
                const isCopyable =
                    ["code", "pin", "gift_url"].includes(key) &&
                    (typeof sub === "string" || typeof sub === "number") &&
                    String(sub).trim() !== "";
                return (
                    <div className="order-payload-row" key={key}>
                        <dt className="order-payload-label">{label}</dt>
                        <dd className="order-payload-value">
                            {isCopyable ? (
                                <span className="order-copy-row">
                                    <code className="order-code-value">{String(sub)}</code>
                                    <CopyButton value={String(sub)} label={label} onError={onCopyError} />
                                </span>
                            ) : (
                                <PayloadValue value={sub} onCopyError={onCopyError} />
                            )}
                        </dd>
                    </div>
                );
            })}
        </dl>
    );
};

/* Ваучеры — плоские пронумерованные блоки вместо вложенного
   «Ваучеры → объект → поля»: покупателю нужен каждый код отдельно,
   а не структура ответа API. Остальные ключи — обычным списком. */
const DeliveredData = ({ payload, onCopyError }) => {
    const vouchers = Array.isArray(payload?.vouchers) ? payload.vouchers.filter((v) => v != null) : [];
    const rest = payload && typeof payload === "object"
        ? Object.fromEntries(Object.entries(payload).filter(([k]) => k !== "vouchers"))
        : null;
    const hasRest = rest && Object.keys(rest).some((k) => !excludedKeys.includes(k));

    return (
        <div className="order-delivery-stack">
            {vouchers.map((v, i) => (
                <div className="order-delivery" key={i}>
                    {vouchers.length > 1 && (
                        <p className="order-delivery-caption">Ваучер {i + 1} из {vouchers.length}</p>
                    )}
                    <PayloadValue value={v} onCopyError={onCopyError} />
                </div>
            ))}
            {hasRest && (
                <div className="order-delivery">
                    <PayloadValue value={rest} onCopyError={onCopyError} />
                </div>
            )}
        </div>
    );
};

/* ---------- страница ---------- */

const OrdersPage = () => {
    const { data, isLoading, error, refetch } = useMyOrders();
    const [searchParams, setSearchParams] = useSearchParams();

    const initialTab = TAB_VALUES.has(searchParams.get("tab"))
        ? searchParams.get("tab")
        : "all";

    const [tab, setTab] = useState(initialTab);
    const [payingId, setPayingId] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const { pushToast } = useToast();
    const { counts } = useUnreadCounts();
    const unreadOrders = counts?.orders_by_chat ?? {};
    const orders = useMemo(() => (Array.isArray(data) ? data : data?.orders || []), [data]);

    const [reviewRating, setReviewRating] = useState(5);
    const [reviewComment, setReviewComment] = useState("");
    const [reviewSubmitting, setReviewSubmitting] = useState(false);

    /* URL → состояние: подхватываем ?tab=... при монтировании
    и при каждом изменении searchParams (кнопка «назад», переход по ссылке). */
    useEffect(() => {
        const urlTab = searchParams.get("tab");
        if (TAB_VALUES.has(urlTab) && urlTab !== tab) {
            setTab(urlTab);
        } else if (!urlTab && tab !== "all") {
            setTab("all");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    /* состояние → URL: клик по табу обновляет query, чтобы можно было
    сохранить/переслать состояние. `replace: true` — чтобы клики
    по вкладкам не засоряли историю браузера. */
    const switchTab = (next) => {
        if (!TAB_VALUES.has(next)) return;
        setTab(next);
        const nextParams = new URLSearchParams(searchParams);
        if (next === "all") {
            nextParams.delete("tab");
        } else {
            nextParams.set("tab", next);
        }
        setSearchParams(nextParams, { replace: true });
    };

    useEffect(() => {
        if (selectedOrder) {
            setReviewRating(5);
            setReviewComment("");
        }
    }, [selectedOrder]);

    const countsOrder = useMemo(() => {
        const c = {};
        TABS.forEach(([key]) => {
            c[key] = orders.filter((o) => matchesTab(o, key)).length;
        });
        return c;
    }, [orders]);

    const filteredOrders = useMemo(() => orders.filter((o) => matchesTab(o, tab)), [orders, tab]);

    const copyError = () => pushToast({ type: "error", message: "Не удалось скопировать" });

    const handleCreateReview = async () => {
        if (!selectedOrder) return;
        setReviewSubmitting(true);
        try {
            await createReview({
                order_public_id: selectedOrder.public_id,
                rating: reviewRating,
                comment: reviewComment.trim() || undefined,
            });
            pushToast({ type: "success", message: "Спасибо! Отзыв появится после модерации" });
            refetch?.();
            setSelectedOrder(null);
        } catch (err) {
            pushToast({ type: "error", message: err?.message || "Не удалось отправить отзыв — попробуйте ещё раз" });
        } finally {
            setReviewSubmitting(false);
        }
    };

    const startPayment = async (orderPublicId) => {
        if (!orderPublicId) return;
        const order = orders.find((item) => item.public_id === orderPublicId);
        if (order?.customer_checkout_data?.kind !== "individual_order") {
            openPayment({ purpose: "orders", order_public_ids: [orderPublicId], onConfirmed: () => refetch?.() });
            return;
        }
        setPayingId(orderPublicId);
        try {
            const paymentData = await initRobokassaPayment(orderPublicId);
            if (paymentData?.payment_method === "POST" && paymentData?.payment_action_url) {
                // 1. Проверяем, открыто ли приложение внутри Telegram
                const telegramWebApp = window.Telegram?.WebApp;

                if (telegramWebApp && telegramWebApp.initData) {
                    // 2. Если да, используем специальный метод для внешних ссылок
                    //    Внимание: этот метод работает только с GET-запросами.
                    //    Если Robokassa требует POST, это может не сработать,
                    //    и вам может потребоваться другой подход (см. ниже).
                    telegramWebApp.openLink(paymentData.payment_action_url);
                } else {
                    // 3. Для обычного браузера оставляем старый способ
                    const form = document.createElement("form");
                    form.method = "POST";
                    form.action = paymentData.payment_action_url;
                    form.target = "_blank";
                    document.body.appendChild(form);
                    form.submit();
                    document.body.removeChild(form);
                    return;
                }
            }
            /* оплачен балансом целиком или уже не в статусе created */
            pushToast({ type: "success", message: "Заказ уже оплачен" });
            refetch?.();
        } catch (e) {
            pushToast({ type: "error", message: e?.message || "Не удалось открыть оплату — попробуйте ещё раз" });
        } finally {
            setPayingId(null);
        }
    };

    const PayButton = ({ order, block = false }) => (
        <button
            type="button"
            className={`orders-pay-btn ${block ? "is-block" : ""}`}
            /* без stopPropagation щелчок доходил до карточки:
               оплата стартовала И открывался диалог поверх неё */
            onClick={(e) => {
                e.stopPropagation();
                startPayment(order.public_id);
            }}
            disabled={payingId === order.public_id}
        >
            {payingId === order.public_id ? "Открываем оплату…" : `Оплатить ${formatMoney(order.total_price)}`}
        </button>
    );

    const header = <h1 className="orders-title">Покупки</h1>;

    if (isLoading) {
        return (
            <div className="orders-page">
                {header}
                <p className="orders-state" role="status">Загружаем заказы…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="orders-page">
                {header}
                <div className="orders-state orders-state--error" role="alert">
                    <p>Не удалось загрузить заказы. Проверьте соединение и попробуйте снова.</p>
                    {refetch && (
                        <button type="button" className="orders-ghost-btn" onClick={() => refetch()}>
                            Повторить
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const selected = selectedOrder;
    const showDelivery = Boolean(selected?.delivered_payload && selected?.is_auto);
    const canReview = selected?.status === "completed" && !selected?.review_id;

    return (
        <>
            <div className="orders-page">
                {header}

                {orders.length > 0 && (
                    <div className="orders-tabs" role="group" aria-label="Фильтр заказов">
                        {TABS.map(([key, label]) => (
                            <button
                                type="button"
                                key={key}
                                className={`orders-tab ${tab === key ? "is-active" : ""}`}
                                aria-pressed={tab === key}
                                onClick={() => switchTab(key)}
                            >
                                {label}
                                <span className="orders-tab-count">{countsOrder[key]}</span>
                            </button>
                        ))}
                    </div>
                )}

                {filteredOrders.length === 0 ? (
                    <div className="orders-state">
                        <p>{EMPTY_TEXT[orders.length === 0 ? "all" : tab]}</p>
                        {orders.length > 0 && tab !== "all" && (
                            <button type="button" className="orders-ghost-btn" onClick={() => switchTab("all")}>
                                Показать все заказы
                            </button>
                        )}
                    </div>
                ) : (
                    <ul className="orders-list">
                        {filteredOrders.map((o) => {
                            const showChat = o.requires_manual_processing && (
                                o.customer_checkout_data?.kind === "individual_order"
                                    ? isOrderPaid(o)
                                    : Boolean(o.assigned_seller_id)
                            );
                            const pay = needsPayment(o);
                            return (
                                <li
                                    className="orders-card"
                                    key={o.id ?? o.public_id}
                                    onClick={() => setSelectedOrder(o)}
                                >
                                    <div className="orders-card-main">
                                        {/* Заголовок — настоящая кнопка: карточка кликабельна
                                            мышью, а клавиатура попадает в подробности отсюда.
                                            Роль на всю карточку не вешаем — внутри уже есть
                                            ссылка в чат и кнопка оплаты. */}
                                        <button
                                            type="button"
                                            className="orders-card-title text-none"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedOrder(o);
                                            }}
                                        >
                                            {productTitle(o)}
                                        </button>
                                        <p className="orders-card-meta">
                                            <span className="text-none">{orderNumber(o)}</span>
                                            {o.created_at && <span>{formatDate(o.created_at)}</span>}
                                        </p>
                                    </div>

                                    <div className="orders-card-side">
                                        {typeof o.total_price !== "undefined" && (
                                            <span className="orders-card-price">{formatMoney(o.total_price)}</span>
                                        )}
                                        <StatusPill order={o} />
                                    </div>

                                    {(pay || showChat) && (
                                        <div className="orders-card-actions">
                                            {showChat && (
                                                <NavLink
                                                    className="orders-ghost-btn"
                                                    to={`/order-chat/${o.id}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    Чат заказа
                                                    {unreadOrders[String(o.id)] > 0 && (() => {
                                                        const value = unreadOrders[String(o.id)];
                                                        const text = value > 99 ? "99+" : String(value);
                                                        return (
                                                            <span
                                                                className={`nav-badge nav-badge--${text.length} orders-btn-badge`}
                                                                aria-label={`Непрочитанных: ${value}`}
                                                            >
                                                                {text}
                                                            </span>
                                                        );
                                                    })()}
                                                </NavLink>
                                            )}
                                            {pay && <PayButton order={o} />}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            <Modal
                isOpen={!!selected}
                onClose={() => setSelectedOrder(null)}
                title={
                    <div className="order-modal-title-row">
                        <span>
                            Заказ<span className="order-modal-number text-none">&nbsp;{orderNumber(selected)}</span>
                        </span>
                        <button
                            type="button"
                            className="order-modal-close-btn"
                            onClick={() => setSelectedOrder(null)}
                            aria-label="Закрыть информацию о заказе"
                        >
                            <span aria-hidden="true">✕</span>
                        </button>
                    </div>
                }
            >
                {selected && (
                    <div className="order-details">
                        <header className="order-summary">
                            <p className="order-summary-product text-none">{productTitle(selected)}</p>
                            <div className="order-summary-line">
                                <span className="order-summary-total">{formatMoney(selected.total_price)}</span>
                                <StatusPill order={selected} />
                            </div>
                            {needsPayment(selected) && <PayButton order={selected} block />}
                        </header>

                        <dl className="order-facts">
                            {!isSteamRefill(selected) && (
                                <div className="order-fact">
                                    <dt>Цена × кол-во</dt>
                                    <dd>
                                        {formatMoney(selected.product_price)} × {selected.quantity} шт.
                                    </dd>
                                </div>
                            )}
                            <div className="order-fact">
                                <dt>Выдача</dt>
                                <dd>
                                    {selected.order_type === "manual" && selected.requires_manual_processing
                                        ? "Вручную, продавцом"
                                        : "Автоматически"}
                                </dd>
                            </div>
                            {selected.seller_nickname && (
                                <div className="order-fact">
                                    <dt>Продавец</dt>
                                    <dd className="text-none">{selected.seller_nickname}</dd>
                                </div>
                            )}
                            <div className="order-fact">
                                <dt>Создан</dt>
                                <dd>{formatDate(selected.created_at)}</dd>
                            </div>
                        </dl>

                        {showDelivery && (
                            <section className="order-section" aria-labelledby="order-delivery-h">
                                <h3 className="order-section-title" id="order-delivery-h">Ваши данные</h3>
                                <DeliveredData payload={selected.delivered_payload} onCopyError={copyError} />
                            </section>
                        )}

                        {canReview && (
                            <section className="order-section order-review" aria-labelledby="order-review-h">
                                <h3 className="order-section-title" id="order-review-h">Оцените покупку</h3>
                                <RatingStarsInput
                                    rating={reviewRating}
                                    onChange={setReviewRating}
                                    disabled={reviewSubmitting}
                                />
                                <label className="order-review-label" htmlFor="order-review-comment">
                                    Комментарий <span>— необязательно</span>
                                </label>
                                <textarea
                                    id="order-review-comment"
                                    className="order-review-textarea"
                                    value={reviewComment}
                                    onChange={(e) => setReviewComment(e.target.value)}
                                    rows={3}
                                    placeholder="Что понравилось, что можно улучшить"
                                    disabled={reviewSubmitting}
                                />
                                <button
                                    type="button"
                                    className="order-review-submit"
                                    onClick={handleCreateReview}
                                    disabled={reviewSubmitting}
                                >
                                    {reviewSubmitting ? "Отправляем…" : "Отправить отзыв"}
                                </button>
                            </section>
                        )}
                    </div>
                )}
            </Modal>
        </>
    );
};

export default OrdersPage;

