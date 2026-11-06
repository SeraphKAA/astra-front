import React from "react";
import { NavLink } from "react-router-dom";
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import { useRevealOnce, revealDelay } from "../../shared/fx/motionUtils";
import {
  ShoppingBagIcon,
  Share2Icon,
  Building2Icon,
  MailIcon,
  SendIcon,
  ClockIcon,
  CopyIcon,
  MessageCircleIcon,
  ChainIcon,
  BackpackIcon,
  BadgeCheckNotFillIcon,
} from "../../shared/icons/lucide";
import "./cooperation.css";

const COOP_EMAIL = "astraassistance@gmail.com";
const COOP_TELEGRAM_URL = "https://t.me/astrashopsupport";


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

/** Появление-однажды (.astra-reveal + useRevealOnce), стаггер 60мс. */
const Reveal = ({ as: Tag = "div", index = 0, className = "", children, ...rest }) => {
  const ref = useRevealOnce();
  return (
    <Tag ref={ref} className={`astra-reveal ${className}`.trim()} style={revealDelay(index)} {...rest}>
      {children}
    </Tag>
  );
};

const HIGHLIGHTS = [
  "3 формата партнёрства",
  "SLA для B2B-клиентов",
  "Ответ за 1 рабочий день",
];

const PARTNERS = [
  {
    title: "Продавцы цифровых товаров",
    text: "Поставляйте нам товары любого уровня, подходящего под концепцию магазина и получайте процент от продаж со своей наценкой.",
    icon: <ShoppingBagIcon />,
  },
  {
    title: "Партнёры по трафику",
    text: "Ищем YouTube-блогеров, авторов нарезок, владельцев Telegram-каналов и других партнёров. Размещайте наш контент на своих площадках и получайте оплату за привлечённые просмотры.",
    icon: <Share2Icon />,
  },
  {
    title: "B2B-компании",
    text: "Рассмотрим индивидуальные условия, оптовые цены, SLA и интеграции под наши процессы.",
    icon: <Building2Icon />,
  },
];

const STEPS = [
  {
    title: "Оставьте заявку",
    text: "Напишите в Telegram или на почту и кратко опишите, какой формат сотрудничества вам подходит.",
  },
  {
    title: "Согласуем условия",
    text: "Обсудим комиссию, сроки, объёмы и технические требования.",
  },
  {
    title: "Запустим продажи",
    text: "Настроим доступы и каталог, затем вместе запустим первые сделки.",
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
    <div className="coop-page text-none">
      <div className="coop-container">
        <Reveal as="header" className="coop-hero">
          <h1 className="coop-title">Сотрудничество</h1>
          <div className="coop-title-divider" aria-hidden />
          <p className="coop-subtitle">
            ASTRA работает с продавцами цифровых товаров, партнерами по рекламе и B2B-компаниями.
            Выберите свой формат, предоставьте ссылки на ресурс, условия и напишите нам.
          </p>
        </Reveal>

        <ul className="coop-highlights">
          {HIGHLIGHTS.map((text, index) => (
            <Reveal as="li" key={text} index={index + 1} className="coop-chip">
              {text}
            </Reveal>
          ))}
        </ul>

        <section className="coop-section">
          <Reveal as="div" className="coop-section-header">
            <BackpackIcon className="backpack-icon" />
            <h2 className="coop-section-title">С кем мы работаем</h2>
          </Reveal>
          <div className="coop-grid">
            {PARTNERS.map((item, index) => (
              <Reveal key={item.title} index={index + 1} className="coop-cell">
                <article className="coop-value-card">
                  <div className="coop-value-icon" aria-hidden>
                    {item.icon}
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="coop-section">
          <Reveal as="div" className="coop-section-header">
            <BadgeCheckNotFillIcon className="badge-check-icon" />
            <h2 className="coop-section-title">Как начать</h2>
          </Reveal>
          <ol className="coop-steps">
            {STEPS.map((step, index) => (
              <Reveal as="li" key={step.title} index={index + 1} className="coop-step">
                <div className="coop-step-marker" aria-hidden>
                  <span className="coop-step-number">{index + 1}</span>
                  {index < STEPS.length - 1 && <span className="coop-step-line" />}
                </div>
                <div className="coop-step-body">
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </section>

        <section className="coop-section">
          <br />
          <Reveal as="div" className="coop-section-header">
            <ChainIcon className="chain-icon" />
            <h2 className="coop-section-title">Как с нами связаться</h2>
          </Reveal>
          <div className="coop-contact-grid">
            <Reveal index={1} className="coop-cell">
              <button
                type="button"
                className="coop-contact-card coop-contact-action"
                onClick={handleCopyEmail}
              >
                <span className="coop-contact-icon" aria-hidden>
                  <MailIcon />
                </span>
                <span className="coop-contact-body">
                  <span className="coop-contact-label">Email</span>
                  <span className="coop-contact-value">{COOP_EMAIL}</span>
                  <span className="coop-contact-hint text-none">
                    <CopyIcon aria-hidden />
                    Нажмите — email скопируется
                  </span>
                </span>
              </button>
            </Reveal>

            <Reveal index={2} className="coop-cell">
              <a
                href={COOP_TELEGRAM_URL}
                className="coop-contact-card coop-contact-action"
                target="_blank"
                rel="noreferrer"
              >
                <span className="coop-contact-icon" aria-hidden>
                  <SendIcon />
                </span>
                <span className="coop-contact-body">
                  <span className="coop-contact-label">Telegram</span>
                  <span className="coop-contact-value">@astrashopsupport</span>
                  <span className="coop-contact-hint">Откроется чат в Telegram</span>
                </span>
              </a>
            </Reveal>

            <Reveal index={3} className="coop-cell">
              <div className="coop-contact-card">
                <span className="coop-contact-icon" aria-hidden>
                  <ClockIcon />
                </span>
                <span className="coop-contact-body">
                  <span className="coop-contact-label">Время ответа</span>
                  <span className="coop-contact-value">Работаем с 10:00 до 22:00</span>
                  <span className="coop-contact-hint">Ответ в течение суток</span>
                </span>
              </div>
            </Reveal>
          </div>
        </section>

        <Reveal as="section" className="coop-cta">
          <div className="coop-cta-inner">
            <h2>Готовы обсудить партнёрство?</h2>
            <p>Напишите нам — подберём формат сотрудничества под ваши задачи</p>
            <div className="coop-cta-actions">
              <a
                href={COOP_TELEGRAM_URL}
                className="astra-btn coop-cta-btn"
                target="_blank"
                rel="noreferrer"
              >
                <SendIcon className="coop-btn-icon" />
                Написать в Telegram
              </a>
              <button type="button" className="astra-btn-ghost coop-cta-btn text-none" onClick={handleCopyEmail}>
                <CopyIcon className="coop-btn-icon" />
                Скопировать email
              </button>
              <NavLink to="/support" className="astra-btn-ghost coop-cta-btn">
                <MessageCircleIcon className="coop-btn-icon" />
                Открыть поддержку
              </NavLink>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
};

export default Cooperation;
