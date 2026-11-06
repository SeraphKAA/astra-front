import React from "react";
import "./liquidGlass.css";

/**
 * Liquid glass (философия liquid-glass-react / rdev, нативная реализация:
 * библиотека требует React 19, проект на React 18 — эффект воссоздан
 * SVG-фильтром). Карта смещения кодирует «линзу»: края панели преломляют
 * фон, центр остаётся честным стеклом.
 *
 * Использование: отрендерить <GlassLensDefs /> один раз (в шапке),
 * поверхностям дать класс .astra-liquid (базовое стекло всегда, линза —
 * прогрессивное улучшение через ::after c backdrop-filter: url()).
 */

/* Карта смещения: R — сдвиг по X, G — по Y; центр нейтрален (#808080),
   края тянут фон внутрь — эффект кромки линзы. */
const LENS_MAP =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>` +
            `<defs>` +
            `<linearGradient id='rx' x1='0' y1='0' x2='1' y2='0'>` +
            `<stop offset='0' stop-color='#ff8080'/><stop offset='0.25' stop-color='#808080'/>` +
            `<stop offset='0.75' stop-color='#808080'/><stop offset='1' stop-color='#008080'/>` +
            `</linearGradient>` +
            `<linearGradient id='gy' x1='0' y1='0' x2='0' y2='1'>` +
            `<stop offset='0' stop-color='#80ff80'/><stop offset='0.25' stop-color='#808080'/>` +
            `<stop offset='0.75' stop-color='#808080'/><stop offset='1' stop-color='#800080'/>` +
            `</linearGradient>` +
            `</defs>` +
            `<rect width='240' height='240' fill='url(#rx)'/>` +
            `<rect width='240' height='240' fill='url(#gy)' style='mix-blend-mode:screen'/>` +
            `</svg>`
    );

export const GlassLensDefs = () => (
    <svg className="fx-lens-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
            <filter id="astra-lens" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
                <feImage
                    href={LENS_MAP}
                    result="map"
                    preserveAspectRatio="none"
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                />
                <feDisplacementMap
                    in="SourceGraphic"
                    in2="map"
                    scale="22"
                    xChannelSelector="R"
                    yChannelSelector="G"
                />
            </filter>
        </defs>
    </svg>
);

export default GlassLensDefs;
