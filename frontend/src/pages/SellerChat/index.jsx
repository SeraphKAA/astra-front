import React, { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import { useAuth } from "../../app/auth/AuthContext";
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import { assignMeToOrder, unassignMeFromOrder, changeOrderStatus, getMyAssignedOrders, getUnassignedOrders } from "../../entities/order/api/orderApi";
import "./sellerChat.css";
import { useOrderSocket } from "../../hooks/useOrderSocket";
import { useUnreadCounts } from "../../app/unread/UnreadContext";

/* Русские имена статусов для интерфейса; в API уходят сырые значения */
const STATUS_LABELS = {
    paid: "Оплачен",
    processing: "В процессе",
    completed: "Завершён",
    canceled: "Отменён",
};

const STATUS_FILTERS = [
    { key: "all", label: "Все" },
    { key: "processing", label: "В процессе" },
    { key: "completed", label: "Завершённые" },
    { key: "canceled", label: "Отменённые" },
];

/* created_at -> «ДД.ММ.ГГГГ, ЧЧ:ММ»; нечитаемое значение отдаём как есть */
const formatDateTime = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const SellerChat = () => {
    const { user } = useAuth();
    const { pushToast } = useToast();
    const { counts } = useUnreadCounts();
    const [searchParams, setSearchParams] = useSearchParams();

    const TAB_VALUES = new Set(["unassigned", "mine"]);
    const STATUS_VALUES = new Set(["all", "processing", "completed", "canceled"]);
    
    const initialTab = TAB_VALUES.has(searchParams.get("tab"))
        ? searchParams.get("tab")
        : "unassigned";

    const initialStatus = STATUS_VALUES.has(searchParams.get("status"))
        ? searchParams.get("status")
        : "all";
    
    const [tab, setTab] = useState(initialTab); // unassigned | mine
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [mineStatusFilter, setMineStatusFilter] = useState(initialStatus);
    const [assigning, setAssigning] = useState(null);
    const [savingStatus, setSavingStatus] = useState(null);
    const [statusDraft, setStatusDraft] = useState({});
    const [unassigning, setUnassigning] = useState(null);

    const statusMap = {
        created: "Создан",
        paid: "Оплачен",
        processing: "В обработке",
        completed: "Выполнен",
        canceled: "Отменён"
    };

    const typeMap ={
        manual: "Ручной",
        processing: "В обработке",
        success: "Успешно",
        failed: "Отменён"
    };

    const userLanguage = navigator.language || 'en';
    const isRussian = userLanguage.startsWith('ru');

    const getStatusLabel = (status) => {
        if (!status) return '';
            const key = status.toLowerCase();
        if (isRussian && statusMap[key]) {
            return statusMap[key];
    }
        return status;
    };
    /* quiet: фоновое обновление БЕЗ смены loading. Смена loading размонтирует
       весь список ради строки «Загрузка…», а обратный монтаж переигрывает
       входные анимации карточек — на каждом событии сокета, без действия
       пользователя. Тихое обновление меняет данные под ногами, и React
       обновляет карточки по key, не пересоздавая их. Ошибку тихого обновления
       не показываем: на экране остаются прежние данные, и пугать оператора
       полосой ошибки из-за фонового толчка не за чем. */
    const load = useCallback(async ({ quiet = false } = {}) => {
        if (!quiet) {
            setLoading(true);
            setError("");
        }
        try {
            const data =
                tab === "mine"
                    ? await getMyAssignedOrders(100, 0)
                    : await getUnassignedOrders(100, 0);
            setOrders(Array.isArray(data) ? data : []);
            if (quiet) setError("");
        } catch (e) {
            if (!quiet) {
                setError("Не удалось загрузить заказы");
                setOrders([]);
            }
        } finally {
            if (!quiet) setLoading(false);
        }
    }, [tab]);

    /* URL → состояние: если пользователь пришёл по ссылке ?tab=mine
    или кликнул браузерную «назад/вперёд», подхватываем значение. */
    useEffect(() => {
        const urlTab = searchParams.get("tab");
        const urlStatus = searchParams.get("status");

        if (TAB_VALUES.has(urlTab) && urlTab !== tab) {
            setTab(urlTab);
        } else if (!urlTab && tab !== "unassigned") {
            setTab("unassigned");
        }

        if (STATUS_VALUES.has(urlStatus) && urlStatus !== mineStatusFilter) {
            setMineStatusFilter(urlStatus);
        } else if (!urlStatus && mineStatusFilter !== "all") {
            setMineStatusFilter("all");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    /* состояние → URL: обновляем query, чтобы:
    - можно было поделиться ссылкой,
    - работала кнопка «назад» в браузере. */
    const switchTab = (next) => {
        if (!TAB_VALUES.has(next)) return;
        setTab(next);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("tab", next);
        setSearchParams(nextParams, { replace: true });
    };

    const switchStatusFilter = (next) => {
        if (!STATUS_VALUES.has(next)) return;
        setMineStatusFilter(next);
        const nextParams = new URLSearchParams(searchParams);
        if (next === "all") {
            nextParams.delete("status");
        } else {
            nextParams.set("status", next);
        }
        setSearchParams(nextParams, { replace: true });
    };

    useEffect(() => {
        load();
    }, [tab, load]);
    const handleOrderEvent = useCallback(() => {
        load({ quiet: true });
    }, [load]);
    useOrderSocket(handleOrderEvent, { enabled: true });

    const filteredOrders = useMemo(() => {
        const byStatus =
            tab === "mine" && mineStatusFilter !== "all"
                ? orders.filter((o) => o.status === mineStatusFilter)
                : orders;
        const q = search.trim().toLowerCase();
        if (!q) return byStatus;
        return byStatus.filter((o) => {
            const hay = [
                o.public_id,
                o.id,
                o.user_id,
                o.product_id,
                o.product_name,
                o.user_nickname,
                o.user_login,
                o.user_email,
                o.status,
                o.order_type,
            ]
                .filter((v) => typeof v !== "undefined" && v !== null)
                .map((v) => String(v).toLowerCase())
                .join(" ");
            return hay.includes(q);
        });
    }, [orders, search, tab, mineStatusFilter]);

    const onAssign = async (publicId) => {
        if (!publicId) return;
        setAssigning(publicId);
        try {
            await assignMeToOrder(publicId);
            pushToast({ type: "success", message: `Заказ ${publicId} занят` });
            /* тихо: список меняется на месте, карточки не переигрывают вход */
            await load({ quiet: true });
        } catch (e) {
            pushToast({ type: "error", message: "Не удалось занять заказ (возможно, его уже заняли)" });
        } finally {
            setAssigning(null);
        }
    };

    const onUnassign = async (publicId) => {
        if (!publicId) return;
        setUnassigning(publicId);
        try {
            await unassignMeFromOrder(publicId);
            pushToast({ type: "success", message: `Вы отказались от заказа ${publicId}` });
            await load(); // обновляем список
        } catch (e) {
            pushToast({ type: "error", message: "Не удалось отказаться от заказа" });
        } finally {
            setUnassigning(null);
        }
    };

    const onSaveStatus = async (publicId) => {
        const next = statusDraft[publicId];
        if (!publicId || !next) return;
        setSavingStatus(publicId);
        try {
            await changeOrderStatus(publicId, next);
            pushToast({ type: "success", message: `Статус заказа ${publicId} обновлён` });
            await load({ quiet: true });
        } catch (e) {
            pushToast({ type: "error", message: "Не удалось обновить статус заказа" });
        } finally {
            setSavingStatus(null);
        }
    };

    /* Пусто из-за поиска/фильтра — не то же самое, что пусто на самом деле */
    const isFiltered = search.trim().length > 0 || (tab === "mine" && mineStatusFilter !== "all");
    const emptyTitle = isFiltered
        ? "Ничего не найдено"
        : tab === "mine"
            ? "У вас пока нет заказов"
            : "Свободных заказов нет";
    const emptySub = isFiltered
        ? (tab === "mine" ? "Попробуйте изменить запрос или фильтр статуса" : "Попробуйте изменить поисковый запрос")
        : tab === "mine"
            ? "Возьмите свободный заказ на вкладке «Свободные»"
            : "Новые заказы появятся здесь автоматически";

    return (
        <div className="seller-chat-page">
            <div className="seller-chat-head">
                <h1>Заказы продавца</h1>
                <div className="seller-chat-sub">
                    Продавец: <strong>{user?.nickname || user?.email || `#${user?.id ?? ""}`}</strong>
                </div>
            </div>

            <div className="seller-chat-toolbar">
                <div className="seller-chat-tabs">
                    <button
                        type="button"
                        className={`seller-tab ${tab === "unassigned" ? "is-active" : ""}`}
                        aria-pressed={tab === "unassigned"}
                        onClick={() => switchTab("unassigned")}
                    >
                        Свободные
                    </button>
                    <button
                        type="button"
                        className={`seller-tab ${tab === "mine" ? "is-active" : ""}`}
                        aria-pressed={tab === "mine"}
                        onClick={() => switchTab("mine")}
                    >
                        Мои
                    </button>
                </div>
                <input
                    className="seller-chat-search"
                    type="text"
                    placeholder="Поиск по номеру, покупателю или товару"
                    aria-label="Поиск по заказам"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button className="seller-chat-btn" type="button" onClick={load} disabled={loading}>
                    Обновить
                </button>
            </div>

            {tab === "mine" && (
                <div className="seller-chat-status-tabs" role="group" aria-label="Фильтр по статусу">
                    {STATUS_FILTERS.map((statusTab) => (
                        <button
                            key={statusTab.key}
                            type="button"
                            className={`seller-tab ${mineStatusFilter === statusTab.key ? "is-active" : ""}`}
                            aria-pressed={mineStatusFilter === statusTab.key}
                            onClick={() => switchStatusFilter(statusTab.key)}
                        >
                            {statusTab.label}
                        </button>
                    ))}
                </div>
            )}

            {loading ? (
                <div className="seller-chat-loading">Загрузка…</div>
            ) : error ? (
                <div className="seller-chat-error" role="alert">
                    <span>{error}</span>
                    <button className="seller-chat-btn" type="button" onClick={load}>
                        Повторить
                    </button>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="seller-chat-empty">
                    <div className="seller-chat-empty-title">{emptyTitle}</div>
                    <div className="seller-chat-empty-sub">{emptySub}</div>
                </div>
            ) : (
                <div className="seller-chat-list">
                    {filteredOrders.map((o) => (
                        <article className="seller-order-card" key={o.public_id || o.id}>
                            <div className="seller-order-top">
                                <div className="seller-order-id">
                                    <span className="seller-order-id-label">Заказ</span>
                                    <span className="seller-order-id-value text-none">{o.public_id}</span>
                                </div>
                                <div className="seller-order-badges">
                                    {o.status && (
                                        <span className={`seller-status-badge ${STATUS_LABELS[o.status] ? `is-${o.status}` : ""}`}>
                                            {STATUS_LABELS[o.status] || o.status}
                                        </span>
                                    )}
                                    {o.order_type && <span className="seller-type-badge">{o.order_type === "manual" ? "Ручной" : "Автоматический"}</span>}
                                </div>
                            </div>

                            <dl className="seller-order-meta">
                                <div className="seller-order-meta-item">
                                    <dt>Покупатель</dt>
                                    <dd>{o.user_nickname || o.user_login || o.user_email || `#${o.user_id}`}</dd>
                                </div>
                                <div className="seller-order-meta-item">
                                    <dt>ID покупателя</dt>
                                    <dd>{o.user_id}</dd>
                                </div>
                                <div className="seller-order-meta-item">
                                    <dt>Товар</dt>
                                    <dd>{o.product_name || o.product_id}</dd>
                                </div>
                                <div className="seller-order-meta-item">
                                    <dt>Сумма</dt>
                                    <dd className="seller-order-sum">{o.total_price} ₽</dd>
                                </div>
                                <div className="seller-order-meta-item">
                                    <dt>Создан</dt>
                                    <dd>{formatDateTime(o.created_at)}</dd>
                                </div>
                            </dl>

                            <div className="seller-order-actions">
                                {tab === "unassigned" ? (
                                    <button
                                        type="button"
                                        className="seller-chat-btn primary"
                                        onClick={() => onAssign(o.public_id)}
                                        disabled={assigning === o.public_id}
                                    >
                                        {assigning === o.public_id ? "Занимаю…" : "Занять заказ"}
                                    </button>
                                ) : (
                                    <>
                                        {o.requires_manual_processing && (
                                            <NavLink className="seller-chat-link" to={`/order-chat/${o.id}`}>
                                                Открыть чат
                                                {counts.seller_orders_by_chat[String(o.id)] > 0 && (() => {
                                                    const value = counts.seller_orders_by_chat[String(o.id)];
                                                    const text = value > 99 ? "99+" : String(value);
                                                    return (
                                                        <span
                                                            className={`nav-badge nav-badge--${text.length} seller-chat-link-badge`}
                                                            aria-label={`Непрочитанных: ${value}`}
                                                        >
                                                            {text}
                                                        </span>
                                                    );
                                                })()}
                                            </NavLink>
                                        )}
                                        <select
                                            className="seller-order-select"
                                            aria-label={`Статус заказа ${o.public_id}`}
                                            value={statusDraft[o.public_id] ?? o.status}
                                            onChange={(e) =>
                                                setStatusDraft((prev) => ({ ...prev, [o.public_id]: e.target.value }))
                                            }
                                        >
                                            <option value="processing">В процессе</option>
                                            <option value="completed">Завершён</option>
                                            <option value="canceled">Отменён</option>
                                        </select>
                                        <button
                                            type="button"
                                            className="seller-chat-btn primary"
                                            onClick={() => onSaveStatus(o.public_id)}
                                            disabled={savingStatus === o.public_id}
                                        >
                                            {savingStatus === o.public_id ? "Сохраняю..." : "Сохранить"}
                                        </button>

                                        <button
                                            type="button"
                                            className="seller-chat-btn secondary"
                                            onClick={() => onUnassign(o.public_id)}
                                            disabled={unassigning === o.public_id}
                                        >
                                            {unassigning === o.public_id ? "Отказываюсь..." : "Отказаться"}
                                        </button>
                                    </>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SellerChat;
