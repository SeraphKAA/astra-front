import React from "react";
import { Link } from "react-router-dom";
import "./faq.css";
import { useRevealOnce } from "../../shared/fx/motionUtils";
import EdgeBlur from "../../shared/fx/EdgeBlur";

/* Контент FAQ, сгруппированный по тому, КОГДА у покупателя возникает
   вопрос: до/во время покупки → пока заказ в пути → если что-то пошло
   не так. Формулировки вопросов и ответов — дословно прежние.
   Каждый ответ — массив абзацев (без <br>). */
const FAQ_GROUPS = [
    {
        id: "faq-buy",
        title: "Покупка и выдача",
        items: [
            {
                q: "Что происходит после оформления заказа?",
                a: [
                    "После успешной оплаты заказ автоматически обрабатывается. В зависимости от товара вы получите код, данные для активации, пополнение на указанный аккаунт / выдачу товара с ручной выдачей.",
                ],
            },
            {
                q: "Нужно ли что-то делать после оплаты?",
                a: [
                    "Если товар выдается автоматически, дополнительных действий не требуется. Для некоторых товаров необходимо активировать полученный код или указать данные аккаунта, для ручной выдачи.",
                ],
            },
            {
                q: "Можно ли купить товар для другого аккаунта?",
                a: [
                    "Да, если выбранный товар поддерживает активацию на сторонний аккаунт. При оформлении заказа укажите необходимые данные получателя.",
                ],
            },
        ],
    },
    {
        id: "faq-status",
        title: "Статус заказа",
        items: [
            {
                q: "Где посмотреть информацию о своей покупке?",
                a: [
                    "Все оформленные заказы и результаты выдачи доступны в личном кабинете. Там же можно проверить статус заказа и получить выданный цифровой товар.",
                ],
            },
            {
                q: "Что делать, если заказ долго находится в обработке?",
                a: [
                    "Сначала проверьте статус оплаты и подождите несколько минут. Если заказ не изменился после успешной оплаты, обратитесь в поддержку и укажите его номер (пример: #C2R57067).",
                ],
            },
            {
                q: "Оплата списалась, но товар не появился. Что делать?",
                a: [
                    "Не оформляйте повторный заказ. Обратитесь в поддержку с номером заказа — мы проверим оплату и статус выдачи.",
                ],
            },
        ],
    },
    {
        id: "faq-problems",
        title: "Ошибки и возврат",
        items: [
            {
                q: "Что делать, если при активации возникла ошибка?",
                a: [
                    "Сохраните сообщение об ошибке и обратитесь в поддержку, указав номер заказа. Мы поможем разобраться с любой проблемой и выдадим нужные инструкции.",
                ],
            },
            {
                q: "В каких случаях возможен возврат?",
                a: [
                    "Условия возврата зависят от конкретного товара и стадии его выдачи или активации.",
                    "Возврат за успешно активированную подписку, выданный товар, полученную подарочную карту или что-либо ещё невозможен. Возврат также не производится, если внутренний аккаунт был заблокирован не по причинам, связанным с оплатой, а вашими действиями (пример: ChatGPT и блокировка за Cyber Abuse).",
                ],
            },
            {
                q: "Как быстро получить помощь по заказу?",
                a: [
                    "Создайте обращение через раздел поддержки в личном кабинете. Для ускорения проверки сразу укажите номер заказа и опишите проблему, выбрав тему тикета.",
                ],
            },
        ],
    },
];

/* Номер заказа из примера (#C2R57067) — моноширинно: это данные,
   которые человек будет сверять глазами символ за символом. */
const ORDER_ID_RE = /(#[A-Z0-9]{6,})/;
const renderAnswer = (text) =>
    text.split(ORDER_ID_RE).map((part, i) =>
        ORDER_ID_RE.test(part) ? (
            <code key={i} className="faq-code">{part}</code>
        ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
        )
    );

const pluralRu = (n, [one, few, many]) => {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
};

const Chevron = () => (
    <svg
        className="faq-chevron"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
    >
        <path d="M6 9l6 6 6-6" />
    </svg>
);

/**
 * «Частые вопросы».
 * Desktop: слева — липкая колонка (заголовок, оглавление групп, карточка
 * поддержки), справа — три группы вопросов. Телефон: всё в одну колонку,
 * карточка поддержки — в конце, после последнего вопроса.
 * Разворот — нативный <details>/<summary>: клавиатура, скринридер и
 * поиск по странице работают без JS; закрытое состояние — дефолт.
 * Розовый — ровно одна кнопка: «Написать в поддержку».
 */
const FAQ = () => {
    const headRef = useRevealOnce();
    const total = FAQ_GROUPS.reduce((n, g) => n + g.items.length, 0);

    const support = (
        <div className="faq-support">
            <h2 className="faq-support-title">Не нашли ответ?</h2>
            <p className="faq-support-text">
                Напишите в поддержку и сразу укажите номер заказа - так проверка пройдёт быстрее.
            </p>
            <span className="astra-ring faq-support-ring">
                <Link to="/support" className="astra-btn astra-press faq-support-btn">
                    Написать в поддержку
                </Link>
            </span>
        </div>
    );

    return (
        <div className="main-menu mm-root faq-root">
            <div className="mm-page">
                <div className="faq-layout">
                    <aside className="faq-rail">
                        <div className="faq-head astra-reveal" ref={headRef}>
                            <h1 id="faq-h" className="astra-h mm-h faq-title">
                                Частые вопросы
                            </h1>
                            <p className="faq-lead">
                                {total} {pluralRu(total, ["ответ", "ответа", "ответов"])} о покупке, выдаче и возврате.
                            </p>
                        </div>

                        <nav className="faq-toc" aria-label="Разделы FAQ">
                            <ul>
                                {FAQ_GROUPS.map((g) => (
                                    <li key={g.id}>
                                        <a className="faq-toc-link" href={`#${g.id}`}>
                                            <span>{g.title}</span>
                                            <span className="faq-toc-count">{g.items.length}</span>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </nav>

                        <div className="faq-support-slot faq-support-slot--rail">{support}</div>
                    </aside>

                    <div className="faq-groups" aria-labelledby="faq-h">
                        {FAQ_GROUPS.map((g) => (
                            <section key={g.id} id={g.id} className="faq-group" aria-labelledby={`${g.id}-h`}>
                                <h2 id={`${g.id}-h`} className="faq-group-title">
                                    {g.title}
                                </h2>
                                <div className="faq-list">
                                    {g.items.map((item) => (
                                        <details key={item.q} className="faq-item">
                                            <summary className="faq-q">
                                                <span className="faq-q-text">{item.q}</span>
                                                <span className="faq-q-icon" aria-hidden="true">
                                                    <Chevron />
                                                </span>
                                            </summary>
                                            <div className="faq-a">
                                                {item.a.map((p, j) => (
                                                    <p key={j} className="faq-a-p">
                                                        {renderAnswer(p)}
                                                    </p>
                                                ))}
                                            </div>
                                        </details>
                                    ))}
                                </div>
                            </section>
                        ))}

                        <div className="faq-support-slot faq-support-slot--end">{support}</div>
                    </div>
                </div>
            </div>

            <EdgeBlur />
        </div>
    );
};

export default FAQ;
