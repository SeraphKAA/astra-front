import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import "./search.css";
import { searchProducts } from "../../entities/product/api/productApi";
import { getApiErrorMessage, normalizeMediaUrl } from "../../shared/commonApi";
import { normalizeSearchQuery } from "../../shared/validation";
import { useQuickBuy } from "../../widgets/CategoryQuickBuy";
import AstraAvatar from "../../shared/brand/AstraAvatar";
import EdgeBlur from "../../shared/fx/EdgeBlur";
import SlidingNumber from "../../shared/fx/SlidingNumber";
import { SearchIcon } from "../../shared/svgIcons";
import {
    useRevealOnce,
    revealDelay,
    useDelayedPending,
    prefersReducedMotion,
} from "../../shared/fx/motionUtils";
import { Pagination } from "../../shared/ui/Pagination/Pagination";

/* Окно «новинки» — те же 14 дней, что и на главной. */
const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_QUERY = 60;
const SKELETON_CARDS = 8;
const AVATAR_VARIANTS = ["pink", "red", "violet"];

/* Длительность кросс-фейда = --astra-t-move (300мс), как в PendingSwap. */
const SWAP_MS = 300;

/**
 * Карточки, приехавшие ЧЕРЕЗ подмену скелетона, считаются уже
 * проявленными: reveal-once (--astra-t-enter, 800мс, плюс стаггер) не
 * укладывается в 300мс кросс-фейда — призрак растворялся раньше, чем
 * проявлялась вторая половина сетки. Появление берёт на себя один слой
 * (.srch-swap-in). Класс ставится в layout-эффекте, до первого кадра:
 * у только что вставленного узла нет предыдущего стиля, transition не
 * запускается. IntersectionObserver позже поставит его повторно —
 * это безвредно. Тот же приём, что в pages/MainMenu/TileGrid.jsx.
 */
const settleReveals = (node) => {
    if (!node) return;
    node.querySelectorAll(".astra-reveal").forEach((el) => {
        el.style.setProperty("--reveal-delay", "0ms");
        el.classList.add("is-revealed");
    });
};

const BAD_QUERY_TEXT = "Запрос содержит недопустимые символы — оставьте буквы, цифры и пробелы";

const formatPrice = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? new Intl.NumberFormat("ru-RU").format(n) : String(value);
};

/** Русские окончания: 1 товар / 2 товара / 5 товаров. */
const pluralRu = (n, one, few, many) => {
    const abs = Math.abs(Math.trunc(n));
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
};

/** Старая цена — только настоящая: old_price / price_old выше текущей. */
const getOldPrice = (item) => {
    const price = Number(item?.price);
    if (!Number.isFinite(price) || price <= 0) return null;
    const candidates = [item?.old_price, item?.price_old, item?.oldPrice];
    for (const candidate of candidates) {
        if (candidate == null) continue;
        const n = Number(candidate);
        if (Number.isFinite(n) && n > price) return n;
    }
    return null;
};

/** −N% только из реальных полей данных, никогда не выдумывается. */
const getDiscountPercent = (item) => {
    const price = Number(item?.price);
    const old = getOldPrice(item);
    if (old != null && Number.isFinite(price) && price > 0) {
        return Math.round((1 - price / old) * 100);
    }
    const direct = Number(item?.discount_percent);
    if (Number.isFinite(direct) && direct > 0 && direct < 100) return Math.round(direct);
    return null;
};

const isFresh = (item) => {
    if (!item?.created_at) return false;
    const t = Date.parse(item.created_at);
    return Number.isFinite(t) && Date.now() - t <= NEW_WINDOW_MS;
};

/** /product/search отдаёт массив; читаем защитно, не додумывая формат. */
const readSearchResponse = (data) => {
    if (Array.isArray(data)) {
        return { items: data.filter((p) => p && p.id != null), total: data.length, pages: 1 };
    }
    const items = Array.isArray(data?.products)
        ? data.products
        : Array.isArray(data?.items)
            ? data.items
            : [];
    return {
        items: items.filter((p) => p && p.id != null),
        total: Number.isFinite(Number(data?.total)) ? Number(data.total) : items.length,
        pages: Number.isFinite(Number(data?.pages)) ? Math.max(1, Number(data.pages)) : 1,
    };
};

const ClearIcon = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
    >
        <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

