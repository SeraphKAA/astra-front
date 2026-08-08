import React, { useState, useRef, useEffect, useCallback } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import "./navbar.css";
import logo from "../../shared/ASTRA Shop.png";
import { ReferalIcon, OrderIcon, HelpIcon, PromocodeIcon, CooperationIcon, BasketIcon, TechSuppIcon, AdminPanelSvg, SearchIcon, InboxIcon, LogoutIcon } from "../../shared/svgIcons";
import { searchProducts } from "../../entities/product/api/productApi";
import { useAuth } from "../../app/auth/AuthContext";
import { normalizeMediaUrl } from "../../shared/commonApi";
import { normalizeSearchQuery } from "../../shared/validation";

const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isAuthenticated, activeAvatar, logout } = useAuth();
    const isAvatar = Boolean(activeAvatar?.url);
    const [isDropdownMounted, setIsDropdownMounted] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isDropdownClosing, setIsDropdownClosing] = useState(false);
    const menuRef = useRef();
    const searchRef = useRef();
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

    const closeSearchModal = useCallback(() => {
        if (!isSearchModalMounted || isSearchClosing) return;
        setIsSearchClosing(true);
        setOpenSearch(false);
        setIsSearchModalOpen(false);
        closeTimerRef.current = setTimeout(() => {
            setIsSearchModalMounted(false);
            setIsSearchClosing(false);
        }, 250);
    }, [isSearchModalMounted, isSearchClosing]);

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
        }, 280);
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

        const qSanitized = normalizeSearchQuery(query, 30);
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

        // Задержка перед отправкой запроса (800мс)
        debounceTimeoutRef.current = setTimeout(async () => {
            try {
                const data = await searchProducts(qSanitized);

                if (data && data.length > 0) {
                    setResultsSearch(data);
                    setOpenSearch(true);
                    setNotFound(false);
                } else {
                    setResultsSearch([]);
                    setOpenSearch(true);
                    setNotFound(true);
                }
            } catch (e) {
                // console.error(e);
                setResultsSearch([]);
                setNotFound(true);
                setOpenSearch(true);
            } finally {
                setIsLoading(false);
            }
        }, 800); // 800 миллисекунд задержки

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
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setOpenSearch(false);
                closeSearchModal();
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [closeSearchModal, closeDropdown]);

    useEffect(() => {
        if (!isSearchModalOpen) return;
        if (query.trim() && (resultsSearch.length > 0 || notFound)) {
            setOpenSearch(true);
        }
    }, [isSearchModalOpen, query, resultsSearch, notFound]);

    const openSearchModal = () => {
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
            if (query.trim() && (resultsSearch.length > 0 || notFound)) {
                setOpenSearch(true);
            }
        });
    };

    useEffect(() => {
        if (!isSearchModalOpen) return;
        const onKey = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                closeSearchModal();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [isSearchModalOpen, closeSearchModal]);

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

    const searchModalAllowed = true;

    const handleLogout = async () => {
        closeDropdown();
        await logout();
        navigate("/menu");
    };

    useEffect(() => {
        closeDropdown();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    return (
        <div className="navbar">
            <NavLink
                to="/menu"
                className={({ isActive }) => `navbar-item ${isActive ? 'active' : ''}`}
            >
                <img src={logo} alt="ASTRA SHOP" className="logo-navbar" />
            </NavLink>

            <div className="nav-right" ref={menuRef}>
                {searchModalAllowed && (
                    <button
                        type="button"
                        className="navbar-spec-item nav-search-btn"
                        onClick={openSearchModal}
                        aria-label="Открыть поиск"
                    >
                        <SearchIcon className="navbar-icon" />
                    </button>
                )}
                {user?.role === "admin" && (
                    <NavLink
                        to="/admin-panel"
                        className={({ isActive }) =>
                            `navbar-item ${isActive ? "active" : ""}`
                        }
                    >
                        <div className="navbar-spec-item">
                            {" "}
                            <AdminPanelSvg className="navbar-icon" />{" "}
                        </div>
                    </NavLink>
                )}
                {(user?.role === "admin" || user?.role === "seller" || user?.role === "moderator") && (
                    <NavLink
                        to="/seller-chat"
                        className={({ isActive }) =>
                            `navbar-item ${isActive ? "active" : ""}`
                        }
                        aria-label="Заказы продавца"
                    >
                        <div className="navbar-spec-item">
                            <InboxIcon className="navbar-icon" />
                        </div>
                    </NavLink>
                )}
                <NavLink
                    to="/basket"
                    className={({ isActive }) => `navbar-item ${isActive ? 'active' : ''}`}
                >
                    <div className="navbar-spec-item"> <BasketIcon className="navbar-icon" /> </div>
                </NavLink>

                <NavLink
                    to="/support"
                    className={({ isActive }) => `navbar-item ${isActive ? 'active' : ''}`}
                >
                    <div className="navbar-spec-item"> <TechSuppIcon className="navbar-icon" /> <span className="support-nav-text">Техподдерка</span> </div>
                </NavLink>

                {isAuthenticated ? (
                    <div className={`profile ${isDropdownOpen ? "is-dropdown-open" : ""}`} onClick={toggleDropdown}>
                        {isAvatar ? (
                            <img
                                src={normalizeMediaUrl(activeAvatar.url)}
                                alt="avatar"
                                className="avatar-large"
                            />
                        ) : (
                            <div className="avatar-large avatar-initials">
                                {user?.nickname?.charAt(0).toUpperCase() || '?'}
                            </div>
                        )}
                    </div>
                ) : (
                    <NavLink to="/sign_in" className="auth-btn">
                        Войти
                    </NavLink>
                )}

                {isDropdownMounted && isAuthenticated && (
                    <div
                        className={`dropdown ${isDropdownClosing ? "is-closing" : (isDropdownOpen ? "is-open" : "")}`}
                    >
                        <div className="profile-header">
                            <NavLink
                                to="/profile"
                                className={({ isActive }) => `navbar-item ${isActive ? 'active' : ''}`}
                            >
                                {isAvatar ? (
                                    <img
                                        src={normalizeMediaUrl(activeAvatar.url)}
                                        alt="avatar"
                                        className="avatar-large"
                                    />
                                ) : (
                                    <div className="avatar-large avatar-initials">
                                        {user?.nickname?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                )}
                                <div>
                                    <div className="username">{user?.nickname || "Пользователь"}</div>
                                    <div className="user-balance">
                                        Баланс: {user?.balance ?? "-"} ₽
                                    </div>
                                </div>
                            </NavLink>

                        </div>

                        <div className="menu">

                            <NavLink
                                to="/orders"
                                className={({ isActive }) => `navbar-item ${isActive ? 'active' : ''}`}
                                onClick={closeDropdown}
                            >
                                <div className="menu-item"> <OrderIcon className="navbar-icon" /> Покупки</div>
                            </NavLink>

                            <div className="divider-navbar" />

                            <NavLink
                                to="/support"
                                className={({ isActive }) => `navbar-item ${isActive ? 'active' : ''}`}
                                onClick={closeDropdown}
                            >
                                <div className="menu-item"> <HelpIcon className="navbar-icon" /> Поддержка</div>
                            </NavLink>

                            <div className="divider-navbar" />

                            <NavLink
                                to="/coop"
                                className={({ isActive }) => `navbar-item ${isActive ? 'active' : ''}`}
                                onClick={closeDropdown}
                            >
                                <div className="menu-item"> <CooperationIcon className="navbar-icon" /> Сотрудничество</div> {/*TODO: отдельная страница, для сотрудничества как работник (разного вида) или как компания (?)*/}
                            </NavLink>

                            <button type="button" className="menu-item nav-logout-btn" onClick={handleLogout}>
                                <LogoutIcon className="navbar-icon" /> Выйти
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {isSearchModalMounted && (
                <div
                    className={`search-modal-overlay ${isSearchClosing ? "is-closing" : (isSearchModalOpen ? "is-open" : "")}`}
                    ref={searchRef}
                    onClick={closeSearchModal}
                >
                    <div
                        className={`search-modal ${isSearchClosing ? "is-closing" : (isSearchModalOpen ? "is-open" : "")}`}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="search-modal-title"
                    >
                        <div className="search-modal-header">
                            <h2 id="search-modal-title" className="search-modal-title">
                                Поиск товаров
                            </h2>
                            <div className="search-modal-header-actions">
                                {query.trim() ? (
                                    <button
                                        type="button"
                                        className="search-modal-text-btn"
                                        onClick={clearSearch}
                                    >
                                        Очистить
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    className="search-modal-close"
                                    onClick={closeSearchModal}
                                    aria-label="Закрыть"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                        <input
                            className="search search-modal-input"
                            placeholder="Название товара…"
                            value={query}
                            onChange={(e) => setQuery(normalizeSearchQuery(e.target.value, 30))}
                            onFocus={() => {
                                if (query.trim() && (resultsSearch.length > 0 || notFound)) {
                                    setOpenSearch(true);
                                }
                            }}
                            autoFocus
                        />
                        <div className="search-modal-body">
                            {!query.trim() && (
                                <div className="search-modal-hint">
                                    Введите запрос — покажем подходящие товары.
                                </div>
                            )}
                            {query.trim() && isLoading && (
                                <div className="search-loading search-loading-inline">
                                    <span className="spinner" />
                                    Ищем…
                                </div>
                            )}
                            {query.trim() && !isLoading && openSearch && resultsSearch.length > 0 && (
                                <div className="search-dropdown search-dropdown-panel">
                                    {resultsSearch.map((item) => (
                                        <NavLink
                                            key={item.id}
                                            to={`/product/${item.id}`}
                                            className="search-item search-item-card"
                                            onClick={() => closeSearchModal()}
                                        >
                                            {item.image_url ? (
                                                <img src={normalizeMediaUrl(item.image_url)} alt="" />
                                            ) : (
                                                <div className="search-item-img-fallback" aria-hidden />
                                            )}
                                            <div className="search-item-text">
                                                <div className="product-name">{item.name}</div>
                                                {(item.category_name || item.category) && (
                                                    <div className="search-item-meta">
                                                        {item.category_name || item.category}
                                                    </div>
                                                )}
                                                <div className="price">{item.price} ₽</div>
                                            </div>
                                        </NavLink>
                                    ))}
                                </div>
                            )}
                            {query.trim() && !isLoading && openSearch && notFound && (
                                <div className="search-not-found search-not-found-panel">
                                    <span className="search-not-found-icon" aria-hidden>
                                        <SearchIcon className="search-not-found-icon-svg" />
                                    </span>
                                    <p>Ничего не найдено</p>
                                    <span className="hint">Попробуйте другие слова или укоротить запрос</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Navbar;