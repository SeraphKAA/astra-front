import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';
import { prefersReducedMotion } from '../../fx/motionUtils';
import './popover.css';

/**
 * ASTRA Popover (v3 «Ash and Signal»).
 *
 * Порт cult-ui-компонента на чистый React 18 + CSS: ни motion/react, ни
 * lucide, ни Tailwind в проекте нет. Сохранены составной API
 * (Root / Trigger / Content / Form / Label / Textarea / Header / Body /
 * Footer / CloseButton / SubmitButton / Button + usePopover), управляемое
 * поле `note` (очищается при закрытии) и контракт `onSubmit(note)`.
 *
 * ГЛАВНЫЙ ЖЕСТ — морф: кнопка ПРЕВРАЩАЕТСЯ в панель. `layoutId` из motion
 * недоступен, поэтому то же самое сделано техникой FLIP: панель монтируется
 * в своём естественном месте, замеряется, мгновенно «сжимается» в
 * прямоугольник триггера и одним переходом transform+opacity (300мс, общая
 * кривая --astra-ease) разворачивается обратно. Закрытие — тот же переход
 * задом наперёд. Внутренний слой контрмасштабируется, поэтому текст в панели
 * не растягивается, а раскрывается из угла триггера. Если замер невозможен
 * (нулевые размеры, скрытый триггер) — мягкая деградация в scale+fade из
 * угла триггера, но НИКОГДА не резкое появление.
 *
 * Доступность: role="dialog" + aria-modal, ловушка фокуса, возврат фокуса
 * триггеру (кроме закрытия щелчком мимо — там фокус остаётся там, куда
 * щёлкнули), aria-expanded на триггере, Escape и клик снаружи закрывают,
 * текстовое поле получает фокус само. Видимого крестика «×» нет по
 * стандартному правилу владельца: PopoverCloseButton — визуально скрытая
 * кнопка «Закрыть», которая проявляется, когда до неё дошли с клавиатуры.
 */

const OPEN_MS = 300;
const CLOSE_MS = 150;

const FOCUSABLE = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'iframe',
    '[contenteditable]:not([contenteditable="false"])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

let popoverSeq = 0;

const cx = (...parts) => parts.filter(Boolean).join(' ');

const PopoverContext = createContext(null);

export function usePopover() {
    const ctx = useContext(PopoverContext);
    if (!ctx) {
        throw new Error('usePopover: компонент должен находиться внутри <PopoverRoot>.');
    }
    return ctx;
}

/* ---------- геометрия морфа (FLIP) ---------- */

const originFor = (side, align) => {
    const x = align === 'end' ? '100%' : align === 'center' ? '50%' : '0%';
    const y = side === 'top' ? '100%' : '0%';
    return `${x} ${y}`;
};

/**
 * Рамка элемента БЕЗ его собственного transform. Инлайновые значения
 * снимаются и возвращаются в том же кадре, поэтому промежуточной отрисовки
 * не происходит: браузер рисует только итог задачи.
 *
 * Переход глушим на время замера: getBoundingClientRect принудительно
 * пересчитывает стиль, и снятие transform при живом transition запустило бы
 * анимацию к 'none', а возврат — обратную. Кадр наружу не попадает, но
 * траектория уходящей панели сбилась бы.
 */
const rectWithoutTransform = (el) => {
    const prevTransform = el.style.transform;
    const prevTransition = el.style.transition;
    el.style.transition = 'none';
    el.style.transform = 'none';
    const r = el.getBoundingClientRect();
    el.style.transform = prevTransform;
    el.style.transition = prevTransition;
    return r;
};

/**
 * Замер: во сколько раз и куда панель должна «сжаться» в источник морфа.
 *
 * Источником может быть НЕ ТОЛЬКО триггер: правка сообщения раскрывается
 * из самого сообщения (см. morphFrom у PopoverRoot). Пузырь и панель лежат
 * в разных ветках разметки, и между ними стоит .message-actions с
 * transform: translateY(-100%). Поэтому мерить по offsetLeft/offsetTop
 * НЕЛЬЗЯ: offset-величины transform не учитывают, и панель стартовала на
 * 53px выше сообщения — размер совпадал, место нет. Берём экранные рамки:
 * трансформации предков входят в них одинаково для обоих элементов и
 * взаимно сокращаются.
 *
 * Собственный transform панели при этом снимается (см. выше): без этого
 * быстрое повторное открытие мерило бы панель посреди уходящего кадра.
 *
 * Допущение: предки двигают, но не масштабируют. Трансформация панели
 * задаётся в её локальных координатах, и при scale у общего предка
 * экранная дельта разошлась бы с локальной.
 */
