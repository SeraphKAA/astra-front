import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useAuth } from '../../app/auth/AuthContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
    getChat,
    getMessages,
    sendMessage as apiSendMessage,
    getSupportChats,
    getSupportMessages,
    sendSupportMessage,
    uploadImage,
} from '../../entities/chat/api/chatApi';
import ChatMessage from '../../entities/chat/ui/chatMessage';
import { getUserById } from '../../entities/user/api/userApi';
import { getOrderByPublicId, getOrdersByUserForStaff } from '../../entities/order/api/orderApi';
import { OrderDetailsModal } from '../../entities/order/ui/OrderDetailsModal';
import { Modal } from '../../shared/ui/Modal/Modal';
import { Spinner } from '../../shared/ui/Spinner/Spinner';
import './SupportChat.css';
import { LS } from '../../utilities/utilLocalStorage';
import { useToast } from "../../shared/ui/Toast/ToastProvider";


const MAX_ATTACHMENTS = 5;

const ImageViewerModal = ({ isOpen, onClose, images, currentIndex = 0 }) => {
  const [activeIndex, setActiveIndex] = useState(currentIndex);

  // Сбрасываем индекс при открытии/закрытии
  useEffect(() => {
    if (isOpen) {
      setActiveIndex(currentIndex);
    }
  }, [isOpen, currentIndex]);

  if (!isOpen || !images || images.length === 0) return null;

  const currentImage = images[activeIndex];
  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < images.length - 1;

  const handlePrev = (e) => {
    e.stopPropagation();
    if (canGoPrev) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const handleNext = (e) => {
    e.stopPropagation();
    if (canGoNext) {
      setActiveIndex(activeIndex + 1);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft" && canGoPrev) {
      setActiveIndex(activeIndex - 1);
    } else if (e.key === "ArrowRight" && canGoNext) {
      setActiveIndex(activeIndex + 1);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Изображение ${activeIndex + 1} из ${images.length}`} variant="wide">
      <div 
        style={{ 
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center",
          minHeight: "60vh",
          position: "relative",
          userSelect: "none"
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Кнопка "Назад" */}
        {canGoPrev && (
          <button
            onClick={handlePrev}
            style={{
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.5)",
              color: "white",
              border: "none",
              borderRadius: "50%",
              width: "44px",
              height: "44px",
              fontSize: "24px",
              cursor: "pointer",
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => e.target.style.background = "rgba(0,0,0,0.8)"}
            onMouseLeave={(e) => e.target.style.background = "rgba(0,0,0,0.5)"}
          >
            ‹
          </button>
        )}

        {/* Изображение */}
        <img 
          src={currentImage.url} 
          alt={currentImage.alt || `Изображение ${activeIndex + 1}`} 
          style={{ 
            maxWidth: "90%", 
            maxHeight: "80vh",
            objectFit: "contain",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
          }} 
        />

        {/* Кнопка "Вперед" */}
        {canGoNext && (
          <button
            onClick={handleNext}
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.5)",
              color: "white",
              border: "none",
              borderRadius: "50%",
              width: "44px",
              height: "44px",
              fontSize: "24px",
              cursor: "pointer",
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => e.target.style.background = "rgba(0,0,0,0.8)"}
            onMouseLeave={(e) => e.target.style.background = "rgba(0,0,0,0.5)"}
          >
            ›
          </button>
        )}

        {/* Индикатор прогресса */}
        {images.length > 1 && (
          <div style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "8px",
            background: "rgba(0,0,0,0.5)",
            padding: "8px 16px",
            borderRadius: "20px",
          }}>
            {images.map((_, index) => (
              <div
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex(index);
                }}
                style={{
                  width: index === activeIndex ? "24px" : "10px",
                  height: "10px",
                  borderRadius: "5px",
                  background: index === activeIndex ? "#ffffff" : "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
              />
            ))}
          </div>
        )}

        {/* Счетчик изображений */}
        <div style={{
          position: "absolute",
          top: "10px",
          right: "70px",
          background: "rgba(0,0,0,0.6)",
          color: "white",
          padding: "6px 12px",
          borderRadius: "12px",
          fontSize: "14px",
          fontWeight: "500",
        }}>
          {activeIndex + 1} / {images.length}
        </div>
      </div>
    </Modal>
  );
};


const SupportChat = () => {
    const { isAuthenticated, user } = useAuth();
    const [token, setToken] = useState(null);
    const [chat, setChat] = useState(null);
    const [supportChats, setSupportChats] = useState([]);
    const [selectedSupportChatId, setSelectedSupportChatId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const [chatSearch, setChatSearch] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [selectedChatInfo, setSelectedChatInfo] = useState(null);
    const [isMobile, setIsMobile] = useState(false);
    const [mobilePane, setMobilePane] = useState('chat');
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [profileDetails, setProfileDetails] = useState(null);
    const [profileOrders, setProfileOrders] = useState([]);
    const [orderDetailsModalOpen, setOrderDetailsModalOpen] = useState(false);
    const [orderDetailsLoading, setOrderDetailsLoading] = useState(false);
    const [orderDetailsError, setOrderDetailsError] = useState(null);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
    const [orderDetailsCache, setOrderDetailsCache] = useState({});
    const messagesEndRef = useRef(null);
    const messagesWrapRef = useRef(null);
    const inputRef = useRef(null);
    const isOperator = ["support", "admin", "moderator"].includes(user?.role);
    const canViewOrderDetails = ["seller", "admin", "moderator"].includes(user?.role);
    const initialAutoScrollDoneRef = useRef(false);
    const pageSizeRef = useRef(30);
    const pagingRef = useRef({ offset: 0, hasMore: true, loadingMore: false });
    const pendingScrollAdjustRef = useRef(null);
    const { pushToast } = useToast();

    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [imageViewerData, setImageViewerData] = useState({
      images: [],
      currentIndex: 0
    });

    const scrollToBottom = () => {
        const wrap = messagesWrapRef.current;
        if (!wrap) return;
        wrap.scrollTop = wrap.scrollHeight;
    };

    useEffect(() => {
        const mql = window.matchMedia?.('(max-width: 720px)');
        if (!mql) return;

        const apply = () => setIsMobile(Boolean(mql.matches));
        apply();

        if (mql.addEventListener) {
            mql.addEventListener('change', apply);
            return () => mql.removeEventListener('change', apply);
        }
        // Safari fallback
        mql.addListener(apply);
        return () => mql.removeListener(apply);
    }, []);

    useEffect(() => {
        if (isOperator && isMobile) {
            setMobilePane('list');
        } else {
            setMobilePane('chat');
        }
    }, [isOperator, isMobile]);

    // WebSocket подключение
    const {
        isConnected,
        messages: wsMessages,
    } = useWebSocket(isOperator ? selectedSupportChatId : chat?.id, token, { enabled: true });

    // Загрузка чата и истории сообщений
    useEffect(() => {
        const loadChat = async () => {
            try {
                setIsLoading(true);
                const accessToken = await LS.get("access_token");
                setToken(accessToken);
                if (!isAuthenticated) return;
                if (isOperator) {
                    const chats = await getSupportChats(100, 0);
                    setSupportChats(chats);
                    if (chats.length > 0) {
                        setSelectedSupportChatId(chats[0].id);
                        setSelectedChatInfo(chats[0]);
                        const limit = pageSizeRef.current;
                        const history = await getSupportMessages(chats[0].id, limit, 0);
                        setMessages(history.reverse()); // oldest -> newest
                        pagingRef.current = {
                            offset: history.length,
                            hasMore: history.length === limit,
                            loadingMore: false,
                        };
                        if (isMobile) {
                            setMobilePane('list');
                        }
                    } else {
                        setMessages([]);
                        pagingRef.current = { offset: 0, hasMore: false, loadingMore: false };
                    }
                } else {
                    // Получаем или создаем чат
                    const chatData = await getChat('support');
                    setChat(chatData);

                    // Загружаем историю сообщений
                    const limit = pageSizeRef.current;
                    const history = await getMessages('support', limit, 0);
                    setMessages(history.reverse()); // oldest -> newest
                    pagingRef.current = {
                        offset: history.length,
                        hasMore: history.length === limit,
                        loadingMore: false,
                    };
                }
            } catch (error) {
                // console.error('Error loading chat:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadChat();
    }, [isAuthenticated, isOperator, isMobile]);

    useEffect(() => {
        const loadSelectedChat = async () => {
            if (!isOperator || !selectedSupportChatId) return;
            setIsLoading(true);
            try {
                const limit = pageSizeRef.current;
                const history = await getSupportMessages(selectedSupportChatId, limit, 0);
                setMessages(history.reverse()); // oldest -> newest
                pagingRef.current = {
                    offset: history.length,
                    hasMore: history.length === limit,
                    loadingMore: false,
                };
                const chatInfo = supportChats.find((item) => item.id === selectedSupportChatId);
                if (chatInfo) {
                    setSelectedChatInfo(chatInfo);
                }
            } catch (error) {
                // console.error('Error loading support chat messages:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadSelectedChat();
    }, [isOperator, selectedSupportChatId, supportChats]);

    // When switching chats (or initial chat id appears), ensure we start at bottom
    useLayoutEffect(() => {
        initialAutoScrollDoneRef.current = false;
        requestAnimationFrame(() => {
            scrollToBottom();
        });
    }, [selectedSupportChatId, chat?.id]);

    const loadOlderMessages = async () => {
        const wrap = messagesWrapRef.current;
        if (!wrap) return;

        const { offset, hasMore, loadingMore } = pagingRef.current;
        if (!hasMore || loadingMore) return;

        pagingRef.current = { ...pagingRef.current, loadingMore: true };
        try {
            const chatId = isOperator ? selectedSupportChatId : chat?.id;
            if (!chatId) return;

            const limit = pageSizeRef.current;
            const prevScrollTop = wrap.scrollTop;
            const prevScrollHeight = wrap.scrollHeight;

            const older = isOperator
                ? await getSupportMessages(chatId, limit, offset)
                : await getMessages('support', limit, offset);

            const olderAsc = older.reverse(); // oldest -> newest
            if (olderAsc.length > 0) {
                pendingScrollAdjustRef.current = { prevScrollTop, prevScrollHeight };
                setMessages((prev) => [...olderAsc, ...prev]);
            }

            pagingRef.current = {
                offset: offset + olderAsc.length,
                hasMore: olderAsc.length === limit,
                loadingMore: false,
            };
        } catch (e) {
            // console.error("Error loading older messages:", e);
            pagingRef.current = { ...pagingRef.current, loadingMore: false };
        }
    };
    
    const handleImageClick = (images, clickedIndex = 0) => {
        if (!images || images.length === 0) return;
        
        // Форматируем изображения для единообразного отображения
        const formattedImages = images.map(img => ({
            url: img.url || img,
            alt: img.name || img.alt || 'Изображение'
        }));
        
        setImageViewerData({
            images: formattedImages,
            currentIndex: clickedIndex
        });
        setImageViewerOpen(true);
    };

    // Обновляем сообщения из WebSocket
    useEffect(() => {
        if (wsMessages.length > 0) {
            const lastMessage = wsMessages[wsMessages.length - 1];
            setMessages(prev => {
                if (prev.some((item) => item.id === lastMessage.id)) {
                    return prev;
                }
                return [...prev, lastMessage];
            });
        }
    }, [wsMessages]);

    // Автоскролл к новым сообщениям
    useEffect(() => {
        const wrap = messagesWrapRef.current;
        if (!wrap) return;

        const nearBottom =
            wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 120;

        // Если мы только что подгрузили старые сообщения сверху — сохраняем позицию скролла
        if (pendingScrollAdjustRef.current) {
            const { prevScrollTop, prevScrollHeight } = pendingScrollAdjustRef.current;
            pendingScrollAdjustRef.current = null;
            const newScrollHeight = wrap.scrollHeight;
            wrap.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
            return;
        }

        // при первом рендере/загрузке — без анимации, всегда скроллим в самый низ
        if (!initialAutoScrollDoneRef.current) {
            initialAutoScrollDoneRef.current = true;
            wrap.scrollTop = wrap.scrollHeight;
            return;
        }

        // для новых сообщений — скроллим только если пользователь не листает вверх
        if (nearBottom) {
            wrap.scrollTop = wrap.scrollHeight;
        }
    }, [messages]);


    const autoResize = (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const remaining = MAX_ATTACHMENTS - (attachments.length + 1);
        if (remaining > 0) {
            pushToast({ 
                type: "info", 
                message: `Загружено ${attachments.length + 1} из ${MAX_ATTACHMENTS}. Можно добавить еще ${remaining}`,
                duration: 2000
            });
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
        if (!allowedTypes.includes(file.type)) {
            pushToast({type: "error", msg: 'Разрешены только изображения (JPEG, PNG, WEBP, SVG)'});

            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            pushToast({type: "error", msg: 'Файл не должен превышать 5 МБ'});
            return;
        }
        setUploading(true);
        try {
        const result = await uploadImage(file);
        setAttachments((prev) => [...prev, { 
            id: result.upload_id,
            url: result.url,
            name: result.name,
            type: result.type,
        }]);
        } catch (error) {
            pushToast({type: "error", msg: 'Ошибка загрузки изображения'});

        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const removeAttachment = (index) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSendMessage = async () => {
        const trimmedText = newMessage.trim();
        if (!trimmedText && attachments.length === 0) return;
        if (isSending) return;

        if (attachments.length > MAX_ATTACHMENTS) {
            pushToast({ 
                type: "error", 
                message: `Нельзя отправить больше ${MAX_ATTACHMENTS} изображений` 
            });
            return;
        }

        setIsSending(true);
        const currentAttachments = [...attachments];
        const payload = {
            text: trimmedText,
            attachment_ids: currentAttachments.map(a => a.id),
        };
        setNewMessage('');
        setAttachments([]);
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage = {
            id: tempId,
            chat_id: isOperator ? selectedSupportChatId : chat?.id,
            sender: isOperator ? 'support' : 'user',
            text: trimmedText || 'Вложение',
            attachments: currentAttachments,
            created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticMessage]);

        try {
            let sent = null;
            if (isOperator && selectedSupportChatId) {
                sent = await sendSupportMessage(selectedSupportChatId, payload);
            } else {
                sent = await apiSendMessage('support', payload);
            }
            if (sent?.id) {
                setMessages((prev) => {
                    const withoutTemp = prev.filter((m) => m.id !== tempId);
                    if (withoutTemp.some((m) => m.id === sent.id)) {
                        return withoutTemp;
                    }
                    return sent?.id ? [...withoutTemp, sent] : withoutTemp;
                });
            }
        } catch (error) {
            // Восстанавливаем текст и вложения при ошибке
            setNewMessage(trimmedText);
            setAttachments(currentAttachments);
        } finally {
            setIsSending(false);
            inputRef.current?.focus();
        }
    };

    // Обработка Enter
    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        if (e.shiftKey) return;
        e.preventDefault();
        handleSendMessage();
    };

    const handleEditMessage = (messageId, newText) => {
        setMessages(prev =>
            prev.map(msg =>
                msg.id === messageId ? { ...msg, text: newText } : msg
            )
        );
    };

    const handleDeleteMessage = (messageId) => {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
    };

    const formatSender = (chatInfo) => {
        if (!chatInfo) return "Пользователь";
        return chatInfo.user_nickname || chatInfo.user_login || chatInfo.user_email || `User #${chatInfo.user_id}`;
    };

    const openUserModal = async () => {
        if (!isOperator || !selectedChatInfo?.user_id) return;
        try {
            const [userData, ordersData] = await Promise.all([
                getUserById(selectedChatInfo.user_id),
                getOrdersByUserForStaff(selectedChatInfo.user_id),
            ]);
            setProfileDetails(userData);
            setProfileOrders(Array.isArray(ordersData) ? ordersData : []);
            setProfileModalOpen(true);
        } catch (error) {
            // console.error("Error loading user details:", error);
        }
    };

    const openOrderDetails = async (publicId) => {
        if (!canViewOrderDetails || !publicId) return;
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
            setOrderDetailsError(e?.message || "Не удалось загрузить заказ");
        } finally {
            setOrderDetailsLoading(false);
        }
    };

    const filteredSupportChats = isOperator
        ? supportChats.filter((chatItem) => {
            const label = formatSender(chatItem).toLowerCase();
            return label.includes(chatSearch.trim().toLowerCase());
        })
        : [];

    const showSidebar = isOperator && (!isMobile || mobilePane === 'list');
    const showMain = !isOperator || !isMobile || mobilePane === 'chat';

    if (isLoading) {
        return (
            <div className="support-chat-loading">
                <Spinner color="#E2799B" size={40} label="Загрузка чата..." />
            </div>
        );
    }

    return (
        <>
            <div className="support-chat">
                {showSidebar && (
                    <aside className="support-chat-sidebar">
                        <h3>Чаты клиентов</h3>
                        <input
                            className="support-chat-search"
                            placeholder="Поиск по никнейму/email"
                            value={chatSearch}
                            onChange={(e) => setChatSearch(e.target.value)}
                        />
                        <div className="support-chat-list">
                            {filteredSupportChats.length === 0 ? (
                                <div className="support-chat-empty-list">Пока нет открытых чатов</div>
                            ) : (
                                filteredSupportChats.map((chatItem) => (
                                    <button
                                        type="button"
                                        key={chatItem.id}
                                        className={`support-chat-list-item ${selectedSupportChatId === chatItem.id ? "is-active" : ""}`}
                                        onClick={() => {
                                            setSelectedSupportChatId(chatItem.id);
                                            setSelectedChatInfo(chatItem);
                                            if (isMobile) {
                                                setMobilePane('chat');
                                            }
                                        }}
                                    >
                                        <div className="support-chat-list-title">{formatSender(chatItem)}</div>
                                        <div className="support-chat-list-subtitle">Чат #{chatItem.id}</div>
                                    </button>
                                ))
                            )}
                        </div>
                    </aside>
                )}
                {showMain && (
                    <div className="support-chat-main">
                        <div className="chat-header">
                            {isOperator && isMobile && mobilePane === 'chat' && (
                                <button
                                    type="button"
                                    className="support-chat-back-btn"
                                    onClick={() => setMobilePane('list')}
                                    aria-label="Назад к списку чатов"
                                >
                                    ←
                                </button>
                            )}
                            <h2>
                                {isOperator && selectedChatInfo
                                    ? `Диалог: ${formatSender(selectedChatInfo)}`
                                    : "Техническая поддержка"}
                            </h2>
                        </div>
                        <div
                            className="chat-messages"
                            ref={messagesWrapRef}
                            onScroll={() => {
                                const wrap = messagesWrapRef.current;
                                if (!wrap) return;
                                if (wrap.scrollTop < 80) {
                                    loadOlderMessages();
                                }
                            }}
                        >
                            {messages.length === 0 ? (
                                <div className="empty-chat">
                                    <p>📝 Напишите нам, и мы обязательно поможем!</p>
                                    <p className="hint">Опишите вашу проблему, и специалист свяжется с вами в ближайшее время</p>
                                </div>
                            ) : (
                                messages.map((message) => (
                                    <ChatMessage
                                        key={message.id}
                                        message={message}
                                        isOwn={isOperator ? message.sender === "support" : message.sender === 'user'}
                                        senderLabel={
                                            isOperator
                                                ? (message.sender === "support" ? "Техподдержка" : formatSender(selectedChatInfo))
                                                : undefined
                                        }
                                        senderClickable={isOperator && message.sender !== "support"}
                                        onSenderClick={openUserModal}
                                        onEdit={handleEditMessage}
                                        onDelete={handleDeleteMessage}
                                        onImageClick={handleImageClick} 
                                    />
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="chat-input-area">
                        {attachments.length > 0 && (
                            <div className="attachment-previews">
                                {attachments.map((att, idx) => (
                                    <div key={idx} className="attachment-preview">
                                        <img src={att.url} alt={att.name || 'вложение'} />
                                        <button type="button" onClick={() => removeAttachment(idx)}>✕</button>
                                    </div>
                                ))}
                                {uploading && <span className="uploading-indicator">Загрузка...</span>}
                            </div>
                        )}
                        <div className="input-row">
                            <label className="attach-btn" disabled={uploading || attachments.length >= MAX_ATTACHMENTS}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M16.5 6V17.5C16.5 19.9853 14.4853 22 12 22C9.51472 22 7.5 19.9853 7.5 17.5V6C7.5 4.067 9.067 2.5 11 2.5C12.933 2.5 14.5 4.067 14.5 6V17.5C14.5 18.6046 13.6046 19.5 12.5 19.5C11.3954 19.5 10.5 18.6046 10.5 17.5V7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <input
                                    type="file"
                                    accept="image/*"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    disabled={uploading || attachments.length >= MAX_ATTACHMENTS}
                                    style={{ display: 'none' }}
                                />
                            </label>
                            <textarea
                                ref={inputRef}
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Введите ваше сообщение..."
                                disabled={isSending}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={(!newMessage.trim() && attachments.length === 0) || isSending}
                                className="send-btn"
                            >
                                {isSending ? 'Отправка...' : 'Отправить'}
                            </button>
                        </div>
                        </div>
                    </div>
                )}
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
                title="Профиль пользователя"
            >
                <div className="support-user-modal">
                    <div><strong>ID:</strong> {profileDetails?.id ?? "-"}</div>
                    <div><strong>Никнейм:</strong> {profileDetails?.nickname || "-"}</div>
                    <div><strong>Логин:</strong> {profileDetails?.login || "-"}</div>
                    <div><strong>Email:</strong> {profileDetails?.email || "-"}</div>
                    <div className="support-user-orders-title">Заказы</div>
                    <div className="support-user-orders">
                        {profileOrders.length === 0 ? (
                            <div className="support-user-order-row">Нет заказов</div>
                        ) : (
                            profileOrders.map((order) => (
                                <div key={order.public_id} className="support-user-order-row">
                                    {canViewOrderDetails ? (
                                        <button
                                            type="button"
                                            onClick={() => openOrderDetails(order.public_id)}
                                            style={{ background: "transparent", border: "none", padding: 0, color: "#2563eb", cursor: "pointer" }}
                                        >
                                            {order.public_id}
                                        </button>
                                    ) : (
                                        <span>{order.public_id}</span>
                                    )}
                                    <span>{order.status}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </Modal>
            <OrderDetailsModal
                isOpen={orderDetailsModalOpen}
                onClose={() => setOrderDetailsModalOpen(false)}
                order={selectedOrderDetails}
                loading={orderDetailsLoading}
                error={orderDetailsError}
            />
        </>
    );
};

export default SupportChat;