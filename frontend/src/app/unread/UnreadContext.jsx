import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { getUnreadCounts } from "../../entities/chat/api/chatApi";

const EMPTY = {
    support: 0,
    support_chats_total: 0,
    support_chats_by_id: {},
    orders_total: 0,
    orders_by_chat: {},
    seller_orders_total: 0,
    seller_orders_by_chat: {},
};

const UnreadContext = createContext(null);

export const UnreadProvider = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const [counts, setCounts] = useState(EMPTY);

    const refetch = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const data = await getUnreadCounts();
            setCounts({ ...EMPTY, ...data });
        } catch {
            /* молча — при следующем тике попробуем снова */
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) {
            setCounts(EMPTY);
            return undefined;
        }
        refetch();

        const interval = setInterval(refetch, 20000);
        const onFocus = () => refetch();
        const onVisibility = () => {
            if (document.visibilityState === "visible") refetch();
        };
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            clearInterval(interval);
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [isAuthenticated, refetch]);

    return (
        <UnreadContext.Provider value={{ counts, refetch }}>
            {children}
        </UnreadContext.Provider>
    );
};

export const useUnreadCounts = () => {
    const ctx = useContext(UnreadContext);
    if (!ctx) return { counts: EMPTY, refetch: () => {} };
    return {
        counts: { ...EMPTY, ...(ctx.counts || {}) },
        refetch: ctx.refetch || (() => {}),
    };
};