const measureMorph = (panel, origin) => {
    if (!panel || !origin) return null;
    const p = rectWithoutTransform(panel);
    const o = origin.getBoundingClientRect();
    if (!p.width || !p.height || !o.width || !o.height) return null;
    return {
        dx: o.left - p.left,
        dy: o.top - p.top,
        sx: Math.max(o.width / p.width, 0.05),
        sy: Math.max(o.height / p.height, 0.05),
    };
};

/**
 * Границы, за которые панели выходить нельзя: содержимое ближайшего
 * предка, который умеет обрезать (у ленты сообщений это .chat-messages
 * с overflow-y: auto), иначе — вьюпорт. Нужно затем, чтобы панель,
 * выросшая из кнопки у самого края, не рождала горизонтальную прокрутку.
 */
const clipBoundsOf = (panel) => {
    let el = panel.parentElement;
    while (el && el !== document.body && el !== document.documentElement) {
        const cs = window.getComputedStyle(el);
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
            const r = el.getBoundingClientRect();
            const padLeft = parseFloat(cs.paddingLeft) || 0;
            const padRight = parseFloat(cs.paddingRight) || 0;
            const padTop = parseFloat(cs.paddingTop) || 0;
            const padBottom = parseFloat(cs.paddingBottom) || 0;
            const innerX = r.left + el.clientLeft;
            const innerY = r.top + el.clientTop;
            return {
                left: innerX + padLeft,
                right: innerX + el.clientWidth - padRight,
                top: innerY + padTop,
                bottom: innerY + el.clientHeight - padBottom,
            };
        }
        el = el.parentElement;
    }
    const vw = document.documentElement.clientWidth || window.innerWidth || 0;
    const vh = document.documentElement.clientHeight || window.innerHeight || 0;
    return { left: 0, right: vw, top: 0, bottom: vh };
};

/**
 * Поправка посадки: сбрасываем прошлую, меряем натуральное место панели
 * и, если она вылезла, двигаем её вдоль той же оси, по которой она
 * привязана. Вызывается ДО замера морфа — иначе траектория улетит мимо.
 */
const clampPanel = (panel, align, anchored) => {
    if (anchored) {
        /* Панель уже посажена по якорю через left — сбрасывать его нельзя,
           поправку внесём поверх. */
    } else if (align === 'center') {
        panel.style.marginLeft = '';
    } else if (align === 'start') {
        panel.style.left = '';
    } else {
        panel.style.right = '';
    }

    const bounds = clipBoundsOf(panel);
    if (!(bounds.right > bounds.left)) return;

    const gap = 4;
    const r = panel.getBoundingClientRect();
    if (!r.width) return;

    let shift = 0; /* > 0 — двигаем вправо */
    if (r.left < bounds.left + gap) {
        shift = bounds.left + gap - r.left;
    } else if (r.right > bounds.right - gap) {
        shift = bounds.right - gap - r.right;
    }
    if (!shift) return;

    if (anchored) {
        const base = parseFloat(panel.style.left) || 0;
        panel.style.left = `${base + shift}px`;
    } else if (align === 'center') {
        const base = parseFloat(window.getComputedStyle(panel).marginLeft) || 0;
        panel.style.marginLeft = `${base + shift}px`;
    } else if (align === 'start') {
        panel.style.left = `${shift}px`;
    } else {
        panel.style.right = `${-shift}px`;
    }
};

/**
 * Вертикальная поправка для посаженной по якорю панели. Нужна из-за нижней
 * привязки: панель растёт ВВЕРХ от нижней кромки сообщения, и у самых
 * верхних сообщений ленты она вылезала бы за край прокручиваемого списка.
 * Двигаем по той же оси, что и посадка, — через inline top.
 */
