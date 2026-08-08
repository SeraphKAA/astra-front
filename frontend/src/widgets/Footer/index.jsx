// Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import './footer.css'; // или используйте CSS Modules, styled-components

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3>ASTRA Shop</h3>
          <p>Ваш постоянный партнер по покупкам подписок и игровой валюты.</p>
        </div>

        <div className="footer-section">
          <h4>Навигация</h4>
          <ul>
            <li><a href="/menu">Главная</a></li>
            <li><a href="/about">О нас</a></li>
            <li><a href="/user-agreement">Пользовательское соглашение</a></li>
            <li><a href="/public-offer">Публичная оферта</a></li>
            <li><a href="/coop">Сотрудничество</a></li>
            {/* <li><a href="/contact">Контакты</a></li> */}
          </ul>
        </div>

        <div className="footer-section">
          <h4>Контакты</h4>
          <p>Email: astraassistance@gmail.com</p> {/* */}
          {/* отзывы, TODO: сделать бота который будет отправлять в группу "отзывы" оценки и описание отзыва если есть с товаров */}
        </div>

        <div className="footer-section">
          <h4>Социальные сети</h4>
          <div className="social-links">
            <a href="https://t.me/astrashopshop" target="_blank" rel="noopener noreferrer">Telegram</a>
            <a href="https://discord.gg/astrashop2" target="_blank" rel="noopener noreferrer">Discord</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© {currentYear} ASTRA Shop. Все права защищены.</p>
      </div>
    </footer>
  );
};

export default Footer;