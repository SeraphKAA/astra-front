import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/auth/AuthContext";
import { getChat, getMessages, sendMessage, uploadImage, markChatRead } from "../../entities/chat/api/chatApi";
import { useWebSocket } from "../../hooks/useWebSocket";
import ChatMessage from "../../entities/chat/ui/chatMessage";
import { getUserById } from "../../entities/user/api/userApi";
import { getOrderByPublicId, getOrdersByUserForStaff } from "../../entities/order/api/orderApi";
import { OrderDetailsModal } from "../../entities/order/ui/OrderDetailsModal";
import { Modal } from "../../shared/ui/Modal/Modal";
import "./orderChat.css";
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import { useUnreadCounts } from "../../app/unread/UnreadContext";

/* Чат по заказу — та же грамматика, что у техподдержки: шапка 56px,
   лента, один «док» ввода. Стили — в orderChat.css, всё под .order-chat. */

const MAX_ATTACHMENTS = 5;
const MAX_COMPOSER_HEIGHT = 135;

const errorText = (e, fallback) => (typeof e === "string" ? e : e?.message) || fallback;

/* ---------- иконки: обводка 2, скруглённые концы ---------- */
const BackIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path d="M14.5 5 8 12l6.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const NextIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path d="M9.5 5 16 12l-6.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const SendIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const PaperclipIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path d="M16.5 6V17.5C16.5 19.9853 14.4853 22 12 22C9.51472 22 7.5 19.9853 7.5 17.5V6C7.5 4.067 9.067 2.5 11 2.5C12.933 2.5 14.5 4.067 14.5 6V17.5C14.5 18.6046 13.6046 19.5 12.5 19.5C11.3954 19.5 10.5 18.6046 10.5 17.5V7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const CloseIcon = () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const UserIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <circle cx="12" cy="8.5" r="3.8" stroke="currentColor" strokeWidth="2" />
        <path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const ReceiptIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path d="M6 3.5h12v17l-2.5-1.6L13 20.5l-2-1.6-2 1.6-3-1.6V3.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M9 8.5h6M9 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const ChatOutlineIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.6 3.6a.6.6 0 0 1-.97-.47V16H6.5A2.5 2.5 0 0 1 4 13.5v-7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.5 8.5h7M8.5 11.5h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const DotsPulse = () => (
    <span className="order-chat-dots" aria-hidden="true">
        <i />
        <i />
        <i />
    </span>
);

/* ---------- разделители дней ---------- */
const dayKeyOf = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const dayLabelOf = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const key = dayKeyOf(iso);
    if (key === dayKeyOf(now.toISOString())) return "Сегодня";
    if (key === dayKeyOf(yesterday.toISOString())) return "Вчера";
    return d.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
    });
};

/**
 * Просмотрщик изображений на общем Modal (Escape, клик по подложке,
 * скрытая кнопка закрытия). Стрелки клавиатуры слушаем на окне —
 * листать можно сразу, без клика по картинке.
 */