const clampPanelVertical = (panel) => {
    const bounds = clipBoundsOf(panel);
    if (!(bounds.bottom > bounds.top)) return;
    const gap = 4;
    const r = panel.getBoundingClientRect();
    if (!r.height) return;

    let shift = 0;
    if (r.top < bounds.top + gap) {
        shift = bounds.top + gap - r.top;
    } else if (r.bottom > bounds.bottom - gap) {
        shift = bounds.bottom - gap - r.bottom;
    }
    if (!shift) return;

    const base = parseFloat(panel.style.top) || 0;
    panel.style.top = `${base + shift}px`;
};

/**
 * Посадка панели ПО МЕСТУ якоря: панель встаёт туда, где лежит якорь, а не
 * возле триггера. Координаты считаем в системе содержащего блока панели
 * (её offsetParent), поэтому чужие отступы и позиция триггера роли не
 * играют. Допущение то же, что и у замера морфа: предки двигают, но не
 * масштабируют.
 */
const placeAtAnchor = (panel, anchor, side, align) => {
    const cb = panel.offsetParent;
    if (!cb || !anchor) return false;
    const a = anchor.getBoundingClientRect();
    if (!a.width || !a.height) return false;
    const c = cb.getBoundingClientRect();
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;

    const originX = a.left - c.left - cb.clientLeft;
    const originY = a.top - c.top - cb.clientTop;

    let left = originX;
    if (align === 'end') left = originX + a.width - pw;
    else if (align === 'center') left = originX + (a.width - pw) / 2;

    const top = side === 'top' ? originY + a.height - ph : originY;

    /* Правая/нижняя привязка из CSS обязана уступить: иначе панель будет
       растянута между двумя противоположными краями. */
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.marginLeft = '0';
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    return true;
};

/** Кадр «панель = триггер». morph === null — деградация в scale+fade. */
const setStartFrame = (panel, inner, morph, side, align) => {
    if (morph) {
        panel.style.transformOrigin = '0 0';
        panel.style.transform =
            `translate(${morph.dx}px, ${morph.dy}px) scale(${morph.sx}, ${morph.sy})`;
    } else {
        panel.style.transformOrigin = originFor(side, align);
        panel.style.transform = 'scale(0.88)';
    }
    panel.style.opacity = '0';
    if (inner) {
        inner.style.transformOrigin = '0 0';
        inner.style.transform = morph ? `scale(${1 / morph.sx}, ${1 / morph.sy})` : 'none';
        inner.style.opacity = '0';
    }
};

const setRestFrame = (panel, inner) => {
    panel.style.transform = 'none';
    panel.style.opacity = '1';
    if (inner) {
        inner.style.transform = 'none';
        inner.style.opacity = '1';
    }
};

const runEnter = (panel, inner, origin, side, align, anchor) => {
    panel.style.transition = 'none';
    if (inner) inner.style.transition = 'none';
    /* Меряем панель в покое: при быстром повторном открытии на ней ещё
       висит transform уходящего кадра. */
    panel.style.transform = 'none';
    const anchored = anchor ? placeAtAnchor(panel, anchor, side, align) : false;
    clampPanel(panel, align, anchored);
    if (anchored) clampPanelVertical(panel);

    if (prefersReducedMotion()) {
        setRestFrame(panel, inner);
        return;
    }

    const morph = measureMorph(panel, origin);
    setStartFrame(panel, inner, morph, side, align);
    /* Фиксируем стартовый кадр: чтение геометрии заставляет браузер
       пересчитать стиль. Без этого он склеит оба кадра в один и
       перехода не будет вовсе. */
    const forcedReflow = panel.offsetWidth;
    if (forcedReflow < 0) return;

    panel.style.transition =
        `transform ${OPEN_MS}ms var(--astra-ease), opacity ${OPEN_MS}ms var(--astra-ease)`;
    if (inner) {
        inner.style.transition =
            `transform ${OPEN_MS}ms var(--astra-ease), ` +
            `opacity ${Math.round(OPEN_MS * 0.6)}ms var(--astra-ease) ${Math.round(OPEN_MS * 0.3)}ms`;
    }
    setRestFrame(panel, inner);
};

/* Уходящую панель НЕ пересаживаем по якорю: она уже стоит на месте, а
   смена left/top посреди перехода дёрнула бы её скачком. */
