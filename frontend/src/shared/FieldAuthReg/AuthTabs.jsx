import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./authTabs.css";

/**
 * Переключатель способа входа / шага регистрации.
 *
 * Под активной вкладкой едет ОДИН розовый индикатор (transform + width,
 * 300мс, единственная кривая --astra-ease) — не две мигающие заливки.
 * Подпись активной вкладки — белые чернила --astra-on-pink на
 * --astra-pink-fill (4.74:1). Ряд не переносится: при нехватке ширины
 * он скроллится внутри себя, страница по горизонтали не едет.
 *
 * items: [{ value, label, disabled?, title? }]
 */
export const AuthTabs = ({ label, value, onChange, items = [] }) => {
    const trackRef = useRef(null);
    const btnRefs = useRef({});
    const [bubble, setBubble] = useState({ x: 0, w: 0, ready: false });

    const measure = useCallback(() => {
        const el = btnRefs.current[value];
        if (!el) return;
        setBubble((prev) => {
            const next = { x: el.offsetLeft, w: el.offsetWidth, ready: true };
            if (prev.ready && prev.x === next.x && prev.w === next.w) return prev;
            return next;
        });
    }, [value]);

    useLayoutEffect(() => {
        measure();
    }, [measure, items.length]);

    /* Шрифт Unbounded/Golos догружается после первой отрисовки и меняет
       ширину подписей — переизмеряем, иначе индикатор встаёт мимо. */
    useEffect(() => {
        let alive = true;
        const fonts = typeof document !== "undefined" ? document.fonts : null;
        if (fonts?.ready?.then) {
            fonts.ready.then(() => {
                if (alive) measure();
            });
        }
        return () => {
            alive = false;
        };
    }, [measure]);

    useEffect(() => {
        const track = trackRef.current;
        if (!track || typeof ResizeObserver === "undefined") return undefined;
        const ro = new ResizeObserver(() => measure());
        ro.observe(track);
        return () => ro.disconnect();
    }, [measure]);

    useEffect(() => {
        if (typeof window === "undefined") return undefined;
        const onResize = () => measure();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [measure]);

    return (
        <div className="astra-auth-tabs" role="group" aria-label={label}>
            <div className="astra-auth-tabtrack" ref={trackRef}>
                <span
                    className={`astra-auth-tabbubble${bubble.ready ? " is-ready" : ""}`}
                    style={{ transform: `translateX(${bubble.x}px)`, width: `${bubble.w}px` }}
                    aria-hidden="true"
                />
                {items.map((item) => {
                    const isActive = item.value === value;
                    return (
                        <button
                            key={item.value}
                            type="button"
                            ref={(el) => {
                                btnRefs.current[item.value] = el;
                            }}
                            className={`astra-auth-tab${isActive ? " is-active" : ""}`}
                            aria-pressed={isActive}
                            disabled={Boolean(item.disabled)}
                            title={item.title || undefined}
                            onClick={() => {
                                if (item.disabled || isActive) return;
                                onChange?.(item.value);
                            }}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default AuthTabs;
