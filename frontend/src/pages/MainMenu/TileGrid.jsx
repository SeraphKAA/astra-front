import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { normalizeMediaUrl } from "../../shared/commonApi";
import { getCategoryDisplayName } from "../../entities/product/mainCategoryLabels";
import AstraAvatar from "../../shared/brand/AstraAvatar";
import TextSwap from "../../shared/fx/TextSwap";
import { useRevealOnce, revealDelay, prefersReducedMotion } from "../../shared/fx/motionUtils";

export const AVATAR_VARIANTS = ["pink", "red", "violet"];

export const pickAvatarVariant = (id) => {
  const s = String(id ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_VARIANTS[Math.abs(h) % AVATAR_VARIANTS.length];
};
/**
 * Квадратная плитка категории: арт заполняет квадрат (радиус 12),
 * подпись под ним. Reveal-once вешается на обёртку ячейки, чтобы
 * transition входа (800мс) не конфликтовал с крисп-нажатием кнопки.
 */
export const CategoryTile = ({ category, index = 0, pending = false, onOpen }) => {
    const [imgError, setImgError] = useState(false);
    const revealRef = useRevealOnce();
    const src = !imgError && category?.image_url ? normalizeMediaUrl(category.image_url) : null;
    const name = getCategoryDisplayName(category?.name);
    /* Категория «скоро»: та же плитка, но с плашкой и без действия.
       status приходит с /categories/... — см. CategoryStatus в модели. */
    const isSoon = category?.status === "soon";

    if (isSoon) {
        return (
            <div className="mm-cell astra-reveal" ref={revealRef} style={revealDelay(index)}>
                <div className="mm-tile mm-tile--soon" aria-disabled="true">
                    <span className="mm-tile-art">
                        {src ? (
                            <img
                                className="mm-tile-img"
                                src={src}
                                alt=""
                                loading="lazy"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <AstraAvatar
                                variant={pickAvatarVariant(category.id)}
                                className="mm-tile-avatar"
                                preserveAspectRatio="xMidYMid slice"
                            />
                        )}
                        <span className="mm-tile-soon">
                            <span className="astra-badge astra-badge--new">Скоро</span>
                        </span>
                    </span>
                    <span className="mm-tile-label text-none">{name}</span>
                </div>
            </div>
        );
    }

    return (
        // существующий return для активных категорий — без изменений
        <div className="mm-cell astra-reveal" ref={revealRef} style={revealDelay(index)}>
            <button
                type="button"
                className={`mm-tile astra-press${pending ? " is-pending" : ""}`}
                aria-busy={pending || undefined}
                onClick={() => onOpen?.(category)}
            >
                <span className="mm-tile-art">
                    {src ? (
                        <img
                            className="mm-tile-img"
                            src={src}
                            alt=""
                            loading="lazy"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <AstraAvatar
                            variant={pickAvatarVariant(category.id)}
                            className="mm-tile-avatar"
                            preserveAspectRatio="xMidYMid slice"
                        />
                    )}
                </span>
                <span className="mm-tile-label text-none">{name}</span>
            </button>
        </div>
    );
};

/* SYNTHETIC — авторская заглушка слота без живой категории: визуально
   завершённая, приглушённая, никуда не ведёт («Скоро», aria-disabled). */
export const SoonTile = ({ title, index = 0 }) => {
    const revealRef = useRevealOnce();
    return (
        <div className="mm-cell astra-reveal" ref={revealRef} style={revealDelay(index)}>
            <div className="mm-tile mm-tile--soon" aria-disabled="true">
                <span className="mm-tile-art">
                    <AstraAvatar
                        variant={AVATAR_VARIANTS[index % AVATAR_VARIANTS.length]}
                        className="mm-tile-avatar"
                        preserveAspectRatio="xMidYMid slice"
                    />
                    <span className="mm-tile-soon">
                        <span className="astra-badge astra-badge--new">Скоро</span>
                    </span>
                </span>
                <span className="mm-tile-label text-none">{title}</span>
            </div>
        </div>
    );
};

export const TileGridSkeleton = ({ count = 8 }) => (
    <div className="mm-grid" aria-hidden="true">
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="mm-tile-skel">
                <span className="mm-tile-skel-art astra-skeleton" />
                <span className="mm-tile-skel-label astra-skeleton" />
            </div>
        ))}
    </div>
);

/* Длительность кросс-фейда = --astra-t-move (300мс). */
const SWAP_MS = 300;

/**
 * Кросс-фейд честен, только когда обе стороны укладываются в одно
 * движение. Reveal-once (--astra-t-enter, 800мс, плюс стаггер до 300мс)
 * в 300мс не укладывается: призрак успевал раствориться раньше, чем
 * проявлялась вторая половина плиток, и «подмена» превращалась в
 * провал в пустоту. Поэтому контент, приехавший ЧЕРЕЗ подмену,
 * считается уже проявленным — появление берёт на себя слой .mm-swap-in.
 *
 * Класс ставится в layout-эффекте, до первого кадра: у только что
 * вставленного узла нет предыдущего стиля, transition не запускается,
 * и плитка сразу непрозрачна. IntersectionObserver внутри useRevealOnce
 * позже поставит тот же класс повторно — это безвредно.
 */
