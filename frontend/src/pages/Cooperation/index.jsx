import React from "react";
import { NavLink } from "react-router-dom";
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import "./cooperation.css";

const COOP_EMAIL = "astraassistance@gmail.com";
const COOP_TELEGRAM_URL = "https://t.me/astrashopshop";

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("copy failed");
  }
}

const PARTNERS = [
  {
    title: "Продавцы цифровых товаров",
    text: "Подключайте свой ассортимент и управляйте продажами через единую витрину и удобные инструменты.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 7h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: "Партнёры по трафику",
    text: "Получайте вознаграждение за привлечение клиентов по прозрачной партнёрской модели.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 12c3-4 13-4 16 0M7 15c2-2 8-2 10 0"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="12" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: "B2B-компании",
    text: "Создаём индивидуальные условия, SLA и интеграции под задачи вашей команды.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="8" width="8" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="13" y="4" width="8" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 12h0M17 9h0M17 13h0M17 17h0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

const STEPS = [
  {
    number: "01",
    title: "Оставьте заявку",
    text: "Напишите нам в Telegram или на почту, кратко опишите ваш формат сотрудничества.",
  },
  {
    number: "02",
    title: "Согласуем условия",
    text: "Обсуждаем комиссию, сроки, объёмы и технические требования.",
  },
  {
    number: "03",
    title: "Запускаем продажи",
    text: "Настраиваем доступы, каталог и совместно запускаем первые сделки.",
  },
];

const CONTACTS = [
  {
    label: "Email",
    value: COOP_EMAIL,
    hint: "Нажмите, чтобы скопировать",
    copyValue: COOP_EMAIL,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Telegram",
    value: "@astrashopshop",
    href: COOP_TELEGRAM_URL,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M20 5L4 11l6 2 2 6 3-5 5-9z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Время ответа",
    value: "Обычно в течение 1 рабочего дня",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

const Cooperation = () => {
  const { pushToast } = useToast();

  const handleCopyEmail = async () => {
    try {
      await copyTextToClipboard(COOP_EMAIL);
      pushToast({ type: "success", message: "Email скопирован — вставьте его в почтовое приложение" });
    } catch {
      pushToast({ type: "error", message: "Не удалось скопировать email" });
    }
  };

  return (
    <div className="coop-page">
      <div className="coop-container">
        <header className="coop-hero">
          <p className="coop-eyebrow">Партнёрская программа</p>
          <h1 className="coop-title">Сотрудничество</h1>
          <div className="coop-title-divider" aria-hidden />
          <p className="coop-subtitle">
            Партнёрство с ASTRA Shop для специалистов, команд и компаний
          </p>
        </header>

        <div className="coop-highlights">
          <div className="coop-highlight-card">
            <span className="coop-highlight-value">3</span>
            <span className="coop-highlight-label">Формата партнёрства</span>
          </div>
          <div className="coop-highlight-card">
            <span className="coop-highlight-value">SLA</span>
            <span className="coop-highlight-label">Для B2B-клиентов</span>
          </div>
          <div className="coop-highlight-card">
            <span className="coop-highlight-value">1 день</span>
            <span className="coop-highlight-label">Средний ответ</span>
          </div>
        </div>

        <section className="coop-section">
          <h2 className="coop-section-title">Кого мы ищем</h2>
          <div className="coop-grid">
            {PARTNERS.map((item) => (
              <article key={item.title} className="coop-card">
                <div className="coop-card-icon">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="coop-section">
          <h2 className="coop-section-title">Как начать</h2>
          <div className="coop-steps">
            {STEPS.map((step, index) => (
              <article key={step.number} className="coop-step">
                <div className="coop-step-marker">
                  <span className="coop-step-number">{step.number}</span>
                  {index < STEPS.length - 1 && <span className="coop-step-line" aria-hidden />}
                </div>
                <div className="coop-step-body">
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="coop-section">
          <h2 className="coop-section-title">Контакты для сотрудничества</h2>
          <div className="coop-contact-grid">
            {CONTACTS.map((contact) => {
              const content = (
                <>
                  <div className="coop-contact-icon">{contact.icon}</div>
                  <div className="coop-contact-body">
                    <span className="coop-contact-label">{contact.label}</span>
                    <span className="coop-contact-value">{contact.value}</span>
                    {contact.hint && <span className="coop-contact-hint">{contact.hint}</span>}
                  </div>
                </>
              );

              if (contact.copyValue) {
                return (
                  <button
                    key={contact.label}
                    type="button"
                    className="coop-contact-card coop-contact-card-link coop-contact-card-button"
                    onClick={handleCopyEmail}
                  >
                    {content}
                  </button>
                );
              }

              if (contact.href) {
                return (
                  <a
                    key={contact.label}
                    href={contact.href}
                    className="coop-contact-card coop-contact-card-link"
                    target={contact.href.startsWith("http") ? "_blank" : undefined}
                    rel={contact.href.startsWith("http") ? "noreferrer" : undefined}
                  >
                    {content}
                  </a>
                );
              }

              return (
                <div key={contact.label} className="coop-contact-card">
                  {content}
                </div>
              );
            })}
          </div>
        </section>

        <section className="coop-cta">
          <div className="coop-cta-inner">
            <h2>Готовы обсудить партнёрство?</h2>
            <p>Напишите нам — подберём формат сотрудничества под ваши задачи</p>
            <div className="coop-cta-actions">
              <a
                href={COOP_TELEGRAM_URL}
                className="coop-cta-btn coop-cta-btn-primary"
                target="_blank"
                rel="noreferrer"
              >
                Написать в Telegram
              </a>
              <button type="button" className="coop-cta-btn coop-cta-btn-secondary" onClick={handleCopyEmail}>
                Скопировать email
              </button>
              <NavLink to="/support" className="coop-cta-btn coop-cta-btn-secondary">
                Открыть поддержку
              </NavLink>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Cooperation;
