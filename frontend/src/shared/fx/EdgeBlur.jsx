import React, { useEffect, useRef } from "react";
import "./EdgeBlur.css";

/**
 * EdgeBlur — прогрессивное размытие у нижней кромки. Пять слоёв
 * backdrop-filter (1/2/3/6/12px), каждый с маской «к верху», поэтому сила
 * размытия нарастает к краю экрана.
 *
 * Приближение к подвалу ГАСИТ эффект: чем ближе низ страницы, тем прозрачнее
 * слой — у самого подвала размытия нет вовсе, и юридические ссылки читаются
 * без помех. Считаем в rAF по скроллу, пишем в CSS-переменную (без ререндеров).
 */
const LAYERS = [1, 2, 3, 6, 12];

/** С какого расстояния до подвала начинаем гасить (px). */
const FADE_START = 320;

const EdgeBlur = () => {
    const ref = useRef(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;

        let raf = 0;
        const update = () => {
            raf = 0;
            const footer = document.querySelector("footer");
            let strength = 1;
            if (footer) {
                const top = footer.getBoundingClientRect().top;
                const distance = top - window.innerHeight; // >0 — подвал ещё ниже экрана
                if (distance <= 0) strength = 0;
                else if (distance < FADE_START) strength = distance / FADE_START;
            }
            const value = Math.max(0, Math.min(1, strength));
            el.style.setProperty("--fx-edgeblur-strength", String(value));
            /* Класс, а не селектор по подстроке стиля: [style*="…: 0"] ловил
               и «0.73», из-за чего затухание было бинарным. */
            el.classList.toggle("is-off", value === 0);
        };

        const schedule = () => {
            if (raf) return;
            raf = requestAnimationFrame(update);
        };

        update();
        /* Страницу прокручивает НЕ документ, а #root (overflow-y: auto).
           scroll на элементе не всплывает и до window не доходит даже в
           фазе перехвата (проверено) — слушаем сам контейнер, а window
           оставляем на случай, если прокрутка вернётся документу. */
        const host = document.getElementById("root");
        if (host) host.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        /* Страница дорастает асинхронно (загрузка списков): без наблюдателя
           значение, снятое на пустом каркасе, застревало до первого скролла. */
        let ro = null;
        if (typeof ResizeObserver !== "undefined") {
            ro = new ResizeObserver(schedule);
            ro.observe(document.body);
        }
        return () => {
            if (raf) cancelAnimationFrame(raf);
            if (ro) ro.disconnect();
            if (host) host.removeEventListener("scroll", schedule);
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
        };
    }, []);

    return (
        <div className="fx-edgeblur" aria-hidden="true" ref={ref}>
            {LAYERS.map((px, i) => (
                <span key={px} className={`fx-edgeblur-layer fx-edgeblur-layer--${i + 1}`} />
            ))}
        </div>
    );
};

export default EdgeBlur;