const ImageViewerModal = ({ isOpen, onClose, images, currentIndex = 0 }) => {
    const [activeIndex, setActiveIndex] = useState(currentIndex);
    const total = images?.length || 0;

    useEffect(() => {
        if (isOpen) setActiveIndex(currentIndex);
    }, [isOpen, currentIndex]);

    useEffect(() => {
        if (!isOpen || total < 2) return undefined;
        const onKey = (e) => {
            if (e.key === "ArrowLeft") setActiveIndex((i) => Math.max(0, i - 1));
            else if (e.key === "ArrowRight") setActiveIndex((i) => Math.min(total - 1, i + 1));
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen, total]);

    if (!isOpen || total === 0) return null;

    const safeIndex = Math.min(activeIndex, total - 1);
    const current = images[safeIndex];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Изображение ${safeIndex + 1} из ${total}`} variant="wide">
            <div className="order-chat-viewer">
                {safeIndex > 0 && (
                    <button
                        type="button"
                        className="order-chat-viewer-nav order-chat-viewer-nav--prev"
                        onClick={() => setActiveIndex(safeIndex - 1)}
                        aria-label="Предыдущее изображение"
                    >
                        <BackIcon />
                    </button>
                )}
                <img
                    className="order-chat-viewer-image"
                    src={current.url}
                    alt={current.alt || `Изображение ${safeIndex + 1}`}
                />
                {safeIndex < total - 1 && (
                    <button
                        type="button"
                        className="order-chat-viewer-nav order-chat-viewer-nav--next"
                        onClick={() => setActiveIndex(safeIndex + 1)}
                        aria-label="Следующее изображение"
                    >
                        <NextIcon />
                    </button>
                )}
                {total > 1 && (
                    <div className="order-chat-viewer-counter" aria-live="polite">
                        {safeIndex + 1} / {total}
                    </div>
                )}
            </div>
        </Modal>
    );
};

const OrderChat = () => {
    const { orderId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [chat, setChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    /* монотонный счётчик для уникальных temp-id оптимистичных сообщений */
    const tempSeqRef = useRef(0);
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [reloadTick, setReloadTick] = useState(0);
    const [sending, setSending] = useState(false);
    const [orderPublicId, setOrderPublicId] = useState(null);
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [profileDetails, setProfileDetails] = useState(null);
    const [profileOrders, setProfileOrders] = useState([]);
    const [orderDetailsModalOpen, setOrderDetailsModalOpen] = useState(false);
    const [orderDetailsLoading, setOrderDetailsLoading] = useState(false);
    const [orderDetailsError, setOrderDetailsError] = useState(null);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
    const [orderDetailsCache, setOrderDetailsCache] = useState({});
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [imageViewerData, setImageViewerData] = useState({ images: [], currentIndex: 0 });

    const wrapRef = useRef(null);
    const inputRef = useRef(null);
    const { pushToast } = useToast();

    const { messages: wsMessages, readEvents = [] } = useWebSocket(chat?.id, { enabled: true });
    const { refetch: refetchUnread } = useUnreadCounts();
    const isSellerSide = ["seller", "admin", "moderator"].includes(user?.role);
    const mySender = isSellerSide ? "support" : "user";
    
    useEffect(() => {
        if (!chat?.id || loading) return;
        markChatRead(chat.id).then(() => refetchUnread()).catch(() => {});
    }, [chat?.id, loading, refetchUnread]);

    useEffect(() => {
        if (!wsMessages.length || !chat?.id) return;
        const incoming = wsMessages[wsMessages.length - 1];
        if (incoming.chat_id !== chat.id) return;
        if (incoming.sender === mySender) return;
        markChatRead(chat.id).then(() => refetchUnread()).catch(() => {});
    }, [wsMessages, chat?.id, mySender, refetchUnread]);

    const scrollToBottom = () => {
        const el = wrapRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    };

    const uploadAttachment = async (file) => {
        if (!file) return;

        if (attachments.length >= MAX_ATTACHMENTS) {
            pushToast({ type: "error", message: `Не больше ${MAX_ATTACHMENTS} изображений в одном сообщении` });
            return;
        }

        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            pushToast({ type: "error", message: "Разрешены только изображения (JPEG, PNG, WEBP)" });
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            pushToast({ type: "error", message: "Файл не должен превышать 5 МБ" });
            return;
        }

        setUploading(true);
        try {
            const result = await uploadImage(file);
            setAttachments((prev) => [
                ...prev,
                {
                    id: result.upload_id,
                    url: result.url,
                    name: result.name || file.name || "pasted-image",
                    type: result.type || file.type,
                },
            ]);
        } catch {
            pushToast({ type: "error", message: "Не удалось загрузить изображение" });
        } finally {
            setUploading(false);
        }
    };

    /* Автовысота: поле растёт до MAX_COMPOSER_HEIGHT, дальше прокручивается.
       scrollHeight не учитывает рамку (border-box) — добавляем её. */
    const resizeComposer = (el) => {
        if (!el) return;
        el.style.height = "auto";
        const border = Math.max(el.offsetHeight - el.clientHeight, 0);
        el.style.height = `${Math.min(el.scrollHeight + border, MAX_COMPOSER_HEIGHT)}px`;
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await uploadAttachment(file);
        e.target.value = "";
    };

    /* Ctrl+V: картинки из буфера аплоадим как вложение, текст пропускаем
    штатно — textarea сам его вставит. */
    const handlePaste = async (e) => {
        const items = e.clipboardData?.items;
        if (!items || items.length === 0) return;

        const files = [];
        for (const item of items) {
            if (item.kind === "file") {
                const file = item.getAsFile();
                if (file) files.push(file);
            }
        }
        if (files.length === 0) return;

        // Раз в буфере есть картинки — текст вставлять не даём,
        // иначе в поле окажется мусор вроде имени файла.
        e.preventDefault();

        for (const file of files) {
            if (attachments.length + files.indexOf(file) >= MAX_ATTACHMENTS) {
                pushToast({
                    type: "error",
                    message: `Не больше ${MAX_ATTACHMENTS} изображений в одном сообщении`,
                });
                break;
            }
            await uploadAttachment(file);
        }
    };

    const removeAttachment = (index) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    const handleImageClick = (images, clickedIndex = 0) => {
        if (!images || images.length === 0) return;
        setImageViewerData({
            images: images.map((img) => ({
                url: img.url || img,
                alt: img.name || img.alt || "Изображение",
            })),
            currentIndex: clickedIndex,
        });
        setImageViewerOpen(true);
    };

    useEffect(() => {
        let alive = true;
        const load = async () => {
            if (!orderId) return;
            setLoading(true);
            setLoadError("");
            try {
                const chatData = await getChat("order", orderId);
                if (!alive) return;
                setChat(chatData);
                setOrderPublicId(chatData?.order_public_id || null);
                const history = await getMessages("order", 100, 0, orderId);
                if (!alive) return;
                setMessages(Array.isArray(history) ? history.reverse() : []);
            } catch (e) {
                if (alive) setLoadError(errorText(e, "Не удалось загрузить переписку"));
            } finally {
                if (alive) setLoading(false);
            }
        };
        load();
        return () => {
            alive = false;
        };
    }, [orderId, reloadTick]);
    
    useEffect(() => {
        if (!wsMessages.length || !chat?.id) return;
        const incoming = wsMessages[wsMessages.length - 1];
        if (incoming.chat_id !== chat.id) return;   // ← защита от чужих
        setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === incoming.id);
            if (idx === -1) return [...prev, incoming];
            const next = prev.slice();
            next[idx] = incoming;
            return next;
        });
    }, [wsMessages, chat?.id]);

    /* 1. Открыли чат — сразу помечаем входящие прочитанными.
    loading нужен, чтобы не дёргать эндпоинт, пока chat.id ещё null. */
    useEffect(() => {
        if (!chat?.id || loading) return;
        markChatRead(chat.id).catch(() => {});
    }, [chat?.id, loading]);

    /* 2. Новое сообщение от собеседника — чат открыт, значит прочитано.
    POST /read идемпотентен: если непрочитанных нет, ничего не обновится
    и сервер не рассылает broadcast. */
    useEffect(() => {
        if (!wsMessages.length || !chat?.id) return;
        const incoming = wsMessages[wsMessages.length - 1];
        if (incoming.chat_id !== chat.id) return;
        if (incoming.sender === mySender) return;
        markChatRead(chat.id).catch(() => {});
    }, [wsMessages, chat?.id, mySender]);

    /* 3. Собеседник прочитал мои сообщения — рисуем у них двойную галочку.
    reader_sender — кто прочитал. Свои красим, когда прочитал НЕ я. */
    useEffect(() => {
        if (!readEvents.length || !chat?.id) return;
        const lastEvent = readEvents[readEvents.length - 1];
        if (lastEvent.chat_id !== chat.id) return;
        if (lastEvent.reader_sender === mySender) return;

        setMessages((prev) =>
            prev.map((m) =>
                m.sender === mySender && !m.read_at
                    ? { ...m, read_at: lastEvent.read_at }
                    : m
            )
        );
    }, [readEvents, chat?.id, mySender]);
    
    useEffect(() => {
        if (!chat?.id || loading || messages.length === 0) return;
        markChatRead(chat.id).then(() => refetchUnread()).catch(() => {});
    }, [chat?.id, loading, messages.length, refetchUnread]);

    useLayoutEffect(() => {
        requestAnimationFrame(() => {
            scrollToBottom();
        });
    }, [messages.length]);

    const handleKeyDown = (e) => {
        if (e.key !== "Enter" || e.shiftKey) return;
        e.preventDefault();
        handleSend();
    };

    const handleSend = async () => {
        const trimmedText = text.trim();
        if (!trimmedText && attachments.length === 0) return;
        if (!orderId || sending) return;

        setSending(true);
        const currentAttachments = [...attachments];
        const payload = {
            text: trimmedText,
            attachment_ids: currentAttachments.map((a) => a.id),
        };
        setText("");
        setAttachments([]);
        if (inputRef.current) inputRef.current.style.height = "";

        /* Счётчик, а не голая метка времени: два отправления в одну
           миллисекунду давали одинаковый ключ React. */
        tempSeqRef.current += 1;
        const tempId = `temp-${Date.now()}-${tempSeqRef.current}`;
        setMessages((prev) => [
            ...prev,
            {
                id: tempId,
                chat_id: chat?.id,
                sender: mySender,
                text: trimmedText || "Вложение",
                attachments: currentAttachments,
                created_at: new Date().toISOString(),
            },
        ]);

        try {
            const sent = await sendMessage("order", payload, orderId);
            setMessages((prev) => {
                const withoutTemp = prev.filter((m) => m.id !== tempId);
                if (sent?.id && withoutTemp.some((m) => m.id === sent.id)) return withoutTemp;
                return sent?.id ? [...withoutTemp, sent] : withoutTemp;
            });
        } catch (error) {
            /* Оптимистичный пузырь убираем — иначе неотправленное выглядит
               отправленным; текст и вложения возвращаем в поле. */
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            pushToast({ type: "error", message: "Не удалось отправить сообщение. Текст и вложения сохранены." });
            setText(trimmedText);
            setAttachments(currentAttachments);
            requestAnimationFrame(() => resizeComposer(inputRef.current));
        } finally {
            setSending(false);
            /* Поле не отключается на время отправки, поэтому фокус с него не
               слетает; возвращаем его, только если браузер уронил фокус в body. */
            const active = document.activeElement;
            if (!active || active === document.body) inputRef.current?.focus();
        }
    };  

    const formatCustomerName = () => {
        if (!chat) return "Покупатель";
        console.log(chat.user_nickname , chat.user_login , chat.user_email , `Покупатель #${chat.user_id}`);
        return chat.user_nickname || chat.user_login || chat.user_email || `Покупатель #${chat.user_id}`;
    };

    const backRoute = isSellerSide ? "/seller-chat?tab=mine" : "/orders";
    const titleOrderId = orderPublicId || orderId;
    const otherSideLabel = isSellerSide ? formatCustomerName() : "Продавец";

    useEffect(() => {
        if (!isSellerSide) setOrderDetailsModalOpen(false);
    }, [isSellerSide]);

    const openUserModal = async () => {
        if (!isSellerSide || !chat?.user_id) return;
        try {
            const [userData, ordersData] = await Promise.all([
                getUserById(chat.user_id),
                getOrdersByUserForStaff(chat.user_id),
            ]);
            setProfileDetails(userData);
            setProfileOrders(Array.isArray(ordersData) ? ordersData : []);
            setProfileModalOpen(true);
        } catch (error) {
            pushToast({ type: "error", message: errorText(error, "Не удалось загрузить профиль покупателя") });
        }
    };

    const openOrderDetails = async (publicId) => {
        if (!isSellerSide || !publicId) return;
        if (orderDetailsCache[publicId]) {
            setSelectedOrderDetails(orderDetailsCache[publicId]);
            setOrderDetailsError(null);
            setOrderDetailsModalOpen(true);
            return;
        }
        setOrderDetailsLoading(true);
        setOrderDetailsError(null);
        setSelectedOrderDetails(null);
        setOrderDetailsModalOpen(true);
        try {
            const details = await getOrderByPublicId(publicId);
            setSelectedOrderDetails(details);
            setOrderDetailsCache((prev) => ({ ...prev, [publicId]: details }));
        } catch (e) {
            setOrderDetailsError(errorText(e, "Не удалось загрузить заказ"));
        } finally {
            setOrderDetailsLoading(false);
        }
    };

    const attachDisabled = uploading || attachments.length >= MAX_ATTACHMENTS;
    const canSend = (text.trim().length > 0 || attachments.length > 0) && !sending;

    return (
        <>
            <div className="order-chat">
                <div className="order-chat-main">
                    <header className="order-chat-head">
                        <button
                            type="button"
                            className="order-chat-icon-btn order-chat-back"
                            onClick={() => navigate(backRoute)}
                            aria-label={isSellerSide ? "Назад к чатам" : "Назад к покупкам"}
                            title={isSellerSide ? "Назад к чатам" : "Назад к покупкам"}
                        >
                            <BackIcon />
                        </button>
                        <div className="order-chat-head-text">
                            <h2 className="order-chat-head-title">
                                Заказ <span className="text-none">{titleOrderId}</span>
                            </h2>
                            <p className="order-chat-head-sub text-none">
                                {isSellerSide ? `Покупатель: ${formatCustomerName()}` : "Чат с продавцом"}
                            </p>
                        </div>
                        {isSellerSide && chat?.user_id && (
                            <button
                                type="button"
                                className="order-chat-icon-btn"
                                onClick={openUserModal}
                                aria-label="Профиль покупателя"
                                title="Профиль покупателя"
                            >
                                <UserIcon />
                            </button>
                        )}
                        {isSellerSide && orderPublicId && (
                            <button
                                type="button"
                                className="order-chat-icon-btn"
                                onClick={() => openOrderDetails(orderPublicId)}
                                aria-label="Детали заказа"
                                title="Детали заказа"
                            >
                                <ReceiptIcon />
                            </button>
                        )}
                    </header>

                    <div className="order-chat-feed" ref={wrapRef}>
                        {loading ? (
                            <p className="order-chat-state" role="status">
                                <DotsPulse /> Загружаем переписку…
                            </p>
                        ) : loadError ? (
                            <div className="order-chat-empty" role="alert">
                                <p className="order-chat-empty-title">Переписка не загрузилась</p>
                                <p className="order-chat-empty-hint">{loadError}</p>
                                <button
                                    type="button"
                                    className="astra-btn-ghost astra-press order-chat-retry"
                                    onClick={() => setReloadTick((t) => t + 1)}
                                >
                                    Повторить
                                </button>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="order-chat-empty">
                                <span className="order-chat-empty-art" aria-hidden="true">
                                    <ChatOutlineIcon />
                                </span>
                                <p className="order-chat-empty-title">Сообщений пока нет</p>
                                <p className="order-chat-empty-hint">
                                    {isSellerSide
                                        ? "Напишите покупателю — он увидит сообщение в этом чате."
                                        : "Напишите продавцу — ответ появится здесь."}
                                </p>
                            </div>
                        ) : (
                            messages.map((m, index) => {
                                const isOwn = isSellerSide ? m.sender === "support" : m.sender === "user";
                                const key = dayKeyOf(m.created_at);
                                const prev = messages[index - 1];
                                const showDay = Boolean(key) && (!prev || dayKeyOf(prev.created_at) !== key);
                                return (
                                    <React.Fragment key={m.id}>
                                        {showDay && (
                                            <div className="order-chat-day">
                                                <span>{dayLabelOf(m.created_at)}</span>
                                            </div>
                                        )}
                                        <div className={`order-chat-msg ${isOwn ? "order-chat-msg--own" : "order-chat-msg--other"}`}>
                                            <ChatMessage
                                                message={m}
                                                isOwn={isOwn}
                                                senderLabel={isOwn ? "Вы" : otherSideLabel}
                                                senderClickable={isSellerSide && !isOwn}
                                                onSenderClick={openUserModal}
                                                onEdit={(id, newText) =>
                                                    setMessages((p) => p.map((msg) => (msg.id === id ? { ...msg, text: newText } : msg)))
                                                }
                                                onDelete={(id) => setMessages((p) => p.filter((msg) => msg.id !== id))}
                                                onImageClick={handleImageClick}
                                            />
                                        </div>
                                    </React.Fragment>
                                );
                            })
                        )}
                    </div>

                    <div className="order-chat-composer">
                        {(attachments.length > 0 || uploading) && (
                            <ul className="order-chat-chips" aria-label="Вложения сообщения">
                                {attachments.map((att, idx) => (
                                    <li key={att.id ?? idx} className="order-chat-chip">
                                        <button
                                            type="button"
                                            className="order-chat-chip-open"
                                            onClick={() => handleImageClick(attachments, idx)}
                                            aria-label={`Показать вложение ${att.name || idx + 1}`}
                                        >
                                            <img className="order-chat-chip-thumb" src={att.url} alt="" />
                                            <span className="order-chat-chip-name">{att.name || `Изображение ${idx + 1}`}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="order-chat-chip-remove"
                                            onClick={() => removeAttachment(idx)}
                                            aria-label={`Убрать вложение ${att.name || idx + 1}`}
                                        >
                                            <CloseIcon />
                                        </button>
                                    </li>
                                ))}
                                {uploading && (
                                    <li className="order-chat-chip order-chat-chip--loading" role="status">
                                        <DotsPulse />
                                        <span className="order-chat-chip-name">Загружаем…</span>
                                    </li>
                                )}
                                {attachments.length > 0 && (
                                    <li
                                        className="order-chat-chip-count"
                                        aria-label={`Вложений: ${attachments.length} из ${MAX_ATTACHMENTS}`}
                                    >
                                        {attachments.length}/{MAX_ATTACHMENTS}
                                    </li>
                                )}
                            </ul>
                        )}

                        <div className="order-chat-dock">
                            <label
                                className="order-chat-attach"
                                aria-disabled={attachDisabled}
                                title={attachments.length >= MAX_ATTACHMENTS ? `Не больше ${MAX_ATTACHMENTS} изображений` : "Прикрепить изображение"}
                            >
                                <PaperclipIcon />
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    disabled={attachDisabled || loading || Boolean(loadError)}
                                    aria-label="Прикрепить изображение"
                                />
                            </label>
                            <textarea
                                ref={inputRef}
                                className="astra-field"
                                rows={1}
                                value={text}
                                onChange={(e) => {
                                    setText(e.target.value);
                                    resizeComposer(e.target);
                                }}
                                onKeyDown={handleKeyDown}
                                onPaste={handlePaste}
                                placeholder="Сообщение"
                                aria-label="Текст сообщения"
                                disabled={loading || Boolean(loadError)}
                            />
                            <button
                                type="button"
                                className="order-chat-send astra-press"
                                onClick={handleSend}
                                disabled={!canSend}
                                aria-busy={sending || undefined}
                                aria-label={sending ? "Отправляется" : "Отправить"}
                                title="Отправить (Enter)"
                            >
                                {sending ? <DotsPulse /> : <SendIcon />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <ImageViewerModal
                isOpen={imageViewerOpen}
                onClose={() => {
                    setImageViewerOpen(false);
                    setImageViewerData({ images: [], currentIndex: 0 });
                }}
                images={imageViewerData.images}
                currentIndex={imageViewerData.currentIndex}
            />

            <Modal 
                isOpen={profileModalOpen} 
                onClose={() => setProfileModalOpen(false)} 
                title={
                        <div>
                            <span style={ {textTransform: "none"} }>
                                Профиль покупателя
                            </span>
                            <button
                                type="button"
                                className="order-chat-close-btn"
                                onClick={() => setProfileModalOpen(false)}
                                aria-label="Закрыть"
                            >
                                <span aria-hidden="true">✕</span>
                            </button>
                        </div>
                    }
                
            >
                <div className="order-chat-profile">
                    <dl className="order-chat-facts">
                        <dt>ID</dt><dd className="text-none">{profileDetails?.id ?? "—"}</dd>
                        <dt>Никнейм</dt><dd className="text-none">{profileDetails?.nickname || "—"}</dd>
                        <dt>Логин</dt><dd className="text-none">{profileDetails?.login || "—"}</dd>
                        <dt>Email</dt><dd className="text-none">{profileDetails?.email || "—"}</dd>
                        <dt>Язык</dt><dd>{profileDetails?.language || "—"}</dd>
                        <dt>Валюта</dt><dd>{profileDetails?.currency || "—"}</dd>
                        <dt>Часовой пояс</dt><dd>{profileDetails?.timezone || "—"}</dd>
                    </dl>
                    <div className="order-chat-orders-title">
                        Заказы <span>{profileOrders.length}</span>
                    </div>
                    <div className="order-chat-orders">
                        {profileOrders.length === 0 ? (
                            <div className="order-chat-order-row">Заказов нет</div>
                        ) : (
                            profileOrders.map((order) => (
                                <div key={order.public_id} className="order-chat-order-row">
                                    <button
                                        type="button"
                                        className="order-chat-order-link text-none"
                                        onClick={() => openOrderDetails(order.public_id)}
                                    >
                                        {order.public_id}
                                    </button>
                                    <span className="order-chat-order-status">{order.status}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </Modal>

            {isSellerSide && (
                <OrderDetailsModal
                    isOpen={orderDetailsModalOpen}
                    onClose={() => setOrderDetailsModalOpen(false)}
                    order={selectedOrderDetails}
                    loading={orderDetailsLoading}
                    error={orderDetailsError}
                />
            )}
        </>
    );
};

export default OrderChat;