const runExit = (panel, inner, origin, side, align) => {
    if (prefersReducedMotion()) {
        panel.style.transition = 'none';
        panel.style.opacity = '0';
        return;
    }
    const morph = measureMorph(panel, origin);
    panel.style.transition =
        `transform ${CLOSE_MS}ms var(--astra-ease), opacity ${CLOSE_MS}ms var(--astra-ease)`;
    if (inner) {
        inner.style.transition =
            `transform ${CLOSE_MS}ms var(--astra-ease), opacity ${CLOSE_MS}ms var(--astra-ease)`;
    }
    setStartFrame(panel, inner, morph, side, align);
};

/* ---------- Root ---------- */

export const PopoverRoot = ({
    children,
    className = '',
    /** Начальное значение управляемого поля; им же оно очищается при закрытии. */
    initialNote = '',
    onOpenChange,
    disabled = false,
    /**
     * Необязательный источник морфа: ref на элемент, ИЗ КОТОРОГО панель
     * раскрывается. По умолчанию это триггер («кнопка превращается в
     * панель»), но правка сообщения должна расти из самого сообщения, а
     * не из карандаша. На фокус и разметку не влияет — только на траекторию.
     */
    morphFrom,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isRendered, setIsRendered] = useState(false);
    const [note, setNote] = useState(initialNote);

    const rootRef = useRef(null);
    const triggerRef = useRef(null);
    const contentRef = useRef(null);

    const isOpenRef = useRef(false);
    const openChangeRef = useRef(onOpenChange);
    const initialNoteRef = useRef(initialNote);
    /* Последнее СООБЩЁННОЕ наружу состояние, а не «я уже разок отработал».
       Флаг «отработал» переживал перемонтирование, которое StrictMode
       разыгрывает в разработке: второй прогон эффекта видел флаг поднятым
       и слал onOpenChange(false) на пустом месте. В чате это будило
       keepActionsAlive, и панель «Изменить/Удалить» висела раскрытой над
       каждым своим сообщением с самой загрузки. */
    const notifiedOpenRef = useRef(false);
    const closeReasonRef = useRef('close');

    isOpenRef.current = isOpen;
    openChangeRef.current = onOpenChange;
    initialNoteRef.current = initialNote;

    const idRef = useRef(null);
    if (idRef.current === null) {
        popoverSeq += 1;
        idRef.current = popoverSeq;
    }

    const ids = useMemo(() => {
        const n = idRef.current;
        return {
            content: `astra-popover-${n}`,
            label: `astra-popover-label-${n}`,
            field: `astra-popover-field-${n}`,
        };
    }, []);

    const open = useCallback(() => {
        if (disabled) return;
        /* Причина прошлого закрытия не должна доживать до следующего:
           иначе после «щёлкнули мимо» фокус не вернулся бы и по Escape. */
        closeReasonRef.current = 'close';
        setNote(initialNoteRef.current || '');
        setIsOpen(true);
    }, [disabled]);

    /* `reason` доезжает до onOpenChange: вызывающей стороне важно
       отличать «закрыли изнутри» (фокус надо вернуть триггеру, а значит
       кнопку нельзя размонтировать) от «щёлкнули мимо». Первым
       аргументом может прилететь событие — тогда причина обычная. */
    const close = useCallback((reason) => {
        closeReasonRef.current = typeof reason === 'string' ? reason : 'close';
        setIsOpen(false);
    }, []);

    const toggle = useCallback(() => {
        if (isOpenRef.current) {
            close();
        } else {
            open();
        }
    }, [open, close]);

    /* Панель живёт в разметке чуть дольше состояния: нужен обратный морф. */
    useEffect(() => {
        if (isOpen) {
            setIsRendered(true);
            return undefined;
        }
        if (!isRendered) return undefined;
        const ms = prefersReducedMotion() ? 0 : CLOSE_MS;
        const timer = window.setTimeout(() => setIsRendered(false), ms);
        return () => window.clearTimeout(timer);
    }, [isOpen, isRendered]);

    /* Поле очищается ровно тогда, когда панель ушла с экрана. */
    useEffect(() => {
        if (isRendered) return;
        setNote(initialNoteRef.current || '');
    }, [isRendered]);

    /* Сообщаем наружу только НАСТОЯЩУЮ смену: повторный прогон эффекта с тем
       же isOpen обязан быть пустым (идемпотентность). */
    useEffect(() => {
        if (notifiedOpenRef.current === isOpen) return;
        notifiedOpenRef.current = isOpen;
        if (openChangeRef.current) {
            openChangeRef.current(isOpen, isOpen ? 'open' : closeReasonRef.current);
        }
    }, [isOpen]);

    /* Клик снаружи закрывает — как в оригинале. */
    useEffect(() => {
        if (!isOpen) return undefined;
        const onPointerDown = (e) => {
            const root = rootRef.current;
            if (!root) return;
            if (root.contains(e.target)) return;
            /* Панель может быть вынесена порталом (см. portalTo): в разметке
               она тогда НЕ внутри root, и щелчок по собственному полю ввода
               считался бы щелчком «мимо» — панель закрывалась бы от попытки
               в неё напечатать. */
            const panel = contentRef.current;
            if (panel && panel.contains(e.target)) return;
            close('outside');
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        return () => document.removeEventListener('pointerdown', onPointerDown, true);
    }, [isOpen, close]);

    const value = useMemo(
        () => ({
            isOpen,
            isRendered,
            open,
            close,
            toggle,
            note,
            setNote,
            rootRef,
            triggerRef,
            contentRef,
            closeReasonRef,
            morphFromRef: morphFrom || null,
            ids,
            disabled,
        }),
        [isOpen, isRendered, open, close, toggle, note, ids, disabled, morphFrom]
    );

    return (
        <PopoverContext.Provider value={value}>
            <div
                ref={rootRef}
                className={cx('astra-popover-root', isOpen && 'is-open', className)}
            >
                {children}
            </div>
        </PopoverContext.Provider>
    );
};

/* ---------- Trigger ---------- */

export const PopoverTrigger = ({
    children,
    className = '',
    labelClassName = '',
    onClick,
    ...rest
}) => {
    const { isOpen, toggle, triggerRef, ids, disabled } = usePopover();

    return (
        <button
            {...rest}
            type="button"
            ref={triggerRef}
            disabled={disabled || rest.disabled}
            className={cx('astra-popover-trigger', isOpen && 'is-open', className)}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-controls={isOpen ? ids.content : undefined}
            onClick={(e) => {
                if (onClick) onClick(e);
                if (!e.defaultPrevented) toggle();
            }}
        >
            <span className={cx('astra-popover-trigger-label', labelClassName)}>
                {children}
            </span>
        </button>
    );
};

/* ---------- Content (морф + диалог) ---------- */

export const PopoverContent = ({
    children,
    className = '',
    /** 'bottom' — растёт вниз от верхней кромки триггера, 'top' — вверх. */
    side = 'bottom',
    /** 'start' | 'center' | 'end' — по какой стороне триггера выравнивать. */
    align = 'end',
    /**
     * Ref на элемент, НА МЕСТЕ которого встаёт панель (а не рядом с
     * триггером). Правка сообщения занимает место самого пузыря: панель
     * кладётся по его кромке, а не по кромке панели действий.
     */
    anchorTo,
    /**
     * Ref на узел-контейнер, куда панель выносится порталом. Нужен, когда
     * панель обязана жить ВНЕ поддерева триггера: панель действий гаснет
     * целиком (opacity: 0), и панель, лежащая внутри неё, погасла бы вместе.
     */
    portalTo,
    /** Ширина панели: число (px) или любая CSS-длина. */
    width,
    label,
    style,
}) => {
    const { isOpen, isRendered, close, triggerRef, contentRef, closeReasonRef, morphFromRef, ids } =
        usePopover();
    const innerRef = useRef(null);
    const enteredRef = useRef(false);

    /* Источник морфа: заданный вызывающей стороной элемент, иначе триггер.
       Если ref пуст (элемент ещё не смонтирован) — тоже триггер: панель
       обязана открыться в любом случае. */
    const morphOrigin = () =>
        (morphFromRef && morphFromRef.current) || triggerRef.current;

    /* Оба направления морфа считаем ДО отрисовки — стартовый кадр не
       должен мигнуть. Флаг сбрасывается на закрытии, поэтому повторное
       открытие «на полпути» снова проигрывает вход. */
    useLayoutEffect(() => {
        const panel = contentRef.current;
        if (!isRendered || !panel) {
            enteredRef.current = false;
            return;
        }
        if (isOpen) {
            if (enteredRef.current) return;
            enteredRef.current = true;
            runEnter(
                panel,
                innerRef.current,
                morphOrigin(),
                side,
                align,
                anchorTo ? anchorTo.current : null
            );
            return;
        }
        enteredRef.current = false;
        runExit(panel, innerRef.current, morphOrigin(), side, align);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRendered, isOpen, side, align]);

    /* Фокус: автофокус в поле, ловушка на Tab, возврат триггеру. */
    useEffect(() => {
        if (!isRendered || !isOpen) return undefined;
        const panel = contentRef.current;
        if (!panel) return undefined;
        const trigger = triggerRef.current;

        const target =
            panel.querySelector('[data-astra-autofocus]') || panel.querySelector(FOCUSABLE);
        if (target && typeof target.focus === 'function') {
            target.focus({ preventScroll: true });
            const tag = target.tagName;
            if (tag === 'TEXTAREA' && typeof target.setSelectionRange === 'function') {
                const end = target.value ? target.value.length : 0;
                try {
                    target.setSelectionRange(end, end);
                } catch (e) {
                    /* поле не поддерживает выделение — не беда */
                }
            }
        } else {
            panel.focus({ preventScroll: true });
        }

        const onPanelKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                /* Не даём Escape провалиться во внешний диалог. */
                e.stopPropagation();
                close('escape');
                return;
            }
            if (e.key !== 'Tab') return;

            const nodes = Array.prototype.filter.call(
                panel.querySelectorAll(FOCUSABLE),
                (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
            );
            if (nodes.length === 0) {
                e.preventDefault();
                panel.focus({ preventScroll: true });
                return;
            }
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            const active = document.activeElement;

            if (e.shiftKey && (active === first || !panel.contains(active))) {
                e.preventDefault();
                last.focus({ preventScroll: true });
            } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
                e.preventDefault();
                first.focus({ preventScroll: true });
            }
        };

        /* Подстраховка: если фокус всё же ушёл из панели (щелчок мимо
           фокусируемого), Escape обязан работать всё равно. */
        const onDocKeyDown = (e) => {
            if (e.key !== 'Escape') return;
            if (panel.contains(document.activeElement)) return;
            close('escape');
        };

        panel.addEventListener('keydown', onPanelKeyDown);
        document.addEventListener('keydown', onDocKeyDown);

        return () => {
            panel.removeEventListener('keydown', onPanelKeyDown);
            document.removeEventListener('keydown', onDocKeyDown);
            /* Фокус возвращаем триггеру ТОЛЬКО когда панель закрыли изнутри:
               Escape, «Закрыть», отправка формы. Щелчок мимо — это уже выбор
               нового места (соседнее поле, другая кнопка), и отбирать у него
               фокус нельзя: курсор выбрасывало бы обратно на карандаш. */
            /* eslint-disable-next-line react-hooks/exhaustive-deps --
               правило предупреждает, что .current к моменту уборки изменится.
               Здесь это и нужно: причину закрытия ставят ПЕРЕД размонтированием,
               и снимок на входе в эффект (когда причины ещё нет) сделал бы
               проверку бессмысленной. */
            if (closeReasonRef && closeReasonRef.current === 'outside') return;
            if (trigger && typeof trigger.focus === 'function' && document.contains(trigger)) {
                trigger.focus({ preventScroll: true });
            }
        };
    }, [isRendered, isOpen, close, contentRef, triggerRef, closeReasonRef]);

    if (!isRendered) return null;

    const panelStyle = { ...(style || {}) };
    if (width != null) {
        panelStyle['--astra-popover-w'] = typeof width === 'number' ? `${width}px` : width;
    }

    const panel = (
        <div
            ref={contentRef}
            id={ids.content}
            className={cx(
                'astra-popover-panel',
                `astra-popover-panel--${side}`,
                `astra-popover-panel--${align}`,
                className
            )}
            style={panelStyle}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            aria-labelledby={label ? undefined : ids.label}
            tabIndex={-1}
        >
            <div className="astra-popover-inner" ref={innerRef}>
                {children}
            </div>
        </div>
    );

    const host = portalTo ? portalTo.current : null;
    return host ? createPortal(panel, host) : panel;
};

