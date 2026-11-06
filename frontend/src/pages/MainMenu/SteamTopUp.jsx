import React, { useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/auth/AuthContext";
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import { useRevealOnce } from "../../shared/fx/motionUtils";

import {
  SteamLoginHelpModal,
  SteamCurrencyHelpModal,
  useSteamRefillInfoModals,
} from "../SteamRefill/SteamRefillInfo";


/** Сумма переживает редирект гостя через вход (см. SteamRefill). */
export const STEAM_AMOUNT_KEY = "astra:steam-amount";

const STEAM_ACCOUNT_URL = "https://store.steampowered.com/account/";

/* Ровно тот набор валют, который поддерживает страница /steam-refill
   (CURRENCIES в pages/SteamRefill/index.jsx) — ни одной лишней.
   Курс и комиссию здесь НЕ считаем: расчёт живёт на странице оплаты. */
const CURRENCIES = [
    { code: "RUB", symbol: "₽", label: "Рубли", inCase: "рублях", placeholder: "1000" },
    { code: "USD", symbol: "$", label: "Доллары", inCase: "долларах", placeholder: "10" },
    { code: "KZT", symbol: "₸", label: "Тенге", inCase: "тенге", placeholder: "5000" },
    { code: "UAH", symbol: "₴", label: "Гривны", inCase: "гривнах", placeholder: "1000" },
];

const currencyOf = (code) => CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];

/* Тот же разбор денежного ввода, что и на странице пополнения:
   запятая → точка, максимум два знака после точки. */
