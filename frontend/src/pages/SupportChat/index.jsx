import React, { useCallback, useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../app/auth/AuthContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
    getChat,
    getMessages,
    sendMessage as apiSendMessage,
    getSupportChats,
    getSupportMessages,
    sendSupportMessage,
    markChatRead,
    uploadImage,
} from '../../entities/chat/api/chatApi';
import ChatMessage from '../../entities/chat/ui/chatMessage';
import { getUserById } from '../../entities/user/api/userApi';
import { getOrderByPublicId, getOrdersByUserForStaff, refundOrder } from '../../entities/order/api/orderApi';
import { OrderDetailsModal } from '../../entities/order/ui/OrderDetailsModal';
import { Modal } from '../../shared/ui/Modal/Modal';
import './SupportChat.css';
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import { useUnreadCounts } from "../../app/unread/UnreadContext";

const SUPPORT_HOURS_LABEL = 'Магазин работает с 10:00 до 22:00 МСК';
const MAX_ATTACHMENTS = 5;
const MAX_COMPOSER_HEIGHT = 135;

/* Иконки — авторские, обводка 2, скруглённые концы (никаких эмодзи). */
const ChevronLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M14.5 5 8 12l6.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M9.5 5 16 12l-6.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ChatOutlineIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path
      d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.6 3.6a.6.6 0 0 1-.97-.47V16H6.5A2.5 2.5 0 0 1 4 13.5v-7Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M8.5 8.5h7M8.5 11.5h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const AlertIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M12 4.5 2.8 20h18.4L12 4.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 10v4.2M12 17.2v.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PaperclipIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M16.5 6V17.5C16.5 19.9853 14.4853 22 12 22C9.51472 22 7.5 19.9853 7.5 17.5V6C7.5 4.067 9.067 2.5 11 2.5C12.933 2.5 14.5 4.067 14.5 6V17.5C14.5 18.6046 13.6046 19.5 12.5 19.5C11.3954 19.5 10.5 18.6046 10.5 17.5V7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <circle cx="12" cy="8.5" r="3.8" stroke="currentColor" strokeWidth="2" />
    <path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** Три «дышащие» точки — индикатор отправки/загрузки. */
const DotsPulse = () => (
  <span className="support-dots" aria-hidden="true">
    <i />
    <i />
    <i />
  </span>
);

/* ---------- разделители дней ---------- */
const dayKeyOf = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const dayLabelOf = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const key = dayKeyOf(iso);
  if (key === dayKeyOf(now.toISOString())) return 'Сегодня';
  if (key === dayKeyOf(yesterday.toISOString())) return 'Вчера';
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
};

const isPendingId = (id) => typeof id === 'string' && id.startsWith('temp-');

/** Пометить сообщения «тихими» — они не должны проигрывать появление. */
const markQuiet = (set, list) => {
  (list || []).forEach((m) => {
    if (m && m.id != null) set.add(m.id);
  });
};

/**
 * Просмотрщик изображений — построен на общем Modal (Escape, клик по
 * подложке, одна скрытая кнопка закрытия), стрелки слушаем на окне,
 * чтобы листать без предварительного клика по холсту.
 */
