import React, { useCallback, useEffect, useState } from "react";
import { Modal } from "../../shared/ui/Modal/Modal";
import { Input } from "../../shared/ui/Input/Input";
import { Pagination } from "../../shared/ui/Pagination/Pagination";
import {
  adminUpdateUser,
  changeUserRole,
  changeUserStatus,
  getUserById,
  getUsersList,
} from "../../entities/user/api/userApi";
import { getOrderByPublicId, getOrdersByUserForStaff } from "../../entities/order/api/orderApi";
import { OrderDetailsModal } from "../../entities/order/ui/OrderDetailsModal";
import styles from "./admin.module.css";

const roles = ["customer", "moderator", "admin", "support", "seller"];
const statuses = ["active", "blocked", "suspended"];
const DEFAULT_PAGE_SIZE = 20;

// Небольшой read-only компонент для отображения поля
const ReadonlyField = ({ label, value }) => (
  <div className={styles.formGroup} style={{ marginBottom: 4 }}>
    <label className={styles.formLabel}>{label}</label>
    <div
      className={styles.formInput}
      style={{ opacity: 0.8, cursor: "default", userSelect: "text" }}
    >
      {value === null || value === undefined || value === "" ? "-" : String(value)}
    </div>
  </div>
);

export const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [orders, setOrders] = useState([]);
  const [orderDetailsModalOpen, setOrderDetailsModalOpen] = useState(false);
  const [orderDetailsLoading, setOrderDetailsLoading] = useState(false);
  const [orderDetailsError, setOrderDetailsError] = useState(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [orderDetailsCache, setOrderDetailsCache] = useState({});
  const [banReason, setBanReason] = useState("");
  const [form, setForm] = useState({
    nickname: "",
    login: "",
    email: "",
    role: "customer",
    status: "active",
    is_email_verified: false,
    balance: 0.00,
  });

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchText.trim()), 350);
    return () => clearTimeout(t);
  }, [searchText]);

  useEffect(() => {
    setPage(1);
  }, [roleFilter, statusFilter, searchDebounced, pageSize]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsersList({
        page,
        size: pageSize,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        search: searchDebounced || undefined,
      });
      const list = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
      const nextTotal = data?.total ?? list.length;
      const nextPages = data?.pages ?? 1;
      setUsers(list);
      setTotal(nextTotal);
      setPages(nextPages);
      if (page > nextPages && nextPages >= 1) {
        setPage(nextPages);
      }
    } catch (e) {
      setUsers([]);
      setTotal(0);
      setPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, roleFilter, statusFilter, searchDebounced]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  /* Результат возврата из OrderDetailsModal. Сервер уже поменял статус
    заказа (canceled, is_paid=false) и начислил деньги на баланс — здесь
    только синхронизируем локальный стейт, чтобы не делать полный
    re-fetch карточки пользователя (это сбросило бы isEditMode/form). */
  const onOrderRefunded = useCallback(
    async (result) => {
      const publicId = result?.order_public_id;
      if (!publicId) return;

      // 1. Инвалидируем кеш деталей — следующий открытый заказ подтянется заново
      setOrderDetailsCache((prev) => {
        if (!(publicId in prev)) return prev;
        const next = { ...prev };
        delete next[publicId];
        return next;
      });

      // 2. Обновляем строку в «Заказы пользователя» (тот же публичный ID)
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

      // 3. Баланс вырос — обновляем и в шапке карточки, и в форме
      if (selectedUser?.id) {
        setSelectedUser((prev) =>
          prev ? { ...prev, balance: result.new_user_balance } : prev
        );
        setForm((prev) => ({ ...prev, balance: result.new_user_balance }));
      }

      // 4. Обновляем таблицу пользователей за модалкой
      await fetchUsers();
    },
    [selectedUser?.id, fetchUsers]
  );

  const openUserModal = async (userId) => {
    const [user, userOrders] = await Promise.all([
      getUserById(userId),
      getOrdersByUserForStaff(userId),
    ]);
    setSelectedUser(user);
    setOrders(Array.isArray(userOrders) ? userOrders : []);
    setIsEditMode(false);
    setBanReason(user?.ban_reason || "");
    setForm({
      nickname: user.nickname || "",
      login: user.login || "",
      email: user.email || "",
      role: user.role || "customer",
      status: user.status || "active",
      is_email_verified: Boolean(user.is_email_verified),
      balance: user.balance || 0.00,
    });
    setModalOpen(true);
  };

  const openOrderDetails = async (publicId) => {
    if (!publicId) return;
    if (orderDetailsCache[publicId]) {
      setSelectedOrderDetails(orderDetailsCache[publicId]);
      setOrderDetailsError(null);
      setOrderDetailsModalOpen(true);
      return;
    }

    setOrderDetailsLoading(true);
    setOrderDetailsError(null);
    setSelectedOrderDetails(null);
    setOrderDetailsModalOpen(true);
    try {
      const details = await getOrderByPublicId(publicId);
      setSelectedOrderDetails(details);
      setOrderDetailsCache((prev) => ({ ...prev, [publicId]: details }));
    } catch (e) {
      setOrderDetailsError(e?.message || "Не удалось загрузить заказ");
    } finally {
      setOrderDetailsLoading(false);
    }
  };

  const onSave = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    await changeUserRole({ user_id: selectedUser.id, role: form.role });
    await changeUserStatus(selectedUser.id, form.status);
    await adminUpdateUser(selectedUser.id, {
      nickname: form.nickname || null,
      login: form.login || null,
      email: form.email || null,
      role: form.role,
      status: form.status,
      is_email_verified: form.is_email_verified,
      balance: form.balance,
    });
    setModalOpen(false);
    await fetchUsers();
    setIsEditMode(false);
  };

  const onBan = async () => {
    if (!selectedUser) return;
    const reason = banReason.trim();
    if (!reason) return;
    await changeUserStatus(selectedUser.id, "blocked");
    await adminUpdateUser(selectedUser.id, { ban_reason: reason });
    setModalOpen(false);
    await fetchUsers();
  };

  const onUnban = async () => {
    if (!selectedUser) return;
    await changeUserStatus(selectedUser.id, "active");
    setModalOpen(false);
    await fetchUsers();
  };

  if (loading && users.length === 0) {
    return <div className={styles.loading}>Загрузка...</div>;
  }

  return (
    <div>
      <div className={styles.adminHeader}>
        <h1 className={styles.pageTitle}>Пользователи</h1>
      </div>

      <div className={styles.formGroup} style={{ marginBottom: 12 }}>
        <Input
          placeholder="Поиск (id, никнейм, email...)"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select className={styles.formSelect} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ maxWidth: 240 }}>
            <option value="">Все роли</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <select className={styles.formSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: 240 }}>
            <option value="">Все статусы</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <button type="button" className={styles.adminButtonSecondary} onClick={fetchUsers} disabled={loading}>
            Обновить
          </button>
        </div>
      </div>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Никнейм</th>
              <th>Email</th>
              <th>Роль</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6}>Пользователи не найдены</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.nickname || "-"}</td>
                  <td>{user.email || "-"}</td>
                  <td>{user.role}</td>
                  <td>{user.status}</td>
                  <td>
                    <button className={styles.adminButtonSecondary} onClick={() => openUserModal(user.id)}>
                      Подробнее
                    </button>
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

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          <div>
            <span>Пользователь</span>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={() => { setModalOpen(false) }}
              aria-label="Закрыть"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        }
      >
        <form onSubmit={onSave} className={styles.form}>
          <div className={styles.formActions} style={{ justifyContent: "space-between" }}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setIsEditMode((prev) => !prev)}
              title="Редактировать"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.8" />
                <path d="m12 6 4 4" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </button>
          </div>
          <input disabled={!isEditMode} className={styles.formInput} value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="Никнейм" />
          <input disabled={!isEditMode} className={styles.formInput} value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} placeholder="Логин" />
          <input disabled={!isEditMode} className={styles.formInput} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" />
          <input disabled={!isEditMode} className={styles.formInput} value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} placeholder="Баланс" />
          <select disabled={!isEditMode} className={styles.formSelect} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {roles.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <select disabled={!isEditMode} className={styles.formSelect} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <label className={styles.formLabel}>
            <input disabled={!isEditMode} type="checkbox" checked={form.is_email_verified} onChange={(e) => setForm({ ...form, is_email_verified: e.target.checked })} />
            {" "}Email подтверждён
          </label>

          {/* --- Telegram (только для чтения, в API не отправляется) --- */}
          <div className={styles.formGroup} style={{ marginTop: 12 }}>
            <label className={styles.formLabel} style={{fontSize: 24, textTransform: "none"}}>Telegram</label>
            <ReadonlyField label="Telegram ID" value={selectedUser?.telegram_id} />
            <ReadonlyField label="Username" value={selectedUser?.telegram_username} />
            <ReadonlyField label="Имя" value={selectedUser?.telegram_first_name} />
            <ReadonlyField label="Фамилия" value={selectedUser?.telegram_last_name} />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Заказы пользователя</label>
            <div className={styles.tableContainer} style={{ marginTop: 0, marginBottom: 0 }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Статус</th>
                    <th>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr><td colSpan={3}>Нет заказов</td></tr>
                  ) : (
                    orders.map((order) => (
                      <tr text-none key={order.public_id}>
                        <td>
                          <button
                            type="button"
                            onClick={() => openOrderDetails(order.public_id)}
                            style={{ background: "transparent", border: "none", padding: 0, color: "var(--astra-pink)", cursor: "pointer" }}
                          >
                            {order.public_id}
                          </button>
                        </td>
                        <td>{order.status}</td>
                        <td>{order.total_price}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {isEditMode && <button type="submit" className={styles.adminButton}>Сохранить изменения</button>}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Блокировка (причина)</label>
            <textarea className={styles.formTextarea} value={banReason} onChange={(e) => setBanReason(e.target.value)} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className={styles.adminButtonSecondary} onClick={onBan}>Заблокировать</button>
              {selectedUser?.status === "blocked" && (
                <button type="button" className={styles.adminButtonSecondary} onClick={onUnban}>
                  Разблокировать
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>
      <OrderDetailsModal
        isOpen={orderDetailsModalOpen}
        onClose={() => setOrderDetailsModalOpen(false)}
        order={selectedOrderDetails}
        loading={orderDetailsLoading}
        error={orderDetailsError}
        onRefunded={onOrderRefunded}
      />
    </div>
  );
};
