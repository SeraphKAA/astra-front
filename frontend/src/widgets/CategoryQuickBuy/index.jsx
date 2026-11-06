import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./categoryQuickBuy.css";
import { getCategoryTree } from "../../entities/category/api/categoryApi";
import { getProductsByCategory, getProductById } from "../../entities/product/api/productApi";
import { addToCart } from "../../entities/cart/api/cartApi";
import { addToGuestCart } from "../../entities/cart/model/guestCart";
import { validatePromocode } from "../../entities/promocode/api/promocodeApi";
import { getApiErrorMessage, normalizeMediaUrl } from "../../shared/commonApi";
import { getCategoryDisplayName } from "../../entities/product/mainCategoryLabels";
import { useAuth } from "../../app/auth/AuthContext";
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import { BasketIcon } from "../../shared/svgIcons";
import AstraAvatar from "../../shared/brand/AstraAvatar";
import SlidingNumber from "../../shared/fx/SlidingNumber";
import { lockScroll, unlockScroll } from "../../shared/fx/scrollLock";
import { useDelayedPending } from "../../shared/fx/motionUtils";
import { getCategoryFaqByCategoryId } from "../../entities/faq/api/faqApi";
import { getAllCategoryAdditionalInfo } from "../../entities/categoryAdditionalInfo/api/categoryAdditionalInfoApi";

const useMediaQuery = (query) => {
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
    useEffect(() => {
        const media = window.matchMedia(query);
        const listener = (e) => setMatches(e.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, [query]);
    return matches;
};

const MIN_QTY = 1;
const MAX_QTY = 99;

const CLOSE_MS = 300;

/* Длинные списки в попапе листаются страницами (решение владельца).
   Порог вариантов = 8: две колонки по четыре ряда помещаются в панель без
   роста её высоты; порог плиток = 12 — три ряда сетки обзора. Короткие
   списки пейджер не показывают вовсе. */
const VARIANTS_PAGE_SIZE = 8;
const TILES_PAGE_SIZE = 12;

/* Страница подрезается к границам СПИСКА, а не хранится слепо: список мог
   смениться (другая категория, повторная загрузка) и укоротиться. */
const pageSlice = (list, page, size) => {
    const pageCount = Math.max(1, Math.ceil(list.length / size));
    const safePage = Math.min(Math.max(0, page), pageCount - 1);
    return {
        pageCount,
        safePage,
        items: list.slice(safePage * size, safePage * size + size),
    };
};

/* Нарисованная стрелка вместо символов «‹ ›»: у глифов шрифта своя
   метрика, и в 44px кнопке они садились мимо центра. */
const ChevronIcon = ({ dir }) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <path
            d={dir === "left" ? "M10 3.5L5.5 8L10 12.5" : "M6 3.5L10.5 8L6 12.5"}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        />
    </svg>
);

/* Пейджер: две призрачные кнопки-стрелки 44px и вежливый счётчик между
   ними. Появляется только когда страниц больше одной. */
const CqbPager = ({ page, pageCount, onPage, label }) => {
    if (pageCount <= 1) return null;
    return (
        <nav className="cqb-pager" aria-label={label}>
            <button
                type="button"
                className="astra-btn-ghost astra-press cqb-pager-btn"
                aria-label="Предыдущая страница"
                disabled={page === 0}
                onClick={() => onPage(page - 1)}
            >
                <ChevronIcon dir="left" />
            </button>
            <span className="cqb-pager-info" aria-live="polite">
                {page + 1} из {pageCount}
            </span>
            <button
                type="button"
                className="astra-btn-ghost astra-press cqb-pager-btn"
                aria-label="Следующая страница"
                disabled={page >= pageCount - 1}
                onClick={() => onPage(page + 1)}
            >
                <ChevronIcon dir="right" />
            </button>
        </nav>
    );
};
const ADDED_LABEL_MS = 1200;

/** Ключ, из которого страница корзины читает применённый код. */
const PROMO_STORAGE_KEY = "astra:promocode";

/* Код только ПРОВЕРЕН: /orders/from-cart принимает лишь checkout_profiles,
   промокод в заказ не уходит. Обещать скидку при оформлении нельзя. */
const PROMO_OK_TEXT =
    "Промокод проверен, но к заказу он ещё не применён: показанная скидка — расчёт сервиса промокодов, итоговую сумму определяет оформление";
const PROMO_BAD_TEXT = "Промокод не найден или истёк";
const PROMO_FAIL_TEXT = "Не удалось проверить промокод — попробуйте ещё раз";

const NEUTRAL_DESC = "Выберите вариант — количество и срок настраиваются ниже.";
const BROWSE_DESC = "Выберите подкатегорию — предложения откроются здесь же.";
const EMPTY_DESC = "Пока нет предложений — загляните позже.";
const PRODUCT_FAIL_TEXT = "Не удалось загрузить товар";

const AVATAR_VARIANTS = ["pink", "red", "violet"];

/** Стабильный вариант аватара по id категории (ротация фирменного арта). */
const pickAvatarVariant = (id) => {
    const s = String(id ?? "");
    let h = 0;
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
    return AVATAR_VARIANTS[Math.abs(h) % AVATAR_VARIANTS.length];
};

const clampQty = (value) => Math.min(MAX_QTY, Math.max(MIN_QTY, value));

const round2 = (n) => Math.round(n * 100) / 100;

const toNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const formatPrice = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value ?? "");
    const rounded = Math.round(n * 100) / 100;
    /* Целое — без копеек; дробное — всегда две цифры: «899,1 ₽» читается
       как обрезок, «899,10 ₽» — как деньги. */
    const digits = Number.isInteger(rounded) ? 0 : 2;
    return rounded.toLocaleString("ru-RU", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
};

const hasCyrillic = (s) => typeof s === "string" && /[А-Яа-яЁё]/.test(s);

/** Ответ API мог прийти обёрнутым — достаём сам товар, не выдумывая полей. */
const unwrapProduct = (raw) => {
    if (!raw || typeof raw !== "object") return null;
    if (raw.id != null) return raw;
    if (raw.product && typeof raw.product === "object" && raw.product.id != null) return raw.product;
    return null;
};

const readProductList = (data) => {
    const list = Array.isArray(data?.products)
        ? data.products
        : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data)
                ? data
                : [];
    return list.filter((p) => p && p.id != null);
};

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

/** Дети узла категории — только валидные записи с id (формат не додумываем). */
const readCategoryChildren = (node) =>
    (Array.isArray(node?.children) ? node.children : []).filter((c) => c && c.id != null);

/**
 * Разрешение товара для попапа: полная карточка + соседи по категории.
 * Устойчиво к тому, что на вход дали ОДИН `{ id }` (или просто id):
 *  • getProductById даёт имя/цену/категорию — без него берём то, что пришло;
 *  • соседи подгружаются, только если категория известна, и их провал НЕ
 *    ломает попап — остаётся один товар;
 *  • кликнутый товар всегда есть в списке и всегда предвыбран.
 * @returns {Promise<{product: object, products: object[], error: string}>}
 */
const resolveProductBundle = async (seed) => {
    const base = seed && typeof seed === "object" ? seed : { id: seed };
    const productId = base.id;

    let full = null;
    let fullFailed = false;
    try {
        full = unwrapProduct(await getProductById(productId));
        if (full == null) fullFailed = true;
    } catch {
        fullFailed = true;
    }

    const resolved = { ...base, ...(full || {}), id: full?.id ?? productId };

    const catId = resolved.category_id ?? resolved.categoryId ?? null;
    let siblings = [];
    // !!!
    if (catId != null) {
        try {
            siblings = readProductList(await getProductsByCategory(catId, { page: 1, size: 40 }));
        } catch {
            /* соседей нет — попап отработает одним товаром */
            siblings = [];
        }
    }

    const inList = siblings.some((p) => sameId(p.id, resolved.id));
    const list = inList
        ? siblings.map((p) => (sameId(p.id, resolved.id) ? { ...p, ...resolved } : p))
        : [resolved, ...siblings];

    /* Ни имени, ни цены — показывать нечего: честнее сказать об ошибке,
       чем рисовать пустую пилюлю с «—» вместо суммы. */
    const usable = Boolean(String(resolved.name ?? "").trim()) || toNumber(resolved.price) != null;

    return {
        product: resolved,
        products: list.length > 0 ? list : [resolved],
        error: usable ? "" : fullFailed ? PRODUCT_FAIL_TEXT : "",
    };
};

