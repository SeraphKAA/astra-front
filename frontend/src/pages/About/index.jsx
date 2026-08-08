import React from "react";
import { NavLink } from "react-router-dom";
import "./about.css";

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
    text: "Ценим каждого участника и создаём комфортную атмосферу",
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

const TEAM = [
  {
    name: "Алексей Иванов",
    role: "Основатель & CEO",
    bio: "10+ лет опыта в IT-индустрии",
    initials: "АИ",
  },
  {
    name: "Мария Петрова",
    role: "Технический директор",
    bio: "Эксперт в области веб-технологий",
    initials: "МП",
  },
  {
    name: "Дмитрий Сидоров",
    role: "Дизайнер",
    bio: "Создаёт красивый и удобный интерфейс",
    initials: "ДС",
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
  // {
  //   label: "Телефон",
  //   value: "+7 (123) 456-78-90",
  //   href: "tel:+71234567890",
  //   icon: (
  //     <svg viewBox="0 0 24 24" fill="none" aria-hidden>
  //       <path
  //         d="M6.5 4h3l1.5 5-2 1.2a11 11 0 005.8 5.8L16 14l5 1.5v3A2.5 2.5 0 0118.6 21 15.5 15.5 0 016 7.4 2.5 2.5 0 016.5 4z"
  //         stroke="currentColor"
  //         strokeWidth="1.5"
  //         strokeLinejoin="round"
  //       />
  //     </svg>
  //   ),
  // },
  // {
  //   label: "Адрес",
  //   value: "Улица Пушкина, дом Колотушкина",
  //   icon: (
  //     <svg viewBox="0 0 24 24" fill="none" aria-hidden>
  //       <path
  //         d="M12 21s6-5.2 6-10a6 6 0 10-12 0c0 4.8 6 10 6 10z"
  //         stroke="currentColor"
  //         strokeWidth="1.5"
  //         strokeLinejoin="round"
  //       />
  //       <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="1.5" />
  //     </svg>
  //   ),
  // },
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
            <span className="about-stat-value">2024</span>
            <span className="about-stat-label">Год основания</span>
          </div>
          <div className="about-stat-card">
            <span className="about-stat-value">24/7</span>
            <span className="about-stat-label">Поддержка</span>
          </div>
          <div className="about-stat-card">
            <span className="about-stat-value">100%</span>
            <span className="about-stat-label">Фокус на клиенте</span>
          </div>
        </div>

        <div className="about-content">
          <section className="about-section about-section-card">
            <h2 className="about-section-title">Наша миссия</h2>
            <p className="about-section-text">
              Мы стремимся создавать инновационные решения, которые делают жизнь
              проще и интереснее. Наша команда объединяет талантливых специалистов,
              увлечённых своей работой и развитием цифровых продуктов.
            </p>
          </section>

          <section className="about-section about-section-card">
            <h2 className="about-section-title">Наша история</h2>
            <p className="about-section-text">
              Проект был основан в 2024 году группой энтузиастов, которые хотели
              создать удобный и надёжный магазин. За это время мы прошли путь от
              небольшой команды до современной платформы, сохранив дух инноваций
              и стремление к совершенству.
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
            <h2 className="about-section-title">Наша команда</h2>
            <div className="about-team-grid">
              {TEAM.map((member) => (
                <article key={member.name} className="about-team-card">
                  <div className="about-member-avatar" aria-hidden>
                    {member.initials}
                  </div>
                  <h3>{member.name}</h3>
                  <p className="about-member-role">{member.role}</p>
                  <p className="about-member-bio">{member.bio}</p>
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
              <NavLink to="/menu" className="about-cta-btn">
                Перейти в магазин
              </NavLink>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default About;