/**
 * Карточка результата — грамматика Kupikod с главной: медиа 4:3 с
 * фирменным аватаром вместо отсутствующего арта, цена Unbounded 700
 * в --astra-soft, «Новинка» — фиолетовый чип (14 дней), −N% —
 * ПУРПУРНЫЙ .astra-badge--drop (скидка носит свой цвет, не розовый).
 * Вся карточка — кнопка: открывает попап быстрой покупки.
 */
const ResultCard = ({ item, index = 0, pending = false, onOpen }) => {
    const [imgError, setImgError] = useState(false);
    const revealRef = useRevealOnce();
    const src = !imgError && item?.image_main ? normalizeMediaUrl(item.image_main) : null;
    const discount = getDiscountPercent(item);
    const oldPrice = getOldPrice(item);
    const hasPrice = item?.price !== null && item?.price !== undefined && item?.price !== "";

    return (
        <div className="srch-cell astra-reveal" ref={revealRef} style={revealDelay(index)}>
            <button
                type="button"
                className={`srch-prod astra-press${pending ? " is-pending" : ""}`}
                aria-busy={pending || undefined}
                onClick={() => onOpen?.(item)}
            >
                <span className="srch-prod-media">
                    {src ? (
                        <img
                            className="srch-prod-img"
                            src={src}
                            alt=""
                            loading="lazy"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <AstraAvatar
                            variant={AVATAR_VARIANTS[index % AVATAR_VARIANTS.length]}
                            className="srch-prod-avatar"
                            preserveAspectRatio="xMidYMid slice"
                        />
                    )}
                    {isFresh(item) && (
                        <span className="astra-badge astra-badge--new srch-prod-new">Новинка</span>
                    )}
                </span>
                <span className="srch-prod-body">
                    {hasPrice && (
                        <span className="srch-prod-pricerow">
                            <span className="srch-prod-price">{formatPrice(item.price)} ₽</span>
                            {discount != null && (
                                <span className="astra-badge astra-badge--drop">−{discount}%</span>
                            )}
                            {oldPrice != null && (
                                <s className="srch-prod-old">{formatPrice(oldPrice)} ₽</s>
                            )}
                        </span>
                    )}
                    <span className="srch-prod-name">{item.name}</span>
                </span>
            </button>
        </div>
    );
};

/**
 * Страница результатов /search?q=… — живой поиск по каталогу.
 * Запрос живёт в адресе: страница открывается прямой ссылкой, поле
 * предзаполнено и по Enter переписывает ?q=. Фокус поля — нейтральное
 * ясеневое кольцо (розовый остаётся сигналом действия, не подсветкой ввода).
 */
const SearchPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const { openProduct, modal, pendingProductId } = useQuickBuy();

    const rawQuery = (searchParams.get("q") ?? "").trim();
    /* Тот же санитайзер, что и в шапке: в запрос уходит только очищенная
       строка, и она же эхом уходит в заголовок — показываем то, что искали. */
    const safeQuery = useMemo(() => normalizeSearchQuery(rawQuery, MAX_QUERY), [rawQuery]);
    const queryRejected = rawQuery.length > 0 && safeQuery.length === 0;

    const [draft, setDraft] = useState(rawQuery);
    const [fieldError, setFieldError] = useState("");
    const [items, setItems] = useState([]);
    const PAGE_SIZE = 24;
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);
    /* Есть запрос — страница СРАЗУ в загрузке. Поиск стартует в эффекте,
       то есть уже после коммита: с loading=false первый кадр
       /search?q=steam успевал написать «Ничего не найдено» ещё до того,
       как запрос ушёл на сервер. */
    const [loading, setLoading] = useState(() => Boolean(safeQuery));
    const [error, setError] = useState("");
    const [retryKey, setRetryKey] = useState(0);

    /* Смена запроса гасит прошлый ответ В ТОМ ЖЕ рендере (приём React
       «adjusting state when a prop changes»). Эффект поиска отрабатывает
       после коммита, поэтому иначе один кадр показывал карточки прошлого
       запроса под новым заголовком. */
    const lastQueryRef = useRef(safeQuery);
    if (lastQueryRef.current !== safeQuery) {
        lastQueryRef.current = safeQuery;
        setItems([]);
        setTotal(0);
        setPages(1);
        setPage(1);
        setError("");
        setLoading(Boolean(safeQuery));
    }

    /* Скелетон — сигнал «ответ задерживается», а не обязательный этап
       загрузки. Быстрый ответ (или кэш) не должен мигать серыми плитками:
       карточки просто проявляются своей обычной reveal-анимацией. */
    const pending = useDelayedPending(loading);
    const showSkeletons = loading && pending;

    /* Если плитки всё-таки показались, они не подменяются рывком: слой
       уходит в прозрачность ПОВЕРХ входящих карточек, а карточки за те же
       300мс проявляются одним слоем (.srch-swap-in). */
    const [skelExit, setSkelExit] = useState(false);
    const skelShownRef = useRef(false);
    const skelTimerRef = useRef(null);
    const resultsRef = useRef(null);

    /* useLayoutEffect — как в PendingSwap на главной: слой-призрак обязан
       попасть в ПЕРВЫЙ кадр с результатами. Из useEffect он приезжал на
       коммит позже, и подмена всё равно была видна швом. */
    useLayoutEffect(() => {
        if (showSkeletons) {
            skelShownRef.current = true;
            clearTimeout(skelTimerRef.current);
            setSkelExit(false);
            return;
        }
        if (!skelShownRef.current) return;
        skelShownRef.current = false;
        if (prefersReducedMotion()) return;
        settleReveals(resultsRef.current);
        setSkelExit(true);
        clearTimeout(skelTimerRef.current);
        skelTimerRef.current = setTimeout(() => setSkelExit(false), SWAP_MS);
    }, [showSkeletons]);

    useEffect(() => () => clearTimeout(skelTimerRef.current), []);

    /* Адрес — источник правды: переход по ссылке/назад обновляет поле. */
    useEffect(() => {
        setDraft(rawQuery);
        setFieldError("");
    }, [rawQuery]);

    useEffect(() => {
        if (!safeQuery) {
            setItems([]);
            setTotal(0);
            setPages(1);
            setError("");
            setLoading(false);
            return undefined;
        }
        let cancelled = false;
        setLoading(true);
        setError("");
        searchProducts(safeQuery, { page, size: PAGE_SIZE })
            .then((data) => {
                if (cancelled) return;
                const parsed = readSearchResponse(data);
                setItems(parsed.items);
                setTotal(parsed.total);
                setPages(parsed.pages);
            })
            .catch((e) => {
                if (cancelled) return;
                setItems([]);
                setTotal(0);
                setPages(1);
                setError(getApiErrorMessage(e, "Не удалось выполнить поиск"));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [safeQuery, page, retryKey]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const typed = draft.trim();
        const next = normalizeSearchQuery(typed, MAX_QUERY);
        if (typed && !next) {
            setFieldError(BAD_QUERY_TEXT);
            return;
        }
        setFieldError("");
        setSearchParams(next ? { q: next } : {});
    };

    const handleClear = () => {
        setDraft("");
        setFieldError("");
        setSearchParams({});
    };

    const count = items.length;
    const showResults = Boolean(safeQuery) && !loading && !error && items.length > 0;
    const showEmpty = Boolean(safeQuery) && !loading && !error && items.length === 0 && total === 0;

    return (
        <div className="search-page srch-root">
            <div className="srch-page">
                <header className="srch-head">
                    <h1 className="srch-title">Поиск</h1>

                    {safeQuery ? (
                        <p className="srch-echo">
                            по запросу <span className="srch-echo-q">«{safeQuery}»</span>
                        </p>
                    ) : (
                        <p className="srch-echo">Наберите название игры, подписки или сервиса</p>
                    )}

                    <form
                        className="srch-form"
                        role="search"
                        aria-label="Поиск по каталогу"
                        onSubmit={handleSubmit}
                    >
                        <span className="srch-fieldwrap">
                            <SearchIcon className="srch-field-icon" />
                            <input
                                type="search"
                                className="srch-input astra-field"
                                name="q"
                                value={draft}
                                maxLength={MAX_QUERY}
                                autoComplete="off"
                                spellCheck={false}
                                placeholder="Например: Steam, Nitro, Telegram"
                                aria-label="Поисковый запрос"
                                aria-invalid={fieldError ? true : undefined}
                                aria-describedby={fieldError ? "srch-field-error" : undefined}
                                onChange={(e) => {
                                    setDraft(e.target.value);
                                    if (fieldError) setFieldError("");
                                }}
                            />
                            {draft && (
                                <button
                                    type="button"
                                    className="srch-clear astra-press"
                                    onClick={handleClear}
                                    aria-label="Очистить запрос"
                                >
                                    <ClearIcon />
                                </button>
                            )}
                        </span>

                        {/* clip-path кнопки съедает outline — кольцо на обёртке */}
                        <span className="astra-ring srch-submit-ring">
                            <button type="submit" className="astra-btn astra-press srch-submit">
                                Найти
                            </button>
                        </span>
                    </form>

                    {fieldError && (
                        <p className="srch-field-error" id="srch-field-error" role="alert">
                            {fieldError}
                        </p>
                    )}

                    {/* «Ищем…» объявляем только когда ответ реально
                        задерживается — иначе живая область тараторит на
                        каждом быстром запросе */}
                    <p className="srch-count" role="status" aria-live="polite">
                        {showSkeletons ? (
                            "Ищем…"
                        ) : showResults ? (
                            <>
                                Найдено{" "}
                                <span className="srch-count-num">
                                    <SlidingNumber value={String(total)} />
                                </span>{" "}
                                {pluralRu(count, "товар", "товара", "товаров")}
                            </>
                        ) : (
                            ""
                        )}
                    </p>
                </header>

                {/* Область результатов — общий слой подмены: уходящие плитки
                    лежат ПОВЕРХ содержимого и гаснут (.srch-skel-layer),
                    входящее проявляется теми же 300мс (.srch-swap-in). */}
                <div className="srch-swap">
                    <div className={skelExit ? "srch-swap-in" : undefined} ref={resultsRef}>
                        {queryRejected ? (
                            <div className="srch-state" role="alert">
                                <p className="srch-state-title">Не получилось выполнить поиск</p>
                                <p className="srch-state-text">{BAD_QUERY_TEXT}.</p>
                                <Link to="/main" className="astra-btn-ghost astra-press">
                                    В каталог
                                </Link>
                            </div>
                        ) : !safeQuery ? (
                            <div className="srch-state">
                                <p className="srch-state-title">Введите запрос…</p>
                                <p className="srch-state-text">
                                    Поиск идёт по названиям товаров каталога. Наберите слово в поле
                                    выше и нажмите Enter.
                                </p>
                                <Link to="/main" className="astra-btn-ghost astra-press">
                                    В каталог
                                </Link>
                            </div>
                        ) : showSkeletons ? (
                            <div className="srch-grid" aria-hidden="true">
                                {Array.from({ length: SKELETON_CARDS }).map((_, i) => (
                                    <div key={i} className="srch-skel astra-skeleton" />
                                ))}
                            </div>
                        ) : loading ? (
                            /* ответ ещё в пути, но укладывается в бюджет ожидания:
                               держим место молча, без серых плиток */
                            <div className="srch-hold" aria-hidden="true" />
                        ) : error ? (
                            <div className="srch-state" role="alert">
                                <p className="srch-state-title">Поиск не удался</p>
                                <p className="srch-state-text srch-state-text--error">{error}</p>
                                <button
                                    type="button"
                                    className="astra-btn-ghost astra-press"
                                    onClick={() => setRetryKey((k) => k + 1)}
                                >
                                    Повторить
                                </button>
                            </div>
                        ) : showEmpty ? (
                            <div className="srch-state">
                                <p className="srch-state-title">Ничего не найдено</p>
                                <p className="srch-state-text">
                                    По запросу «{safeQuery}» товаров нет. Попробуйте короче или
                                    другое слово.
                                </p>
                                <Link to="/main" className="astra-btn-ghost astra-press">
                                    В каталог
                                </Link>
                            </div>
                        ) : (
                            <div className="srch-grid">
                                {/* ключ — только id: подмешанный запрос менял ключ на
                                    каждую букву, карточки перемонтировались и reveal
                                    заново гасил их в прозрачность */}
                                {items.map((item, i) => (
                                    <ResultCard
                                        key={item.id}
                                        item={item}
                                        index={i}
                                        onOpen={openProduct}
                                        pending={pendingProductId === item.id}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {skelExit && (
                        <div className="srch-grid srch-skel-layer" aria-hidden="true">
                            {Array.from({ length: SKELETON_CARDS }).map((_, i) => (
                                <div key={i} className="srch-skel astra-skeleton" />
                            ))}
                        </div>
                    )}
                    {showResults && pages > 1 && (
                        <Pagination
                            page={page}
                            pages={pages}
                            total={total}
                            pageSize={PAGE_SIZE}
                            loading={loading}
                            onPageChange={setPage}
                        />
                    )}
                </div>
            </div>

            <EdgeBlur />

            {modal}
        </div>
    );
};

export default SearchPage;
