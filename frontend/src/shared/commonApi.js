import { LS } from "../utilities/utilLocalStorage";

const normalizePublicURL = (value) => {
    if (!value) return "/api";

    // In HTTPS mode, calling `http://...` will be blocked as mixed content.
    // If user configured an absolute localhost URL, route through nginx via `/api`.
    if (typeof window !== "undefined" && window.location?.protocol === "https:") {
        if (value.startsWith("http://localhost:8000") || value.startsWith("http://127.0.0.1:8000")) {
            return "/api";
        }
        if (value.startsWith("http://")) {
            return value.replace(/^http:\/\//, "https://");
        }
    }

    return value;
};

const readPublicURLFromEnv = () => {
    // CRA (react-scripts)
    if (typeof process !== "undefined" && process?.env?.REACT_APP_PUBLIC_URL) {
        return process.env.REACT_APP_PUBLIC_URL;
    }
    return null;
};

export const publicURL = normalizePublicURL(readPublicURLFromEnv()) || "/api";

/**
 * Старые URL MinIO как http://localhost:9000/bucket/... на HTTPS-странице дают mixed content.
 * Переводим на тот же хост и путь /storage/... (см. nginx proxy на MinIO).
 */
export const normalizeMediaUrl = (url) => {
    if (!url || typeof url !== "string") return url;
    if (typeof window === "undefined" || window.location?.protocol !== "https:") {
        return url;
    }
    const m = url.match(/^http:\/\/(localhost|127\.0\.0\.1):9000\/(.+)$/);
    if (m) {
        return `${window.location.origin}/storage/${m[2]}`;
    }
    return url;
};

let isRefreshing = false;
let failedQueue = [];

const formatFastApiDetail = (detail) => {
    if (!detail) return "";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
        const parts = detail
            .map((item) => {
                if (!item) return null;
                if (typeof item === "string") return item;
                const msg = item?.msg ? String(item.msg) : null;
                const loc = Array.isArray(item?.loc) ? item.loc.join(".") : null;
                return msg && loc ? `${loc}: ${msg}` : msg || loc;
            })
            .filter(Boolean);
        return parts.join("\n");
    }
    try {
        return JSON.stringify(detail);
    } catch {
        return String(detail);
    }
};

/** Сообщение для UI из ошибки apiRequest / fetch */
export const getApiErrorMessage = (err, fallback = "Ошибка запроса") => {
    if (err == null) return fallback;
    if (typeof err === "string") return err || fallback;
    if (err instanceof ApiError && err.message) return err.message;
    if (err instanceof Error && err.message) return err.message;
    if (typeof err.message === "string" && err.message.trim()) return err.message.trim();
    if (typeof err.status === "number" && typeof err.message === "string") return err.message;
    const fromData = formatFastApiDetail(err.data?.detail);
    if (fromData) return fromData;
    return fallback;
};

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

/** Ошибка API: instanceof Error, чтобы CRA/консоль не показывали [object Object]. */
export class ApiError extends Error {
    constructor({ status, message, data }) {
        super(message || `Ошибка ${status}`);
        this.name = "ApiError";
        this.status = status;
        this.data = data;
    }
}

const buildHttpError = (response, data) => {
    const detail = formatFastApiDetail(data?.detail) || data?.message;
    const fallback =
        response.status === 401
            ? "Неверная почта или пароль"
            : `Ошибка ${response.status}`;
    return new ApiError({
        status: response.status,
        message: detail || fallback,
        data,
    });
};

export const apiRequest = async ({
    url,
    method = "GET",
    body = null,
    authorized = true,
}) => {
    const makeRequest = async () => {
        const headers = {
            Accept: "application/json",
        };

        const token = await LS.get("access_token");

        if (authorized && token) {
            headers["Authorization"] = "Bearer " + token;
        }

        const isFormData = body instanceof FormData;

        if (body && !isFormData) {
            headers["Content-Type"] = "application/json";
        }

        return fetch(publicURL + url, {
            method,
            headers,
            body: body
                ? isFormData
                    ? body
                    : JSON.stringify(body)
                : null,
        });
    };

    let response = await makeRequest();

    if (response.status === 401 && authorized) {
        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then(async () => {
                const res = await makeRequest();
                const d = await res.json().catch(() => null);
                if (!res.ok) {
                    throw buildHttpError(res, d);
                }
                return d;
            });
        }

        isRefreshing = true;

        try {
            const refreshToken = await LS.get("refresh_token");

            const refreshResponse = await fetch(
                publicURL + "/users/refresh",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refresh_token: refreshToken }),
                }
            );

            if (!refreshResponse.ok) {
                throw new Error("Refresh failed");
            }

            const refreshData = await refreshResponse.json();

            await LS.set("access_token", refreshData.access_token);
            await LS.set("refresh_token", refreshData.refresh_token);

            processQueue(null, refreshData.access_token);

            response = await makeRequest();
        } catch (err) {
            processQueue(err, null);

            await LS.remove("access_token");
            await LS.remove("refresh_token");

            throw err;
        } finally {
            isRefreshing = false;
        }
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw buildHttpError(response, data);
    }

    return data;
};