/* ---------- каркас панели ---------- */

export const PopoverHeader = ({ children, className = '' }) => (
    <div className={cx('astra-popover-header', className)}>{children}</div>
);

export const PopoverBody = ({ children, className = '' }) => (
    <div className={cx('astra-popover-body', className)}>{children}</div>
);

export const PopoverFooter = ({ children, className = '' }) => (
    <div className={cx('astra-popover-footer', className)}>{children}</div>
);

/**
 * Заголовок панели — та самая подпись, которая в оригинале «перетекала»
 * из кнопки (layoutId="label"); здесь это перекрёстное затухание.
 * `htmlFor` можно передать `true` — привяжется к полю этого поповера.
 */
export const PopoverLabel = ({ children, className = '', htmlFor }) => {
    const { ids } = usePopover();
    const cls = cx('astra-popover-label', className);
    if (htmlFor) {
        return (
            <label className={cls} id={ids.label} htmlFor={htmlFor === true ? ids.field : htmlFor}>
                {children}
            </label>
        );
    }
    return (
        <span className={cls} id={ids.label}>
            {children}
        </span>
    );
};

/* ---------- форма ---------- */

/**
 * `onSubmit(note)` — контракт оригинала. Отличие одно и оно честное:
 * если обработчик вернул `false` (или промис, разрешившийся в `false`),
 * панель НЕ закрывается — так виден текст ошибки сервера.
 */
