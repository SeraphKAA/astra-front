import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import "./toast.css";

const ToastContext = createContext(null);

const MAX_TOASTS = 5;
const DEFAULT_DURATION_MS = 5000;
/* Must stay in step with the 300ms exit animation in toast.css — the
   movement duration of the One-Easing/Three-Durations rule. */
const EXIT_ANIMATION_MS = 300;
/* Pointer travel past which a gesture stops being a click. */
const DRAG_SLOP_PX = 4;
const DRAG_MAX_PX = 160;
const DRAG_DISMISS_PX = 70;

let idSeq = 0;
const makeId = () => `toast_${Date.now().toString(36)}_${(idSeq += 1)}`;

const TYPE_CLASS = {
    success: "is-success",
    warning: "is-warning",
    error: "is-error",
    info: "is-info",
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    /* Ids already playing their exit, so a double dismiss (timer + click)
       cannot queue two unmounts for the same toast. */
    const closingRef = useRef(new Set());
    const unmountTimersRef = useRef(new Set());

    const removeToast = useCallback((id) => {
        if (closingRef.current.has(id)) return;
        closingRef.current.add(id);

        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, isClosing: true } : t)));

        const timer = setTimeout(() => {
            closingRef.current.delete(id);
            unmountTimersRef.current.delete(timer);
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, EXIT_ANIMATION_MS);

        unmountTimersRef.current.add(timer);
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

        return id;
    }, []);

    useEffect(() => {
        const timers = unmountTimersRef.current;
        return () => {
            timers.forEach((t) => clearTimeout(t));
            timers.clear();
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

/* One persistent live region on the viewport — it exists from mount, so
   additions are reliably announced. The items carry no role of their own:
   a role="status" inside a live region reads the toast twice. Removals
   stay silent; a dismissal is not news. */
const ToastViewport = ({ toasts, onDismiss }) => {
    return (
        <div
            className="toast-viewport"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Уведомления"
        >
            {toasts.map((t) => (
                <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
            ))}
        </div>
    );
};

const ToastIcon = ({ type }) => {
    /* The glyph is the non-colour half of the type cue — the status colours
       alone would leave the type unreadable to anyone who cannot separate
       green from red. */
    const common = {
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2.2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
        focusable: "false",
    };

    if (type === "success") {
        return (
            <svg {...common}>
                <path d="M4 12.8 9.2 18 20 6.6" />
            </svg>
        );
    }

    if (type === "error") {
        return (
            <svg {...common}>
                <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
            </svg>
        );
    }

    if (type === "warning") {
        return (
            <svg {...common}>
                <path d="M12 3.6 22 20.4H2L12 3.6Z" />
                <path d="M12 10v4.2" />
                <path d="M12 17.4h.01" />
            </svg>
        );
    }

    return (
        <svg {...common}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5.4" />
            <path d="M12 7.6h.01" />
        </svg>
    );
};

const ToastItem = ({ toast, onDismiss }) => {
    const startRef = useRef(null);
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    const { id, durationMs, isClosing } = toast;
    const dismiss = useCallback(() => onDismiss(id), [onDismiss, id]);

    /* The toast owns its own lifetime: the timer unmounts with it, and a
       pointer or a keyboard resting on the card holds it open. What is left
       of the countdown is banked on pause, so a glance at a toast does not
       hand it a fresh five seconds. */
    const remainingRef = useRef(durationMs);
    const startedAtRef = useRef(0);

    useEffect(() => {
        if (isClosing || isPaused || !(durationMs > 0)) return undefined;
        startedAtRef.current = Date.now();
        const timer = setTimeout(dismiss, remainingRef.current);
        return () => {
            clearTimeout(timer);
            remainingRef.current = Math.max(
                0,
                remainingRef.current - (Date.now() - startedAtRef.current)
            );
        };
    }, [isClosing, durationMs, isPaused, dismiss]);

    /* A pointer gesture decides for itself whether it was a tap or a swipe,
       so the click that follows it must not dismiss a second time. A click
       with no gesture behind it — assistive tech, a synthetic dispatch — is
       the one this handler is for. */
    const sawGestureRef = useRef(false);

    const onClick = () => {
        if (sawGestureRef.current) {
            sawGestureRef.current = false;
            return;
        }
        dismiss();
    };

    const onPointerDown = (e) => {
        if (e.button != null && e.button !== 0) return;
        if (e.target.closest && e.target.closest(".toast-close")) return;
        sawGestureRef.current = true;
        /* Capture so the gesture survives the pointer leaving the card. */
        if (e.currentTarget.setPointerCapture) {
            try {
                e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
                /* capture is a nicety, not a requirement */
            }
        }
        startRef.current = { x: e.clientX, y: e.clientY, moved: false };
        setIsDragging(true);
    };

    const onPointerMove = (e) => {
        if (!isDragging || !startRef.current) return;
        const dy = e.clientY - startRef.current.y;
        const dx = e.clientX - startRef.current.x;

        if (Math.abs(dx) > DRAG_SLOP_PX || Math.abs(dy) > DRAG_SLOP_PX) {
            startRef.current.moved = true;
        }
        // только свайп вниз
        if (dy < 0) return;
        // игнорируем «горизонтальные» жесты
        if (Math.abs(dx) > 60 && Math.abs(dx) > dy) return;

        setDragY(Math.min(dy, DRAG_MAX_PX));
    };

    const onPointerUp = (e) => {
        if (!isDragging) return;
        setIsDragging(false);
        if (e && e.currentTarget.releasePointerCapture && e.pointerId != null) {
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
                /* already released */
            }
        }

        const moved = startRef.current ? startRef.current.moved : false;
        startRef.current = null;

        if (dragY > DRAG_DISMISS_PX) {
            dismiss();
            return;
        }
        setDragY(0);
        /* A tap that never travelled is a dismiss — the card is the close
           control, per *No Visible Close Cross*. */
        if (!moved) dismiss();
    };

    const onPointerCancel = () => {
        sawGestureRef.current = false;
        if (!isDragging) return;
        setIsDragging(false);
        startRef.current = null;
        setDragY(0);
    };

    const typeClass = TYPE_CLASS[toast.type] || TYPE_CLASS.info;
    const stateClass = toast.isClosing ? "is-closing" : "is-entering";

    return (
        <div
            className={`toast-item ${typeClass} ${stateClass}${isDragging ? " is-dragging" : ""}`}
            style={
                dragY
                    ? {
                        transform: `translateY(${dragY}px)`,
                        opacity: Math.max(0.35, 1 - dragY / 220),
                    }
                    : undefined
            }
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onClick={onClick}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onFocusCapture={() => setIsPaused(true)}
            onBlurCapture={() => setIsPaused(false)}
        >
            <span className="toast-icon">
                <ToastIcon type={toast.type} />
            </span>
            <div className="toast-content">
                {toast.title ? <div className="toast-title">{toast.title}</div> : null}
                <div className="toast-message">{toast.message}</div>
            </div>
            <button type="button" className="toast-close" onClick={dismiss}>
                Закрыть
            </button>
        </div>
    );
};