const normalizeMoneyInput = (v) => {
    const s = String(v ?? "");
    const cleaned = s.replace(",", ".").replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length <= 1) return cleaned;
    return `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;
};

/* Authored Steam glyph — simplified valve/piston mark, stroke ink. */
export const SteamGlyph = () => (
    <svg
        viewBox="0 0 24 24"
        width="40"
        height="40"
        aria-hidden="true"
        focusable="false"
    >
        <path 
            d="M8.21 17.32L7 16.8a2.13 2.13 0 1 0 1.17-2.93l1.28.53a1.58 1.58 0 0 1-1.22 2.92z" 
            fill="currentColor" 
        />
        <path 
            d="M12 2a10 10 0 0 0-10 9.34l5.38 2.21a2.31 2.31 0 0 1 .47-.24A2.62 2.62 0 0 1 9 13.1l2.44-3.56a3.8 3.8 0 1 1 3.8 3.8h-.08l-3.51 2.5a2.77 2.77 0 0 1-5.47.68l-3.77-1.6A10 10 0 1 0 12 2z" 
            fill="currentColor" 
        />
        <path 
            d="M17.79 9.5a2.53 2.53 0 1 0-2.53 2.5a2.54 2.54 0 0 0 2.53-2.5zm-4.42 0a1.9 1.9 0 1 1 1.9 1.91a1.9 1.9 0 0 1-1.9-1.92z" 
            fill="currentColor" 
        />
    </svg>
);

const HelpIcon = () => (
    <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
    >
        <circle cx="12" cy="12" r="9" />
        <path d="M9.6 9.2a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.7-.9 1.3v.5" />
        <path d="M12 16.8h.01" />
    </svg>
);

/**
 * Панель прямого пополнения баланса Steam — живёт во вкладке
 * «Пополнение Steam» и повторяет поля страницы /steam-refill: логин,
 * сумма + валюта, промокод. Расчёт, проверка логина и оплата остаются
 * на странице пополнения — здесь мы ничего не обещаем и не считаем.
 * Ясень + liquid-glass (без transform-анимаций на стекле), единственный
 * цвет — плоская розовая CTA --astra-pink-fill с БЕЛЫМИ чернилами:
 * тёмных чернил на розовом в системе нет ни одних (раунд 5).
 */
const SteamTopUp = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { pushToast } = useToast();

    const loginId = useId();
    const loginErrId = useId();
    const amountId = useId();
    const amountErrId = useId();
    const promoId = useId();

    const loginRef = useRef(null);
    const amountRef = useRef(null);
    const rulesRef = useRevealOnce();

    const [login, setLogin] = useState("");
    /* Обещание «сумма сохранится» держим здесь же: гость вернётся после
       входа на эту вкладку — сумма уже в поле (SteamRefill читает и чистит
       ключ сам, если пользователь дошёл до него напрямую). */
    const [amount, setAmount] = useState(() => {
        try {
            const saved = Number(sessionStorage.getItem(STEAM_AMOUNT_KEY));
            return Number.isFinite(saved) && saved > 0 ? normalizeMoneyInput(String(saved)) : "";
        } catch {
            return "";
        }
    });
    const [currency, setCurrency] = useState("RUB");
    const [promo, setPromo] = useState("");
    const [carriedPromo, setCarriedPromo] = useState("");
    const [promoNote, setPromoNote] = useState("");
    const [loginError, setLoginError] = useState("");
    const [amountError, setAmountError] = useState("");

    const {
        loginHelpOpen,
        currencyHelpOpen,
        openLoginHelp,
        closeLoginHelp,
        closeCurrencyHelp,
        toggleCurrencyHelp,
    } = useSteamRefillInfoModals();

    const active = currencyOf(currency);
    const trimmedLogin = login.trim();
    const numericAmount = amount === "" ? NaN : Number(amount);


    const handleLogin = (e) => {
        setLogin(e.target.value);
        if (loginError) setLoginError("");
    };

    const handleAmount = (e) => {
        setAmount(normalizeMoneyInput(e.target.value).slice(0, 12));
        if (amountError) setAmountError("");
    };

    const handleCurrency = (code) => {
        /* Сумму не пересчитываем: курс живёт на странице пополнения,
           выдумывать его здесь нечестно. */
        setCurrency(code);
        if (amountError) setAmountError("");
    };

    const handleApplyPromo = () => {
        const code = promo.trim();
        if (!code) {
            setPromoNote("Введите промокод — поле пустое");
            return;
        }
        setCarriedPromo(code);
        setPromoNote(`Промокод «${code}» подставим на странице пополнения`);
    };

    const handleClearPromo = () => {
        setPromo("");
        setCarriedPromo("");
        setPromoNote("");
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!trimmedLogin) {
            setLoginError("Укажите Steam login — без него непонятно, какой аккаунт пополнять");
            loginRef.current?.focus();
            return;
        }
        if (amount === "") {
            setAmountError(
                `Введите сумму пополнения — например, ${active.placeholder} ${active.symbol}`
            );
            amountRef.current?.focus();
            return;
        }
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            setAmountError("Сумма должна быть больше нуля — укажите, сколько зачислить");
            amountRef.current?.focus();
            return;
        }
        /* Гостя маршрут /steam-refill перебросит на вход — сумму сохраняем
           и честно предупреждаем, а не роняем её молча. */
        try {
            sessionStorage.setItem(STEAM_AMOUNT_KEY, String(numericAmount));
        } catch {
            /* приватный режим — просто едем дальше со state */
        }
        if (!isAuthenticated) {
            pushToast({
                type: "info",
                message: "Войдите, чтобы пополнить Steam — сумма сохранится",
            });
        }
        navigate("/steam-refill", {
            state: {
                amount: numericAmount,
                currency,
                login: trimmedLogin,
                promo: (carriedPromo || promo.trim()) || undefined,
            },
        });
    };

    return (
        <>
            {/* без .astra-grain: у него и у .astra-liquid общий ::after —
               зерно задушило бы линзу opacity-ю и маской */}
            <section className="mm-steam astra-liquid" aria-labelledby="mm-steam-h">
                <div className="mm-steam-info">
                    <span className="mm-steam-glyphwrap" aria-hidden="true">
                        <span className="mm-steam-plate" />
                        <span className="mm-steam-glyph">
                            <SteamGlyph />
                        </span>
                    </span>
                    <div className="mm-steam-copy">
                        <h3 id="mm-steam-h" className="astra-h mm-steam-title">
                            Пополнение Steam
                        </h3>
                        <p className="mm-steam-sub">
                            Укажите Steam login и сумму зачисления. Курс конвертации актуален на
                            момент расчёта.
                        </p>
                    </div>
                </div>

                <form className="mm-steam-form" onSubmit={handleSubmit} noValidate>
                    <div className="mm-steam-fields">
                        {/* -------- Steam login -------- */}
                        <div className="mm-field">
                            <div className="mm-field-head">
                                <label className="mm-field-label" htmlFor={loginId}>
                                    Steam login
                                </label>
                                {/* Справка открывается общей модалкой, а не
                                    соседним узлом: aria-controls указывать не
                                    на что — фокус и ярлык держит сам диалог. */}
                                <button
                                    type="button"
                                    className="mm-microlink"
                                    aria-haspopup="dialog"
                                    aria-expanded={loginHelpOpen}
                                    onClick={openLoginHelp}
                                >
                                    <HelpIcon />
                                    Как узнать?
                                </button>
                            </div>
                            <div className={`mm-input${loginError ? " has-error" : ""}`}>
                                <input
                                    id={loginId}
                                    ref={loginRef}
                                    className="mm-input-el"
                                    type="text"
                                    autoComplete="username"
                                    placeholder="Логин Steam"
                                    value={login}
                                    onChange={handleLogin}
                                    aria-invalid={loginError ? true : undefined}
                                    aria-describedby={loginError ? loginErrId : undefined}
                                />
                            </div>
                            {loginError && (
                                <p className="mm-field-error" id={loginErrId} role="alert">
                                    {loginError}
                                </p>
                            )}
                        </div>

                        {/* -------- сумма + валюта -------- */}
                        <div className="mm-field">
                            <div className="mm-field-head">
                                <label className="mm-field-label" htmlFor={amountId}>
                                    Сумма зачисления
                                </label>
                                <button
                                    type="button"
                                    className="mm-microlink"
                                    aria-haspopup="dialog"
                                    aria-expanded={currencyHelpOpen}
                                    onClick={toggleCurrencyHelp}
                                >
                                    <HelpIcon />
                                    О валюте
                                </button>
                            </div>
                            <div className={`mm-amount${amountError ? " has-error" : ""}`}>
                                <input
                                    id={amountId}
                                    ref={amountRef}
                                    className="mm-amount-input"
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    placeholder={active.placeholder}
                                    value={amount}
                                    onChange={handleAmount}
                                    aria-label={`Сумма пополнения в ${active.inCase}`}
                                    aria-invalid={amountError ? true : undefined}
                                    aria-describedby={amountError ? amountErrId : undefined}
                                />
                                <span className="mm-amount-suffix" aria-hidden="true">
                                    {active.symbol}
                                </span>
                            </div>
                            {amountError && (
                                <p className="mm-field-error" id={amountErrId} role="alert">
                                    {amountError}
                                </p>
                            )}
                            <div
                                className="mm-steam-currencies"
                                role="group"
                                aria-label="Валюта суммы"
                            >
                                {CURRENCIES.map((item) => {
                                    const isActive = item.code === currency;
                                    return (
                                        <button
                                            key={item.code}
                                            type="button"
                                            className={`astra-chip${isActive ? " is-active" : ""}`}
                                            aria-pressed={isActive}
                                            onClick={() => handleCurrency(item.code)}
                                        >
                                            <span aria-hidden="true">{item.symbol}</span>
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="mm-field-hint">
                                Зачисление на кошелёк Steam в {active.inCase}
                            </p>
                        </div>
                    </div>

                    {/* -------- промокод: переносим дальше, не проверяем дважды -------- */}
                    <div className="mm-field mm-field--promo">
                        <label className="mm-field-label" htmlFor={promoId}>
                            Промокод
                        </label>
                        <div className="mm-promo">
                            <div className="mm-input">
                                <input
                                    id={promoId}
                                    className="mm-input-el"
                                    type="text"
                                    autoComplete="off"
                                    placeholder="Промокод"
                                    value={promo}
                                    onChange={(e) => {
                                        setPromo(e.target.value);
                                        if (promoNote) setPromoNote("");
                                        if (carriedPromo) setCarriedPromo("");
                                    }}
                                />
                            </div>
                            <button
                                type="button"
                                className="astra-btn-ghost astra-press mm-promo-btn"
                                onClick={handleApplyPromo}
                            >
                                Применить
                            </button>
                        </div>
                        {promoNote && (
                            <div className="mm-promo-note" role="status">
                                <span className="mm-field-hint">{promoNote}</span>
                                {carriedPromo && (
                                    <button
                                        type="button"
                                        className="mm-microlink"
                                        onClick={handleClearPromo}
                                    >
                                        убрать
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mm-steam-foot">
                        <p className="mm-steam-note">
                            Комиссия сервиса 11% добавляется к оплате в ₽.
                        </p>
                        <span className="astra-ring mm-steam-cta">
                            <button type="submit" className="astra-btn">
                                Продолжить пополнение
                            </button>
                        </span>
                    </div>
                </form>
            </section>

            {/* -------- «Важная информация»: копия правил владельца -------- */}
            <section
                className="mm-rules astra-reveal"
                ref={rulesRef}
                aria-labelledby="mm-rules-h"
            >
                <h3 id="mm-rules-h" className="astra-h mm-rules-title">
                    Важная информация
                </h3>
                <ol className="mm-rules-list">
                    <li>
                        <strong>Первое пополнение:</strong> если аккаунт ранее не пополнялся, валюта
                        может автоматически измениться на иностранную (€, ₸, $). Рекомендуется
                        первое пополнение делать на небольшую сумму.
                    </li>
                    <li>
                        <strong>ДНР, ЛНР, Крым:</strong> перед пополнением закройте все сессии в
                        Steam и переведите телефон в авиарежим на 30 минут.
                    </li>
                    <li>
                        <strong>Регион и валюта:</strong> если регион и валюта вашего аккаунта
                        отличаются от определённых при проверке логина, пополнение может не пройти.
                    </li>
                </ol>
                <p className="mm-rules-foot">
                    При возникновении проблем — свяжитесь с поддержкой на{" "}
                    <Link to="/support" className="mm-rules-link">
                        странице поддержки
                    </Link>
                    .
                </p>
            </section>

            <SteamLoginHelpModal isOpen={loginHelpOpen} onClose={closeLoginHelp} />
            <SteamCurrencyHelpModal isOpen={currencyHelpOpen} onClose={closeCurrencyHelp} />
        </>
    );
};

export default SteamTopUp;
