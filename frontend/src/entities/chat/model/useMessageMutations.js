import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    sendMessage,
    editMessage,
    deleteMessage,
} from "../api/chatApi";

export const useSendMessage = (chatType) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data) => sendMessage(chatType, data),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["chat-messages", chatType],
            });
        },
    });
};

export const useEditMessage = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ messageId, data }) =>
            editMessage(messageId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["chat-messages"],
            });
        },
    });
};

export const useDeleteMessage = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (messageId) =>
            deleteMessage(messageId),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["chat-messages"],
            });
        },
    });
};
