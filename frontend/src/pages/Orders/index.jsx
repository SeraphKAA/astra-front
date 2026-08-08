import React, { useMemo, useState } from "react";
import { useMyOrders } from "../../entities/order/model/useOrders";
import { NavLink } from "react-router-dom";
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import { initRobokassaPayment } from "../../entities/order/api/orderApi";
import { Modal } from "../../shared/ui/Modal/Modal";
import "./orders.css";

const OrdersPage = () => {
    const { data, isLoading, error, refetch } = useMyOrders();
    const [tab, setTab] = useState("all");
    const [payingId, setPayingId] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const { pushToast } = useToast();
    const orders = Array.isArray(data) ? data : data?.orders || [];

    const formatCreatedAt = (value) => {
        if (!value) return "-";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleString("ru-RU", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    const startPayment = async (orderPublicId) => {
        if (!orderPublicId) return;
        setPayingId(orderPublicId);
        try {
            const paymentData = await initRobokassaPayment(orderPublicId);
            if (
                paymentData?.payment_method === "POST" &&
                paymentData?.payment_action_url
            ) {
                const form = document.createElement("form");
                form.method = "POST";
                form.action = paymentData.payment_action_url;
                form.target = "_blank";

                document.body.appendChild(form);
                form.submit();
                document.body.removeChild(form);
                return;
            }

            // paid fully by balance or already not in CREATED
            pushToast({ type: "success", message: "Заказ уже оплачен или не требует оплаты" });
            refetch?.();
        } catch (e) {
            pushToast({ type: "error", message: e?.message || "Не удалось перейти к оплате" });
        } finally {
            setPayingId(null);
        }
    };

    const isOrderPaid = (o) => {
        if (typeof o.is_paid === "boolean") return o.is_paid;
        return ["paid", "processing", "completed"].includes(o.status);
    };

    const filteredOrders = useMemo(() => {
        if (tab === "all") return orders;
        if (tab === "processing") return orders.filter((o) => o.status === "processing");
        if (tab === "completed") return orders.filter((o) => o.status === "completed");
        if (tab === "canceled") return orders.filter((o) => o.status === "canceled");

        return orders;
    }, [orders, tab]);

    if (isLoading) {
        return (
            <div className="orders-page">
                <h1>Покупки</h1>
                <div className="orders-muted">Загрузка...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="orders-page">
                <h1>Покупки</h1>
                <div className="orders-error">Не удалось загрузить заказы</div>
            </div>
        );
    }

    return (
        <> 
            <div className="orders-page">
                <h1>Покупки</h1>
                <div className="orders-tabs">
                    {[
                        ["all", "Все"],
                        ["processing", "В процессе"],
                        ["completed", "Завершено"],
                        ["canceled", "Отменено"],
                    ].map(([key, label]) => (
                        <button
                            type="button"
                            key={key}
                            className={`orders-tab ${tab === key ? "is-active" : ""}`}
                            onClick={() => setTab(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {filteredOrders.length === 0 ? (
                    <div className="orders-muted">Заказов пока нет</div>
                ) : (
                    <div className="orders-list">
                        {filteredOrders.map((o) => (
                            
                            <div className="orders-card" 
                                key={o.id ?? o.public_id}
                                onClick={() => setSelectedOrder(o)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="orders-card-row">
                                    <div className="orders-card-title">
                                        Заказ {o.public_id ? `${o.public_id}` : `ID ${o.id}`}
                                    </div>
                                    <div className="orders-card-badges">
                                        <div
                                            className={`orders-paid-badge ${isOrderPaid(o) ? "is-paid" : "is-unpaid"}`}
                                        >
                                            {isOrderPaid(o) ? "Оплачено" : "Не оплачено"}
                                        </div>
                                        {o.status && <div className="orders-badge">{o.status}</div>}
                                    </div>
                                </div>
                                <div className="orders-card-meta">
                                    {console.log(orders)}
                                    {(o.product_name || o.product_id) && 
                                    <div>
                                        {/* Товар: {o.product_name || `#${o.product_id}`} */}
                                        Товар: {(() => {
                                        const text = o.product_name || `#${o.product_id}`;
                                        const maxLength = 20;
                                        return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
                                        })()}
                                    </div>}
                                    {(o.user_nickname || o.user_login || o.user_email) && (
                                        <div>Покупатель: {o.user_nickname || o.user_login || o.user_email}</div>
                                    )}
                                    {(o.seller_nickname || o.seller_login) && (
                                        <div>Продавец: {o.seller_nickname || o.seller_login}</div>
                                    )}
                                    {o.created_at && <div>Создан: {formatCreatedAt(o.created_at)}</div>}
                                    {typeof o.total_price !== "undefined" && (
                                        <div>Сумма: {o.total_price} ₽</div>
                                    )}
                                    {o.requires_manual_processing && o.assigned_seller_id && {/* o.has_seller_reply */} && (
                                        <div className="orders-chat-link-wrap">
                                            <NavLink className="orders-chat-link" to={`/order-chat/${o.id}`} onClick={(e) => e.stopPropagation()}>
                                                Перейти в чат с продавцом
                                            </NavLink>
                                        </div>
                                    )}
                                </div>

                                {!isOrderPaid(o) && o.status === "created" && o.public_id && (
                                    <div className="orders-card-actions">
                                        <button
                                            type="button"
                                            className="orders-pay-btn"
                                            onClick={() => startPayment(o.public_id)}
                                            disabled={payingId === o.public_id}
                                        >
                                            {payingId === o.public_id ? "Переход..." : "Оплатить"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Modal
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                title={`Заказ ${selectedOrder?.public_id || selectedOrder?.id || ''}`}
            >
                {selectedOrder && (
                    <div className="order-details" style={{ display: "flex", flexDirection: "column" }}>
                        {selectedOrder.public_id && (
                            <div className="order-detail-row">
                                <span className="order-detail-label">Публичный ID: </span>
                                <span>{selectedOrder.public_id}</span>
                            </div>
                        )}
                        <div className="order-detail-row">
                            <span className="order-detail-label">Товар: </span>
                            <span>{selectedOrder.product_name || `#${selectedOrder.product_id}`}</span>
                        </div>
                        
                        <div className="order-detail-row">
                            <span className="order-detail-label">Цена товара: </span>
                            <span>
                                {selectedOrder.product_name === "Пополнение Steam" 
                                    ? selectedOrder.total_price 
                                    : selectedOrder.product_price} ₽
                            </span>
                        </div>
                        
                        {selectedOrder.product_name !== "Пополнение Steam" && (
                            <div className="order-detail-row">
                                <span className="order-detail-label">Количество: </span>
                                <span>
                                    {selectedOrder.quantity} шт.
                                </span>
                            </div>
                        )}

                        <div className="order-detail-row">
                            <span className="order-detail-label">Итого: </span>
                            <span>{selectedOrder.total_price} ₽</span>
                        </div>



                        <div className="order-detail-row">
                            <span className="order-detail-label">Статус:</span>
                            <span className={`order-status-${selectedOrder.status}`}>
                                {selectedOrder.status}
                            </span>
                        </div>
                        <div className="order-detail-row">
                            <span className="order-detail-label">Оплата:</span>
                            <span className={isOrderPaid(selectedOrder) ? "order-paid" : "order-unpaid"}>
                                {isOrderPaid(selectedOrder) ? "Оплачено" : "Не оплачено"}
                            </span>
                        </div>
                        <div className="order-detail-row">
                            <span className="order-detail-label">Тип заказа:</span>
                            <span>{selectedOrder.order_type === "manual" ? "Ручной" : "Автоматический"}</span>
                        </div>
                        {selectedOrder.seller_nickname && (
                            <div className="order-detail-row">
                                <span className="order-detail-label">Продавец:</span>
                                <span>{selectedOrder.seller_nickname}</span>
                            </div>
                        )}
                        <div className="order-detail-row">
                            <span className="order-detail-label">Создан:</span>
                            <span>{formatCreatedAt(selectedOrder.created_at)}</span>
                        </div>
                        {selectedOrder.requires_manual_processing && (
                            <div className="order-detail-row">
                                <span className="order-detail-label">Требует обработки:</span>
                                <span>Да</span>
                            </div>
                        )}
                        {selectedOrder.fulfillment_status && (
                            <div className="order-detail-row">
                                <span className="order-detail-label">Статус выполнения:</span>
                                <span>{selectedOrder.fulfillment_status}</span>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </>
    );
};

export default OrdersPage;

