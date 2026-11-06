import React, { useEffect, useRef, useState } from "react";
import "./slidingNumber.css";

/**
 * SlidingNumber — «барабаны» цифр (философия SlidingNumber из Block Market,
 * чистый CSS-transform). Каждая позиция — колонка 0-9: активная цифра
 * подъезжает transform'ом, проявляется (opacity) и выходит из размытия,
 * соседние по барабану остаются приглушёнными — цифра не просто едет, она
 * появляется и растворяется. При смене всего значения строка коротко
 * всплывает целиком. tabular-nums держит ширину.
 *
 * Барабаны aria-hidden, значение озвучивается скрытой строкой.
 *
 * @param {{ value: string|number, className?: string }} props
 */
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export const SlidingNumber = ({ value, className = "" }) => {
    const str = String(value);
    const [changing, setChanging] = useState(false);
    const prevRef = useRef(str);
    const timerRef = useRef(null);

    useEffect(() => {
        if (prevRef.current === str) return undefined;
        prevRef.current = str;
        clearTimeout(timerRef.current);
        /* Снимаем класс и ставим заново на следующем кадре: React гасит
           повторный setState(true), и при быстрых кликах степпера анимация
           больше не перезапускалась. */
        setChanging(false);
        const raf = requestAnimationFrame(() => setChanging(true));
        timerRef.current = setTimeout(() => setChanging(false), 300);
        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(timerRef.current);
        };
    }, [str]);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    return (
        <span className={`fx-slidenum ${changing ? "is-changing " : ""}${className}`}>
            <span className="fx-slidenum-sr">{str}</span>
            {str.split("").map((ch, i) =>
                /\d/.test(ch) ? (
                    <span className="fx-slidenum-slot" key={i} aria-hidden="true">
                        <span
                            className="fx-slidenum-reel"
                            style={{ transform: `translateY(-${Number(ch)}em)` }}
                        >
                            {DIGITS.map((d) => (
                                <span
                                    className={
                                        "fx-slidenum-digit" + (d === ch ? " is-current" : "")
                                    }
                                    key={d}
                                >
                                    {d}
                                </span>
                            ))}
                        </span>
                    </span>
                ) : (
                    <span className="fx-slidenum-sym" key={i} aria-hidden="true">
                        {ch === " " ? " " : ch}
                    </span>
                )
            )}
        </span>
    );
};

export default SlidingNumber;
