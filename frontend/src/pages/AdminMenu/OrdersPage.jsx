import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "../../shared/ui/Modal/Modal";
import { Input } from "../../shared/ui/Input/Input";
import { Pagination } from "../../shared/ui/Pagination/Pagination";
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import { OrderDetailsModal } from "../../entities/order/ui/OrderDetailsModal";
import {
    assignSellerToOrder,
    changeOrderStatus,
    getOrderByPublicId,
    getOrdersByFilter,
    refundOrder,
} from "../../entities/order/api/orderApi";
import { getUsersList } from "../../entities/user/api/userApi";
import styles from "./admin.module.css";
import {
    ChatIcon,
    ClipboardIcon,
    PencilIcon,
    RefundIcon,
} from '../../shared/svgIcons';


const STATUS_LABELS = {
    created: "Создан",
    paid: "Оплачен",
    processing: "В обработке",
    completed: "Выполнен",
    canceled: "Отменён",
};

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
}));

const ORDER_TYPE_LABELS = {
    manual: "Ручной",
    auto: "Автоматический",
};

const DEFAULT_PAGE_SIZE = 20;

const formatMoney = (v) =>
  `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(Number(v) || 0)} ₽`;

const formatDateTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const sellerLabel = (o) =>
    o.seller_nickname || o.seller_login || (o.assigned_seller_id != null ? `ID ${o.assigned_seller_id}` : "—");

const buyerLabel = (o) =>
    o.user_nickname || o.user_login || o.user_email || (o.user_id != null ? `ID ${o.user_id}` : "—");

const userOptionLabel = (u) => {
    const name = u.nickname || u.login || u.email || `ID ${u.id}`;
    return `${name} · ${u.role} · #${u.id}`;
};

const toIso = (value) => {
    if (!value) return undefined;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
};

