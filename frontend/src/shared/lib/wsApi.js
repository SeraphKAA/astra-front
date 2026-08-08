import { publicURL } from "../commonApi";

/** Базовый URL для WebSocket (wss/ws + тот же префикс, что и REST API). */
export const getWsBase = () => {
    let apiBase = String(publicURL || "/api").replace(/\/$/, "");
    if (typeof window !== "undefined" && apiBase.startsWith("/")) {
        apiBase = `${window.location.origin}${apiBase}`;
    }
    if (apiBase.startsWith("https://")) {
        return apiBase.replace(/^https:\/\//, "wss://");
    }
    if (apiBase.startsWith("http://")) {
        return apiBase.replace(/^http:\/\//, "ws://");
    }
    return apiBase;
};