const ImageViewerModal = ({ isOpen, onClose, images, currentIndex = 0 }) => {
  const [activeIndex, setActiveIndex] = useState(currentIndex);

  // Сбрасываем индекс при открытии/закрытии
  useEffect(() => {
    if (isOpen) {
      setActiveIndex(currentIndex);
    }
  }, [isOpen, currentIndex]);

  const total = images?.length || 0;

  useEffect(() => {
    if (!isOpen || total < 2) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') {
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'ArrowRight') {
        setActiveIndex((i) => Math.min(total - 1, i + 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, total]);

  if (!isOpen || !images || images.length === 0) return null;

  const safeIndex = Math.min(activeIndex, images.length - 1);
  const currentImage = images[safeIndex];
  const canGoPrev = safeIndex > 0;
  const canGoNext = safeIndex < images.length - 1;

  const handlePrev = (e) => {
    e.stopPropagation();
    if (canGoPrev) {
      setActiveIndex(safeIndex - 1);
    }
  };

  const handleNext = (e) => {
    e.stopPropagation();
    if (canGoNext) {
      setActiveIndex(safeIndex + 1);
    }
  };

  /* Стрелки слушаем один раз на окне (эффект выше): дублирующий
     обработчик на самом холсте перелистывал бы через кадр. Escape
     закрывает базовый Modal. */
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Изображение ${safeIndex + 1} из ${images.length}`} variant="wide">
      <div className="support-viewer">
        {/* Кнопка "Назад" */}
        {canGoPrev && (
          <button
            type="button"
            onClick={handlePrev}
            className="support-viewer-nav support-viewer-nav--prev astra-press"
            aria-label="Предыдущее изображение"
          >
            <ChevronLeftIcon />
          </button>
        )}

        {/* Изображение */}
        <img
          className="support-viewer-image"
          src={currentImage.url}
          alt={currentImage.alt || `Изображение ${safeIndex + 1}`}
        />

        {/* Кнопка "Вперед" */}
        {canGoNext && (
          <button
            type="button"
            onClick={handleNext}
            className="support-viewer-nav support-viewer-nav--next astra-press"
            aria-label="Следующее изображение"
          >
            <ChevronRightIcon />
          </button>
        )}

        {/* Индикатор прогресса */}
        {images.length > 1 && (
          <div className="support-viewer-dots">
            {images.map((_, index) => (
              <button
                key={index}
                type="button"
                className={`support-viewer-dot${index === safeIndex ? ' is-active' : ''}`}
                aria-label={`Показать изображение ${index + 1}`}
                aria-current={index === safeIndex}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex(index);
                }}
              />
            ))}
          </div>
        )}

        {/* Счетчик изображений */}
        <div className="support-viewer-counter" aria-live="polite">
          {safeIndex + 1} / {images.length}
        </div>
      </div>
      {currentImage.alt ? (
        <p className="support-viewer-caption">{currentImage.alt}</p>
      ) : null}
    </Modal>
  );
};


const SupportChat = () => {
    const { isAuthenticated, user } = useAuth();
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
    const [loadError, setLoadError] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const messagesEndRef = useRef(null);
    const messagesWrapRef = useRef(null);
    const inputRef = useRef(null);
    const isOperator = ["support", "admin", "moderator"].includes(user?.role);
    const canViewOrderDetails = ["seller", "admin", "moderator"].includes(user?.role);
    const initialAutoScrollDoneRef = useRef(false);
    const pageSizeRef = useRef(30);
    const pagingRef = useRef({ offset: 0, hasMore: true, loadingMore: false });
    const pendingScrollAdjustRef = useRef(null);
    const tempSeqRef = useRef(0);
    /* Ширина экрана — не повод перечитывать переписку. Держим её в ref:
       загрузчик истории читает значение, но НЕ пересоздаётся из-за него. */
    const isMobileRef = useRef(isMobile);
    isMobileRef.current = isMobile;
    const { pushToast } = useToast();
    const { counts, refetch: refetchUnread } = useUnreadCounts();

    /* Появление играет ТОЛЬКО у по-настоящему новых сообщений: всё, что
       пришло из истории (первая загрузка, смена диалога, подгрузка вверх),
       помечается «тихим» и не анимируется ни при монтировании, ни при
       повторных рендерах. */
    const quietIdsRef = useRef(new Set());

    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [imageViewerData, setImageViewerData] = useState({
      images: [],
      currentIndex: 0
    });

    const [refundModalOpen, setRefundModalOpen] = useState(false);
    const [refundTarget, setRefundTarget] = useState(null);
    const [refundReason, setRefundReason] = useState('');
    const [refundAmount, setRefundAmount] = useState('');
    const [refundSubmitting, setRefundSubmitting] = useState(false);

    const canRefundOrders = ["support", "admin", "moderator"].includes(user?.role);
    
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
        readEvents,
    } = useWebSocket(isOperator ? selectedSupportChatId : chat?.id, { enabled: true });

    // Загрузка чата и истории сообщений
    useEffect(() => {
        const loadChat = async () => {
            try {
                setIsLoading(true);
                setLoadError('');
                if (!isAuthenticated) return;
                if (isOperator) {
                    const chats = await getSupportChats(100, 0);
                    setSupportChats(chats);
                    if (chats.length === 0) {
                        setMessages([]);
                        pagingRef.current = { offset: 0, hasMore: false, loadingMore: false };
                    }
                    
                    if (isMobileRef.current) {
                        setMobilePane('list');
                    }
                    if (chats.length > 0) {
                        const limit = pageSizeRef.current;
                        const history = await getSupportMessages(chats[0].id, limit, 0);
                        const ascending = history.reverse(); // oldest -> newest
                        markQuiet(quietIdsRef.current, ascending);
                        setMessages(ascending);
                        pagingRef.current = {
                            offset: ascending.length,
                            hasMore: ascending.length === limit,
                            loadingMore: false,
                        };
                        if (isMobileRef.current) {
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
                    const ascending = history.reverse(); // oldest -> newest
                    markQuiet(quietIdsRef.current, ascending);
                    setMessages(ascending);
                    pagingRef.current = {
                        offset: ascending.length,
                        hasMore: ascending.length === limit,
                        loadingMore: false,
                    };
                }
            } catch (error) {
                // console.error('Error loading chat:', error);
                setLoadError(error?.message || 'Не удалось загрузить переписку');
            } finally {
                setIsLoading(false);
            }
        };

        loadChat();
        /* isMobile здесь намеренно нет: поворот экрана или перетаскивание
           границы 720px перечитывали историю, и setMessages стирал живые
           сообщения из сокета вместе с уже подгруженной вверх лентой. */
    }, [isAuthenticated, isOperator]);

    useEffect(() => {
        const chatId = isOperator ? selectedSupportChatId : chat?.id;
        if (!chatId || isLoading) return;
        markChatRead(chatId).then(() => refetchUnread()).catch(() => {});
    }, [isOperator, selectedSupportChatId, chat?.id, isLoading, refetchUnread]);


    /* История — только при смене выбранного чата. */
    useEffect(() => {
        if (!isOperator || !selectedSupportChatId) return undefined;
        let alive = true;
        const run = async () => {
            setIsLoading(true);
            setLoadError('');
            try {
                const limit = pageSizeRef.current;
                const history = await getSupportMessages(selectedSupportChatId, limit, 0);
                if (!alive) return;
                const ascending = history.reverse();
                markQuiet(quietIdsRef.current, ascending);
                setMessages(ascending);
                pagingRef.current = {
                    offset: ascending.length,
                    hasMore: ascending.length === limit,
                    loadingMore: false,
                };
            } catch (error) {
                if (!alive) return;
                setLoadError(error?.message || 'Не удалось загрузить переписку');
            } finally {
                if (alive) setIsLoading(false);
            }
        };
        run();
        return () => { alive = false; };
    }, [isOperator, selectedSupportChatId]);

    /* Заголовок — обновляется при перезагрузке списка чатов. */
    useEffect(() => {
        if (!isOperator || !selectedSupportChatId) return;
        const fresh = supportChats.find((c) => c.id === selectedSupportChatId);
        if (fresh) setSelectedChatInfo(fresh);
    }, [isOperator, selectedSupportChatId, supportChats]);

    useEffect(() => {
        if (!readEvents.length) return;
        const lastEvent = readEvents[readEvents.length - 1];

        // readEvents приходят по конкретному chat_id
        const activeChatId = isOperator ? selectedSupportChatId : chat?.id;
        if (lastEvent.chat_id !== activeChatId) return;

        // reader_sender — кто прочитал. Мы показываем статус у своих сообщений,
        // значит «прочитано» относится к сообщениям, которые отправили МЫ
        // (sender === 'user' для клиента, 'support' для оператора) —
        // ровно противоположно reader_sender.
        const mySender = isOperator ? 'support' : 'user';
        if (lastEvent.reader_sender === mySender) return;

        setMessages(prev =>
            prev.map(m =>
                m.sender === mySender && !m.read_at
                    ? { ...m, read_at: lastEvent.read_at }
                    : m
            )
        );
    }, [readEvents, isOperator, selectedSupportChatId, chat?.id]);

    useEffect(() => {
        if (!wsMessages.length) return;
        const chatId = isOperator ? selectedSupportChatId : chat?.id;
        if (!chatId) return;
        const last = wsMessages[wsMessages.length - 1];
        if (last.chat_id !== chatId) return;
        const mySender = isOperator ? 'support' : 'user';
        if (last.sender === mySender) return;
        markChatRead(chatId).then(() => refetchUnread()).catch(() => {});
    }, [wsMessages, isOperator, selectedSupportChatId, chat?.id, refetchUnread]);

    const loadSupportChats = useCallback(async () => {
    if (!isOperator) return;
    try {
        const chats = await getSupportChats(100, 0);
        setSupportChats(chats);
    } catch {
        /* тихо: список не критичен для UX, при следующем тике попробуем */
    }
}, [isOperator]);

    /* Любое изменение общего числа непрочитанных — перезагружаем список.
    Новый чат от покупателя → support_chats_total 0→1 → чат появляется
    в колонке. Прочитали → total уменьшился → бейджи в списке обновились. */
    useEffect(() => {
        if (!isOperator) return;
        loadSupportChats();
    }, [isOperator, counts.support_chats_total, loadSupportChats]);

    /* Возврат фокуса на вкладку — тоже повод перечитать список. */
    useEffect(() => {
        if (!isOperator) return undefined;
        const onFocus = () => loadSupportChats();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [isOperator, loadSupportChats]);

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
        setLoadingOlder(true);
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
                markQuiet(quietIdsRef.current, olderAsc);
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
        } finally {
            setLoadingOlder(false);
        }
    };

    /* «Обновить» рядом с состоянием связи: сокет сам переподключением не
       управляет, поэтому честная кнопка перечитывает историю по HTTP. */
    const refreshMessages = async () => {
        if (isRefreshing) return;
        const chatId = isOperator ? selectedSupportChatId : chat?.id;
        if (!chatId) return;
        setIsRefreshing(true);
        try {
            const limit = pageSizeRef.current;
            const history = isOperator
                ? await getSupportMessages(chatId, limit, 0)
                : await getMessages('support', limit, 0);
            const ascending = history.reverse();
            markQuiet(quietIdsRef.current, ascending);
            setMessages(ascending);
            pagingRef.current = {
                offset: ascending.length,
                hasMore: ascending.length === limit,
                loadingMore: false,
            };
            initialAutoScrollDoneRef.current = false;
            setLoadError('');
        } catch (e) {
            const message = e?.message || 'Не удалось обновить переписку';
            setLoadError(message);
            pushToast({ type: 'error', message });
        } finally {
            setIsRefreshing(false);
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
        if (wsMessages.length === 0) return;
        const lastMessage = wsMessages[wsMessages.length - 1];
        const activeChatId = isOperator ? selectedSupportChatId : chat?.id;
        if (!activeChatId || lastMessage.chat_id !== activeChatId) return;

        setMessages(prev => {
            const idx = prev.findIndex((item) => item.id === lastMessage.id);
            if (idx === -1) return [...prev, lastMessage];
            const next = prev.slice();
            next[idx] = lastMessage;
            return next;
        });
    }, [wsMessages, isOperator, selectedSupportChatId, chat?.id]);

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


    /* Автовысота композера: поле растёт под текст до MAX_COMPOSER_HEIGHT,
       дальше прокручивается САМО и без видимой полосы (.astra-no-scrollbar).
       Ползунок в строке ввода владелец убрал. */
    const resizeComposer = (el) => {
        if (!el) return;
        el.style.height = 'auto';
        /* box-sizing: border-box, а scrollHeight рамку не считает. Без
           поправки поле недорастает на её толщину, и последняя строка
           уезжает в невидимую (скрытую) прокрутку. */
        const border = Math.max(el.offsetHeight - el.clientHeight, 0);
        el.style.height = `${Math.min(el.scrollHeight + border, MAX_COMPOSER_HEIGHT)}px`;
    };

    const resetComposerHeight = () => {
        if (inputRef.current) {
            inputRef.current.style.height = '';
        }
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
        resetComposerHeight();
        /* Счётчик обязателен: две отправки в одну миллисекунду давали бы
           один и тот же id, и оптимистичные пузыри слились бы в React. */
        tempSeqRef.current += 1;
        const tempId = `temp-${Date.now()}-${tempSeqRef.current}`;
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
                markQuiet(quietIdsRef.current, [sent]);
                setMessages((prev) => {
                    // Проверяем, есть ли уже это сообщение в списке
                    const existing = prev.some(m => m.id === sent.id);
                    if (existing) {
                        // Если уже есть, просто удаляем временное
                        return prev.filter(m => m.id !== tempId);
                    }
                    // Иначе заменяем временное на реальное
                    const withoutTemp = prev.filter(m => m.id !== tempId);
                    return [...withoutTemp, sent];
                });
            }
        } catch (error) {
            // Восстанавливаем текст и вложения при ошибке
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            setNewMessage(trimmedText);
            setAttachments(currentAttachments);
            requestAnimationFrame(() => resizeComposer(inputRef.current));
            pushToast({
                type: 'error',
                message: 'Не удалось отправить сообщение. Текст и вложения сохранены.',
            });
        } finally {
            setIsSending(false);
            /* Поле больше не отключается на время отправки, поэтому фокус с
               него и не слетает. Возвращаем его, только если он потерялся
               совсем: кнопка «Отправить» гаснет сразу после клика, и браузер
               роняет фокус на body. Если пользователь тем временем ушёл в
               другое место — не отбираем. */
            const active = document.activeElement;
            if (!active || active === document.body) {
                inputRef.current?.focus();
            }
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
            pushToast({ type: 'error', message: 'Не удалось загрузить профиль пользователя' });
        }
    };

    const openRefundModal = (order) => {
        if (!canRefundOrders || !order?.public_id) return;
        if (order.refunded_at) {
            pushToast({ type: 'info', message: 'По заказу уже сделан возврат' });
            return;
        }
        setRefundTarget(order);
        setRefundReason('');
        setRefundAmount('');
        setRefundModalOpen(true);
    };

    const closeRefundModal = () => {
        if (refundSubmitting) return;
        setRefundModalOpen(false);
        setRefundTarget(null);
    };

    /* Локальная правка уже загруженных данных: перечитывать весь профиль
    ради одной строки — лишний round-trip и мигание модалки. */
    const applyRefundLocally = (publicId, patch) => {
        setProfileOrders((prev) =>
            prev.map((o) => (o.public_id === publicId ? { ...o, ...patch } : o))
        );
        setOrderDetailsCache((prev) => {
            const cached = prev[publicId];
            if (!cached) return prev;
            return { ...prev, [publicId]: { ...cached, ...patch } };
        });
        setSelectedOrderDetails((prev) =>
            prev && prev.public_id === publicId ? { ...prev, ...patch } : prev
        );
    };

    const submitRefund = async () => {
        if (!refundTarget || refundSubmitting) return;

        const trimmedReason = refundReason.trim();
        if (!trimmedReason) {
            pushToast({ type: 'error', message: 'Укажите причину возврата' });
            return;
        }

        let parsedAmount = null;
        const rawAmount = refundAmount.trim();
        if (rawAmount) {
            const numeric = Number(rawAmount.replace(',', '.'));
            if (!Number.isFinite(numeric) || numeric <= 0) {
                pushToast({ type: 'error', message: 'Сумма должна быть положительным числом' });
                return;
            }
            parsedAmount = numeric;
        }

        setRefundSubmitting(true);
        try {
            const result = await refundOrder(refundTarget.public_id, trimmedReason, parsedAmount);
            const patch = {
                can_refund: false,
                refunded_at: result.refunded_at,
                refund_amount: result.refunded_amount,
                refund_reason: trimmedReason,
                status: 'canceled',
            };
            applyRefundLocally(refundTarget.public_id, patch);
            pushToast({
                type: 'success',
                message: `Возврат ${result.refunded_amount} ₽ выполнен`,
            });
            setRefundModalOpen(false);
            setRefundTarget(null);
        } catch (e) {
            pushToast({
                type: 'error',
                message: e?.message || 'Не удалось выполнить возврат',
            });
        } finally {
            setRefundSubmitting(false);
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
    const attachDisabled = uploading || attachments.length >= MAX_ATTACHMENTS;
    const canSend = (newMessage.trim().length > 0 || attachments.length > 0) && !isSending;

    if (isLoading) {
        return (
            <div className="support-chat-loading" role="status" aria-live="polite" aria-busy="true">
                <span className="support-sr-only">Загружаем чат…</span>
                <div className="support-skel-head" aria-hidden="true">
                    <span className="astra-skeleton support-skel-title" />
                </div>
                <div className="support-skel-messages" aria-hidden="true">
                    <span className="astra-skeleton support-skel-bubble support-skel-bubble--other" />
                    <span className="astra-skeleton support-skel-bubble support-skel-bubble--own" />
                    <span className="astra-skeleton support-skel-bubble support-skel-bubble--other" />
                    <span className="astra-skeleton support-skel-bubble support-skel-bubble--own" />
                </div>
                <div className="support-skel-composer" aria-hidden="true">
                    <span className="astra-skeleton support-skel-field" />
                    <span className="astra-skeleton support-skel-send" />
                </div>
            </div>
        );
    }

    return (
        <>
            <div className={`support-chat${isOperator ? ' support-chat--operator' : ''}`}>
                {showSidebar && (
                    <aside className="support-chat-sidebar" aria-label="Диалоги с клиентами">
                        <div className="support-sidebar-head">
                            <h3 className="support-chat-sidebar-title">Диалоги</h3>
                            <span className="support-sidebar-count">{supportChats.length}</span>
                        </div>
                        <input
                            className="support-chat-search astra-field"
                            placeholder="Ник или email"
                            aria-label="Поиск по никнейму или email"
                            type="search"
                            value={chatSearch}
                            onChange={(e) => setChatSearch(e.target.value)}
                        />
                        <div className="support-chat-list">
                            {filteredSupportChats.length === 0 ? (
                                <div className="support-chat-empty-list">
                                    {supportChats.length === 0
                                        ? "Пока нет открытых чатов"
                                        : "Ничего не найдено"}
                                </div>
                            ) : (
                                filteredSupportChats.map((chatItem) => {
                                    const unread =
                                        counts.support_chats_by_id?.[String(chatItem.id)]
                                        ?? chatItem.unread_count
                                        ?? 0;

                                    return (
                                        <button
                                            type="button"
                                            key={chatItem.id}
                                            aria-pressed={selectedSupportChatId === chatItem.id}
                                            className={`support-chat-list-item astra-press ${selectedSupportChatId === chatItem.id ? "is-active" : ""}`}
                                            onClick={() => {
                                                setSelectedSupportChatId(chatItem.id);
                                                setSelectedChatInfo(chatItem);
                                                if (isMobile) {
                                                    setMobilePane('chat');
                                                }
                                            }}
                                        >
                                            <div className="support-chat-list-body">
                                                <div className="support-chat-list-title text-none">
                                                    {formatSender(chatItem)}
                                                </div>
                                                <div className="support-chat-list-subtitle">
                                                    Чат #{chatItem.id}
                                                </div>
                                            </div>
                                            <div className="support-chat-list-badge-slot" aria-hidden={unread === 0 || undefined}>
                                                {unread > 0 && (
                                                    <span className="support-chat-list-badge">
                                                        {unread > 99 ? "99+" : unread}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </aside>
                )}
                {showMain && (
                    <div className="support-chat-main">
                        {isOperator && !selectedSupportChatId ? (
                            <div className="empty-chat" style={{ margin: "auto" }}>
                                <span className="empty-chat-art" aria-hidden="true">
                                    <ChatOutlineIcon />
                                </span>
                                <p>Диалог не выбран</p>
                                <p className="hint">
                                    Выберите чат из списка слева, чтобы прочитать переписку и ответить клиенту.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="chat-header">
                                {isOperator && isMobile && mobilePane === 'chat' && (
                                    <button
                                        type="button"
                                        className="support-chat-back-btn astra-press"
                                        onClick={() => setMobilePane('list')}
                                        aria-label="Назад к списку чатов"
                                    >
                                        <ChevronLeftIcon />
                                    </button>
                                )}
                                {/* Шапка в одну строку: кто на том конце + одна тихая
                                    подпись. Часы работы переехали сюда из строки под
                                    полем ввода — это факт о чате, а не о сообщении. */}
                                <div className="support-head-text">
                                    <h2 className="support-head-title text-none">
                                        {isOperator && selectedChatInfo
                                            ? formatSender(selectedChatInfo)
                                            : "Техподдержка"}
                                    </h2>
                                    <p className="support-head-sub">
                                        {isOperator
                                            ? (selectedChatInfo ? `Чат #${selectedChatInfo.id}` : "Диалог не выбран")
                                            : SUPPORT_HOURS_LABEL}
                                    </p>
                                </div>
                                {isOperator && selectedChatInfo && (
                                    <button
                                        type="button"
                                        className="support-head-action astra-press"
                                        onClick={openUserModal}
                                        aria-label="Профиль клиента"
                                        title="Профиль клиента"
                                    >
                                        <UserIcon />
                                    </button>
                                )}
                            </div>

                            {loadError && messages.length > 0 && (
                                <div className="support-error-strip" role="alert">
                                    <span className="support-error-strip-text">{loadError}</span>
                                    <button
                                        type="button"
                                        className="astra-btn-ghost astra-press support-error-strip-btn"
                                        onClick={refreshMessages}
                                        disabled={isRefreshing}
                                    >
                                        {isRefreshing ? 'Обновляем…' : 'Повторить'}
                                    </button>
                                </div>
                            )}

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
                                {loadingOlder && (
                                    <div className="support-older" role="status" aria-live="polite">
                                        <DotsPulse />
                                        <span>Загружаем историю…</span>
                                    </div>
                                )}

                                {messages.length === 0 ? (
                                    loadError ? (
                                        <div className="empty-chat support-state" role="alert">
                                            <span className="empty-chat-art support-state-art" aria-hidden="true">
                                                <AlertIcon />
                                            </span>
                                            <p>Переписка не загрузилась</p>
                                            <p className="hint">{loadError}</p>
                                            <button
                                                type="button"
                                                className="astra-btn-ghost astra-press support-state-btn"
                                                onClick={refreshMessages}
                                                disabled={isRefreshing}
                                            >
                                                {isRefreshing ? 'Обновляем…' : 'Повторить'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="empty-chat">
                                            <span className="empty-chat-art" aria-hidden="true">
                                                <ChatOutlineIcon />
                                            </span>
                                            <p>Напишите нам, и мы обязательно поможем</p>
                                            <p className="hint">Опишите вашу проблему, и специалист свяжется с вами в ближайшее время</p>
                                        </div>
                                    )
                                ) : (
                                    messages.map((message, index) => {
                                        const isOwn = isOperator
                                            ? message.sender === "support"
                                            : message.sender === 'user';
                                        const prev = messages[index - 1];
                                        const key = dayKeyOf(message.created_at);
                                        const showDay =
                                            Boolean(key) && (!prev || dayKeyOf(prev.created_at) !== key);
                                        const pending = isPendingId(message.id);
                                        const isNew = !quietIdsRef.current.has(message.id);

                                        return (
                                            <React.Fragment key={message.id}>
                                                {showDay && (
                                                    <div className="support-day">
                                                        <span>{dayLabelOf(message.created_at)}</span>
                                                    </div>
                                                )}
                                                <div
                                                    className={[
                                                        'support-msg',
                                                        isOwn ? 'support-msg--own' : 'support-msg--other',
                                                        isNew ? 'is-new' : '',
                                                    ].filter(Boolean).join(' ')}
                                                >
                                                    <ChatMessage
                                                        message={message}
                                                        isOwn={isOwn}
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
                                                </div>
                                            </React.Fragment>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                            <div className="chat-input-area">
                            {(attachments.length > 0 || uploading) && (
                                <ul className="support-chips" aria-label="Вложения сообщения">
                                    {attachments.map((att, idx) => (
                                        <li key={att.id ?? idx} className="support-chip">
                                            <button
                                                type="button"
                                                className="support-chip-open"
                                                onClick={() => handleImageClick(attachments, idx)}
                                                aria-label={`Показать вложение ${att.name || idx + 1}`}
                                            >
                                                <img
                                                    className="support-chip-thumb"
                                                    src={att.url}
                                                    alt=""
                                                />
                                                <span className="support-chip-name">
                                                    {att.name || `Изображение ${idx + 1}`}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className="support-chip-remove astra-press"
                                                onClick={() => removeAttachment(idx)}
                                                aria-label={`Убрать вложение ${att.name || idx + 1}`}
                                            >
                                                <CloseIcon />
                                            </button>
                                        </li>
                                    ))}
                                    {uploading && (
                                        <li className="support-chip support-chip--loading">
                                            <DotsPulse />
                                            <span className="support-chip-name" role="status" aria-live="polite">
                                                Загружаем…
                                            </span>
                                        </li>
                                    )}
                                    {/* счётчик живёт там же, где вложения, — отдельной
                                        строки под него больше нет */}
                                    {attachments.length > 0 && (
                                        <li className="support-chip-count" aria-label={`Вложений: ${attachments.length} из ${MAX_ATTACHMENTS}`}>
                                            {attachments.length}/{MAX_ATTACHMENTS}
                                        </li>
                                    )}
                                </ul>
                            )}

                            {/* Одна строка-«док»: скрепка, поле, отправка. Enter
                                отправляет, Shift + Enter — новая строка. */}
                            <div className="input-row support-dock">
                                <label
                                    className="attach-btn"
                                    aria-disabled={attachDisabled}
                                    title={attachDisabled && attachments.length >= MAX_ATTACHMENTS ? `Не больше ${MAX_ATTACHMENTS} изображений` : 'Прикрепить изображение'}
                                >
                                    <PaperclipIcon />
                                    <input
                                        className="attach-input"
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        disabled={attachDisabled}
                                        aria-label="Прикрепить изображение"
                                    />
                                </label>
                                {/* .astra-field — ввод не подсвечивается по клику;
                                    .astra-no-scrollbar — полосы прокрутки в поле нет.
                                    disabled на время отправки нет намеренно: браузер
                                    снимал бы фокус с поля на каждом сообщении. Гонку
                                    держит сам handleSendMessage (ранний выход по
                                    isSending), а ожидание видно по пузырю. */}
                                <textarea
                                    className="astra-field astra-no-scrollbar"
                                    ref={inputRef}
                                    value={newMessage}
                                    onChange={(e) => {
                                        setNewMessage(e.target.value);
                                        resizeComposer(e.target);
                                    }}
                                    onKeyDown={handleKeyDown}
                                    onPaste={handlePaste}
                                    placeholder="Сообщение"
                                    aria-label="Текст сообщения"
                                    rows={1}
                                />
                                {/* Иконка вместо слова: кнопка — единственная розовая
                                    точка экрана, её назначение читается без подписи;
                                    для скринридера — aria-label. */}
                                <button
                                    type="button"
                                    onClick={handleSendMessage}
                                    disabled={!canSend}
                                    aria-busy={isSending || undefined}
                                    aria-label={isSending ? 'Отправляется' : 'Отправить'}
                                    title="Отправить (Enter)"
                                    className="send-btn astra-press"
                                >
                                    {isSending ? <DotsPulse /> : <SendIcon />}
                                </button>
                            </div>
                            </div>
                        </>
                        )}
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
                title={
                        <div>
                            <span style={ {textTransform: "none"} }>
                                Профиль покупателя
                            </span>
                            <button
                                type="button"
                                className="support-chat-close-btn"
                                onClick={() => setProfileModalOpen(false)}
                                aria-label="Закрыть"
                            >
                                <span aria-hidden="true">✕</span>
                            </button>
                        </div>
                    }
            >
                {/* Видимого крестика нет (No Visible Close Cross): закрывают Esc,
                    клик по фону и скрытая кнопка общего Modal. */}
                <div className="support-user-modal">
                    <dl className="support-user-facts">
                        <dt>ID</dt><dd className="text-none">{profileDetails?.id ?? "—"}</dd>
                        <dt>Никнейм</dt><dd className="text-none">{profileDetails?.nickname || "—"}</dd>
                        <dt>Логин</dt><dd className="text-none">{profileDetails?.login || "—"}</dd>
                        <dt>Email</dt><dd className="text-none">{profileDetails?.email || "—"}</dd>
                    </dl>
                    <div className="support-user-orders-title">
                        Заказы <span>{profileOrders.length}</span>
                    </div>
                    <div className="support-user-orders">
                        {profileOrders.length === 0 ? (
                            <div className="support-user-order-row">Нет заказов</div>
                        ) : (
                            profileOrders.map((order) => {
                                const alreadyRefunded = Boolean(order.refunded_at);
                                return (
                                    <div key={order.public_id} className="support-user-order-row">
                                        <div className="support-user-order-main">
                                            {canViewOrderDetails ? (
                                                <button
                                                    type="button"
                                                    className="support-order-link text-none"
                                                    onClick={() => openOrderDetails(order.public_id)}
                                                >
                                                    {order.public_id}
                                                </button>
                                            ) : (
                                                <span className='text-none'>{order.public_id}</span>
                                            )}
                                            <span className="support-user-order-status">{order.status}</span>
                                        </div>

                                        {alreadyRefunded ? (
                                            <span className="support-order-refunded" title={order.refund_reason || ''}>
                                                Возврат {order.refund_amount} ₽
                                            </span>
                                        ) : (
                                            canRefundOrders &&
                                            order.can_refund && (
                                                <button
                                                    type="button"
                                                    className="support-refund-btn astra-press"
                                                    onClick={() => openRefundModal(order)}
                                                >
                                                    Вернуть
                                                </button>
                                            )
                                        )}
                                    </div>
                                );
                            })
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
            <Modal
                isOpen={refundModalOpen}
                onClose={closeRefundModal}
                title="Возврат средств"
            >
                <div className="support-refund">
                    <p className="support-refund-summary">
                        Заказ <strong className='text-none'>{refundTarget?.public_id}</strong>
                        {refundTarget?.total_price != null
                            ? ` — ${refundTarget.total_price} ₽`
                            : ''}
                    </p>

                    <label className="support-refund-field">
                        <span>Причина возврата</span>
                        <textarea
                            className="astra-field astra-no-scrollbar"
                            value={refundReason}
                            onChange={(e) => setRefundReason(e.target.value)}
                            rows={3}
                            placeholder="Опишите причину — она попадёт в аудит"
                            disabled={refundSubmitting}
                        />
                    </label>

                    <label className="support-refund-field">
                        <span>
                            Сумма, ₽ (оставьте пустым — вернём всю стоимость заказа)
                        </span>
                        <input
                            className="astra-field"
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            placeholder={refundTarget?.total_price != null ? String(refundTarget.total_price) : ''}
                            disabled={refundSubmitting}
                        />
                    </label>

                    <div className="support-refund-actions">
                        <button
                            type="button"
                            className="astra-btn-ghost astra-press"
                            onClick={closeRefundModal}
                            disabled={refundSubmitting}
                        >
                            Отмена
                        </button>
                        <button
                            type="button"
                            className="astra-btn astra-press support-refund-submit"
                            onClick={submitRefund}
                            disabled={refundSubmitting || !refundReason.trim()}
                            aria-busy={refundSubmitting || undefined}
                        >
                            {refundSubmitting ? 'Возвращаем…' : 'Вернуть деньги'}
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default SupportChat;
