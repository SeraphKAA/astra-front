import { useQuery } from "@tanstack/react-query";
import { getChat } from "../api/chatApi";

export const useChat = (chatType) => {
    return useQuery({
        queryKey: ["chat", chatType],
        queryFn: () => getChat(chatType),
        enabled: !!chatType,
    });
};
