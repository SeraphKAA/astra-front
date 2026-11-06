/**
 * Единый счётчик блокировки прокрутки.
 *
 * Зачем: у диалогов, поиска и попапа покупки были ТРИ независимых замка.
 * Снятие не по стеку (поиск закрылся, пока открыт диалог) разблокировало
 * страницу под диалогом, а следующее снятие возвращало overflow:hidden
 * навсегда — страница переставала прокручиваться до перезагрузки.
 *
 * Здесь замок один: первый lock() запоминает стили и вешает hidden,
 * последний unlock() их возвращает. Порядок вызовов больше не важен.
 *
 * Прокручивает страницу #root (overflow-y: auto), а не документ, поэтому
 * замораживаем и его — иначе лента продолжает ехать под оверлеем.
 */

let locks = 0;
let saved = null;

const scrollHost = () =>
    (typeof document !== "undefined" && document.getElementById("root")) || null;

/** Ширина полосы прокрутки элемента (без учёта рамок). */
const scrollbarWidth = (el) => {
    if (!el) return 0;
    const cs = window.getComputedStyle(el);
    const borders = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
    return Math.max(0, Math.round(el.offsetWidth - el.clientWidth - borders));
};

export const lockScroll = () => {
    if (typeof document === "undefined") return;
    locks += 1;
    if (locks > 1) return;

    const html = document.documentElement;
    const body = document.body;
    const host = scrollHost();

    saved = {
        htmlOverflow: html.style.overflow,
        htmlGutter: html.style.scrollbarGutter,
        htmlPadding: html.style.paddingRight,
        htmlBox: html.style.boxSizing,
        bodyOverflow: body.style.overflow,
        hostOverflow: host ? host.style.overflow : "",
        hostPadding: host ? host.style.paddingRight : "",
        hostBox: host ? host.style.boxSizing : "",
    };

    /* Компенсируем исчезающую полосу, чтобы макет не дёрнулся по горизонтали;
       box-sizing обязателен — иначе padding расширит сам элемент. */
    const hostGap = scrollbarWidth(host);
    const htmlGap = scrollbarWidth(html);

    html.style.scrollbarGutter = "auto";
    if (htmlGap > 0) {
        const current = parseFloat(window.getComputedStyle(html).paddingRight) || 0;
        html.style.boxSizing = "border-box";
        html.style.paddingRight = `${current + htmlGap}px`;
    }
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    if (host) {
        if (hostGap > 0) {
            const current = parseFloat(window.getComputedStyle(host).paddingRight) || 0;
            host.style.boxSizing = "border-box";
            host.style.paddingRight = `${current + hostGap}px`;
        }
        host.style.overflow = "hidden";
    }
};

export const unlockScroll = () => {
    if (typeof document === "undefined") return;
    locks = Math.max(0, locks - 1);
    if (locks > 0 || !saved) return;

    const html = document.documentElement;
    const body = document.body;
    const host = scrollHost();

    html.style.overflow = saved.htmlOverflow;
    html.style.scrollbarGutter = saved.htmlGutter;
    html.style.paddingRight = saved.htmlPadding;
    html.style.boxSizing = saved.htmlBox;
    body.style.overflow = saved.bodyOverflow;
    if (host) {
        host.style.overflow = saved.hostOverflow;
        host.style.paddingRight = saved.hostPadding;
        host.style.boxSizing = saved.hostBox;
    }
    saved = null;
};