const settleReveals = (node) => {
    if (!node) return;
    node.querySelectorAll(".astra-reveal").forEach((el) => {
        el.style.setProperty("--reveal-delay", "0ms");
        el.classList.add("is-revealed");
    });
};

/**
 * Политика скелетонов (владелец, раунд 6). Скелетон — сигнал «данные
 * задерживаются», а не обязательный этап загрузки:
 *
 *  • пока ожидание короче порога useDelayedPending — на месте контента
 *    ТИХОЕ место, серых плиток нет; быстрый (или кэшированный) ответ
 *    сразу показывает плитки их обычным появлением, без мигания;
 *  • если скелетон всё-таки успел появиться, подмена не рывком: уходящий
 *    серый слой гаснет ПОВЕРХ входящего контента (300мс, одна кривая),
 *    а сам контент проявляется теми же 300мс одним слоем (.mm-swap-in) —
 *    reveal плиток при этом считается отыгранным (см. settleReveals),
 *    иначе половина сетки была бы ещё невидима, когда призрак ушёл;
 *  • тихое ожидание места НЕ резервирует: угадать высоту сетки честно
 *    нельзя, а дыра не того размера хуже её отсутствия.
 *
 * prefers-reduced-motion — мгновенная смена без слоя-призрака.
 */
export const PendingSwap = ({
    loading = false,
    showSkeleton = false,
    skeleton = null,
    className = "",
    children,
}) => {
    const [ghost, setGhost] = useState(false);
    const hadSkeletonRef = useRef(false);
    const wasLoadingRef = useRef(loading);
    const timerRef = useRef(null);
    const contentRef = useRef(null);

    useEffect(() => {
        if (showSkeleton) hadSkeletonRef.current = true;
    }, [showSkeleton]);

    /* useLayoutEffect: слой-призрак должен попасть в ПЕРВЫЙ кадр после
       загрузки, иначе контент успеет мигнуть без него. */
    useLayoutEffect(() => {
        const wasLoading = wasLoadingRef.current;
        wasLoadingRef.current = loading;
        if (!wasLoading || loading) return;
        const hadSkeleton = hadSkeletonRef.current;
        hadSkeletonRef.current = false;
        if (!hadSkeleton || prefersReducedMotion()) return;
        /* до setGhost: контент этого коммита уже в DOM, и он должен быть
           непрозрачным ДО того, как призрак начнёт гаснуть */
        settleReveals(contentRef.current);
        setGhost(true);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setGhost(false), SWAP_MS);
    }, [loading]);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    const cls = `mm-swap${className ? ` ${className}` : ""}`;

    if (loading) {
        return showSkeleton ? (
            <div className={cls}>{skeleton}</div>
        ) : (
            <div className={`${cls} mm-swap--quiet`} aria-hidden="true" />
        );
    }

    return (
        <div className={cls}>
            <div className={ghost ? "mm-swap-in" : undefined} ref={contentRef}>
                {children}
            </div>
            {ghost && (
                <div className="mm-swap-ghost" aria-hidden="true">
                    {skeleton}
                </div>
            )}
        </div>
    );
};

/**
 * Раскрываемая сетка (owner: extendable cards): свёрнутая показывает
 * максимум `limit` плиток; «Показать все (N)» раскрывает с анимацией
 * max-height (300мс, одна кривая), подпись кнопки морфится через TextSwap.
 * Высота анимируется императивно на DOM-узле: state не участвует,
 * reflow между стартовым и целевым значением гарантирует transition.
 */
export const ExpandableTileGrid = ({ children, limit = 12, className = "" }) => {
    const all = React.Children.toArray(children);
    const overflow = all.length > limit;
    const [expanded, setExpanded] = useState(false);
    const clipRef = useRef(null);
    const fromRef = useRef(null);
    const timerRef = useRef(null);

    const visible = expanded || !overflow ? all : all.slice(0, limit);

    const toggle = () => {
        const el = clipRef.current;
        if (el && !prefersReducedMotion()) fromRef.current = el.offsetHeight;
        setExpanded((v) => !v);
    };

    useLayoutEffect(() => {
        const from = fromRef.current;
        fromRef.current = null;
        if (from == null) return;
        const el = clipRef.current;
        if (!el) return;
        const to = el.scrollHeight;
        el.classList.add("is-animating");
        /* явный height: max-height не держит контейнер выше естественной
           высоты — «Свернуть» схлопывалось скачком */
        el.style.height = `${from}px`;
        /* фиксируем стартовую высоту до смены на целевую */
        void el.offsetHeight;
        el.style.height = `${to}px`;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            el.style.height = "";
            el.classList.remove("is-animating");
        }, 340);
    }, [expanded]);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    const gridId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");

    return (
        <div className={`mm-expand${className ? ` ${className}` : ""}`}>
            <div className="mm-expand-clip" ref={clipRef} id={`mm-expand-${gridId}`}>
                <div className="mm-grid">{visible}</div>
            </div>
            {overflow && (
                <div className="mm-more">
                    <button
                        type="button"
                        className="astra-btn-ghost astra-press mm-more-btn"
                        aria-expanded={expanded}
                        aria-controls={`mm-expand-${gridId}`}
                        onClick={toggle}
                    >
                        <TextSwap text={expanded ? "Свернуть" : `Показать все (${all.length})`} />
                    </button>
                </div>
            )}
        </div>
    );
};
