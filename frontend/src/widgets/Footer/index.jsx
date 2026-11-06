// Footer — ASTRA basement, "ash and signal" v3, compact.
// Три строки вместо четырёх высоких колонок:
//   1. бренд (маленький локап + одна строка о магазине) · соцсети;
//   2. «Каталог» и «Помощь» — ссылки ТЕКУТ в строку и переносятся,
//      а не стоят столбиком по 44px на каждую;
//   3. © и юридические ссылки одной волосяной полосой.
// Зоны нажатия по-прежнему ≥44px — компактность берётся из раскладки,
// не из урезанных хит-зон. Розовый — только ховер и фокус.
import React from 'react';
import { Link } from 'react-router-dom';
import './footer.css';
/* Фирменные SVG инлайном (CRA/svgr): чернила — currentColor, внутренние
   «бумажные» пятна — var(--astra-paper), фона нет (Authored-Colors-Only). */
import { ReactComponent as AstraTitle } from './icons/astra-title.svg';
import { ReactComponent as AstraIcon } from './icons/astra-icon.svg';
import { ReactComponent as TelegramIcon } from './icons/telegram.svg';
import { ReactComponent as DiscordIcon } from './icons/discord.svg';

/* Каталог: якоря главной (#sec-…) переключают вкладку «Категории».
   Все адреса существуют в frontend/src/app/index.jsx. */
const CATALOG_LINKS = [
    { to: '/main#sec-ai', label: 'Нейросети' },
    { to: '/main#sec-social', label: 'Подписки' },
    { to: '/main#sec-pc', label: 'Игры' },
    { to: '/main#sec-gift', label: 'Подарочные карты' },
    { to: '/main#sec-steam-gift', label: 'Подарок Steam' },
    { to: '/main#sec-steam', label: 'Пополнение Steam' },
    { to: '/main#sec-individual', label: 'Индивидуальный заказ' },
    { to: '/main#sec-recommended', label: 'Рекомендованные товары' },
];

/* «Отзывы» — не юридический документ: переехали сюда из нижней полосы. */
const HELP_LINKS = [
    { to: '/support', label: 'Поддержка' },
    { to: '/faq', label: 'FAQ' },
    { to: '/review', label: 'Отзывы' },
    { to: '/about', label: 'О нас' },
    { to: '/coop', label: 'Сотрудничество' },
];

const LEGAL_LINKS = [
    { to: '/user-agreement', label: 'Пользовательское соглашение' },
    { to: '/public-offer', label: 'Публичная оферта' },
];

/* Соцсети — монохром currentColor: ash в покое, ярче на ховере.
   Фирменный синий Discord не используем — цвет здесь только у действия. */
const SOCIAL_LINKS = [
    { href: 'https://t.me/astrashopshop', label: 'ASTRA в Telegram', Glyph: TelegramIcon, mod: 'telegram' },
    { href: 'https://discord.gg/astrashop2', label: 'ASTRA в Discord', Glyph: DiscordIcon, mod: 'discord' },
];

const LinkGroup = ({ id, title, links }) => (
    <nav className="astra-footer__group" aria-labelledby={id}>
        <h3 id={id} className="astra-footer__title">{title}</h3>
        <ul className="astra-footer__links">
            {links.map((item) => (
                <li key={item.to}>
                    <Link className="astra-footer__link" to={item.to}>
                        {item.label}
                    </Link>
                </li>
            ))}
        </ul>
    </nav>
);

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="astra-footer">
            {/* Mascot haunting the basement of the page */}
            <div className="astra-footer__watermark" aria-hidden="true">
                <AstraIcon className="astra-footer__watermark-mark" focusable="false" />
            </div>

            <div className="astra-footer__inner">
                <div className="astra-footer__top">
                    {/* Локап подвала ИНЕРТЕН (решение владельца, #6): не ссылка,
                        без ховера и фокуса. Имя бренда — в визуально скрытом span. */}
                    <div className="astra-footer__brand">
                        <span className="astra-footer__lockup">
                            <AstraTitle
                                className="astra-footer__title-mark"
                                aria-hidden="true"
                                focusable="false"
                            />
                            <span className="astra-footer__vh">ASTRA</span>
                        </span>
                        <p className="astra-footer__tagline text-none">
                            Ваш постоянный партнёр по покупкам подписок и игровой валюты.
                        </p>
                    </div>

                    <ul className="astra-footer__socials" aria-label="Мы в соцсетях">
                        {SOCIAL_LINKS.map(({ href, label, Glyph, mod }) => (
                            <li key={href}>
                                <a
                                    className={`astra-footer__social astra-footer__social--${mod}`}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={label}
                                    title={label}
                                >
                                    <Glyph className="astra-footer__glyph" aria-hidden="true" focusable="false" />
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="astra-footer__nav">
                    <LinkGroup id="astra-footer-catalog" title="Каталог" links={CATALOG_LINKS} />
                    <LinkGroup id="astra-footer-help" title="Помощь" links={HELP_LINKS} />
                </div>
            </div>

            <div className="astra-footer__bottom">
                <p className="astra-footer__copy text-none">© {currentYear} ASTRA Shop</p>
                <div className="astra-footer__cert">
                    <div className="astra-footer__cert-frame">
                        <iframe
                            src="https://smartretail.tech/api/v1/certificates/badge/SR-2026-5403638681-4A5C?theme=dark"
                            width="380"
                            height="140"
                            frameBorder="0"
                            scrolling="no"
                            allowtransparency="true"
                            title="Сертификат надежности Smart Retail"
                        />
                    </div>
                </div>
                <ul className="astra-footer__legal">
                    {LEGAL_LINKS.map((item) => (
                        <li key={item.to}>
                            <Link className="astra-footer__link astra-footer__link--quiet" to={item.to}>
                                {item.label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </footer>
    );
};

export default Footer;
