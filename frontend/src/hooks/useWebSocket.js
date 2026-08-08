import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { getWsBase } from "../shared/lib/wsApi";
import { isChatWsRoute } from "../shared/lib/wsRoutes";

/**
 * WebSocket чата. Подключается только на /support и /order-chat/:id
 * (и когда переданы chatId + token).
 */
export const useWebSocket = (chatId, token, options = {}) => {
    const { enabled = true } = options;
    const { pathname } = useLocation();
    const routeAllowed = isChatWsRoute(pathname);
    const shouldConnect = Boolean(enabled && routeAllowed && chatId && token);

    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState([]);
    const wsRef = useRef(null);

    const disconnect = useCallback(() => {
        const ws = wsRef.current;
        wsRef.current = null;
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            ws.close();
        }
        setIsConnected(false);
    }, []);

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
            return undefined;
        }

        const wsUrl = `${getWsBase()}/chats/ws/${chatId}?token=${encodeURIComponent(token)}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => setIsConnected(true);

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                const normalized = message?.data ? message.data : message;
                if (normalized?.id) {
                    setMessages((prev) =>
                        prev.some((item) => item.id === normalized.id)
                            ? prev
                            : [...prev, normalized]
                    );
                }
            } catch (error) {
                // console.error("Error parsing chat WS message:", error);
            }
        };

        ws.onclose = () => setIsConnected(false);
        ws.onerror = () => setIsConnected(false);

        return () => {
            if (wsRef.current === ws) {
                disconnect();
            }
        };
    }, [shouldConnect, chatId, token, disconnect]);

    return {
        isConnected,
        messages,
        sendMessage,
        disconnect,
    };
};
