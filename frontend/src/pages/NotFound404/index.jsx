import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import "./not_found.css";

const NotFound404 = () => {
  const location = useLocation();

  return (
    <div className="not-found-page">
      <div className="not-found-container">
        <section className="not-found-hero">
          <p className="not-found-eyebrow">Ошибка</p>
          <h1 className="not-found-code">404</h1>
          <div className="not-found-title-divider" aria-hidden />
          <h2 className="not-found-title">Страница не найдена</h2>
          <p className="not-found-subtitle">
            Запрашиваемый адрес не существует или был перемещён. Проверьте ссылку или
            вернитесь в каталог.
          </p>
          {location.pathname ? (
            <p className="not-found-path" title={location.pathname}>
              {location.pathname}
            </p>
          ) : null}
        </section>

        <section className="not-found-actions">
          <NavLink to="/menu" className="not-found-btn not-found-btn-primary">
            На главную
          </NavLink>
          <NavLink to="/basket" className="not-found-btn not-found-btn-secondary">
            В корзину
          </NavLink>
          <NavLink to="/support" className="not-found-btn not-found-btn-secondary">
            Поддержка
          </NavLink>
        </section>

        <section className="not-found-links">
          <span className="not-found-links-label">Популярные разделы</span>
          <div className="not-found-links-row">
            <NavLink to="/about">О нас</NavLink>
            <NavLink to="/coop">Сотрудничество</NavLink>
            <NavLink to="/orders">Заказы</NavLink>
          </div>
        </section>
      </div>
    </div>
  );
};

export default NotFound404;
