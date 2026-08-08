import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOrder } from "../api/orderApi";

export const useCreateOrder = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createOrder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["my-orders"] });
        },
    });
};