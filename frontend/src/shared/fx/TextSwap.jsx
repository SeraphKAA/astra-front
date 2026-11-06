import React, { useEffect, useRef, useState } from "react";
import "./textSwap.css";

/**
 * TextSwap — анимация смены текста (философия TextMorph из Block Market,
 * реализация на чистом CSS/JS): при изменении `text` старая строка уезжает
 * вверх с блюром, новая въезжает снизу с посимвольным стаггером
 * (шаг 24мс, максимум 8 символов). Под prefers-reduced-motion — мгновенно.
 *
 * @param {{ text: string, as?: string, className?: string }} props
 */
export const TextSwap = ({ text, as: Tag = "span", className = "" }) => {
    const [current, setCurrent] = useState(text);
    const [leaving, setLeaving] = useState(null);
    const timerRef = useRef(null);

    useEffect(() => {
        if (text === current) return;
        const reduce =
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) {
            setCurrent(text);
            return;
        }
        setLeaving(current);
        setCurrent(text);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setLeaving(null), 420);
        return () => clearTimeout(timerRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text]);

    const chars = String(current).split("");

    return (
        <Tag className={`fx-textswap ${className}`} aria-label={String(current)}>
            {leaving != null && (
                <span className="fx-textswap-out" aria-hidden="true">
                    {leaving}
                </span>
            )}
            <span className="fx-textswap-in" aria-hidden="true">
                {chars.map((ch, i) => (
                    <span
                        key={`${current}-${i}`}
                        className="fx-textswap-ch"
                        style={{ "--fx-d": `${Math.min(i, 7) * 24}ms` }}
                    >
                        {ch === " " ? " " : ch}
                    </span>
                ))}
            </span>
        </Tag>
    );
};

export default TextSwap;
