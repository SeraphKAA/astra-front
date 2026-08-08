import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import "./toast.css";

const ToastContext = createContext(null);

const MAX_TOASTS = 5;
const DEFAULT_DURATION_MS = 3500;
const EXIT_ANIMATION_MS = 240;

const makeId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const timersRef = useRef(new Map());

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, isClosing: true } : t)));
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, EXIT_ANIMATION_MS);
        const timer = timersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
        }
    }, []);

    const pushToast = useCallback((toast) => {
        const id = makeId();
        const message =
            typeof toast?.message === "string"
                ? toast.message
                : toast?.message == null
                    ? ""
                    : (() => {
                        try {
                            return JSON.stringify(toast.message);
                        } catch {
                            return String(toast.message);
                        }
                    })();
        const normalized = {
            id,
            type: toast?.type || "info",
            title: toast?.title || "",
            message,
            durationMs:
                typeof toast?.durationMs === "number" ? toast.durationMs : DEFAULT_DURATION_MS,
            isClosing: false,
        };

        setToasts((prev) => [normalized, ...prev].slice(0, MAX_TOASTS));

        if (normalized.durationMs > 0) {
            const timer = setTimeout(() => removeToast(id), normalized.durationMs);
            timersRef.current.set(id, timer);
        }

        return id;
    }, [removeToast]);

    useEffect(() => {
        return () => {
            timersRef.current.forEach((t) => clearTimeout(t));
            timersRef.current.clear();
        };
    }, []);

    const value = useMemo(() => ({ pushToast, removeToast }), [pushToast, removeToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToastViewport toasts={toasts} onDismiss={removeToast} />
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error("useToast must be used within ToastProvider");
    }
    return ctx;
};

const ToastViewport = ({ toasts, onDismiss }) => {
    return (
        <div className="toast-viewport" aria-live="polite" aria-relevant="additions removals">
            {toasts.map((t) => (
                <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
            ))}
        </div>
    );
};

const ToastItem = ({ toast, onDismiss }) => {
    const startRef = useRef(null);
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const onPointerDown = (e) => {
        startRef.current = {
            y: e.clientY,
            x: e.clientX,
        };
        setIsDragging(true);
    };

    const onPointerMove = (e) => {
        if (!isDragging || !startRef.current) return;
        const dy = e.clientY - startRef.current.y;
        const dx = e.clientX - startRef.current.x;

        // только свайп вниз
        if (dy < 0) return;
        // игнорируем “горизонтальные” жесты
        if (Math.abs(dx) > 60 && Math.abs(dx) > dy) return;

        setDragY(Math.min(dy, 160));
    };

    const onPointerUp = () => {
        if (!isDragging) return;
        setIsDragging(false);
        if (dragY > 70) {
            onDismiss();
        } else {
            setDragY(0);
        }
        startRef.current = null;
    };

    const typeClass =
        toast.type === "success"
            ? "is-success"
            : toast.type === "error"
                ? "is-error"
                : "is-info";

    return (
        <div
            className={`toast-item ${typeClass} ${toast.isClosing ? "is-closing" : "is-entering"}`}
            style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            role="status"
        >
            <div className="toast-content">
                {toast.title ? <div className="toast-title">{toast.title}</div> : null}
                <div className="toast-message">{toast.message}</div>
            </div>
            <button type="button" className="toast-close" onClick={onDismiss} aria-label="Закрыть">
                ×
            </button>
        </div>
    );
};

