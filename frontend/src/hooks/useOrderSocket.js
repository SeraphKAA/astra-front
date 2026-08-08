import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { LS } from "../utilities/utilLocalStorage";
import { getWsBase } from "../shared/lib/wsApi";
import { isOrderWsRoute } from "../shared/lib/wsRoutes";

/**
 * WebSocket событий заказов. Только на /seller-chat.
 */
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

        const connect = async () => {
            const token = await LS.get("access_token");
            if (!token || !active) return;

            const ws = new WebSocket(
                `${getWsBase()}/orders/ws?token=${encodeURIComponent(token)}`
            );
            wsRef.current = ws;

            ws.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data);
                    onEventRef.current?.(payload);
                } catch (error) {
                    // console.error("Orders WS parse error", error);
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
