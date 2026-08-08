import { useQuery } from "@tanstack/react-query";
import { getMessages } from "../api/chatApi";

export const useMessages = (chatType, limit = 50, offset = 0) => {
    return useQuery({
        queryKey: ["chat-messages", chatType, limit, offset],
        queryFn: () => getMessages(chatType, limit, offset),
        enabled: !!chatType,
    });
};
