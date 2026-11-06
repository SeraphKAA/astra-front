import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import "./navbar.css";
import AstraMark from "../../shared/brand/AstraMark";
import AstraWordmark from "../../shared/brand/AstraWordmark";
import AstraAvatar from "../../shared/brand/AstraAvatar";
import { GlassLensDefs } from "../../shared/fx/LiquidGlass";
import {
    OrderIcon,
    TechSuppIcon,
    CooperationIcon,
    BasketIcon,
    AdminPanelSvg,
    SearchIcon,
    InboxIcon,
    LogoutIcon,
} from "../../shared/svgIcons";
import { searchProducts } from "../../entities/product/api/productApi";
import { useQuickBuy } from "../CategoryQuickBuy";
import { useAuth } from "../../app/auth/AuthContext";
import { normalizeMediaUrl } from "../../shared/commonApi";
import { normalizeSearchQuery, normalizeSearchTyping } from "../../shared/validation";
import { lockScroll, unlockScroll } from "../../shared/fx/scrollLock";
import { useDelayedPending } from "../../shared/fx/motionUtils";
import photo from "../../shared/navbar_logo.png";
import { useUnreadCounts } from "../../app/unread/UnreadContext";
import { getCart } from "../../entities/cart/api/cartApi";
import { readGuestCart } from "../../entities/cart/model/guestCart";

const DROPDOWN_CLOSE_MS = 150;

const useCartCount = (isAuthenticated) => {
    const [count, setCount] = useState(0);

    const fetchCount = useCallback(async () => {
        try {
            if (isAuthenticated) {
                const data = await getCart();
                const total = (data?.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
                setCount(total);
            } else {
                const rows = readGuestCart();
                const total = rows.reduce((sum, row) => sum + (row.quantity || 0), 0);
                setCount(total);
            }
        } catch {
            // Игнорируем ошибки, чтобы не ломать навбар
        }
    }, [isAuthenticated]);

    useEffect(() => {
        fetchCount();

        // Слушаем кастомное событие обновления корзины
        const handleUpdate = () => fetchCount();
        window.addEventListener("astra:cart-updated", handleUpdate);
        
        // Слушаем storage для гостевой корзины (синхронизация между вкладками)
        window.addEventListener("storage", handleUpdate);

        return () => {
            window.removeEventListener("astra:cart-updated", handleUpdate);
            window.removeEventListener("storage", handleUpdate);
        };
    }, [fetchCount]);

    return count;
};

const readSearchItems = (data) => {
    const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.products)
            ? data.products
            : [];
    return list.filter((p) => p && p.id != null);
};
/* ------------------------------------------------------------------
   Скрытый SVG-фильтр «goo» для поисковой пилюли.
   Порт GooeyFilter из D:/Block Market/src/components/ui/GooeySearch.tsx
   (там motion/react + lucide — здесь их нет, механика воспроизведена
   на чистом CSS/JSX). Регион фильтра расширен, иначе размытие срезается
   по краям и «шейка» между пилюлей и пузырём рвётся.
   ------------------------------------------------------------------ */
const GooFilterDefs = () => (
    <svg className="nav-goo-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
            <filter id="astra-goo" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                <feColorMatrix
                    in="blur"
                    type="matrix"
                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
                    result="goo"
                />
                <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
        </defs>
    </svg>
);

const AVATAR_VARIANTS = ["pink", "red", "violet"];

/* Один потолок с /search (MAX_QUERY = 60): иначе набранный на странице
   запрос молча обрезался при возврате через строку в шапке. */
const SEARCH_MAX = 60;

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* При наборе — только белый список и длина (normalizeSearchTyping):
   защита от инъекций возвращает пустую строку и стирала бы поле прямо
   под курсором на «--». Проверка отрабатывает при отправке — там, где
   строка уходит в API и в /search. */
const sanitizeTyping = (value) => normalizeSearchTyping(value, SEARCH_MAX);

