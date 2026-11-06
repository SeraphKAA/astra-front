import React from "react";
import { NavLink } from "react-router-dom";
import { SendIcon, BadgeCheckIcon, ClockIcon, CalendarIcon, ShoppingBagIcon } from "../../shared/icons/lucide";
import "./about.css";

const COOP_TELEGRAM_URL = "https://t.me/astrashopsupport";

const VALUES = [
  {
    title: "Инновации",
    text: "Постоянно ищем новые решения и не боимся экспериментировать",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3l1.4 4.3h4.6l-3.7 2.7 1.4 4.3L12 11.6 8.3 14.3l1.4-4.3L6 7.3h4.6L12 3z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M5 19h14M8 16h8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: "Качество",
    text: "Уделяем внимание каждой детали и стремимся к совершенству",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3l2.2 4.5 4.9.7-3.5 3.4.8 4.9L12 14.8 7.6 16.5l.8-4.9-3.5-3.4 4.9-.7L12 3z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Команда",
    text: "Ценим каждого участника и создаём атмосферу, в которой все друг другу равны",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M4 19c0-2.8 2.2-5 5-5s5 2.2 5 5M13 19c0-2 1.5-3.7 3.5-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: "Клиенты",
    text: "Наши пользователи — главный источник вдохновения",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 21s-7-4.5-7-10a4 4 0 018 0 4 4 0 018 0c0 5.5-7 10-7 10z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

const CONTACTS = [
  {
    label: "Email",
    value: "astraassistance@gmail.com",
    href: "mailto:astraassistance@gmail.com",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Telegram",
    value: "@astrashopsupport",
    href: COOP_TELEGRAM_URL,
    target: "_blank",
    rel: "noreferrer",
    icon: <SendIcon className="coop-btn-icon" />
  }

];

const About = () => {
  return (
    <div className="about-page">
      <div className="about-container">
        <header className="about-hero">
          <p className="about-eyebrow">ASTRA Shop</p>
          <h1 className="about-title">О нас</h1>
          <div className="about-title-divider" aria-hidden />
          <p className="about-subtitle">
            Цифровой магазин игр, подписок и сервисов — с заботой о каждом заказе
          </p>
        </header>

        <div className="about-stats">
          <div className="about-stat-card">
            <div className="about-stat-text">
              <span className="about-stat-value">2024</span>
              <span className="about-stat-label">Год основания</span>
            </div>
            <CalendarIcon className="about-stat-icon" />
          </div>
          <div className="about-stat-card">
            <div className="about-stat-text">
              <span className="about-stat-value">24/7</span>
              <span className="about-stat-label">Поддержка</span>
            </div>
            <ClockIcon className="about-stat-icon" />
          </div>
          <div className="about-stat-card">
            <div className="about-stat-text">
              <span className="about-stat-value">100%</span>
              <span className="about-stat-label">Фокус на клиенте</span>
            </div>
            <BadgeCheckIcon className="about-stat-icon" />
          </div>
        </div>

        <div className="about-content">
          <section className="about-section about-section-card">
            <h2 className="about-section-title">Наша миссия</h2>
            <p className="about-section-text">
              Мы стремимся создавать инновационные решения, которые делают опыт клиента проще и интереснее.
              Мы объединяем талантливых специалистов, молодых инфлюенсеров и умных ребят, 
              увлечённых своей работой и развитием сферы ритейла и цифровых продуктов.
            </p>
          </section>

          <section className="about-section about-section-card">
            <h2 className="about-section-title">Наша история</h2>
            <p className="about-section-text">
              Проект был основан в 2024 году группой энтузиастов, которые жили и живут исключительно идеей, а не заработком.
              За это время мы прошли путь от небольшой команды до современной платформы, сохранив командную атмосферу,
              дух инноваций и стремление к совершенству.
            </p>
          </section>

          <section className="about-section">
            <h2 className="about-section-title">Наши ценности</h2>
            <div className="about-values-grid">
              {VALUES.map((item) => (
                <article key={item.title} className="about-value-card">
                  <div className="about-value-icon">{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="about-section">
            <h2 className="about-section-title">Контактная информация</h2>
            <div className="about-contact-grid">
              {CONTACTS.map((contact) => {
                const content = (
                  <>
                    <div className="about-contact-icon">{contact.icon}</div>
                    <div className="about-contact-body">
                      <span className="about-contact-label">{contact.label}</span>
                      <span className="about-contact-value">{contact.value}</span>
                    </div>
                  </>
                );

                if (contact.href) {
                  return (
                    <a
                      key={contact.label}
                      href={contact.href}
                      className="about-contact-card about-contact-card-link"
                    >
                      {content}
                    </a>
                  );
                }

                return (
                  <div key={contact.label} className="about-contact-card">
                    {content}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="about-cta">
            <div className="about-cta-inner">
              <h2>Готовы начать покупки?</h2>
              <p>Загляните в каталог — там уже ждут лучшие предложения</p>
              <NavLink to="/main" className="about-cta-btn">
                Перейти в магазин
              </NavLink>
              <ShoppingBagIcon className="about-cta-right-icon" />
              <ShoppingBagIcon className="about-cta-left-icon" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default About;
