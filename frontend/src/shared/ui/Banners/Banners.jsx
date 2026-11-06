import React, { useEffect, useRef, useState } from "react";
import "./Banners.css";
import currencyBanner from "./src/Валюта.jpg";
import subsBanner from "./src/Подписки.jpg";

/* ============================================================
   Banners — промо-карусель над «Категориями».
   Два слайда, автопереключение каждые 15–30 с (случайно),
   бесконечно по кругу. Под картинкой — полоски-индикаторы:
   у активного слайда полоска заливается от 0 до 100% за время
   показа, при переходе заливка сбрасывается и стартует
   следующая полоска.
   ============================================================ */

const SLIDES = [
    { key: "currency", src: currencyBanner, alt: "Валюта",      tab: "games" },
    { key: "subs",     src: subsBanner,     alt: "Подписки",     tab: "ai" },
];

const MIN_MS = 10000;
const MAX_MS = 15000;
const randomMs = () => MIN_MS + Math.random() * (MAX_MS - MIN_MS);

const Banners = ({ className = "", onSelect }) => {
    const [index, setIndex] = useState(0);
    const fillRefs = useRef([]);

    useEffect(() => {
        const duration = randomMs();
        const start = performance.now();
        let raf = 0;

        /* сбрасываем все полоски — и ту, что только что была активной */
        fillRefs.current.forEach((el) => {
            if (el) el.style.transform = "scaleX(0)";
        });

        const step = (now) => {
            const p = Math.min(1, (now - start) / duration);
            const el = fillRefs.current[index];
            if (el) el.style.transform = `scaleX(${p})`;
            if (p >= 1) {
                setIndex((i) => (i + 1) % SLIDES.length);
                return;
            }
            raf = requestAnimationFrame(step);
        };

        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [index]);

    return (
        <div
            className={`mm-banners${className ? ` ${className}` : ""}`}
            role="region"
            aria-roledescription="carousel"
            aria-label="Промо-баннеры"
        >
            <div className="mm-banners-viewport">
                <div
                    className="mm-banners-track"
                    style={{ transform: `translateX(-${index * 100}%)` }}
                >
                    {SLIDES.map((s, i) => {
                        const isActive = i === index;
                        return (
                            <button
                                key={s.key}
                                type="button"
                                className={`mm-banners-slide${isActive ? " is-active" : ""}`}
                                aria-hidden={!isActive}
                                aria-label={`Перейти в раздел «${s.alt}»`}
                                tabIndex={isActive ? 0 : -1}
                                onClick={() => onSelect?.(s.tab)}
                            >
                                <img
                                    className="mm-banners-img"
                                    src={s.src}
                                    alt=""
                                    draggable={false}
                                />
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="mm-banners-dots" aria-label="Переключение баннеров">
                {SLIDES.map((s, i) => (
                    <button
                        key={s.key}
                        type="button"
                        className={`mm-banners-dot${
                            i === index ? " is-active" : ""
                        }`}
                        aria-label={`Баннер ${i + 1}: ${s.alt}`}
                        aria-current={i === index}
                        onClick={() => setIndex(i)}
                    >
                        <span
                            ref={(el) => {
                                fillRefs.current[i] = el;
                            }}
                            className="mm-banners-dot-fill"
                        />
                    </button>
                ))}
            </div>
        </div>
    );
};

export default Banners;