const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isAuthenticated, activeAvatar, logout } = useAuth();
    /* Карточка результата открывает попап быстрой покупки: маршрут
       /product/:id удалён, ссылок на него в шапке больше нет. */
    const { openProduct, modal: quickBuyModal, pendingProductId } = useQuickBuy();
    const isAvatar = Boolean(activeAvatar?.url);
    const [isDropdownMounted, setIsDropdownMounted] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isDropdownClosing, setIsDropdownClosing] = useState(false);
    const menuRef = useRef();
    const overlayRef = useRef();
    const gooRef = useRef();
    const inputRef = useRef();
    const triggerRef = useRef();
    const restoreFocusRef = useRef(false);
    const dropdownCloseTimerRef = useRef(null);
    const dropdownOpenRafRef = useRef(null);
    const [query, setQuery] = useState("");
    const [resultsSearch, setResultsSearch] = useState([]);
    const [openSearch, setOpenSearch] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const [isSearchModalMounted, setIsSearchModalMounted] = useState(false);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [isSearchClosing, setIsSearchClosing] = useState(false);
    const debounceTimeoutRef = useRef(null);
    const closeTimerRef = useRef(null);
    const openRafRef = useRef(null);

    const isAdmin = user?.role === "admin";
    const isStaff = user?.role === "admin" || user?.role === "seller" || user?.role === "moderator";

    const { counts } = useUnreadCounts();
    const supportBadge = isStaff ? counts.support_chats_total : counts.support;
    const ordersBadge = counts.orders_total;
    const sellerOrdersBadge = counts.seller_orders_total;

    const cartBadge = useCartCount(isAuthenticated);

    const Badge = ({ value }) => {
        if (!value) return null;
        const text = value > 99 ? "99+" : String(value);
        const len = text.length;                       // 1, 2 или 3
        return (
            <span
                className={`nav-badge nav-badge--${len}`}
                aria-label={`Непрочитанных: ${value}`}
            >
                {text}
            </span>
        );
    };

    /* Серые полосы в выпадашке — сигнал «ответ задерживается», а не
       обязательный этап: строка «Ищем…» появляется сразу, плитки — только
       если ожидание перевалило за дебаунс (400мс) плюс запас. */
    const showSearchSkeletons = useDelayedPending(isLoading, 700);

    /* мазкот-заглушка вместо инициалов: вариант вращается по нику */
    const fallbackVariant =
        AVATAR_VARIANTS[(user?.nickname ? user.nickname.length : 0) % AVATAR_VARIANTS.length];

    const closeSearch = useCallback(
        (options) => {
            if (!isSearchModalMounted || isSearchClosing) return;
            const restoreFocus = !(options && options.restoreFocus === false);
            restoreFocusRef.current = restoreFocus;
            setIsSearchClosing(true);

            closeTimerRef.current = setTimeout(() => {
                setIsSearchModalMounted(false);
                setIsSearchClosing(false);
                setIsSearchModalOpen(false); // снимаем is-open после анимации
            }, 10);
        },
        [isSearchModalMounted, isSearchClosing]
    );

    const openDropdown = useCallback(() => {
        if (dropdownCloseTimerRef.current) {
            clearTimeout(dropdownCloseTimerRef.current);
            dropdownCloseTimerRef.current = null;
        }
        if (dropdownOpenRafRef.current) {
            cancelAnimationFrame(dropdownOpenRafRef.current);
        }
        setIsDropdownClosing(false);
        setIsDropdownMounted(true);
        setIsDropdownOpen(false);
        dropdownOpenRafRef.current = requestAnimationFrame(() => {
            setIsDropdownOpen(true);
        });
    }, []);

    const closeDropdown = useCallback(() => {
        if (!isDropdownMounted || isDropdownClosing) return;
        setIsDropdownClosing(true);
        setIsDropdownOpen(false);
        dropdownCloseTimerRef.current = setTimeout(() => {
            setIsDropdownMounted(false);
            setIsDropdownClosing(false);
        }, DROPDOWN_CLOSE_MS);
    }, [isDropdownMounted, isDropdownClosing]);

    const toggleDropdown = useCallback(() => {
        if (isDropdownMounted && !isDropdownClosing && isDropdownOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
    }, [isDropdownMounted, isDropdownClosing, isDropdownOpen, closeDropdown, openDropdown]);

    const clearSearch = useCallback(() => {
        setQuery("");
        setResultsSearch([]);
        setNotFound(false);
        setOpenSearch(false);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        const qSanitized = normalizeSearchQuery(query, SEARCH_MAX);
        if (!qSanitized.trim()) {
            setResultsSearch([]);
            setOpenSearch(false);
            setNotFound(false);
            setIsLoading(false);
            return;
        }

        // Устанавливаем индикатор загрузки
        setIsLoading(true);
        setNotFound(false);

        // Задержка перед отправкой запроса (400мс)
        debounceTimeoutRef.current = setTimeout(async () => {
            try {
                const data = await searchProducts(qSanitized, { page: 1, size: 5 });
                const items = readSearchItems(data);

                if (items.length > 0) {
                    setResultsSearch(items);
                    setOpenSearch(true);
                    setNotFound(false);
                } else {
                    setResultsSearch([]);
                    setOpenSearch(true);
                    setNotFound(true);
                }
            } catch (e) {
                setResultsSearch([]);
                setNotFound(true);
                setOpenSearch(true);
            } finally {
                setIsLoading(false);
            }
        }, 400); // 400 миллисекунд задержки

        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [query]);

    useEffect(() => {
        const handleTouchMove = () => {
            closeDropdown();
        };

        document.addEventListener("touchmove", handleTouchMove, {
            passive: true,
        });

        return () => {
            document.removeEventListener("touchmove", handleTouchMove);
        };
    }, [closeDropdown]);

    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                closeDropdown();
            }
            /* «Снаружи» теперь = вне пилюли И вне оверлея: поле ввода
               переехало из модалки в саму пилюлю. */
            const inGoo = gooRef.current && gooRef.current.contains(e.target);
            const inOverlay = overlayRef.current && overlayRef.current.contains(e.target);
            if (!inGoo && !inOverlay) {
                closeSearch();
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [closeSearch, closeDropdown]);

    useEffect(() => {
        if (!isSearchModalOpen) return;
        if (query.trim() && (resultsSearch.length > 0 || notFound)) {
            setOpenSearch(true);
        }
    }, [isSearchModalOpen, query, resultsSearch, notFound]);

    const openSearchPanel = useCallback(() => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
        }
        if (openRafRef.current) {
            cancelAnimationFrame(openRafRef.current);
        }
        setIsSearchClosing(false);
        setIsSearchModalMounted(true);
        setIsSearchModalOpen(false);
        openRafRef.current = requestAnimationFrame(() => {
            setIsSearchModalOpen(true);
        });
    }, []);

    /* Поле живёт в пилюле. Монтируем его сразу по «смонтирован и не
       закрывается», не дожидаясь кадра анимации: класс .is-open приходит
       через requestAnimationFrame (он нужен, чтобы ширина анимировалась),
       а вводить пользователь должен с первого клика. */
    const isSearchActive = isSearchModalMounted && !isSearchClosing;

    useEffect(() => {
        if (!isSearchActive) return;
        const el = inputRef.current;
        if (el && typeof el.focus === "function") el.focus();
    }, [isSearchActive]);

    /* Пока поиск открыт, страница под затемнением не должна ехать: на
       мобиле панель занимает экран, а лента продолжала прокручиваться.
       Замок общий на приложение — порядок снятия с диалогами не важен. */
    useEffect(() => {
        if (!isSearchActive) return undefined;
        lockScroll();
        return unlockScroll;
    }, [isSearchActive]);

    /* возврат фокуса на свёрнутую пилюлю (кроме ухода по ссылке результата) */
    useEffect(() => {
        if (isSearchModalMounted) return;
        if (!restoreFocusRef.current) return;
        restoreFocusRef.current = false;
        const el = triggerRef.current;
        if (el && typeof el.focus === "function") el.focus();
    }, [isSearchModalMounted]);

    /* Enter — уход на страницу результатов /search?q= */
    const submitSearch = useCallback(
        (e) => {
            if (e) e.preventDefault();
            const q = normalizeSearchQuery(query, SEARCH_MAX);
            if (!q) {
                const el = inputRef.current;
                if (el && typeof el.focus === "function") el.focus();
                return;
            }
            closeSearch({ restoreFocus: false });
            navigate(`/search?q=${encodeURIComponent(q)}`);
        },
        [query, closeSearch, navigate]
    );

    useEffect(() => {
        if (!isSearchModalMounted) return undefined;
        const onKey = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                clearSearch();
                closeSearch();
                return;
            }
            /* Ловушка фокуса охватывает ДВА корня: пилюлю в шапке (там поле
               ввода) и панель результатов. Порядок = порядок в массиве. */
            if (e.key !== "Tab") return;
            const focusables = [];
            [gooRef.current, overlayRef.current].forEach((root) => {
                if (!root) return;
                root.querySelectorAll(FOCUSABLE_SELECTOR).forEach((el) => {
                    if (el.getAttribute("aria-hidden") === "true") return;
                    focusables.push(el);
                });
            });
            if (!focusables.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const inScope = focusables.indexOf(document.activeElement) !== -1;
            if (!inScope) {
                e.preventDefault();
                first.focus();
            } else if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [isSearchModalMounted, closeSearch, clearSearch]);

    useEffect(() => {
        return () => {
            if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current);
            }
            if (openRafRef.current) {
                cancelAnimationFrame(openRafRef.current);
            }
            if (dropdownOpenRafRef.current) {
                cancelAnimationFrame(dropdownOpenRafRef.current);
            }
            if (dropdownCloseTimerRef.current) {
                clearTimeout(dropdownCloseTimerRef.current);
            }
        };
    }, []);

    const handleLogout = async () => {
        closeDropdown();
        await logout();
        navigate("/main");
    };

    useEffect(() => {
        closeDropdown();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);


    const avatarNode = isAvatar ? (
        <img
            src={normalizeMediaUrl(activeAvatar.url)}
            alt="avatar"
            className="avatar-large"
        />
    ) : (
        <span className="avatar-large avatar-fallback" aria-hidden="true">
            <AstraAvatar variant={fallbackVariant} className="avatar-fallback-art" />
        </span>
    );

    const hasQuery = Boolean(query.trim());

    /* одна вежливая живая область на все состояния списка */
    const liveStatus = !hasQuery
        ? ""
        : isLoading
            ? "Ищем товары"
            : notFound
                ? "Ничего не найдено"
                : resultsSearch.length > 0
                    ? `Найдено товаров: ${resultsSearch.length}`
                    : "";

    return (
        <>
        <header className="navbar">
            <GooFilterDefs />
            <GlassLensDefs />

            {/* Liquid-glass поверхность бара лежит на внутреннем слое, НЕ на
                .navbar: backdrop-filter создаёт containing block для fixed-
                потомков, а оверлей поиска (position: fixed) — потомок шапки.
                Слой абсолютный и под контентом — оверлей остаётся во весь
                вьюпорт. Transform-анимаций на этом слое нет и быть не должно. */}
            <div className="navbar-glass astra-liquid" aria-hidden="true" />

            <div className="navbar-inner">
                {/* Бренд снова ведёт на главную (владелец отменил инертность
                    раунда 5). Маскот и словомарка — ОДНА ссылка с ОДНИМ именем
                    «ASTRA — на главную»: оба SVG скрыты от скринридера, иначе
                    бренд читался бы дважды. Ховер — сдержанная ясеневая
                    подложка (см. .nav-brand::before): ни розового, ни подъёма.
                    Зазор маскот↔словомарка (gap) не тронут. */}
                <Link to="/main" className="nav-brand" aria-label="ASTRA — на главную">
                    {/* <AstraMark className="nav-brand-mark" aria-hidden="true" focusable="false" />
                    <AstraWordmark
                        className="nav-brand-word"
                        role="presentation"
                        aria-hidden="true"
                        focusable="false"
                    /> */}
                    <img src={photo} className= "nav-brand-photo" alt="" />
                </Link>

                {/* ------------------------------------------------------------
                    Gooey-поиск — порт GooeySearch.tsx на React 18 + CSS.
                    Два слоя одинаковой геометрии: .gooey-goo (только силуэты,
                    прогоняется через #astra-goo) и .gooey-layer (форма с полем
                    и кнопкой — резкая, вне фильтра). Пилюля анимирует width,
                    пузырь отлипает на 8px за её край — goo тянет «шейку»
                    и они разлепляются. Габарит .gooey фиксирован, поэтому бар
                    не переливается. На фильтрованном слое нет ни
                    backdrop-filter, ни transform-анимаций.
                    ------------------------------------------------------------ */}
                <div className="nav-center">
                    {/* .is-active — поле смонтировано и живо; .is-open — кадр
                        анимации (ширина пилюли, отрыв пузыря) */}
                    <div
                        className={`gooey ${isSearchActive ? "is-active" : ""} ${isSearchModalOpen ? "is-open" : ""}`}
                        ref={gooRef}
                    >
                        {/* На узких экранах раскрытая пилюля перекрывает бар
                            целиком — этот слой прячет под собой его содержимое.
                            Он лежит внутри gooRef, поэтому тап по нему считался
                            «внутри» и ничего не закрывал: вешаем закрытие явно,
                            иначе на мобиле у пальца нет выхода из поиска. */}
                        <span
                            className="gooey-veil"
                            aria-hidden="true"
                            onMouseDown={(e) => {
                                if (!isSearchActive) return;
                                e.stopPropagation();
                                closeSearch();
                            }}
                        />

                        <span className="gooey-goo" aria-hidden="true">
                            <span className="gooey-goo-pill" />
                            <span className="gooey-goo-bubble" />
                        </span>

                        <form className="gooey-layer" role="search" onSubmit={submitSearch}>
                            <div className="gooey-pill">
                                {/* Кольцо фокуса поля рисует .gooey-face токеном
                                    --astra-focus-field: у самого input нет ни рамки,
                                    ни фона — поверхность даёт goo-слой, а розовая
                                    подсветка ввода в v3 запрещена.

                                    aria-expanded здесь НЕТ: у searchbox такого
                                    состояния не бывает, а role="combobox" пришлось
                                    бы подкреплять listbox/option и переходом по
                                    стрелкам — результаты же остаются обычными
                                    кнопками. Появление списка объявляет живая
                                    область (liveStatus выше). */}
                                {isSearchActive ? (
                                    <input
                                        ref={inputRef}
                                        type="search"
                                        className="gooey-input"
                                        value={query}
                                        onChange={(e) => setQuery(sanitizeTyping(e.target.value))}
                                        onFocus={() => {
                                            if (query.trim() && (resultsSearch.length > 0 || notFound)) {
                                                setOpenSearch(true);
                                            }
                                        }}
                                        placeholder="Найти игру или сервис"
                                        aria-label="Поиск товаров"
                                        aria-controls="nav-search-results"
                                        autoComplete="off"
                                        enterKeyHint="search"
                                        inputMode="search"
                                        maxLength={SEARCH_MAX}
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        ref={triggerRef}
                                        className="gooey-trigger"
                                        onClick={openSearchPanel}
                                        aria-haspopup="dialog"
                                        aria-expanded={false}
                                        aria-label={
                                            hasQuery
                                                ? `Открыть поиск товаров. Текущий запрос: ${query.trim()}`
                                                : "Открыть поиск товаров"
                                        }
                                    >
                                        {/* подпись сокращается вместе с пилюлей —
                                            обрезанное многоточием «Найти игру ил…»
                                            читается как поломка, а не как подсказка.
                                            Запрос показываем БЕЗ кавычек (решение
                                            владельца): «nitro» выглядело цитатой,
                                            а не текущим состоянием поля. Обрезка
                                            многоточием остаётся на CSS. */}
                                        <span
                                            className="gooey-trigger-label gooey-trigger-label--full"
                                            aria-hidden="true"
                                        >
                                            {hasQuery ? query.trim() : "Найти игру или сервис"}
                                        </span>
                                        <span
                                            className="gooey-trigger-label gooey-trigger-label--short"
                                            aria-hidden="true"
                                        >
                                            {hasQuery ? query.trim() : "Поиск"}
                                        </span>
                                    </button>
                                )}
                                <span className="gooey-face" aria-hidden="true" />
                            </div>

                            {/* пузырь: свёрнутый — просто иконка внутри пилюли
                                (aria-hidden, кликов не ловит); раскрытый —
                                настоящая кнопка отправки в 44px */}
                            <button
                                type="submit"
                                className="gooey-bubble"
                                tabIndex={isSearchActive ? 0 : -1}
                                aria-hidden={isSearchActive ? undefined : "true"}
                                aria-label="Показать все результаты"
                            >
                                <SearchIcon className="gooey-icon" />
                            </button>
                        </form>
                    </div>
                </div>

                <div className="nav-right">
                    {/* Поддержка и Корзина — видны и гостю, и авторизованному.
                        Пункты в дропдауне остались, ничего не удалено. */}
                    <NavLink
                        to="/support"
                        className={({ isActive }) => `nav-icon-btn astra-press ${isActive ? "is-active" : ""}`}
                        aria-label="Поддержка"
                        title="Поддержка"
                    >
                        {/* чат-пузыри, а не бумажный самолётик:
                            самолётик занят телеграмом в подвале */}
                        <span className="nav-icon-glyph nav-icon-glyph--support" aria-hidden="true">
                            <TechSuppIcon />
                        </span>
                        <Badge value={supportBadge} />
                    </NavLink>

                    <NavLink
                        to="/basket"
                        className={({ isActive }) => `nav-icon-btn astra-press ${isActive ? "is-active" : ""}`}
                        aria-label="Корзина"
                        title="Корзина"
                    >
                        <span className="nav-icon-glyph nav-icon-glyph--basket" aria-hidden="true">
                            <BasketIcon />
                        </span>
                        <Badge value={cartBadge} />
                    </NavLink>

                    <div className="nav-account" ref={menuRef}>
                        {isAuthenticated ? (
                            <button
                                type="button"
                                className={`profile astra-press ${isDropdownOpen ? "is-dropdown-open" : ""}`}
                                onClick={toggleDropdown}
                                aria-haspopup="true"
                                aria-expanded={isDropdownOpen}
                                aria-label="Меню профиля"
                            >
                                {avatarNode}
                            </button>
                        ) : (
                            /* .astra-ring: clip-path кнопки съедает outline — кольцо на обёртке */
                            <span className="astra-ring nav-login-ring">
                                <NavLink to="/sign_in" className="astra-btn nav-login-btn">
                                    Войти
                                </NavLink>
                            </span>
                        )}

                        {isDropdownMounted && isAuthenticated && (
                            <div
                                className={`dropdown ${isDropdownClosing ? "is-closing" : (isDropdownOpen ? "is-open" : "")}`}
                            >
                                <div className="dropdown-shadow" aria-hidden="true" />
                                {/* Панель — liquid glass; transform живёт на обёртке
                                    .dropdown, сама панель анимирует только opacity */}
                                <div className="dropdown-panel astra-liquid astra-liquid--deep">
                                    <div className="profile-header">
                                        <NavLink to="/profile" className="dropdown-user" onClick={closeDropdown}>
                                            {avatarNode}
                                            <span className="dropdown-user-meta">
                                                <span className="username">{user?.nickname || "Пользователь"}</span>
                                                <span className="user-balance">
                                                    Баланс: {user?.balance ?? 0} ₽
                                                </span>
                                            </span>
                                        </NavLink>
                                    </div>

                                    <div className="menu">
                                        <NavLink
                                            to="/orders"
                                            className={({ isActive }) => `navbar-item ${isActive ? "active" : ""}`}
                                            onClick={closeDropdown}
                                        >
                                            <div className="menu-item">
                                                <OrderIcon /> Покупки
                                                <Badge value={ordersBadge} />
                                            </div>
                                        </NavLink>

                                        <NavLink
                                            to="/basket"
                                            className={({ isActive }) => `navbar-item ${isActive ? "active" : ""}`}
                                            onClick={closeDropdown}
                                        >
                                            <div className="menu-item"> 
                                                <BasketIcon /> Корзина
                                                <Badge value={cartBadge} />
                                            </div>
                                            
                                        </NavLink>

                                        <NavLink
                                            to="/support"
                                            className={({ isActive }) => `navbar-item ${isActive ? "active" : ""}`}
                                            onClick={closeDropdown}
                                        >
                                            <div className="menu-item"> <TechSuppIcon /> Поддержка</div>
                                        </NavLink>

                                        <NavLink
                                            to="/coop"
                                            className={({ isActive }) => `navbar-item ${isActive ? "active" : ""}`}
                                            onClick={closeDropdown}
                                        >
                                            <div className="menu-item"> <CooperationIcon /> Сотрудничество</div>
                                        </NavLink>

                                        {isStaff && <div className="divider-navbar" />}

                                        {isAdmin && (
                                            <NavLink
                                                to="/admin-panel"
                                                className={({ isActive }) => `navbar-item ${isActive ? "active" : ""}`}
                                                onClick={closeDropdown}
                                            >
                                                <div className="menu-item"> <AdminPanelSvg /> Админ-панель</div>
                                            </NavLink>
                                        )}

                                        {isStaff && (
                                            <NavLink
                                                to="/seller-chat"
                                                className={({ isActive }) => `navbar-item ${isActive ? "active" : ""}`}
                                                onClick={closeDropdown}
                                            >
                                                <div className="menu-item">
                                                    <InboxIcon /> Заказы продавца
                                                    <Badge value={sellerOrdersBadge} />
                                                </div>
                                            </NavLink>
                                        )}

                                        <div className="divider-navbar" />

                                        <button type="button" className="menu-item nav-logout-btn" onClick={handleLogout}>
                                            <LogoutIcon /> Выйти
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isSearchModalMounted && (
                <div
                    className={`search-modal-overlay ${isSearchModalOpen ? "is-open" : ""} ${isSearchClosing ? "is-closing" : ""}`}
                    ref={overlayRef}
                    onClick={() => closeSearch()}
                >
                    {/* .search-modal — обёртка для движения; панель гаснет отдельно.
                        aria-modal СНЯТ намеренно: поле ввода теперь живёт в пилюле
                        шапки, а aria-modal="true" спрятал бы её от скринридера.
                        Ловушка фокуса охватывает оба корня (пилюля + панель), так
                        что клавиатура из поиска всё равно не убегает. */}
                    <div
                        className={`search-modal ${isSearchClosing ? "is-closing" : (isSearchModalOpen ? "is-open" : "")}`}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-labelledby="search-modal-title"
                    >
                        {/* Панель — сплошная ясеневая поверхность. Liquid-glass
                            снят: его линза (::after) давала зеркальный артефакт,
                            который владелец забраковал в попапе покупки.
                            Затемнение и блюр остались ТОЛЬКО на оверлее. */}
                        <div className="search-modal-panel">
                            {/* Видимого крестика нет (решение владельца): закрытие —
                                Escape и клик по затемнению. Для клавиатуры и
                                скринридера остаётся один визуально скрытый выход;
                                он проявляется, когда на него приходит фокус, иначе
                                фокус «исчезал» бы с экрана. */}
                            <button
                                type="button"
                                className="nav-vh nav-vh-focusable"
                                onClick={() => closeSearch()}
                            >
                                Закрыть поиск
                            </button>

                            <div className="search-modal-header">
                                <h2 id="search-modal-title" className="search-modal-title">
                                    Поиск товаров
                                </h2>
                                <div className="search-modal-header-actions">
                                    {hasQuery ? (
                                        <button
                                            type="button"
                                            className="search-modal-text-btn astra-press"
                                            onClick={() => {
                                                clearSearch();
                                                const el = inputRef.current;
                                                if (el && typeof el.focus === "function") el.focus();
                                            }}
                                        >
                                            Очистить
                                        </button>
                                    ) : null}
                                </div>
                            </div>

                            <p className="nav-vh" role="status">{liveStatus}</p>

                            {/* .astra-no-scrollbar — список ПРОКРУЧИВАЕТСЯ, но
                                своего ползунка не показывает (решение владельца) */}
                            <div
                                className="search-modal-body astra-no-scrollbar"
                                id="nav-search-results"
                            >
                                {!hasQuery && (
                                    <div className="search-modal-hint">
                                        Введите запрос — покажем подходящие товары.
                                    </div>
                                )}
                                {hasQuery && isLoading && (
                                    <div className="search-loading-wrap">
                                        <div className="search-loading search-loading-inline">
                                            <span className="spinner" aria-hidden="true" />
                                            Ищем…
                                        </div>
                                        {showSearchSkeletons && (
                                            <>
                                                <div className="search-skeleton-row astra-skeleton" aria-hidden="true" />
                                                <div className="search-skeleton-row astra-skeleton" aria-hidden="true" />
                                            </>
                                        )}
                                    </div>
                                )}
                                {hasQuery && !isLoading && openSearch && resultsSearch.length > 0 && (
                                    <div className="search-dropdown search-dropdown-panel">
                                        {/* Карточка — КНОПКА: открывает попап быстрой
                                            покупки. Отдельной страницы товара больше
                                            нет, ссылок на /product/:id тут не осталось. */}
                                        {resultsSearch.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                className={`search-item search-item-card${
                                                    pendingProductId === item.id ? " is-pending" : ""
                                                }`}
                                                aria-busy={pendingProductId === item.id || undefined}
                                                onClick={() => {
                                                    closeSearch({ restoreFocus: false });
                                                    openProduct(item);
                                                }}
                                            >
                                                <span className="search-item-surface">
                                                    {item.image_main ? (
                                                        <img src={normalizeMediaUrl(item.image_main)} alt="" />
                                                    ) : (
                                                        <span className="search-item-img-fallback" aria-hidden="true" />
                                                    )}
                                                    <span className="search-item-text">
                                                        <span className="product-name text-none">{item.name}</span>
                                                        {(item.category_name || item.category) && (
                                                            <span className="search-item-meta">
                                                                {item.category_name || item.category}
                                                            </span>
                                                        )}
                                                        <span className="price">
                                                            {Number.isFinite(Number(item.price))
                                                                ? Number(item.price).toLocaleString("ru-RU")
                                                                : item.price} ₽
                                                        </span>
                                                    </span>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {hasQuery && !isLoading && openSearch && notFound && (
                                    <div className="search-not-found search-not-found-panel">
                                        <span className="search-not-found-icon" aria-hidden="true">
                                            <SearchIcon className="search-not-found-icon-svg" />
                                        </span>
                                        <p>Ничего не найдено</p>
                                        <span className="hint">Попробуйте другие слова или укоротить запрос</span>
                                    </div>
                                )}
                                {hasQuery && !isLoading && openSearch && resultsSearch.length > 0 && (
                                    <p className="search-modal-foot">
                                        Enter — открыть страницу со всеми результатами
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </header>

        {/* Попап быстрой покупки — СИБЛИНГ шапки, а не её потомок: внутри
            он попал бы в стековый контекст .navbar (z-index 3200), и его
            собственный z-index 4000 считался бы уже внутри этой ступени.
            Снаружи попап честно лежит над страницей и под тостами (5000). */}
        {quickBuyModal}
        </>
    );
};

export default Navbar;