/**
 * Скидка из ответа /promocode/validate — ТОЛЬКО по явным полям.
 * Формат ответа не гарантирован (мок отдаёт 404), поэтому читаем
 * защитно и, если числа нет, скидку НЕ придумываем.
 * Порядок: процент → итоговая сумма → абсолютная скидка → amount.
 * @returns {{kind: "percent"|"amount", value: number} | null}
 */
const readPromoDiscount = (res, baseTotal) => {
    if (!res || typeof res !== "object") return null;
    if (res.valid === false || res.is_valid === false || res.success === false) return null;

    const base = toNumber(baseTotal);
    if (base == null || base <= 0) return null;

    const percent = toNumber(res.discount_percent ?? res.percent ?? res.discount_percentage);
    if (percent != null && percent > 0 && percent < 100) {
        return { kind: "percent", value: percent };
    }

    /* Итог со скидкой -> АБСОЛЮТНАЯ скидка, а не процент: фиксированные
       «−200 ₽» нельзя пересчитывать от нового количества. */
    const finalAmount = toNumber(
        res.final_amount ?? res.final_amount_rub ?? res.final_price ?? res.amount_with_discount
    );
    if (finalAmount != null && finalAmount >= 0 && finalAmount < base) {
        return { kind: "amount", value: round2(base - finalAmount) };
    }

    const absolute = toNumber(res.discount_amount ?? res.discount_rub ?? res.discount);
    if (absolute != null && absolute > 0 && absolute < base) {
        return { kind: "amount", value: absolute };
    }

    /* «amount» неоднозначен: считаем его итогом со скидкой только если он
       строго меньше базы (эхо исходной суммы отсекается сравнением). */
    const amount = toNumber(res.amount);
    if (amount != null && amount >= 0 && amount < base) {
        return { kind: "amount", value: round2(base - amount) };
    }

    return null;
};

/** Живой пересчёт: количество меняется — итог со скидкой продолжает крутиться. */
const applyDiscount = (total, promo) => {
    if (promo == null || total == null || !Number.isFinite(total)) return null;
    if (promo.kind === "percent") return Math.max(0, round2(total * (1 - promo.value / 100)));
    if (promo.kind === "amount") return Math.max(0, round2(total - promo.value));
    return null;
};

const storePromoCode = (code) => {
    try {
        window.sessionStorage.setItem(PROMO_STORAGE_KEY, code);
    } catch {
        /* приватный режим / отключённое хранилище — попап работает и без него */
    }
};

const clearStoredPromoCode = () => {
    try {
        window.sessionStorage.removeItem(PROMO_STORAGE_KEY);
    } catch {
        /* см. выше */
    }
};


const MinusIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <path d="M3.5 8H12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const PlusIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <path d="M8 3.5V12.5M3.5 8H12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const BackIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <path d="M10 3.5L5.5 8L10 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const HelpIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.8" />
        <path
            d="M7.8 7.6C7.8 6.5 8.6 5.8 9.9 5.8C11.1 5.8 11.9 6.5 11.9 7.4C11.9 8.4 11.3 8.8 10.5 9.3C9.8 9.7 9.5 10.1 9.5 10.9V11.2"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        />
        <circle cx="9.9" cy="14.2" r="1.1" fill="currentColor" />
    </svg>
);

/**
 * Плитка подкатегории внутри попапа — та же грамматика, что на главной
 * (квадратный арт радиуса 12 + подпись под ним). Кнопка, а не ссылка:
 * страниц подкатегорий больше нет, клик уводит на уровень глубже прямо
 * здесь. Зона нажатия — весь квадрат, заведомо больше 44px.
 */
const BrowseTile = ({ node, index = 0, busy = false, onOpen }) => {
    const [imgError, setImgError] = useState(false);
    const src = !imgError && node?.image_main
    ? normalizeMediaUrl(node.image_main)
    : (node?.image_url ? normalizeMediaUrl(node.image_url) : null);
    const label = getCategoryDisplayName(node?.name) || "Категория";

    return (
        <button
            type="button"
            className={"cqb-tile astra-press" + (busy ? " is-pending" : "")}
            aria-busy={busy || undefined}
            onClick={() => onOpen?.(node)}
        >
            <span className="cqb-tile-art">
                {src ? (
                    <img
                        className="cqb-tile-img"
                        src={src}
                        alt=""
                        loading="lazy"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <AstraAvatar
                        variant={AVATAR_VARIANTS[index % AVATAR_VARIANTS.length]}
                        className="cqb-tile-avatar"
                        preserveAspectRatio="xMidYMid slice"
                    />
                )}
            </span>
            <span className="cqb-tile-label">{label}</span>
        </button>
    );
};

/* FAQ приходит СЛОЖЕННЫМ: { faq: { id, category_id, faq: {q: a}, created_at, updated_at } }.
   Иногда (если ручка отдаёт словарь напрямую) — просто { q: a }. Разбираем
   оба варианта и ВСЕГДА отбрасываем DTO-поля: id/category_id/created_at/
   updated_at и вложенный faq — иначе React падает на «объект вместо строки». */
const readFaqEntries = (res) => {
    if (!res || typeof res !== "object") return [];
    const candidates = [res?.faq?.faq, res?.faq, res];
    for (const c of candidates) {
        if (!c || typeof c !== "object" || Array.isArray(c)) continue;
        const entries = Object.entries(c).filter(
            ([k, v]) =>
                String(k).trim() &&
                typeof v === "string" &&
                v.trim() &&
                k !== "faq" &&
                k !== "id" &&
                k !== "category_id" &&
                k !== "created_at" &&
                k !== "updated_at"
        );
        if (entries.length > 0) return entries;
    }
    return [];
};

/* Доп. сведения: массив DTO, одиночный DTO или { additional_info: DTO }
   (ручка /category-faq/by-category/ как раз отдаёт второе). Лишнее
   (чужую категорию, пустой info) отсекаем. */
const readInfoItems = (res, categoryId) => {
    const candidates = [res?.items, res?.additional_info, res];
    let raw = [];
    for (const c of candidates) {
        if (Array.isArray(c)) { raw = c; break; }
        if (c && typeof c === "object" && c.info != null) { raw = [c]; break; }
    }
    return raw.filter(
        (x) =>
            x && String(x.info ?? "").trim() &&
            (x.category_id == null || String(x.category_id) === String(categoryId))
    );
};

