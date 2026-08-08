import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/auth/AuthContext";
import { getChat, getMessages, sendMessage, uploadImage } from "../../entities/chat/api/chatApi";
import { useWebSocket } from "../../hooks/useWebSocket";
import ChatMessage from "../../entities/chat/ui/chatMessage";
import { getUserById } from "../../entities/user/api/userApi";
import { getOrderByPublicId, getOrdersByUserForStaff } from "../../entities/order/api/orderApi";
import { OrderDetailsModal } from "../../entities/order/ui/OrderDetailsModal";
import { Modal } from "../../shared/ui/Modal/Modal";
import "./orderChat.css";
import { ToastProvider, useToast } from "../../shared/ui/Toast/ToastProvider";


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


// const ImageViewerModal = ({ isOpen, onClose, imageUrl, alt }) => {
//   if (!isOpen) return null;

//   return (
//     <Modal isOpen={isOpen} onClose={onClose} title="Просмотр изображения" variant="wide">
//       <div style={{ 
//         display: "flex", 
//         justifyContent: "center", 
//         alignItems: "center",
//         maxHeight: "80vh",
//         overflow: "auto"
//       }}>
//         <img 
//           src={imageUrl} 
//           alt={alt || "Изображение"} 
//           style={{ 
//             maxWidth: "100%", 
//             maxHeight: "80vh",
//             objectFit: "contain",
//             borderRadius: "8px"
//           }} 
//         />
//       </div>
//     </Modal>
//   );
// };

