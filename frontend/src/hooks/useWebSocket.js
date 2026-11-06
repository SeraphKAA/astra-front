import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { getWsBase } from "../shared/lib/wsApi";
import { isChatWsRoute } from "../shared/lib/wsRoutes";

export const useWebSocket = (chatId, options = {}) => {
    const { enabled = true } = options;
    const { pathname } = useLocation();
    const routeAllowed = isChatWsRoute(pathname);
    const shouldConnect = Boolean(enabled && routeAllowed && chatId);

    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState([]);
    const [readEvents, setReadEvents] = useState([]);
    const [deletedIds, setDeletedIds] = useState([]);

    const wsRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const reconnectAttemptRef = useRef(0);
    const shouldReconnectRef = useRef(false);
    const healthCheckRef = useRef(null);
    const connectRef = useRef(null);

    const clearReconnect = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
    }, []);

    const clearHealthCheck = useCallback(() => {
        if (healthCheckRef.current) {
            clearInterval(healthCheckRef.current);
            healthCheckRef.current = null;
        }
    }, []);

    const disconnect = useCallback(() => {
        shouldReconnectRef.current = false;
        clearReconnect();
        clearHealthCheck();
        const ws = wsRef.current;
        wsRef.current = null;
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            try { ws.close(); } catch { /* noop */ }
        }
        setIsConnected(false);
    }, [clearReconnect, clearHealthCheck]);

    const sendMessage = useCallback((text) => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ text }));
            return true;
        }
        return false;
    }, []);

    useEffect(() => {
        if (!shouldConnect) {
            disconnect();
            setMessages([]);
            setReadEvents([]);
            setDeletedIds([]);
            return undefined;
        }

        shouldReconnectRef.current = true;
        reconnectAttemptRef.current = 0;

        const scheduleReconnect = () => {
            if (!shouldReconnectRef.current) return;
            if (reconnectTimerRef.current) return;   // уже запланирован

            const attempt = reconnectAttemptRef.current;
            const delay = Math.min(30000, 500 * Math.pow(2, attempt));
            reconnectAttemptRef.current = attempt + 1;
            reconnectTimerRef.current = setTimeout(() => {
                reconnectTimerRef.current = null;
                connectRef.current?.();
            }, delay);
        };

        const connect = () => {
            if (!shouldReconnectRef.current) return;

            const wsUrl = `${getWsBase()}/chats/ws/${chatId}`;
            let ws;
            try {
                ws = new WebSocket(wsUrl);
            } catch {
                scheduleReconnect();
                return;
            }
            wsRef.current = ws;

            ws.onopen = () => {
                setIsConnected(true);
                reconnectAttemptRef.current = 0;

                clearHealthCheck();
                healthCheckRef.current = setInterval(() => {
                    if (wsRef.current !== ws) return;
                    if (ws.readyState === WebSocket.CLOSED) {
                        clearHealthCheck();
                        scheduleReconnect();
                    }
                }, 10000);
            };

            ws.onmessage = (event) => {
                let payload;
                try { payload = JSON.parse(event.data); } catch { return; }

                const type = payload?.event;
                const data = payload?.data ?? payload;

                switch (type) {
                    case "messages_read":
                        if (data?.chat_id != null && data?.read_at) {
                            setReadEvents((prev) => [...prev, data]);
                        }
                        return;
                    case "delete_message":
                        if (data?.id != null) {
                            setDeletedIds((prev) => [...prev, data.id]);
                            setMessages((prev) => prev.filter((m) => m.id !== data.id));
                        }
                        return;
                    case "update_message":
                    case "new_message":
                    default:
                        if (data?.id != null) {
                            setMessages((prev) => {
                                const idx = prev.findIndex((m) => m.id === data.id);
                                if (idx === -1) return [...prev, data];
                                if (type === "update_message") {
                                    const next = prev.slice();
                                    next[idx] = data;
                                    return next;
                                }
                                return prev;
                            });
                        }
                }
            };

            /* Ключевой фикс: игнорируем события от «старого» WS, если
               после cleanup уже открыт новый. Иначе устаревший onclose
               может запланировать дублирующий реконнект. */
            const isCurrent = () => wsRef.current === ws;

            ws.onclose = () => {
                if (!isCurrent()) return;
                setIsConnected(false);
                clearHealthCheck();
                scheduleReconnect();
            };

            /* Второй ключевой фикс: onerror тоже реконнектит. */
            ws.onerror = () => {
                if (!isCurrent()) return;
                setIsConnected(false);
                scheduleReconnect();
            };
        };

        connectRef.current = connect;
        connect();

        return () => {
            shouldReconnectRef.current = false;
            clearReconnect();
            clearHealthCheck();
            const ws = wsRef.current;
            wsRef.current = null;
            if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
                try { ws.close(); } catch { /* noop */ }
            }
            setIsConnected(false);
        };
    }, [shouldConnect, chatId, disconnect, clearReconnect, clearHealthCheck]);

    return { isConnected, messages, readEvents, deletedIds, sendMessage, disconnect };
};