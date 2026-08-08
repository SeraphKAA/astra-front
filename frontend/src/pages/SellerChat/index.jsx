import React, { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../app/auth/AuthContext";
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import { assignMeToOrder, changeOrderStatus, getMyAssignedOrders, getUnassignedOrders } from "../../entities/order/api/orderApi";
import "./sellerChat.css";
import { useOrderSocket } from "../../hooks/useOrderSocket";

const SellerChat = () => {
    const { user } = useAuth();
    const { pushToast } = useToast();
    const [tab, setTab] = useState("unassigned"); // unassigned | mine
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [mineStatusFilter, setMineStatusFilter] = useState("all");
    const [assigning, setAssigning] = useState(null);
    const [savingStatus, setSavingStatus] = useState(null);
    const [statusDraft, setStatusDraft] = useState({});

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const data =
                tab === "mine"
                    ? await getMyAssignedOrders(100, 0)
                    : await getUnassignedOrders(100, 0);
            setOrders(Array.isArray(data) ? data : []);
        } catch (e) {
            setError("Не удалось загрузить заказы");
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, [tab]);

    useEffect(() => {
        load();
    }, [tab, load]);
    const handleOrderEvent = useCallback(() => {
        load();
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
            await load();
        } catch (e) {
            pushToast({ type: "error", message: "Не удалось занять заказ (возможно, его уже заняли)" });
        } finally {
            setAssigning(null);
        }
    };

    const onSaveStatus = async (publicId) => {
        const next = statusDraft[publicId];
        if (!publicId || !next) return;
        setSavingStatus(publicId);
        try {
            await changeOrderStatus(publicId, next);
            pushToast({ type: "success", message: `Статус заказа ${publicId} обновлён` });
            await load();
        } catch (e) {
            pushToast({ type: "error", message: "Не удалось обновить статус заказа" });
        } finally {
            setSavingStatus(null);
        }
    };

    return (
        <div className="seller-chat-page">
            <div className="seller-chat-head">
                <h1>Заказы продавца</h1>
                <div className="seller-chat-sub">
                    Продавец: <strong>{user?.nickname || user?.email || `#${user?.id ?? ""}`}</strong>
                </div>
            </div>

            <div className="seller-chat-tabs">
                <button
                    type="button"
                    className={`seller-tab ${tab === "unassigned" ? "is-active" : ""}`}
                    onClick={() => setTab("unassigned")}
                >
                    Свободные
                </button>
                <button
                    type="button"
                    className={`seller-tab ${tab === "mine" ? "is-active" : ""}`}
                    onClick={() => setTab("mine")}
                >
                    Мои
                </button>
            </div>

            <div className="seller-chat-controls">
                <input
                    className="seller-chat-search"
                    placeholder="Поиск по заказам (public_id, user_id, product_id...)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button className="seller-chat-btn" type="button" onClick={load} disabled={loading}>
                    Обновить
                </button>
            </div>
            {tab === "mine" && (
                <div className="seller-chat-status-tabs">
                    {[
                        { key: "all", label: "Все" },
                        { key: "processing", label: "В процессе" },
                        { key: "completed", label: "Завершенные" },
                        { key: "canceled", label: "Отмененные" },
                    ].map((statusTab) => (
                        <button
                            key={statusTab.key}
                            type="button"
                            className={`seller-tab ${mineStatusFilter === statusTab.key ? "is-active" : ""}`}
                            onClick={() => setMineStatusFilter(statusTab.key)}
                        >
                            {statusTab.label}
                        </button>
                    ))}
                </div>
            )}

            {loading ? (
                <div className="seller-chat-muted">Загрузка...</div>
            ) : error ? (
                <div className="seller-chat-error">{error}</div>
            ) : filteredOrders.length === 0 ? (
                <div className="seller-chat-muted">
                    {tab === "mine" ? "У вас нет заказов" : "Свободных заказов нет"}
                </div>
            ) : (
                <div className="seller-chat-list">
                    {filteredOrders.map((o) => (
                        <div className="seller-order-card" key={o.public_id || o.id}>
                            <div className="seller-order-row">
                                <div className="seller-order-title">Заказ {o.public_id}</div>
                                <div className="seller-order-badges">
                                    {o.status && <span className="seller-badge">{o.status}</span>}
                                    {o.order_type && <span className="seller-badge">{o.order_type}</span>}
                                </div>
                            </div>

                            <div className="seller-order-grid">
                                <div><span>user_id:</span> {o.user_id}</div>
                                <div><span>покупатель:</span> {o.user_nickname || o.user_login || o.user_email || o.user_id}</div>
                                <div><span>товар:</span> {o.product_name || o.product_id}</div>
                                <div><span>сумма:</span> {o.total_price} ₽</div>
                                <div><span>создан:</span> {String(o.created_at).slice(0, 19).replace("T", " ")}</div>
                            </div>

                            <div className="seller-order-actions">
                                {tab === "unassigned" ? (
                                    <button
                                        type="button"
                                        className="seller-chat-btn primary"
                                        onClick={() => onAssign(o.public_id)}
                                        disabled={assigning === o.public_id}
                                    >
                                        {assigning === o.public_id ? "Занимаю..." : "Занять заказ"}
                                    </button>
                                ) : (
                                    <div className="seller-order-status">
                                        {o.requires_manual_processing && (
                                            <NavLink className="seller-chat-link" to={`/order-chat/${o.id}`}>
                                                Открыть чат
                                            </NavLink>
                                        )}
                                        <select
                                            className="seller-order-select"
                                            value={statusDraft[o.public_id] ?? o.status}
                                            onChange={(e) =>
                                                setStatusDraft((prev) => ({ ...prev, [o.public_id]: e.target.value }))
                                            }
                                        >
                                            <option value="processing">processing</option>
                                            <option value="completed">completed</option>
                                            <option value="canceled">canceled</option>
                                        </select>
                                        <button
                                            type="button"
                                            className="seller-chat-btn primary"
                                            onClick={() => onSaveStatus(o.public_id)}
                                            disabled={savingStatus === o.public_id}
                                        >
                                            {savingStatus === o.public_id ? "Сохраняю..." : "Сохранить"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SellerChat;