const OrderChat = () => {
    const { orderId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [chat, setChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(true);
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

    // const [imageViewerOpen, setImageViewerOpen] = useState(false);
    // const [selectedImage, setSelectedImage] = useState(null);
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [imageViewerData, setImageViewerData] = useState({
      images: [],
      currentIndex: 0
    });

    const wrapRef = useRef(null);
    const inputRef = useRef(null);
    const { pushToast } = useToast();

    const token = localStorage.getItem("access_token");
    const { messages: wsMessages } = useWebSocket(chat?.id, token, { enabled: true });

    const scrollToBottom = () => {
        const el = wrapRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    };

    const autoResize = (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (attachments.length >= MAX_ATTACHMENTS) {
            pushToast({ 
                type: "error", 
                message: `Максимальное количество изображений - ${MAX_ATTACHMENTS}` 
            });
            e.target.value = '';
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
        if (!allowedTypes.includes(file.type)) {
            pushToast({ type: "error", message: 'Разрешены только изображения (JPEG, PNG, WEBP, SVG)' }); 
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            pushToast({ type: "error", message: 'Файл не должен превышать 5 МБ' }); 
            return;
        }
        setUploading(true);
        try {
            const result = await uploadImage(file);
            // result содержит { upload_id, url, name?, type? }
            setAttachments((prev) => [...prev, {
                id: result.upload_id,
                url: result.url,
                name: result.name || file.name,
                type: result.type || file.type,
            }]);

            const remaining = MAX_ATTACHMENTS - (attachments.length + 1);
            if (remaining > 0) {
                pushToast({ 
                    type: "info", 
                    message: `Загружено ${attachments.length + 1} из ${MAX_ATTACHMENTS}. Можно добавить еще ${remaining}`,
                    duration: 2000
                });
            }

        } catch (error) {
            pushToast({ type: "error", message: 'Ошибка загрузки изображения' }); 
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const removeAttachment = (index) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    // const handleImageClick = (imageUrl, alt) => {
    //     setSelectedImage({ url: imageUrl, alt });
    //     setImageViewerOpen(true);
    // };
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


    useEffect(() => {
        const load = async () => {
            if (!orderId) return;
            setLoading(true);
            try {
                const chatData = await getChat("order", orderId);
                setChat(chatData);
                setOrderPublicId(chatData?.order_public_id || null);
                const history = await getMessages("order", 100, 0, orderId);
                setMessages(Array.isArray(history) ? history.reverse() : []);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [orderId]);

    useEffect(() => {
        if (wsMessages.length === 0) return;
        const incoming = wsMessages[wsMessages.length - 1];
        setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
    }, [wsMessages]);

    useLayoutEffect(() => {
        requestAnimationFrame(() => {
            scrollToBottom();
        });
    }, [messages.length]);

    const handleKeyDown = (e) => {
        if (e.key !== "Enter") return;
        if (e.shiftKey) return;
        e.preventDefault();
        handleSend();
    };

    const handleSend = async () => {
        const trimmedText = text.trim();
        if (!trimmedText && attachments.length === 0) return;
        if (!orderId) return;
        if (sending) return;

        if (attachments.length > MAX_ATTACHMENTS) {
            pushToast({ 
                type: "error", 
                message: `Нельзя отправить больше ${MAX_ATTACHMENTS} изображений` 
            });
            return;
        }

        setSending(true);
        const currentAttachments = [...attachments];
        const payload = {
            text: trimmedText,
            attachment_ids: currentAttachments.map(a => a.id),
        };
        setText("");
        setAttachments([]);
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage = {
            id: tempId,
            chat_id: chat?.id,
            sender: user?.role === "seller" ? "support" : "user",
            text: trimmedText || "Вложение",
            attachments: currentAttachments,
            created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticMessage]);

        try {
            const sent = await sendMessage("order", payload, orderId);
            setMessages((prev) => {
                const withoutTemp = prev.filter((m) => m.id !== tempId);
                if (sent?.id && withoutTemp.some((m) => m.id === sent.id)) {
                    return withoutTemp;
                }
                return sent?.id ? [...withoutTemp, sent] : withoutTemp;
            });
        } catch (error) {
            pushToast({ type: "error", message: error }); 
            setText(trimmedText);
            setAttachments(currentAttachments);
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const formatCustomerName = () => {
        if (!chat) return "Покупатель";
        return chat.user_nickname || chat.user_login || chat.user_email || `Покупатель #${chat.user_id}`;
    };

    const isSellerSide = ["seller", "admin", "moderator"].includes(user?.role);
    const backRoute = isSellerSide ? "/seller-chat" : "/orders";
    const titleOrderId = orderPublicId || orderId;
    const otherSideLabel = isSellerSide ? formatCustomerName() : "Продавец";

    useEffect(() => {
        if (!isSellerSide) {
            setOrderDetailsModalOpen(false);
        }
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
            pushToast({ type: "error", message: error }); 
        }
    };

    const openOrderDetails = async (publicId) => {
        if (!["seller", "admin", "moderator"].includes(user?.role) || !publicId) return;
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

    if (loading) return <div className="order-chat-page">Загрузка чата...</div>;

    return (
        <>
            <div className="order-chat-page">
                <div className="order-chat-main">
                    <div className="chat-header">
                        <div className="order-chat-header-left">
                            <button type="button" className="order-chat-back-btn" onClick={() => navigate(backRoute)}>
                                Вернуться
                            </button>
                            {isSellerSide && orderPublicId ? (
                                <button
                                    type="button"
                                    className="order-chat-order-id-btn"
                                    onClick={() => openOrderDetails(orderPublicId)}
                                >
                                    {`Чат по заказу ${titleOrderId}`}
                                </button>
                            ) : (
                                <h2>{`Чат по заказу ${titleOrderId}`}</h2>
                            )}
                        </div>
                        <div className="connection-status">
                            {/* <span className="status online">● Онлайн</span> */}
                        </div>
                    </div>
                    <div className="chat-messages" ref={wrapRef}>
                        {messages.length === 0 ? (
                            <div className="empty-chat">
                                <p>Пока нет сообщений</p>
                                <p className="hint">Начните диалог с покупателем</p>
                            </div>
                        ) : (
                            messages.map((m) => (
                                <ChatMessage
                                    key={m.id}
                                    message={m}
                                    isOwn={isSellerSide ? m.sender === "support" : m.sender === "user"}
                                    senderLabel={isSellerSide ? (m.sender === "support" ? "Вы" : otherSideLabel) : (m.sender === "user" ? "Вы" : otherSideLabel)}
                                    senderClickable={isSellerSide && m.sender !== "support"}
                                    onSenderClick={openUserModal}
                                    onEdit={(id, newText) =>
                                        setMessages((prev) => prev.map((msg) => (msg.id === id ? { ...msg, text: newText } : msg)))
                                    }
                                    onDelete={(id) => setMessages((prev) => prev.filter((msg) => msg.id !== id))}
                                    onImageClick={handleImageClick} // Передаем обработчик клика по изображению
                                />
                            ))
                        )}
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
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onInput={autoResize}
                                placeholder="Введите сообщение..."
                                disabled={sending}
                            />
                            <button
                                type="button"
                                className="send-btn"
                                onClick={handleSend}
                                disabled={sending || (!text.trim() && attachments.length === 0)}
                            >
                                {sending ? "Отправка..." : "Отправить"}
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

            {/* <ImageViewerModal 
                isOpen={imageViewerOpen}
                onClose={() => {
                    setImageViewerOpen(false);
                    setSelectedImage(null);
                }}
                imageUrl={selectedImage?.url}
                alt={selectedImage?.alt}
            /> */}

            <Modal
                isOpen={profileModalOpen}
                onClose={() => setProfileModalOpen(false)}
                title="Профиль покупателя"
            >
                <div className="support-user-modal">
                    <div><strong>ID:</strong> {profileDetails?.id ?? "-"}</div>
                    <div><strong>Никнейм:</strong> {profileDetails?.nickname || "-"}</div>
                    <div><strong>Логин:</strong> {profileDetails?.login || "-"}</div>
                    <div><strong>Email:</strong> {profileDetails?.email || "-"}</div>
                    <div><strong>Язык:</strong> {profileDetails?.language || "-"}</div>
                    <div><strong>Валюта:</strong> {profileDetails?.currency || "-"}</div>
                    <div><strong>Регион (таймзона):</strong> {profileDetails?.timezone || "-"}</div>
                    <div className="support-user-orders-title">Заказы</div>
                    <div className="support-user-orders">
                        {profileOrders.length === 0 ? (
                            <div className="support-user-order-row">Нет заказов</div>
                        ) : (
                            profileOrders.map((order) => (
                                <div key={order.public_id} className="support-user-order-row">
                                    <button
                                        type="button"
                                        onClick={() => openOrderDetails(order.public_id)}
                                        style={{ background: "transparent", border: "none", padding: 0, color: "#2563eb", cursor: "pointer" }}
                                    >
                                        {order.public_id}
                                    </button>
                                    <span>{order.status}</span>
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