export const OrdersPage = () => {
    const { pushToast } = useToast();

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);

    // Фильтры
    const [searchPublicId, setSearchPublicId] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [userIdFilter, setUserIdFilter] = useState("");
    const [sellerIdFilter, setSellerIdFilter] = useState("");
    const [buyerOptions, setBuyerOptions] = useState([]);
    const [buyerOptionsLoading, setBuyerOptionsLoading] = useState(false);
    const [sellerOptions, setSellerOptions] = useState([]);
    const [sellerOptionsLoading, setSellerOptionsLoading] = useState(false);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [manualOnly, setManualOnly] = useState(false);
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Детали заказа
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [detailsCache, setDetailsCache] = useState({});

    // Возврат
    const [refundOpen, setRefundOpen] = useState(false);
    const [refundOrderRow, setRefundOrderRow] = useState(null);
    const [refundReason, setRefundReason] = useState("");
    const [refundAmount, setRefundAmount] = useState("");
    const [refundBusy, setRefundBusy] = useState(false);

    // Назначение продавца
    const [assignOpen, setAssignOpen] = useState(false);
    const [assignOrderRow, setAssignOrderRow] = useState(null);
    const [assignSellerId, setAssignSellerId] = useState("");
    const [assignBusy, setAssignBusy] = useState(false);
    const [assignUsers, setAssignUsers] = useState([]);
    const [assignUsersLoading, setAssignUsersLoading] = useState(false);

    // Статус меняется в inline-select
    const [statusBusy, setStatusBusy] = useState({});

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchPublicId.trim()), 350);
        return () => clearTimeout(t);
    }, [searchPublicId]);

    useEffect(() => {
        setPage(1);
    }, [
        debouncedSearch, statusFilter, typeFilter, userIdFilter,
        sellerIdFilter, dateFrom, dateTo, manualOnly, pageSize,
    ]);

    const loadBuyerOptions = useCallback(async () => {
        if (buyerOptions.length > 0) return;
        setBuyerOptionsLoading(true);
        try {
            const data = await getUsersList({ page: 1, size: 100, role: "customer" });
            const list = Array.isArray(data?.users)
                ? data.users
                : Array.isArray(data)
                    ? data
                    : [];
            setBuyerOptions(list);
        } catch (e) {
            pushToast({ type: "error", message: "Не удалось загрузить список покупателей" });
            setBuyerOptions([]);
        } finally {
            setBuyerOptionsLoading(false);
        }
    }, [buyerOptions.length, pushToast]);

    const loadSellerOptions = useCallback(async () => {
        if (sellerOptions.length > 0) return;
        setSellerOptionsLoading(true);
        try {
            const roles = ["seller", "moderator", "admin"];
            const responses = await Promise.all(
                roles.map((role) => getUsersList({ page: 1, size: 100, role }))
            );
            const merged = [];
            for (const data of responses) {
                const list = Array.isArray(data?.users)
                    ? data.users
                    : Array.isArray(data)
                        ? data
                        : [];
                merged.push(...list);
            }
            const byId = new Map();
            for (const u of merged) byId.set(u.id, u);
            setSellerOptions(Array.from(byId.values()));
        } catch (e) {
            pushToast({ type: "error", message: "Не удалось загрузить список продавцов" });
            setSellerOptions([]);
        } finally {
            setSellerOptionsLoading(false);
        }
    }, [sellerOptions.length, pushToast]);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
        const filters = { flag: true }; 
        if (debouncedSearch) filters.public_id = debouncedSearch;
        if (statusFilter) filters.status = statusFilter;
        if (typeFilter) filters.order_type = typeFilter;
        if (userIdFilter) filters.user_id = Number(userIdFilter);
        if (sellerIdFilter) filters.assigned_seller_id = Number(sellerIdFilter);
        if (dateFrom) filters.date_from = toIso(dateFrom);
        if (dateTo) filters.date_to = toIso(dateTo);
        if (manualOnly) filters.requires_manual_processing = true;

        const data = await getOrdersByFilter(filters, pageSize, (page - 1) * pageSize);
        const list = Array.isArray(data) ? data : Array.isArray(data?.orders) ? data.orders : [];
        setOrders(list);
        setTotal(data?.total ?? list.length);
        const nextPages = data?.pages ?? Math.max(1, Math.ceil((data?.total ?? list.length) / pageSize));
        setPages(nextPages);
        if (page > nextPages && nextPages >= 1) setPage(nextPages);
        } catch (e) {
        pushToast({ type: "error", message: e?.message || "Не удалось загрузить заказы" });
        setOrders([]);
        setTotal(0);
        setPages(1);
        } finally {
        setLoading(false);
        }
    }, [
        page, pageSize, debouncedSearch, statusFilter, typeFilter,
        userIdFilter, sellerIdFilter, dateFrom, dateTo, manualOnly, pushToast,
    ]);

    useEffect(() => {
        loadBuyerOptions();
        loadSellerOptions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const resetFilters = () => {
        setSearchPublicId("");
        setStatusFilter("");
        setTypeFilter("");
        setUserIdFilter("");
        setSellerIdFilter("");
        setDateFrom("");
        setDateTo("");
        setManualOnly(false);
    };

    const openDetails = async (order) => {
        if (detailsCache[order.public_id]) {
        setSelectedOrder(detailsCache[order.public_id]);
        setDetailsError(null);
        setDetailsOpen(true);
        return;
        }
        setDetailsLoading(true);
        setDetailsError(null);
        setSelectedOrder(null);
        setDetailsOpen(true);
        try {
        const details = await getOrderByPublicId(order.public_id);
        setSelectedOrder(details);
        setDetailsCache((prev) => ({ ...prev, [order.public_id]: details }));
        } catch (e) {
        setDetailsError(e?.message || "Не удалось загрузить заказ");
        } finally {
        setDetailsLoading(false);
        }
    };

    const openChat = (order) => {
        // Открываем в новой вкладке, чтобы не терять список
        const url = `/order-chat/${encodeURIComponent(order.id)}`;
        window.open(url, "_blank", "noopener,noreferrer");
    };

    const onChangeStatus = async (order, newStatus) => {
        if (!newStatus || newStatus === order.status) return;
        setStatusBusy((prev) => ({ ...prev, [order.id]: true }));
        try {
        const updated = await changeOrderStatus(order.public_id, newStatus);
        setOrders((prev) => prev.map((o) => (o.public_id === order.public_id ? { ...o, ...updated } : o)));
        pushToast({ type: "success", message: `Статус заказа ${order.public_id} обновлён` });
        } catch (e) {
        pushToast({ type: "error", message: e?.message || "Не удалось изменить статус" });
        } finally {
        setStatusBusy((prev) => {
            const next = { ...prev };
            delete next[order.id];
            return next;
        });
        }
    };

    const openRefund = (order) => {
        setRefundOrderRow(order);
        setRefundReason("");
        setRefundAmount("");
        setRefundOpen(true);
    };

    const onRefund = async (e) => {
        e.preventDefault();
        if (!refundOrderRow) return;
        setRefundBusy(true);
        try {
        const amount = refundAmount ? Number(refundAmount) : null;
        await refundOrder(refundOrderRow.public_id, refundReason || null, amount);
        pushToast({ type: "success", message: `Возврат по заказу ${refundOrderRow.public_id} оформлен` });
        setRefundOpen(false);
        setRefundOrderRow(null);
        await fetchOrders();
        } catch (err) {
        pushToast({ type: "error", message: err?.message || "Не удалось оформить возврат" });
        } finally {
        setRefundBusy(false);
        }
    };

    /* Результат возврата из OrderDetailsModal. У OrdersPage ДВА пути
        оформления возврата: (1) отдельная модалка refundOpen («Возврат»
        в списке заказов) — там уже есть onRefund и fetchOrders();
        (2) RefundForm ВНУТРИ OrderDetailsModal — для неё и нужен этот
        обработчик. Он инвалидирует кеш деталей и обновляет список. */
    const onOrderRefunded = useCallback(
        async (result) => {
        const publicId = result?.order_public_id;
        if (!publicId) return;

        // 1. Инвалидируем кеш — следующий openDetails(publicId) подтянет свежий заказ
        setDetailsCache((prev) => {
            if (!(publicId in prev)) return prev;
            const next = { ...prev };
            delete next[publicId];
            return next;
        });

        // 2. Локально патчим строку — таблица сразу показывает canceled / Возврат
        setOrders((prev) =>
            prev.map((o) =>
            o.public_id === publicId
                ? {
                    ...o,
                    status: "canceled",
                    is_paid: false,
                    can_refund: false,
                    refunded_at: result.refunded_at,
                    refund_amount: result.refunded_amount,
                }
                : o
            )
        );

        // 3. Подтягиваем полный список — фильтры/сортировка могли измениться
        await fetchOrders();
        },
        [fetchOrders]
    );

    const loadAssignUsers = useCallback(async () => {
        setAssignUsersLoading(true);
        try {
            const roles = ["seller", "moderator", "admin"];
            const responses = await Promise.all(
                roles.map((role) => getUsersList({ page: 1, size: 100, role }))
            );
            const merged = [];
            for (const data of responses) {
                const list = Array.isArray(data?.users)
                    ? data.users
                    : Array.isArray(data)
                        ? data
                        : [];
                merged.push(...list);
            }
            // Дедупликация по id (мало ли кто-то попадёт в несколько выдач)
            const byId = new Map();
            for (const u of merged) byId.set(u.id, u);
            setAssignUsers(Array.from(byId.values()));
        } catch (e) {
            pushToast({ type: "error", message: "Не удалось загрузить список исполнителей" });
            setAssignUsers([]);
        } finally {
            setAssignUsersLoading(false);
        }
    }, [pushToast]);

    const openAssign = async (order) => {
        setAssignOrderRow(order);
        setAssignSellerId(order.assigned_seller_id ? String(order.assigned_seller_id) : "");
        setAssignOpen(true);
        if (assignUsers.length === 0) {
            await loadAssignUsers();
        }
    };

    const onAssign = async (e) => {
        e.preventDefault();
        if (!assignOrderRow || !assignSellerId) return;
        setAssignBusy(true);
        try {
        await assignSellerToOrder(assignOrderRow.public_id, Number(assignSellerId));
        pushToast({ type: "success", message: `Продавец назначен на ${assignOrderRow.public_id}` });
        setAssignOpen(false);
        setAssignOrderRow(null);
        await fetchOrders();
        } catch (err) {
        pushToast({ type: "error", message: err?.message || "Не удалось назначить продавца" });
        } finally {
        setAssignBusy(false);
        }
    };

    const colCount = 9;

    return (
        <div>
        <div className={styles.adminHeader}>
            <h1 className={styles.pageTitle}>Заказы</h1>
        </div>

        <div className={styles.formGroup} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Input
                placeholder="Поиск по public_id (например, #E8ADA9D4)"
                value={searchPublicId}
                onChange={(e) => setSearchPublicId(e.target.value)}
                style={{ maxWidth: 280 }}
            />

            <select
                className={styles.formSelect}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ maxWidth: 180 }}
            >
                <option value="">Все статусы</option>
                {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>

            <select
                className={styles.formSelect}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{ maxWidth: 160 }}
            >
                <option value="">Все типы</option>
                <option value="manual">Ручной</option>
                <option value="auto">Автоматический</option>
            </select>

            <select
                className={styles.formSelect}
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
                disabled={buyerOptionsLoading}
                style={{ maxWidth: 260 }}
                title="Покупатель"
            >
                <option value="">
                    {buyerOptionsLoading ? "Загрузка покупателей…" : "Все покупатели"}
                </option>
                {buyerOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                        {userOptionLabel(u)}
                    </option>
                ))}
            </select>

            <select
                className={styles.formSelect}
                value={sellerIdFilter}
                onChange={(e) => setSellerIdFilter(e.target.value)}
                disabled={sellerOptionsLoading}
                style={{ maxWidth: 260 }}
                title="Продавец"
            >
                <option value="">
                    {sellerOptionsLoading ? "Загрузка продавцов…" : "Все продавцы"}
                </option>
                {sellerOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                        {userOptionLabel(u)}
                    </option>
                ))}
            </select>

            <input
                type="datetime-local"
                className={styles.formInput}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                title="Дата от"
                style={{ maxWidth: 200 }}
            />
            <input
                type="datetime-local"
                className={styles.formInput}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                title="Дата до"
                style={{ maxWidth: 200 }}
            />

            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, whiteSpace: "nowrap" }}>
                <input
                type="checkbox"
                checked={manualOnly}
                onChange={(e) => setManualOnly(e.target.checked)}
                />
                Только ручные
            </label>

            <button
                type="button"
                className={styles.adminButtonSecondary}
                onClick={resetFilters}
                disabled={loading}
            >
                Сбросить фильтры
            </button>
            </div>
        </div>

        <div className={styles.tableContainer}>
            <table className={styles.table}>
            <thead>
                <tr>
                <th>Public ID</th>
                <th>Товар</th>
                <th>Покупатель</th>
                <th>Продавец</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th>Оплачен</th>
                <th>Создан</th>
                <th>Действия</th>
                </tr>
            </thead>
            <tbody>
                {loading && orders.length === 0 ? (
                <tr><td colSpan={colCount} style={{ textAlign: "center", padding: 40 }}>Загрузка…</td></tr>
                ) : orders.length === 0 ? (
                <tr><td colSpan={colCount} style={{ textAlign: "center", padding: 40 }}>Заказы не найдены</td></tr>
                ) : (
                orders.map((o) => (
                    <tr key={o.public_id}>
                    <td className="text-none">{o.public_id}</td>
                    <td className="text-none">{o.product_name || `#${o.product_id}` || "—"}</td>
                    <td className="text-none">{buyerLabel(o)}</td>
                    <td className="text-none">{sellerLabel(o)}</td>
                    <td>{formatMoney(o.total_price)}</td>
                    <td>
                        <select
                        className={styles.imageItemSelect}
                        value={o.status}
                        onChange={(e) => onChangeStatus(o, e.target.value)}
                        disabled={Boolean(statusBusy[o.id]) || o.status === "created"}
                        title={o.status === "created" ? "Нельзя изменить статус неоплаченного заказа" : ""}
                        style={{ minWidth: 130 }}
                        >
                        {STATUS_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                        </select>
                    </td>
                    <td>
                        <span className={`${styles.badge} ${o.is_paid ? styles.active : styles.inactive}`}>
                        {o.is_paid ? "Да" : "Нет"}
                        </span>
                    </td>
                    <td>{formatDateTime(o.created_at)}</td>
                    <td>
                        <div className={styles.actionButtons}>
                        <button
                            type="button"
                            className={`${styles.iconButton} ${styles.iconButtonCheckout}`}
                            onClick={() => openDetails(o)}
                            title="Детали заказа"
                            aria-label="Детали"
                        >
                            <ClipboardIcon className={styles.adminActionIcon} />
                        </button>
                        <button
                            type="button"
                            className={`${styles.iconButton} ${styles.iconButtonImage}`}
                            onClick={() => openChat(o)}
                            title="Открыть чат заказа"
                            aria-label="Чат"
                        >
                            <ChatIcon className={styles.adminActionIcon} />
                        </button>
                        <button
                            type="button"
                            className={`${styles.iconButton} ${styles.iconButtonDuplicate}`}
                            onClick={() => openAssign(o)}
                            title="Назначить продавца"
                            aria-label="Назначить"
                        >
                            <PencilIcon className={styles.adminActionIcon} />
                        </button>
                        <button
                            type="button"
                            className={`${styles.iconButton} ${styles.iconButtonDelete}`}
                            onClick={() => openRefund(o)}
                            disabled={!o.is_paid}
                            title={o.is_paid ? "Оформить возврат" : "Только для оплаченных заказов"}
                            aria-label="Возврат"
                        >
                            <RefundIcon className={styles.adminActionIcon} />
                        </button>
                        </div>
                    </td>
                    </tr>
                ))
                )}
            </tbody>
            </table>
        </div>

        <Pagination
            page={page}
            pages={pages}
            total={total}
            pageSize={pageSize}
            loading={loading}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 20, 50, 100]}
        />

        {/* Детали заказа */}
        <OrderDetailsModal
            isOpen={detailsOpen}
            onClose={() => setDetailsOpen(false)}
            order={selectedOrder}
            loading={detailsLoading}
            error={detailsError}
            onRefunded={onOrderRefunded}
        />

        {/* Возврат */}
        <Modal
            isOpen={refundOpen}
            onClose={() => !refundBusy && setRefundOpen(false)}
            title={
            <div className="text-none">
                {`Возврат по заказу ${refundOrderRow?.public_id || ""}`}
                <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => !refundBusy && setRefundOpen(false)}
                aria-label="Закрыть"
                >
                <span aria-hidden="true">✕</span>
                </button>
            </div>
            }
        >
            <form onSubmit={onRefund} className={styles.form}>
            <div className={styles.formGroup}>
                <label className={styles.formLabel}>Сумма (пусто — вся стоимость заказа)</label>
                <input
                type="number"
                step="0.01"
                min="0"
                className={styles.formInput}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={refundOrderRow ? String(refundOrderRow.total_price) : ""}
                />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.formLabel}>Причина</label>
                <textarea
                className={styles.formTextarea}
                rows={3}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                />
            </div>
            <div className={styles.formActions}>
                <button
                type="button"
                className={styles.adminButtonSecondary}
                onClick={() => !refundBusy && setRefundOpen(false)}
                >
                Отмена
                </button>
                <button type="submit" className={styles.adminButton} disabled={refundBusy}>
                {refundBusy ? "Оформляем…" : "Оформить возврат"}
                </button>
            </div>
            </form>
        </Modal>

            {/* Назначить продавца */}
        <Modal
            isOpen={assignOpen}
            onClose={() => !assignBusy && setAssignOpen(false)}
            title={
            <div>
                {`Назначить продавца — ${assignOrderRow?.public_id || ""}`}
                <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => !assignBusy && setAssignOpen(false)}
                aria-label="Закрыть"
                >
                <span aria-hidden="true">✕</span>
                </button>
            </div>
            }
        >
            <form onSubmit={onAssign} className={styles.form}>
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Исполнитель</label>
                    <select
                        className={styles.formSelect}
                        value={assignSellerId}
                        onChange={(e) => setAssignSellerId(e.target.value)}
                        required
                        disabled={assignUsersLoading}
                    >
                        <option value="">
                            {assignUsersLoading ? "Загрузка…" : "— выберите —"}
                        </option>
                        {assignUsers.map((u) => {
                            const name = u.nickname || u.login || u.email || `ID ${u.id}`;
                            return (
                                <option key={u.id} value={u.id}>
                                    {name} · {u.role} · #{u.id}
                                </option>
                            );
                        })}
                    </select>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>
                        Показаны пользователи с ролями seller / moderator / admin.
                    </span>
                </div>
                <div className={styles.formActions}>
                        <button
                            type="button"
                            className={styles.adminButtonSecondary}
                            onClick={() => !assignBusy && setAssignOpen(false)}
                            >
                            Отмена
                        </button>
                        <button type="submit" className={styles.adminButton} disabled={assignBusy || !assignSellerId}>
                            {assignBusy ? "Назначаем…" : "Назначить"}
                        </button>
                </div>
            </form>
        </Modal>
    </div>
);
};