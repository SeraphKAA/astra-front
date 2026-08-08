import { useQuery } from "@tanstack/react-query";
import {
    getMyOrders,
    getOrderByPublicId,
} from "../api/orderApi";

/* ========================
   MY ORDERS
======================== */

export const useMyOrders = () => {
    return useQuery({
        queryKey: ["my-orders"],
        queryFn: getMyOrders,
    });
};

/* ========================
   ORDER BY PUBLIC ID
======================== */

export const useOrderByPublicId = (publicId) => {
    return useQuery({
        queryKey: ["order", publicId],
        queryFn: () => getOrderByPublicId(publicId),
        enabled: !!publicId,
    });
};
