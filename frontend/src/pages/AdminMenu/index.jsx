import React, { useState } from 'react';
import { DashboardPage } from './DashboardPage';
import { OrdersPage } from './OrdersPage';
import { ProductsPage } from './ProductsPage';
import { CategoriesPage } from './CategoriesPage';
import { PromocodesPage } from './PromocodesPage';
import { UsersPage } from './UsersPage';
import { PaymentsPage } from './PaymentsPage';
import styles from './admin.module.css';

const AdminMenu = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const onChangeTab = (tab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'orders':
        return <OrdersPage />;
      case 'payments':
        return <PaymentsPage />;
      case 'products':
        return <ProductsPage />;
      case 'categories':
        return <CategoriesPage />;
      case 'promocodes':
        return <PromocodesPage />;
      case 'users':
        return <UsersPage />;
      default:
        return <DashboardPage />;
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Дашборд', icon: '📊' },
    { id: 'orders', label: 'Заказы', icon: '🧾' },
    { id: 'payments', label: 'Платежи', icon: '💳' },
    { id: 'products', label: 'Товары', icon: '📦' },
    { id: 'categories', label: 'Категории', icon: '📁' },
    { id: 'promocodes', label: 'Промокоды', icon: '🏷️' },
    { id: 'users', label: 'Пользователи', icon: '👤' }
  ];

  return (
    <div className={styles.adminPage}>
      <div className={styles.adminContainer}>
        {isSidebarOpen ? (
          <button
            type="button"
            className={styles.sidebarOverlay}
            aria-label="Закрыть меню"
            onClick={() => setIsSidebarOpen(false)}
          />
        ) : null}
        <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.open : ""}`}>
          <div className={styles.logo}>
            <br />
            <br />
            <h1>ASTRA ADMIN</h1>
            <p>Панель управления</p>
          </div>
          <nav className={styles.nav}>
            {navItems.map(item => (
              <div
                key={item.id}
                className={`${styles.navItem} ${activeTab === item.id ? styles.active : ''}`}
                onClick={() => onChangeTab(item.id)}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </nav>
        </aside>

        <main className={styles.mainContent}>
          <div className={styles.menuToggleWrap}>
            <button
              type="button"
              className={`${styles.adminButtonSecondary} ${styles.menuToggleBtn}`}
              onClick={() => setIsSidebarOpen((prev) => !prev)}
            >
              <span className={styles.menuToggleBtnText}>
                {isSidebarOpen ? "Скрыть меню" : "Открыть меню"}
              </span>
            </button>
          </div>
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default AdminMenu;