export const PopoverForm = ({ children, className = '', onSubmit, closeOnSubmit = true }) => {
    const { note, close } = usePopover();

    const handleSubmit = (e) => {
        e.preventDefault();
        const result = onSubmit ? onSubmit(note) : undefined;
        if (!closeOnSubmit) return;
        if (result && typeof result.then === 'function') {
            result.then(
                (ok) => {
                    if (ok !== false) close();
                },
                () => {
                    /* обработчик сам показал ошибку — панель остаётся */
                }
            );
            return;
        }
        if (result !== false) close();
    };

    return (
        <form className={cx('astra-popover-form', className)} onSubmit={handleSubmit}>
            {children}
        </form>
    );
};

export const PopoverTextarea = ({ className = '', autoFocus = true, onChange, ...rest }) => {
    const { note, setNote, ids } = usePopover();

    return (
        <textarea
            rows={3}
            {...rest}
            id={rest.id || ids.field}
            className={cx('astra-popover-textarea', 'astra-field', 'astra-no-scrollbar', className)}
            value={note}
            onChange={(e) => {
                setNote(e.target.value);
                if (onChange) onChange(e);
            }}
            data-astra-autofocus={autoFocus ? 'true' : undefined}
        />
    );
};

/* ---------- кнопки ---------- */

