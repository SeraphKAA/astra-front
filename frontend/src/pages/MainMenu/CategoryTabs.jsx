import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import TextSwap from "../../shared/fx/TextSwap";
import { prefersReducedMotion } from "../../shared/fx/motionUtils";
import SteamTopUp from "./SteamTopUp";
import {
    CategoryTile,
    SoonTile,
    TileGridSkeleton,
    ExpandableTileGrid,
    PendingSwap,
} from "./TileGrid";
import SteamGift from "./SteamGift";
import IndividualOrder from "./IndividualOrder";
/**
 * Единый таббед-блок «Категории» (линейность astrashop.app/menu):
 * ряд вкладок с ОДНИМ скользящим розовым «пузырём» (transform+width,
 * 300мс, одна кривая), под рядом — приглушённая строка-описание через
 * TextSwap, ниже — контент активной вкладки с direction-aware
 * переходом (философия DirectionAwareTabs): уходящая панель уезжает
 * на ±24px по направлению движения с fade+blur 4px, входящая — с
 * противоположной стороны; высота контейнера анимируется ЯВНЫМ height
 * (max-height не удерживает контейнер выше естественной высоты — сжатие
 * схлопывалось скачком). prefers-reduced-motion — мгновенная смена без
 * оверлеев.
 *
 * Панели остаются смонтированными (hidden) — состояние «Показать все»,
 * сумма Steam и reveal-once плиток переживают переключения и не
 * реиграют.
 */
export const TABS = [
    {
        key: "featured",
        label: "Популярное",
        desc: "Витрина магазина — что мы советуем прямо сейчас",
    },
    { key: "games", label: "Игры", desc: "Любые игры и игровая валюта" },
    { key: "subs", label: "Подписки", desc: "Цифровые сервисы и любые услуги" },
    { key: "ai", label: "Нейросети", desc: " Подписки на любые нейросети" },
    {
        key: "gift",
        label: "Подарочные карты",
        desc: "Карты пополнения и подарочные",
    },
    {
        key: "steam_gift",
        label: "Подарок Steam",
        desc: "Подарочные карты Steam — укажите свой профиль",
        /* flat: панель содержит liquid-glass — вход/выход только opacity,
        как у соседней вкладки «Пополнение Steam». */
        flat: true,
    },
    {
        key: "steam",
        label: "Пополнение Steam",
        desc: "Пополнение баланса аккаунта Steam",
        /* flat: у панели Steam живёт liquid-glass (backdrop-filter) —
           вход/выход без transform и blur, только fade, иначе Chromium
           ломает стекло под анимируемым transform-предком. */
        flat: true,
    },
    {
        key: "individual",
        label: "Индивидуальный заказ",
        desc: "Нужна другая услуга или подписка? Оставьте индивидуальную заявку",
        flat: true,
    },
];

/* SYNTHETIC — подарочные карты, которых в каталоге ещё нет: инертные
   плитки «Скоро», владелец уберёт их, когда категории появятся. */
const GIFT_SOON_TITLES = ["iTunes", "Google Play", "PlayStation Store", "Xbox"];

const keyIndex = (key) => TABS.findIndex((t) => t.key === key);