const CqbInfoModal = ({ categoryId, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [faqEntries, setFaqEntries] = useState([]);
    const [infoItems, setInfoItems] = useState([]);

    const [isClosing, setIsClosing] = useState(false);
    const closeTimerRef = useRef(null);
    const requestClose = useCallback(() => {
        if (isClosing) return;
        setIsClosing(true);
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(onClose, CLOSE_MS);
    }, [isClosing, onClose]);
    useEffect(() => () => clearTimeout(closeTimerRef.current), []);

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            e.stopPropagation();
            requestClose();
        };
        document.addEventListener("keydown", onKeyDown, true);
        return () => document.removeEventListener("keydown", onKeyDown, true);
    }, [requestClose]);
    /* Скелетоны — сигнал «данные задерживаются», а не обязательный этап:
       быстрый ответ показывается сразу, серых строк никто не увидит
       (тот же useDelayedPending, что уже используют плитки товаров). */
    const showSkeletons = useDelayedPending(loading);

    const overlayPressRef = useRef(false);
    const panelRef = useRef(null);

    useEffect(() => {
        if (categoryId == null) return undefined;
        let alive = true;
        setLoading(true);
        setError("");
        setFaqEntries([]);
        setInfoItems([]);

        Promise.all([
            getCategoryFaqByCategoryId(categoryId).catch(() => null),
            getAllCategoryAdditionalInfo(categoryId).catch(() => null),
        ])
            .then(([faqRes, infoRes]) => {
                if (!alive) return;
                /* Каждая ручка может вернуть обёртку со СВОИМ полем — или
                вообще тот же объект целиком (мок /category-faq/by-category/
                отдаёт и faq, и additional_info разом). Парсеры достают
                нужную часть сами, второй ручке это не мешает. */
                setFaqEntries(readFaqEntries(faqRes));
                const fromInfo = readInfoItems(infoRes, categoryId);
                const fromFaq = readInfoItems(faqRes, categoryId);
                setInfoItems(fromInfo.length > 0 ? fromInfo : fromFaq);
            })
            .catch((e) => {
                if (alive) setError(getApiErrorMessage(e, "Не удалось загрузить информацию"));
            })
            .finally(() => {
                if (alive) setLoading(false);
            });

        return () => {
            alive = false;
        };
    }, [categoryId]);

    useEffect(() => {
        panelRef.current?.focus({ preventScroll: true });
    }, []);

    const hasContent = faqEntries.length > 0 || infoItems.length > 0;

    return (
        <div
            className={`cqb-info-overlay${isClosing ? " cqb-info-overlay--closing" : ""}`}
            onMouseDown={(e) => {
                overlayPressRef.current = e.target === e.currentTarget;
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget && overlayPressRef.current) onClose();
                overlayPressRef.current = false;
            }}
        >
            <div
                className={`cqb-info-panel${isClosing ? " cqb-info-panel--closing" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-label="Информация о категории"
                ref={panelRef}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
            >
                {/* No Visible Close Cross: hidden until a keyboard reaches it
                    (see .cqb-info-close-btn:focus-visible) — a mouse or touch
                    user closes via Escape or a backdrop click, both already
                    handled above. A dedicated class, not the shared
                    .cqb-close-btn, so the outer panel's close button is
                    untouched by this fix. */}
                <button
                    type="button"
                    className="cqb-info-close-btn"
                    onClick={requestClose}
                    aria-label="Закрыть информацию"
                >
                    <span aria-hidden="true">✕</span>
                </button>

                <div className="cqb-info-body">
                    <h2 className="cqb-info-title">Информация</h2>

                    {loading ? (
                        showSkeletons ? (
                            <div className="cqb-skeletons" aria-hidden="true">
                                <span className="astra-skeleton cqb-skel-line" />
                                <span className="astra-skeleton cqb-skel-line" style={{ width: "42%" }} />
                                <span className="astra-skeleton cqb-skel-line" />
                            </div>
                        ) : (
                            /* Ответ ещё может прийти быстро — держим место,
                               но не мигаем серым (см. useDelayedPending выше). */
                            <div className="cqb-hold" aria-hidden="true" />
                        )
                    ) : error ? (
                        <p className="cqb-state-text cqb-state-text--error" role="alert">{error}</p>
                    ) : !hasContent ? (
                        <p className="cqb-state-text">Информация пока не добавлена.</p>
                    ) : (
                        <>
                            {faqEntries.length > 0 && (
                                <section className="cqb-info-section">
                                    <h3 className="cqb-info-subtitle">Вопросы и ответы</h3>
                                    <dl className="cqb-info-faq">
                                        {faqEntries.map(([q, a], i) => (
                                            <div className="cqb-info-faq-item" key={`q-${i}`}>
                                                {/* Порядковый номер вместо угаданной по ключевым
                                                    словам темы — вопрос из бэкенда произвольный,
                                                    без своей категории (см. readFaqEntries выше),
                                                    и эвристика по тексту иногда путала тему (см.
                                                    историю правок); номер не ошибается никогда. */}
                                                <span className="cqb-info-faq-icon" aria-hidden="true">{i + 1}</span>
                                                <div className="cqb-info-faq-text">
                                                    <dt className="cqb-info-q">{q}</dt>
                                                    <dd className="cqb-info-a">{a}</dd>
                                                </div>
                                            </div>
                                        ))}
                                    </dl>
                                </section>
                            )}

                            {infoItems.length > 0 && (
                                <section className="cqb-info-section">
                                    <h3 className="cqb-info-subtitle">Дополнительно</h3>
                                    <ul className="cqb-info-list">
                                        {infoItems.map((item) => (
                                            <li className="cqb-info-list-item" key={item.id}>
                                                {item.info}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * Модалка быстрой покупки. Два режима:
 *  • категория — useQuickBuy().openCategory(category). Внутри режима два
 *    вида: ОБЗОР (у узла есть дети — сетка квадратных плиток, клик уводит
 *    на уровень глубже прямо в попапе) и ПОКУПКА (лист — товары категории
 *    становятся вариантами). Отдельной страницы /category/:id больше нет,
 *    поэтому вся навигация по дереву живёт здесь, в стеке уровней.
 *  • товар — useQuickBuy().openProduct(product): хук уже разрешил товар и
 *    его соседей по категории, попап получает их готовым списком.
 * v3 (round 4): панель — ПЛОТНАЯ пепельная поверхность без liquid glass:
 * стеклянная линза давала зеркальные артефакты по кромке и тяжёлую тень.
 * Затемнение и блюр остаются на оверлее; вход панели — только opacity.
 * Round 5: крестика нет (Esc + клик по фону, скрытая кнопка для клавиатуры),
 * ярлык «В корзину» без морфа, белый текст на розовой заливке, скидка —
 * пурпурная, замок прокрутки без второй пустой полосы.
 * Round 6: обзор подкатегорий + «Назад» с именем родителя, скелетоны только
 * когда данные реально задержались (useDelayedPending).
 */
const CategoryQuickBuy = ({
    category = null,
    product = null,
    initialProducts = null,
    initialSelectedId = null,
    initialError = "",
    onClose,
}) => {
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const { pushToast } = useToast();
    const canViewStatus = isAuthenticated && ['admin', 'moderator', 'seller'].includes(user?.role);

    const isProductMode = product != null;
    const isMobile = useMediaQuery('(max-width: 720px)');

    /* Стек уровней категории: [корень, …, текущий]. Пустой в режиме товара.
       Хранит уже РАЗРЕШЁННЫЕ узлы (с children), чтобы «Назад» не ходил в сеть. */
    const [stack, setStack] = useState(() => (isProductMode || !category ? [] : [category]));
    const [childPendingId, setChildPendingId] = useState(null);
    const drillSeqRef = useRef(0);

    const [products, setProducts] = useState(() => {
        if (!isProductMode) return [];
        const list = Array.isArray(initialProducts) ? initialProducts.filter(Boolean) : [];
        return list.length > 0 ? list : [product];
    });
    const [productsLoading, setProductsLoading] = useState(!isProductMode);
    const [productsError, setProductsError] = useState(() => (isProductMode ? initialError || "" : ""));
    const [reloadTick, setReloadTick] = useState(0);
    const [selectedId, setSelectedId] = useState(() => {
        if (!isProductMode) return null;
        return initialSelectedId != null ? initialSelectedId : product?.id ?? null;
    });
    const [quantity, setQuantity] = useState(MIN_QTY);
    const [adding, setAdding] = useState(false);
    const [justAdded, setJustAdded] = useState(false);
    const [buying, setBuying] = useState(false);
    const [imgError, setImgError] = useState(false);
    /* Длинные списки листаются СТРАНИЦАМИ (решение владельца): у вариантов
       и у плиток подкатегорий свои страницы, обе нулевые на новом уровне. */
    const [variantsPage, setVariantsPage] = useState(0);
    const [tilesPage, setTilesPage] = useState(0);

    /* Промокод: код в поле, занятость кнопки, ошибка, применённый код и
       прочитанная из ответа скидка (может быть null — сумму не выдумываем). */
    const [promoInput, setPromoInput] = useState("");
    const [promoBusy, setPromoBusy] = useState(false);
    const [promoError, setPromoError] = useState("");
    const [appliedCode, setAppliedCode] = useState("");
    const [promoDiscount, setPromoDiscount] = useState(null);
    /* Сумма, ПОД КОТОРУЮ сервис проверил код (см. эффект ниже). */
    const promoCheckedFor = useRef(null);

    const overlayRef = useRef(null);
    const panelRef = useRef(null);
    const tilesRef = useRef(null);
    const overlayPressRef = useRef(false);
    const addedTimerRef = useRef(null);
    const titleId = useId();
    const descId = useId();

    /* Текущий уровень дерева. Есть дети — режим ОБЗОРА; нет — режим ПОКУПКИ. */
    const current = stack.length > 0 ? stack[stack.length - 1] : null;
    const currentId = current?.id ?? null;
    const browseChildren = useMemo(() => readCategoryChildren(current), [current]);
    const isBrowse = !isProductMode && browseChildren.length > 0;

    /* Скелетоны — сигнал «данные задерживаются», а не обязательный этап:
       быстрый ответ показывается сразу, серых плиток никто не увидит. */
    const showSkeletons = useDelayedPending(productsLoading);

    const [isClosing, setIsClosing] = useState(false);
    const closeTimerRef = useRef(null);


    const SWIPE_DEAD_ZONE = 22;
    const SWIPE_RESISTANCE = 0.55;
    const SWIPE_CLOSE_AT = 110;

    const [dragY, setDragY] = useState(0);       // смещение пальцем
    const [isSwiping, setIsSwiping] = useState(false);
    const [swipeClosing, setSwipeClosing] = useState(false); // зафиксировано закрытие
    const swipeDirRef = useRef(0);               // -1 вверх, +1 вниз
    const touchStartRef = useRef({ x: 0, y: 0 });
    /* axis: "y" | "rejected" | null
    captured: "down" | "up" | null — направление, в котором жест ЗАХВАЧЕН.
    Оба поля живут на весь жест и не пересчитываются. */
    const swipeStateRef = useRef({ axis: null, captured: null });
    const isClosingRef = useRef(false);

    const panelClassName = [
        "cqb-panel",
        /* cqb-panel--closing НЕ вешаем при свайпе: его анимация (fade +
        лёгкий scale) перебивает inline-transform и давала «прыжок»
        173px на свайпе вверх. */
        isClosing && !swipeClosing ? "cqb-panel--closing" : "",
        isSwiping ? "is-swiping" : "",
        swipeClosing ? "swipe-close" : "",
    ].filter(Boolean).join(" ");

    const panelStyle = isSwiping
        ? { transform: `translateY(${dragY}px)` }
        : swipeClosing
            ? { transform: `translateY(${swipeDirRef.current * 110}vh)` }
            : undefined;

    const [infoOpen, setInfoOpen] = useState(false);
    const infoPanelRef = useRef(null);

    /* Куда вешать «?»: в режиме товара — категория самого товара,
   в режиме категории — текущий уровень дерева.!!! */
    const handleClose = useCallback(() => {
    if (isClosing) return; // предотвращаем повторный вызов
    setIsClosing(true);
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
        onClose();
    }, CLOSE_MS);
    }, [isClosing, onClose]);

    const handleMouseDown = (e) => {
        overlayPressRef.current = e.target === e.currentTarget;
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget && overlayPressRef.current) {
            handleClose();
        }
        overlayPressRef.current = false;
    };

    const getScroller = () => {
        const body = panelRef.current?.querySelector(".cqb-body");
        if (body && body.scrollHeight > body.clientHeight + 1) return body;
        return overlayRef.current;
    };

    const handleTouchStart = (e) => {
        if (isClosingRef.current) return;
        const t = e.touches[0];
        touchStartRef.current = { x: t.clientX, y: t.clientY };
        swipeStateRef.current = { axis: null, captured: null };
        setDragY(0);
    };

    const handleTouchMove = (e) => {
        if (isClosingRef.current) return;
        const t = e.touches[0];
        const dx = t.clientX - touchStartRef.current.x;
        const dy = t.clientY - touchStartRef.current.y;
        const state = swipeStateRef.current;

        /* Ось и направление захвата фиксируются ОДИН РАЗ. Горизонталь
        отброшена полностью: касание с преобладающим X не даёт попапу
        никакой реакции. */
        if (state.axis === null) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            if (Math.abs(dy) <= Math.abs(dx)) {
                state.axis = "rejected";
                return;
            }
            const scroller = getScroller();
            if (!scroller) {
                state.axis = "rejected";
                return;
            }
            const canScroll = scroller.scrollHeight > scroller.clientHeight + 1;
            const atTop = !canScroll || scroller.scrollTop <= 0;
            const atBottom =
                !canScroll ||
                scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
            /* Захватываем жест только если палец ИЗНАЧАЛЬНО идёт от края. */
            if (dy > 0 && atTop) state.captured = "down";
            else if (dy < 0 && atBottom) state.captured = "up";
            else state.captured = null;
            state.axis = "y";
        }

        if (state.axis !== "y" || !state.captured) return;

        /* Мёртвая зона: палец движется, панель ещё стоит. */
        const abs = Math.abs(dy);
        if (abs <= SWIPE_DEAD_ZONE) {
            if (isSwiping) setDragY(0);
            return;
        }

        e.preventDefault();
        setIsSwiping(true);

        /* Смещение ведём ВСЕГДА от начала жеста, а не «накоплением», —
        поэтому возврат пальца к старту честно возвращает панель на
        место, и отпускание больше не закрывает попап против воли. */
        const signed = dy - Math.sign(dy) * SWIPE_DEAD_ZONE;
        const damped = signed * SWIPE_RESISTANCE;

        if (state.captured === "down") {
            setDragY(Math.max(0, Math.min(240, damped)));
        } else {
            setDragY(Math.min(0, Math.max(-240, damped)));
        }
    };

    const handleTouchEnd = () => {
        const state = swipeStateRef.current;
        swipeStateRef.current = { axis: null, captured: null };

        if (!isSwiping) {
            setDragY(0);
            return;
        }

        if (Math.abs(dragY) >= SWIPE_CLOSE_AT) {
            /* Порядок строго такой: сначала фиксируем направление и включаем
            swipeClosing, потом снимаем isSwiping — тогда transition
            стартует от ТЕКУЩЕГО положения пальца, а не от нуля. И только
            после этого дёргаем handleClose: оверлей гаснет в такт,
            а панель едет своим transform, без конкурирующей анимации. */
            swipeDirRef.current = dragY > 0 ? 1 : -1;
            setIsSwiping(false);
            setSwipeClosing(true);
            handleClose();
        } else {
            /* Не дотянули — панель плавно возвращается. */
            setDragY(0);
            setIsSwiping(false);
        }
    };

    /* Сброс покупательской части при смене уровня: количество, промокод и
       список вариантов принадлежат КОНКРЕТНОЙ категории. */
    const resetBuyState = useCallback(() => {
        clearTimeout(addedTimerRef.current);
        setProducts([]);
        setSelectedId(null);
        setProductsError("");
        setQuantity(MIN_QTY);
        setImgError(false);
        setJustAdded(false);
        setPromoInput("");
        setPromoError("");
        setAppliedCode("");
        setPromoDiscount(null);
        promoCheckedFor.current = null;
        setVariantsPage(0);
        clearStoredPromoCode();
    }, []);
    
    /* Уровень глубже: дети приходят только своим запросом дерева. Если он
       упал — считаем узел листом и пробуем товары: тупика не остаётся,
       ошибку покажет уже блок предложений. */
    const openChild = useCallback(
        async (child) => {
            const childId = child?.id;
            if (childId == null) return;
            const seq = ++drillSeqRef.current;
            setChildPendingId(childId);
            let node = null;
            try {
                node = await getCategoryTree(childId);
            } catch {
                node = null;
            }
            if (seq !== drillSeqRef.current) return;
            const merged = {
                ...(child && typeof child === "object" ? child : {}),
                ...(node && typeof node === "object" ? node : {}),
                id: childId,
            };
            resetBuyState();
            setTilesPage(0);
            setProductsLoading(true);
            setChildPendingId(null);
            setStack((s) => [...s, merged]);
        },
        [resetBuyState]
    );

    /* «Назад» — на уровень выше; заодно отменяет незавершённый переход вглубь. */
    const goBack = useCallback(() => {
        drillSeqRef.current += 1;
        setChildPendingId(null);
        resetBuyState();
        setTilesPage(0);
        setProductsLoading(false);
        setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    }, [resetBuyState]);

    /* Товары категории = «варианты» в попапе. В обзоре не грузим ничего:
       у узла с детьми своих предложений нет. */
    useEffect(() => {
        if (isProductMode || isBrowse) return undefined;
        if (currentId == null) return undefined;
        let alive = true;
        setProductsLoading(true);
        setProductsError("");
        getProductsByCategory(currentId, { page: 1, size: 50 })
            .then((data) => {
                if (!alive) return;
                const list = readProductList(data);
                setProducts(list);
                setSelectedId(list[0]?.id ?? null);
            })
            .catch((e) => {
                if (!alive) return;
                setProducts([]);
                setProductsError(getApiErrorMessage(e, "Не удалось загрузить предложения"));
            })
            .finally(() => {
                if (alive) setProductsLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [isProductMode, isBrowse, currentId, reloadTick]);

    /* Режим товара: «Повторить» перезапрашивает карточку и соседей.
       Первый показ уже разрешён хуком, поэтому tick === 0 пропускаем. */
    useEffect(() => {
        if (!isProductMode || reloadTick === 0) return undefined;
        let alive = true;
        setProductsLoading(true);
        setProductsError("");
        resolveProductBundle(product)
            .then((bundle) => {
                if (!alive) return;
                setProducts(bundle.products);
                setSelectedId(bundle.product?.id ?? null);
                setProductsError(bundle.error);
            })
            .catch((e) => {
                if (alive) setProductsError(getApiErrorMessage(e, PRODUCT_FAIL_TEXT));
            })
            .finally(() => {
                if (alive) setProductsLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [isProductMode, product, reloadTick]);

    /* Смена уровня: список плиток прокручиваем в начало и возвращаем фокус
       в панель — иначе он остаётся на исчезнувшей плитке и «улетает» в body. */
    const levelInitRef = useRef(true);
    useEffect(() => {
        if (levelInitRef.current) {
            levelInitRef.current = false;
            return;
        }
        if (tilesRef.current) tilesRef.current.scrollTop = 0;
        panelRef.current?.focus({ preventScroll: true });
    }, [currentId]);

    /* Таймер морфа «Добавлено» — прибрать при размонтировании */
    useEffect(() => () => clearTimeout(addedTimerRef.current), []);
    useEffect(() => {
        return () => clearTimeout(closeTimerRef.current);
    }, []);
    /* Блокировка прокрутки — общий замок приложения (shared/fx/scrollLock):
       одна полоса, без горизонтального сдвига, и порядок снятия с другими
       оверлеями не важен. Плюс перенос фокуса в панель и обратно. */
    useEffect(() => {
        const previouslyFocused = document.activeElement;
        lockScroll();
        panelRef.current?.focus({ preventScroll: true });
        return () => {
            unlockScroll();
            if (previouslyFocused && typeof previouslyFocused.focus === "function") {
                previouslyFocused.focus({ preventScroll: true });
            }
        };
    }, []);

    /* Esc закрывает; Tab не выходит за пределы диалога */
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                if (infoOpen) {
                    setInfoOpen(false);
                    return;
                }
                handleClose();
                return;
            }
            if (e.key !== "Tab") return;

            /* Пока открыта вложенная модалка, ловушка держит фокус ВНУТРИ неё,
            а не внутри основной панели. */
            const panel = infoOpen ? infoPanelRef.current : panelRef.current;
            if (!panel) return;
            const focusables = Array.from(
                panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
            ).filter((el) => !el.disabled && el.offsetParent !== null);
            if (focusables.length === 0) {
                e.preventDefault();
                panel.focus();
                return;
            }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const current = document.activeElement;
            const atPanel = current === panel;
            if (e.shiftKey) {
                if (atPanel || current === first || !panel.contains(current)) {
                    e.preventDefault();
                    last.focus();
                }
            } else if (current === last || !panel.contains(current)) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown, true);
        return () => document.removeEventListener("keydown", onKeyDown, true);
    }, [handleClose, infoOpen]);

    const selected = useMemo(
        () => products.find((p) => sameId(p.id, selectedId)) ?? null,
        [products, selectedId]
    );

    /* Страницы длинных списков. «Итого» и выбор живут в полном списке —
       перелистывание НИЧЕГО не сбрасывает, выбранный вариант может лежать
       и на другой странице. */
    const variantsPaged = useMemo(
        () => pageSlice(products, variantsPage, VARIANTS_PAGE_SIZE),
        [products, variantsPage]
    );
    const tilesPaged = useMemo(
        () => pageSlice(browseChildren, tilesPage, TILES_PAGE_SIZE),
        [browseChildren, tilesPage]
    );

    const unitPrice = Number(selected?.price);
    const total = Number.isFinite(unitPrice) ? round2(unitPrice * quantity) : null;

    /* Промокод проверяется ПОД конкретную сумму. Сменили количество или
       выбрали другой вариант — сумма стала другой, и держать на экране
       скидку от суммы, которой сервис не видел, нельзя: абсолютная скидка
       («−200 ₽») на варианте подешевле давала «Итого: 0 ₽» — товар даром,
       которого никто не разрешал. Та же защита стоит в корзине
       (pages/Basket/index.jsx). */
    useEffect(() => {
        if (!appliedCode) return;
        if (total == null) return;
        if (promoCheckedFor.current === total) return;
        promoCheckedFor.current = null;
        setAppliedCode("");
        setPromoDiscount(null);
        clearStoredPromoCode();
        setPromoError("Сумма изменилась — проверьте промокод заново");
    }, [total, appliedCode]);

    /* Итог со скидкой — только когда API вернул читаемое число И код всё ещё
       относится к текущей сумме. */
    const discountedTotal = useMemo(() => {
        if (!appliedCode || promoDiscount == null || total == null) return null;
        if (promoCheckedFor.current !== total) return null;
        const next = applyDiscount(total, promoDiscount);
        if (next == null || next >= total) return null;
        return next;
    }, [appliedCode, promoDiscount, total]);

    const liveTotal = discountedTotal != null ? discountedTotal : total;

    const goSignIn = () => {
        pushToast({ type: "info", message: "Войдите, чтобы оформить покупку" });
        navigate("/sign_in");
    };

    /* Гость складывает товары в локальную корзину этой вкладки, а не
       упирается в форму входа: страница /basket открыта всем, и без этой
       записи она никогда бы не наполнилась. Вход требуется только на
       оформлении — там, где он действительно нужен. */
    const addForGuest = () => {
        addToGuestCart({ productId: selected.id, quantity });
        pushToast({ type: "success", message: "Добавлено в корзину" });
        setJustAdded(true);
        clearTimeout(addedTimerRef.current);
        addedTimerRef.current = setTimeout(() => setJustAdded(false), ADDED_LABEL_MS);
    };

    const handleAddToCart = async () => {
        if (!selected || adding || buying) return;
        if (!isAuthenticated) {
            addForGuest();
            return;
        }
        setAdding(true);
        try {
            await addToCart({ productId: selected.id, quantity });
            pushToast({ type: "success", message: "Добавлено в корзину" });
            /* Ярлык кнопки ненадолго становится «Добавлено» — простой текст,
               без посимвольного морфа (round 5, #3); подтверждает тост. */
            setJustAdded(true);
            clearTimeout(addedTimerRef.current);
            addedTimerRef.current = setTimeout(() => setJustAdded(false), ADDED_LABEL_MS);
        } catch (e) {
            if (e?.status === 401) {
                goSignIn();
            } else {
                pushToast({ type: "error", message: getApiErrorMessage(e) });
            }
        } finally {
            setAdding(false);
        }
    };

    /* «Купить сейчас»: кладёт выбранный товар с количеством в корзину
       и ведёт сразу к оформлению — количество не теряется. */
    const handleBuyNow = async () => {
        if (!selected || adding || buying) return;
        if (!isAuthenticated) {
            /* Гостя ведём в его же корзину: там он видит состав заказа и
               уже оттуда входит — «Войти и оформить». */
            addToGuestCart({ productId: selected.id, quantity });
            handleClose();
            navigate("/basket");
            return;
        }
        setBuying(true);
        try {
            await addToCart({ productId: selected.id, quantity });
            navigate("/basket");
        } catch (e) {
            if (e?.status === 401) {
                goSignIn();
            } else {
                pushToast({ type: "error", message: getApiErrorMessage(e) });
            }
            setBuying(false);
        }
    };

    const dropPromo = () => {
        setAppliedCode("");
        setPromoDiscount(null);
        promoCheckedFor.current = null;
        clearStoredPromoCode();
    };

    const handleApplyPromo = async () => {
        if (promoBusy) return;
        const code = promoInput.trim().toUpperCase();
        if (!code || total == null) return;
        setPromoBusy(true);
        setPromoError("");
        try {
            const res = await validatePromocode(code, total);
            const discount = readPromoDiscount(res, total);
            const okFlag =
                res && typeof res === "object" &&
                (res.valid === true || res.is_valid === true || res.success === true);
            if (discount == null && !okFlag) {
                dropPromo();
                setPromoError(PROMO_BAD_TEXT);
                return;
            }
            /* Скидка есть числом — показываем её; нет, но код валиден —
               применяем код без выдуманной суммы (пересчёт при оформлении). */
            setPromoDiscount(discount);
            setAppliedCode(code);
            setPromoInput(code);
            /* Запоминаем сумму, под которую сервис дал ответ: как только она
               изменится, эффект выше снимет код. */
            promoCheckedFor.current = total;
            storePromoCode(code);
        } catch (e) {
            dropPromo();
            const status = Number(e?.status);
            const apiText = getApiErrorMessage(e, "");
            if (hasCyrillic(apiText) && !/^Ошибка\s+\d+$/.test(apiText.trim())) {
                setPromoError(apiText);
            } else if (status >= 400 && status < 500) {
                setPromoError(PROMO_BAD_TEXT);
            } else {
                setPromoError(PROMO_FAIL_TEXT);
            }
        } finally {
            setPromoBusy(false);
        }
    };

    const handleRemovePromo = () => {
        dropPromo();
        setPromoInput("");
        setPromoError("");
    };

    /* В режиме товара шапка следует за ВЫБРАННЫМ вариантом: иначе заголовок
       говорит «3 месяца», пока в корзину уходит «12 месяцев». */
    const shown = isProductMode ? (selected ?? product) : null;
    
    const infoCategoryId =
        isProductMode
            ? (shown?.category_id ?? shown?.categoryId ?? product?.category_id ?? product?.categoryId ?? null)
            : currentId;

    /* Хлебные крошки: путь по стеку без последнего узла — он и есть заголовок. */
    const trail = useMemo(
        () => stack.map((node) => getCategoryDisplayName(node?.name) || "Категория"),
        [stack]
    );

    /* Остаток показываем только у ваучеров с автовыдачей — у остальных
       поле quantity ничего не значит. */
    const isStockTracked = Boolean(
        selected &&
        selected.fulfillment_provider === "desslyhub" &&
        selected.is_auto_delivery &&
        selected.provider_service === "voucher_desslyhub"
    );
    const isOutOfStock = isStockTracked && selected.quantity === 0;

    const canGoBack = !isProductMode && trail.length > 1;
    const parentName = canGoBack ? trail[trail.length - 2] : "";
    const crumbs = trail.length > 1 ? trail.slice(0, -1).join(" / ") : "";

    // const title = (() => {
    //     if (isProductMode) {
    //         return String(shown?.name ?? "").trim() || "Товар";
    //     }
    //     if (!isBrowse && selected) {
    //         return String(selected.name ?? "").trim() || (trail[trail.length - 1] || "Товар");
    //     }
    //     return trail.length > 0 ? trail[trail.length - 1] : "Категория";
    // })();
    const title = (() => {
        if (!isBrowse) {
            const fromProduct = isProductMode ? shown : selected;
            const text =
                typeof fromProduct?.name === "string"
                    ? fromProduct.name.trim()
                    : "";
            if (text) return text;
        }
        const source = isProductMode ? shown : current;
        if (typeof source?.name === "string" && source.name.trim()) {
            return source.name.trim();
        }
        return isBrowse ? BROWSE_DESC : NEUTRAL_DESC;
    })();

    const source = isProductMode ? shown : current;
    // const description =
    //     typeof source?.description === "string" && source.description.trim()
    //         ? source.description.trim()
    //         : isBrowse
    //             ? BROWSE_DESC
    //             : NEUTRAL_DESC;
    const description = (() => {
        if (!isBrowse) {
            const fromProduct = isProductMode ? shown : selected;
            const text =
                typeof fromProduct?.description === "string"
                    ? fromProduct.description.trim()
                    : "";
            if (text) return text;
        }
        const source = isProductMode ? shown : current;
        if (typeof source?.description === "string" && source.description.trim()) {
            return source.description.trim();
        }
        return isBrowse ? BROWSE_DESC : NEUTRAL_DESC;
    })();
    const pickProductImage = (p) =>
        isMobile
            ? (p?.image_mobile ?? p?.image_main ?? p?.image_url ?? p?.image ?? null)
            : (p?.image_desktop ?? p?.image_main ?? p?.image_url ?? p?.image ?? null);

    const rawImage = isProductMode
        ? pickProductImage(shown)
        : isBrowse
            ? (current?.image_main ?? null)
            : (pickProductImage(selected) ?? current?.image_main ?? null);

    const imageUrl = !imgError && rawImage ? normalizeMediaUrl(rawImage) : null;
    const avatarSeed = isProductMode ? shown?.id ?? product?.id : currentId;

    const mediaPending = !imageUrl && productsLoading;

    useEffect(() => {
        setImgError(false);
    }, [rawImage]);

    const cartLabel = adding ? "Добавляем…" : justAdded ? "Добавлено" : "В корзину";
    const promoCanApply = Boolean(promoInput.trim()) && total != null && !promoBusy;

    return (
        <>
            <div
                className={`cqb-overlay ${isClosing ? 'cqb-overlay--closing' : ''}`}
                ref={overlayRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onClick={handleOverlayClick}
            >
                <div
                    className={panelClassName}
                    style={panelStyle}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    aria-describedby={descId}
                    ref={panelRef}
                    tabIndex={-1}
                    onClick={(e) => e.stopPropagation()}
                >
                    {infoCategoryId != null && (
                        <button
                            type="button"
                            className="cqb-help-btn"
                            onClick={() => setInfoOpen(true)}
                            aria-label="Информация о категории"
                            aria-haspopup="dialog"
                            aria-expanded={infoOpen}
                        >
                            <HelpIcon />
                        </button>
                    )}
                    <button
                        type="button"
                        className="cqb-close-btn"
                        onClick={handleClose}
                        aria-label="Закрыть"
                    >
                        <span aria-hidden="true" className="cqb-close-btn-text">✕</span>
                    </button>
                    {/* Видимого крестика нет (решение владельца): окно закрывают
                        Esc и клик по затемнению. Для клавиатуры и скринридеров
                        остаётся ОДНА скрытая кнопка внутри ловушки фокуса; она
                        проявляется, только когда фокус пришёл с клавиатуры —
                        иначе индикатор фокуса было бы негде показать. */}
                    <button type="button" className="cqb-sr-close" onClick={handleClose}>
                        Закрыть
                    </button>

                    <div className="cqb-clip">
                        <div className="cqb-media">
                            {imageUrl ? (
                                <img src={imageUrl} alt="" onError={() => setImgError(true)} />
                            ) : mediaPending ? (
                                /* Тихая пепельная подложка: тот же фон, что у колонки, без
                                «дефолтного» арта. Полоска-скелет не нужна — квадрат всё
                                равно закроется фото через долю секунды. */
                                <span className="cqb-media-hold" aria-hidden="true" />
                            ) : (
                                <AstraAvatar
                                    variant={pickAvatarVariant(avatarSeed)}
                                    className="cqb-avatar"
                                    preserveAspectRatio="xMidYMid slice"
                                />
                            )}
                        </div>

                        <div className="cqb-body astra-grain">
                            {/* «Назад» есть и в обзоре, и в покупке: пользователь мог
                                уйти на два уровня вниз и упереться в лист без
                                предложений — выход наверх должен быть всегда. */}
                            <div className="cqb-head">
                            {canGoBack && (
                                <button
                                    type="button"
                                    className="cqb-back astra-press"
                                    onClick={goBack}
                                    aria-label={`Назад: ${parentName}`}
                                >
                                    <BackIcon />
                                    <span className="cqb-back-label">
                                        Назад
                                        {parentName ? <span className="cqb-back-to"> · {parentName}</span> : null}
                                    </span>
                                </button>
                            )}

                            {crumbs ? <p className="cqb-crumbs">{crumbs}</p> : null}

                                <h2 className="cqb-title" id={titleId}>{title}</h2>
                                <p className="cqb-desc" id={descId}>{description}</p>
                            </div>

                            {isBrowse ? (
                                /* Обзор подкатегорий: те же квадратные плитки, что на
                                главной. Собственная полоса прокрутки скрыта — сетка
                                листается колесом и табом (.astra-no-scrollbar). */
                                <>
                                    {/* key по странице: смена страницы — смена содержимого,
                                        короткое проявление (150мс, только opacity) уместно */}
                                    <div
                                        className="cqb-tiles astra-no-scrollbar"
                                        role="group"
                                        aria-label="Подкатегории"
                                        ref={tilesRef}
                                        key={`tiles-${tilesPaged.safePage}`}
                                    >
                                        {tilesPaged.items.map((child, i) => (
                                            <BrowseTile
                                                key={child.id}
                                                node={child}
                                                index={i}
                                                busy={sameId(child.id, childPendingId)}
                                                onOpen={openChild}
                                            />
                                        ))}
                                    </div>
                                    <CqbPager
                                        page={tilesPaged.safePage}
                                        pageCount={tilesPaged.pageCount}
                                        onPage={setTilesPage}
                                        label="Страницы подкатегорий"
                                    />
                                </>
                            ) : productsLoading ? (
                                showSkeletons ? (
                                    <div className="cqb-skeletons" aria-hidden="true">
                                        <div className="cqb-skel-row">
                                            <span className="astra-skeleton cqb-skel-pill" />
                                            <span className="astra-skeleton cqb-skel-pill" />
                                            <span className="astra-skeleton cqb-skel-pill" />
                                        </div>
                                        <span className="astra-skeleton cqb-skel-line" />
                                        <span className="astra-skeleton cqb-skel-btn" />
                                    </div>
                                ) : (
                                    /* Ответ ещё может прийти быстро — держим место,
                                    но не мигаем серыми плитками. */
                                    <div className="cqb-hold" aria-hidden="true" />
                                )
                            ) : productsError ? (
                                <div className="cqb-state" role="alert">
                                    <p className="cqb-state-text cqb-state-text--error">{productsError}</p>
                                    <button
                                        type="button"
                                        className="astra-btn-ghost astra-press"
                                        onClick={() => setReloadTick((t) => t + 1)}
                                    >
                                        Повторить
                                    </button>
                                </div>
                            ) : products.length === 0 ? (
                                /* Кнопки «Открыть категорию» больше нет: страницы
                                категории не существует, вести некуда. */
                                <div className="cqb-state">
                                    <p className="cqb-state-text">{EMPTY_DESC}</p>
                                </div>
                            ) : (
                                <>
                                    {/* Одна-две позиции — строки во всю ширину; три и
                                        больше — ровная сетка в две колонки. key по
                                        странице — смена содержимого с коротким проявлением. */}
                                    <div
                                        className={
                                            "cqb-options" +
                                            (products.length <= 2 ? " cqb-options--few" : "") +
                                            (products.length <= 3 ? " cqb-options--center" : "")
                                        }
                                        role="group"
                                        aria-label="Варианты"
                                        key={`variants-${variantsPaged.safePage}`}
                                    >
                                        {variantsPaged.items.map((p) => {
                                            const isActive = sameId(p.id, selectedId);
                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    className={"cqb-pill astra-press" + (isActive ? " is-active" : "")}
                                                    aria-pressed={isActive}
                                                    onClick={() => setSelectedId(p.id)}
                                                >
                                                    <span className="cqb-pill-name text-none">{p.name}</span>
                                                    <span className="cqb-pill-price">{formatPrice(p.price)} ₽</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <CqbPager
                                        page={variantsPaged.safePage}
                                        pageCount={variantsPaged.pageCount}
                                        onPage={setVariantsPage}
                                        label="Страницы вариантов"
                                    />
                                    {(isStockTracked || (selected && canViewStatus)) && (
                                    <div className="cqb-meta">
                                    {isStockTracked && (
                                    <div className="cqb-stock">
                                        <span className="cqb-stock-label">В наличии:</span>
                                        <span className={`cqb-stock-value ${selected.quantity === 0 ? 'cqb-stock-value--empty' : ''}`}>
                                        {selected.quantity > 0 ? (
                                            <>
                                            <SlidingNumber value={String(selected.quantity)} />
                                            <span className="cqb-stock-unit"> шт.</span>
                                            </>
                                        ) : 'Нет в наличии'}
                                        </span>
                                    </div>
                                    )}
                                    {selected && canViewStatus && (
                                        <span className={`cqb-status-badge ${selected.is_active ? 'is-active' : 'is-inactive'}`}>
                                            {selected.is_active ? 'Активно' : 'Не активно'}
                                        </span>
                                    )}
                                    </div>
                                    )}

                                    {/* Оформление — липкий низ тела: при длинном списке
                                        вариантов итог и «Купить сейчас» не уезжают. */}
                                    <div className="cqb-checkout">
                                    <div className="cqb-qty-row">
                                        <div className="cqb-qty" role="group" aria-label="Количество">
                                            <button
                                                type="button"
                                                className="cqb-qty-btn astra-press"
                                                aria-label="Уменьшить количество"
                                                disabled={quantity <= MIN_QTY}
                                                onClick={() => setQuantity((q) => clampQty(q - 1))}
                                            >
                                                <MinusIcon />
                                            </button>
                                            <span className="cqb-qty-value" aria-live="polite">{quantity}</span>
                                            <button
                                                type="button"
                                                className="cqb-qty-btn astra-press"
                                                aria-label="Увеличить количество"
                                                disabled={quantity >= MAX_QTY}
                                                onClick={() => setQuantity((q) => clampQty(q + 1))}
                                            >
                                                <PlusIcon />
                                            </button>
                                        </div>
                                        <p className="cqb-total">
                                            <span className="cqb-total-label">Итого:</span>
                                            <span className="cqb-total-nums">
                                                <span className="cqb-total-value" aria-live="polite">
                                                    {liveTotal != null ? (
                                                        <SlidingNumber value={`${formatPrice(liveTotal)} ₽`} />
                                                    ) : (
                                                        "—"
                                                    )}
                                                </span>
                                                {discountedTotal != null && (
                                                    <>
                                                        {/* Скидка носит СВОЙ цвет (пурпур), не розовый
                                                            действия; сумма — разница РЕАЛЬНЫХ чисел,
                                                            ничего не выдумано. */}
                                                        <span
                                                            className="astra-badge astra-badge--drop cqb-total-drop"
                                                            aria-label={`Скидка ${formatPrice(round2(total - discountedTotal))} ₽`}
                                                        >
                                                            −{formatPrice(round2(total - discountedTotal))} ₽
                                                        </span>
                                                        <s className="cqb-total-old">{formatPrice(total)} ₽</s>
                                                    </>
                                                )}
                                            </span>
                                        </p>
                                    </div>

                                    {/* Промокод: сумма скидки берётся ТОЛЬКО из ответа API */}
                                    <div className="cqb-promo">
                                        <div className="cqb-promo-row">
                                            {/* astra-field: фокус поля — нейтральное ясеневое
                                                кольцо, без розовой подсветки (round 5, #16) */}
                                            <input
                                                type="text"
                                                className="cqb-promo-input astra-field"
                                                placeholder="Промокод"
                                                aria-label="Промокод"
                                                autoComplete="off"
                                                spellCheck={false}
                                                maxLength={40}
                                                value={promoInput}
                                                disabled={promoBusy || Boolean(appliedCode)}
                                                onChange={(e) => {
                                                    setPromoInput(e.target.value);
                                                    if (promoError) setPromoError("");
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && !appliedCode && promoCanApply) {
                                                        e.preventDefault();
                                                        handleApplyPromo();
                                                    }
                                                }}
                                            />
                                            {appliedCode ? (
                                                <button
                                                    type="button"
                                                    className="astra-btn-ghost astra-press cqb-promo-btn"
                                                    onClick={handleRemovePromo}
                                                >
                                                    Убрать
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="astra-btn-ghost astra-press cqb-promo-btn"
                                                    onClick={handleApplyPromo}
                                                    disabled={!promoCanApply}
                                                    aria-busy={promoBusy}
                                                >
                                                    {promoBusy ? "Проверяем…" : "Применить"}
                                                </button>
                                            )}
                                        </div>
                                        {promoBusy && <span className="astra-skeleton cqb-promo-skel" aria-hidden="true" />}
                                        {promoError && (
                                            <p className="cqb-promo-note cqb-promo-note--error" role="alert">{promoError}</p>
                                        )}
                                        {!promoError && appliedCode && (
                                            <p className="cqb-promo-note" role="status">{PROMO_OK_TEXT}</p>
                                        )}
                                    </div>

                                    <div className="cqb-actions">
                                        <button
                                            type="button"
                                            className="astra-btn-ghost astra-press cqb-cart-btn"
                                            onClick={handleAddToCart}
                                            disabled={adding || buying || !selected || isOutOfStock}
                                        >
                                            <BasketIcon />
                                            {/* Ярлык — обычный текст: посимвольный морф снят
                                                (round 5, #3). Успех подтверждает тост. */}
                                            <span className="cqb-cart-label">{cartLabel}</span>
                                        </button>
                                        {/* .astra-ring: clip-path кнопки съедает outline —
                                            кольцо фокуса живёт на необрезанной обёртке */}
                                        <span className="astra-ring cqb-buy-ring">
                                            <button
                                                type="button"
                                                className="astra-btn astra-press cqb-buy-btn"
                                                onClick={handleBuyNow}
                                                disabled={adding || buying || !selected || isOutOfStock}
                                            >
                                                {buying ? "Оформляем…" : "Купить сейчас"}
                                            </button>
                                        </span>
                                    </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {infoOpen && infoCategoryId != null && (
                <CqbInfoModal
                    categoryId={infoCategoryId}
                    onClose={() => {
                        setInfoOpen(false);
                        /* возвращаем фокус в основную панель, чтобы Tab
                        не улетал в body после закрытия вложенной */
                        panelRef.current?.focus({ preventScroll: true });
                    }}
                />
            )}
        </>
    );
};

/**
 * Хук быстрой покупки (общий контракт для плиток категорий и карточек товаров).
 * НИКУДА не навигирует: страниц /product/:id и /category/:id больше нет —
 * и товар, и обход дерева категорий живут в попапе.
 *
 * openCategory(category): подтягивает дерево категории и открывает попап.
 *   Есть дети — попап встаёт в режим ОБЗОРА (плитки подкатегорий, клик
 *   уводит глубже там же); лист — сразу вид покупки. Дерево не пришло —
 *   открываем тем, что знаем: попап покажет свою ошибку/пустоту.
 * openProduct(product | id): открывает попап по одному товару. Достаточно
 *   `{ id }` (или голого id): карточка тянется через getProductById, соседи
 *   по категории становятся вариантами с предвыбранным кликнутым товаром,
 *   а провал любого из двух запросов не ломает попап.
 * modal: готовый элемент (или null) — хост размещает его один раз в корне страницы.
 * pendingCategoryId / pendingProductId: то, по чему сейчас идёт решение
 *   (для press-feedback плитки/карточки).
 */
export const useQuickBuy = () => {
    const [active, setActive] = useState(null);
    const [pendingCategoryId, setPendingCategoryId] = useState(null);
    const [pendingProductId, setPendingProductId] = useState(null);
    const seqRef = useRef(0);

    const openCategory = useCallback(async (category) => {
        const seed = category && typeof category === "object" ? category : { id: category };
        const categoryId = seed?.id;
        if (categoryId == null) return;
        const seq = ++seqRef.current;
        setPendingProductId(null);
        setPendingCategoryId(categoryId);
        try {
            let node = null;
            try {
                node = await getCategoryTree(categoryId);
            } catch {
                /* Дерево недоступно — открываем узел как есть: вести некуда,
                   попап сам покажет ошибку загрузки предложений. */
                node = null;
            }
            if (seq !== seqRef.current) return;
            setActive({
                kind: "category",
                category: {
                    ...seed,
                    ...(node && typeof node === "object" ? node : {}),
                    id: categoryId,
                },
            });
        } finally {
            if (seq === seqRef.current) {
                setPendingCategoryId(null);
                setPendingProductId(null);
            }
        }
    }, []);

    const openProduct = useCallback(async (productLike) => {
        const seed = productLike && typeof productLike === "object" ? productLike : { id: productLike };
        const productId = seed?.id;
        if (productId == null) return;
        const seq = ++seqRef.current;
        setPendingCategoryId(null);
        setPendingProductId(productId);
        try {
            const bundle = await resolveProductBundle(seed);
            if (seq !== seqRef.current) return;
            setActive({
                kind: "product",
                product: bundle.product,
                products: bundle.products,
                error: bundle.error,
            });
        } catch (e) {
            if (seq !== seqRef.current) return;
            /* Совсем ничего не разрешилось — открываем попап с честной
               ошибкой и кнопкой «Повторить», а не пустой карточкой. */
            const fallback = { ...seed, id: productId };
            setActive({
                kind: "product",
                product: fallback,
                products: [fallback],
                error: getApiErrorMessage(e, PRODUCT_FAIL_TEXT),
            });
        } finally {
            if (seq === seqRef.current) {
                setPendingProductId(null);
                setPendingCategoryId(null);
            }
        }
    }, []);

    const closeModal = useCallback(() => setActive(null), []);

    let modal = null;
    if (active?.kind === "product") {
        modal = (
            <CategoryQuickBuy
                key={`p-${active.product.id}`}
                product={active.product}
                initialProducts={active.products}
                initialSelectedId={active.product.id}
                initialError={active.error || ""}
                onClose={closeModal}
            />
        );
    } else if (active?.kind === "category") {
        modal = (
            <CategoryQuickBuy
                key={`c-${active.category.id}`}
                category={active.category}
                onClose={closeModal}
            />
        );
    }

    return { openCategory, openProduct, modal, pendingCategoryId, pendingProductId };
};

/** Обратная совместимость: страницы импортируют это имя. */
export const useCategoryQuickBuy = useQuickBuy;

export default CategoryQuickBuy;