export const PopoverButton = ({
    children,
    className = '',
    variant = 'ghost',
    ...rest
}) => (
    <button
        type="button"
        {...rest}
        className={cx('astra-popover-btn', `astra-popover-btn--${variant}`, 'astra-press', className)}
    >
        {children}
    </button>
);

/* .astra-ring: clip-path кнопки съедает outline — кольцо на обёртке */
export const PopoverSubmitButton = ({ children, className = '', ...rest }) => (
    <span className="astra-ring astra-popover-ring">
        <button
            type="submit"
            {...rest}
            className={cx('astra-btn', 'astra-press', 'astra-popover-submit', className)}
        >
            {children}
        </button>
    </span>
);

/**
 * Видимого «×» нет. Это визуально скрытая кнопка «Закрыть»: она в ловушке
 * фокуса и проявляется, когда до неё дошли с клавиатуры.
 */
export const PopoverCloseButton = ({ children = 'Закрыть', className = '', onClick, ...rest }) => {
    const { close } = usePopover();
    return (
        <button
            {...rest}
            type="button"
            className={cx('astra-popover-close', className)}
            onClick={(e) => {
                if (onClick) onClick(e);
                if (!e.defaultPrevented) close();
            }}
        >
            {children}
        </button>
    );
};

const Popover = {
    Root: PopoverRoot,
    Trigger: PopoverTrigger,
    Content: PopoverContent,
    Header: PopoverHeader,
    Body: PopoverBody,
    Footer: PopoverFooter,
    Label: PopoverLabel,
    Form: PopoverForm,
    Textarea: PopoverTextarea,
    Button: PopoverButton,
    SubmitButton: PopoverSubmitButton,
    CloseButton: PopoverCloseButton,
};

export default Popover;