const CategoryTabs = ({
    active,
    onSelect,
    buckets,
    loading,
    /* Скелетон показываем, только если каталог реально задержался
       (useDelayedPending на стороне страницы) — быстрый ответ идёт
       сразу в обычное появление плиток. */
    showSkeleton = false,
    error,
    onRetry,
    catalogEmpty,
    openCategory,
    pendingCategoryId,
}) => {
    /* ---------------- ряд вкладок: скользящий пузырь ---------------- */
    const scrollRef = useRef(null);
    const btnRefs = useRef({});
    const [bubble, setBubble] = useState({ left: 0, width: 0, ready: false });

    const measure = useCallback(() => {
        const btn = btnRefs.current[active];
        if (!btn) return;
        setBubble({ left: btn.offsetLeft, width: btn.offsetWidth, ready: true });
    }, [active]);

    useLayoutEffect(() => {
        measure();
    }, [measure]);

    useEffect(() => {
        let cancelled = false;
        const onResize = () => measure();
        window.addEventListener("resize", onResize);
        /* повторный замер после загрузки шрифтов — ширины кнопок меняются */
        if (typeof document !== "undefined" && document.fonts?.ready) {
            document.fonts.ready.then(() => {
                if (!cancelled) measure();
            });
        }
        return () => {
            cancelled = true;
            window.removeEventListener("resize", onResize);
        };
    }, [measure]);

    /* активная вкладка остаётся видимой внутри горизонтального скролла ряда */
    useEffect(() => {
        const inner = scrollRef.current;
        const btn = btnRefs.current[active];
        if (!inner || !btn) return;
        const pad = 24;
        const left = btn.offsetLeft;
        const right = left + btn.offsetWidth;
        let target = null;
        if (left < inner.scrollLeft + pad) target = left - pad;
        else if (right > inner.scrollLeft + inner.clientWidth - pad) {
            target = right - inner.clientWidth + pad;
        }
        if (target != null) {
            inner.scrollTo({
                left: Math.max(0, target),
                behavior: prefersReducedMotion() ? "auto" : "smooth",
            });
        }
    }, [active]);

    /* клавиатура таблиста: стрелки/Home/End, автоактивация */
    const onKeyDown = (e) => {
        const idx = keyIndex(active);
        let next = null;
        if (e.key === "ArrowRight") next = (idx + 1) % TABS.length;
        else if (e.key === "ArrowLeft") next = (idx - 1 + TABS.length) % TABS.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = TABS.length - 1;
        if (next == null) return;
        e.preventDefault();
        const key = TABS[next].key;
        onSelect(key);
        btnRefs.current[key]?.focus();
    };

    /* ------------- direction-aware смена панелей + высота ------------- */
    const [current, setCurrent] = useState(active);
    const [leaving, setLeaving] = useState(null); // { key, dir }
    const [entering, setEntering] = useState(null); // key панели с классом входа
    const panelsRef = useRef(null);
    const panelRefs = useRef({});
    const fromHeightRef = useRef(null);
    const dirRef = useRef(1);
    const timersRef = useRef([]);

    const clearTimers = () => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
    };

    useLayoutEffect(() => {
        if (active === current) return;
        /* DOM ещё показывает старую панель — фиксируем стартовую высоту */
        const cont = panelsRef.current;
        fromHeightRef.current = cont ? cont.offsetHeight : null;
        dirRef.current = keyIndex(active) > keyIndex(current) ? 1 : -1;
        clearTimers();
        if (prefersReducedMotion()) {
            fromHeightRef.current = null;
            setLeaving(null);
            setEntering(null);
            setCurrent(active);
            return;
        }
        setLeaving({ key: current, dir: dirRef.current });
        setEntering(active);
        setCurrent(active);
    }, [active, current]);

    useLayoutEffect(() => {
        const from = fromHeightRef.current;
        fromHeightRef.current = null;
        if (from == null) return;
        const cont = panelsRef.current;
        const panel = panelRefs.current[current];
        if (!cont || !panel) return;
        const to = panel.offsetHeight;
        cont.classList.add("is-animating");
        /* явный height (не max-height): max-height не удерживает контейнер
           выше естественной высоты, и сжатие схлопывалось скачком */
        cont.style.height = `${from}px`;
        /* reflow: стартовое значение должно попасть в стиль до целевого */
        void cont.offsetHeight;
        cont.style.height = `${to}px`;
        timersRef.current.push(
            setTimeout(() => {
                cont.style.height = "";
                cont.classList.remove("is-animating");
                setLeaving(null);
                setEntering(null);
            }, 340)
        );
    }, [current]);

    useEffect(
        () => () => {
            timersRef.current.forEach(clearTimeout);
        },
        []
    );

    /* ---------------------- контент вкладок ---------------------- */
    const emptyCatalog = (
        <div className="mm-state">
            <p className="mm-state-text">
                Категории пока не добавлены — каталог скоро наполнится
            </p>
        </div>
    );

    const emptyBucket = (
        <div className="mm-state">
            <p className="mm-state-text">
                В этом разделе пока пусто — категории появятся позже
            </p>
        </div>
    );

    const tilesOf = (items) =>
        items.map((category, i) => (
            <CategoryTile
                key={category.id}
                category={category}
                index={i}
                onOpen={openCategory}
                pending={pendingCategoryId === category.id}
            />
        ));

    const renderTiles = (tab) => {
        switch (tab.key) {
            case "featured": {
                if (catalogEmpty) return emptyCatalog;
                return (
                    <div className="mm-grid">
                        {buckets.featured.map(({ slot, category }, i) =>
                            category ? (
                                <CategoryTile
                                    key={`f-${category.id}`}
                                    category={category}
                                    index={i}
                                    onOpen={openCategory}
                                    pending={pendingCategoryId === category.id}
                                />
                            ) : (
                                /* SYNTHETIC — слот витрины без живого совпадения */
                                <SoonTile key={`soon-${slot.key}`} title={slot.title} index={i} />
                            )
                        )}
                    </div>
                );
            }
            case "games":
            case "subs":
            case "ai": {
                if (catalogEmpty) return emptyCatalog;
                const items = buckets[tab.key];
                if (items.length === 0) return emptyBucket;
                return <ExpandableTileGrid>{tilesOf(items)}</ExpandableTileGrid>;
            }
            case "gift": {
                if (catalogEmpty) return emptyCatalog;
                if (buckets.gift.length === 0) {
                    return (
                        <div className="mm-grid">
                            {/* SYNTHETIC — живых подарочных карт нет */}
                            {GIFT_SOON_TITLES.map((title, i) => (
                                <SoonTile key={title} title={title} index={i} />
                            ))}
                        </div>
                    );
                }
                return <ExpandableTileGrid>{tilesOf(buckets.gift)}</ExpandableTileGrid>;
            }
            default:
                return null;
        }
    };

    const renderPanel = (tab) => {
        if (tab.key === "individual") {
            return <div className="mm-steamwrap"><IndividualOrder /></div>;
        }
        /* Владелец: во вкладке Steam НЕТ плиток — только форма пополнения
           и «Важная информация». Она не зависит от каталога, поэтому ни
           скелетон плиток, ни ошибка категорий её не касаются. Сами
           Steam-категории живут в тематической вкладке «Игры». */
        if (tab.key === "steam_gift") {
            return (
                <div className="mm-steamwrap">
                    <SteamGift />
                </div>
            );
        }
        if (tab.key === "steam") {
            return (
                <div className="mm-steamwrap">
                    <SteamTopUp />
                </div>
            );
        }

        if (error) {
            return (
                <div className="mm-state" role="alert">
                    <p className="mm-state-text">{error}</p>
                    <button
                        type="button"
                        className="astra-btn-ghost astra-press"
                        onClick={onRetry}
                    >
                        Повторить
                    </button>
                </div>
            );
        }

        return (
            <PendingSwap
                loading={loading}
                showSkeleton={showSkeleton}
                skeleton={<TileGridSkeleton count={8} />}
            >
                {renderTiles(tab)}
            </PendingSwap>
        );
    };

    const activeDesc = TABS.find((t) => t.key === active)?.desc || "";

    return (
        <div className="mm-cats">
            <div className="mm-tabrow">
                <div className="mm-tabscroll" ref={scrollRef}>
                    <div
                        className="mm-tabtrack"
                        role="tablist"
                        aria-label="Разделы каталога"
                        onKeyDown={onKeyDown}
                    >
                        <span
                            className={`mm-tabbubble${bubble.ready ? " is-ready" : ""}`}
                            style={{
                                transform: `translateX(${bubble.left}px)`,
                                width: `${bubble.width}px`,
                            }}
                            aria-hidden="true"
                        />
                        {TABS.map((t) => (
                            <button
                                key={t.key}
                                id={`mm-tab-${t.key}`}
                                type="button"
                                role="tab"
                                aria-selected={active === t.key}
                                aria-controls={`mm-panel-${t.key}`}
                                tabIndex={active === t.key ? 0 : -1}
                                ref={(el) => {
                                    btnRefs.current[t.key] = el;
                                }}
                                className={`mm-tabbtn${active === t.key ? " is-active" : ""}`}
                                onClick={() => onSelect(t.key)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <p className="mm-tabdesc">
                <TextSwap text={activeDesc} />
            </p>

            <div className="mm-panels" ref={panelsRef}>
                {TABS.map((t) => {
                    const isCurrent = t.key === current;
                    const isLeaving = leaving?.key === t.key;
                    const cls = [
                        "mm-panel",
                        isCurrent && entering === t.key ? "mm-panel--in" : "",
                        isLeaving ? "mm-panel--out" : "",
                        t.flat ? "mm-panel--flat" : "",
                    ]
                        .filter(Boolean)
                        .join(" ");
                    return (
                        <div
                            key={t.key}
                            id={`mm-panel-${t.key}`}
                            role="tabpanel"
                            aria-labelledby={`mm-tab-${t.key}`}
                            hidden={!isCurrent && !isLeaving}
                            className={cls}
                            style={{ "--mm-dir": isLeaving ? leaving.dir : dirRef.current }}
                            ref={(el) => {
                                panelRefs.current[t.key] = el;
                            }}
                        >
                            {renderPanel(t)}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CategoryTabs;
