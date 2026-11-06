import { useEffect, useRef, useState } from "react";

/**
 * Моторика v3 (философия Block Market): reveal-once-on-scroll.
 * Хук вешает .is-revealed один раз при первом попадании в вьюпорт;
 * парный класс — .astra-reveal (astra-theme.css). Ничего не реиграет.
 */
export function useRevealOnce() {
    const ref = useRef(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (typeof IntersectionObserver === "undefined") {
            el.classList.add("is-revealed");
            return;
        }
        const io = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        el.classList.add("is-revealed");
                        io.disconnect();
                    }
                }
            },
            { threshold: 0.1, rootMargin: "0px 0px -8% 0px" }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    return ref;
}

/** Стаггер: 60мс на элемент, максимум 6 (бюджет моторики). */
export function revealDelay(index) {
    return { "--reveal-delay": `${Math.min(index, 5) * 60}ms` };
}

/**
 * Политика скелетонов (владелец, раунд 6): скелетон — это НЕ обязательный
 * этап загрузки, а сигнал «данные задерживаются». Если ответ пришёл быстро
 * (или лежал в кэше), пользователь не должен увидеть серые плитки вовсе —
 * контент просто появляется своей обычной анимацией.
 *
 * Возвращает true, только если загрузка длится дольше `delay`.
 * @param {boolean} loading
 * @param {number} delay мс до показа скелетона
 */
export function useDelayedPending(loading, delay = 260) {
    const [pending, setPending] = useState(false);

    useEffect(() => {
        if (!loading) {
            setPending(false);
            return undefined;
        }
        const t = setTimeout(() => setPending(true), delay);
        return () => clearTimeout(t);
    }, [loading, delay]);

    return pending;
}

export function prefersReducedMotion() {
    return (
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}
