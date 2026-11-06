import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { getWsBase } from "../shared/lib/wsApi";
import { isOrderWsRoute } from "../shared/lib/wsRoutes";

export const useOrderSocket = (onEvent, options = {}) => {
    const { enabled = true } = options;
    const { pathname } = useLocation();
    const shouldConnect = Boolean(enabled && isOrderWsRoute(pathname));
    const wsRef = useRef(null);
    const onEventRef = useRef(onEvent);
    onEventRef.current = onEvent;

    useEffect(() => {
        if (!shouldConnect) {
            const ws = wsRef.current;
            wsRef.current = null;
            if (ws) ws.close();
            return undefined;
        }

        let active = true;

        const connect = () => {
            // Если бэкенд ожидает токен в query – оставьте, но токен теперь нельзя прочитать из JS
            // Лучше убрать параметр token, полагаясь на куки.
            const ws = new WebSocket(`${getWsBase()}/orders/ws`);
            wsRef.current = ws;

            ws.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data);
                    onEventRef.current?.(payload);
                } catch (error) {
                    // обработка ошибок
                }
            };
        };

        connect();

        return () => {
            active = false;
            const ws = wsRef.current;
            wsRef.current = null;
            if (ws) ws.close();
        };
    }, [shouldConnect]);
};