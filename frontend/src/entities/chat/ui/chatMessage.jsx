import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';    
import { editMessage, deleteMessage } from '../api/chatApi';
import { PencilIcon, TrashIcon } from '../../../shared/svgIcons';
import {
    PopoverRoot,
    PopoverTrigger,
    PopoverContent,
    PopoverForm,
    PopoverHeader,
    PopoverLabel,
    PopoverTextarea,
    PopoverBody,
    PopoverFooter,
    PopoverButton,
    PopoverSubmitButton,
    PopoverCloseButton,
    usePopover,
} from '../../../shared/ui/Popover/Popover';
import './chatMessage.css';
import { createPortal } from 'react-dom';

/* Разбираем только http/https/www. Голые домены (example.com) не трогаем:
   иначе под нож попадут обычные точки и «цена.com 100 руб». */
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;

const normalizeUrl = (raw) => {
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^www\./i.test(raw)) return `https://${raw}`;
    return raw;
};

/* Отрезаем «прилипшую» пунктуацию: «Смотри https://a.b. Там…»
   и «(https://a.b/path)». Простые знаки — всегда, парные —
   только если закрывающих больше, чем открывающих. */
const trimTrailing = (url) => {
    let out = url;
    while (/[.,;:!?]$/.test(out)) out = out.slice(0, -1);
    const pairs = [['(', ')'], ['[', ']'], ['{', '}']];
    for (const [open, close] of pairs) {
        while (out.endsWith(close)) {
            const opens = (out.match(new RegExp(`\\${open}`, 'g')) || []).length;
            const closes = (out.match(new RegExp(`\\${close}`, 'g')) || []).length;
            if (closes > opens) out = out.slice(0, -1);
            else break;
        }
    }
    return out;
};

/* Возвращает массив {type:'text'|'url', value}. */
const splitLinks = (text) => {
    if (!text) return [];
    const parts = [];
    let lastIndex = 0;
    URL_RE.lastIndex = 0;
    let match;
    while ((match = URL_RE.exec(text)) !== null) {
        const trimmed = trimTrailing(match[0]);
        if (trimmed.length < match[0].length) {
            URL_RE.lastIndex = match.index + trimmed.length;
        }
        if (match.index > lastIndex) {
            parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
        }
        parts.push({ type: 'url', value: trimmed });
        lastIndex = match.index + trimmed.length;
    }
    if (lastIndex < text.length) {
        parts.push({ type: 'text', value: text.slice(lastIndex) });
    }
    return parts;
};


const SingleCheckIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path
            d="M5 12.5 9.5 17 19 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const DoubleCheckIcon = () => (
    <svg width="18" height="14" viewBox="0 0 30 24" fill="none" aria-hidden="true" focusable="false">
        <path
            d="M3 12.5 7.5 17 17 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M12 12.5 16.5 17 26 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

/* «Отмена» живёт в контексте поповера: usePopover даёт ей close().
   Объявлена на уровне модуля — иначе на каждый рендер новый тип и панель
   пересоздавалась бы посреди морфа. */
const PopoverCancel = ({ children = 'Отмена', ...rest }) => {
    const { close } = usePopover();
    return (
        <PopoverButton variant="ghost" {...rest} onClick={close}>
            {children}
        </PopoverButton>
    );
};

const ChatMessage = ({
    message,
    isOwn,
    onEdit,
    onDelete,
    senderLabel,
    onSenderClick,
    senderClickable = false,
    onImageClick,
}) => {
    const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const isPending = typeof message.id === 'string' && message.id.startsWith('temp-');
    const messageRef = useRef(null);
    /* Пузырь сообщения — источник морфа для правки: форма раскрывается ИЗ
       самого сообщения, а не из карандаша (решение владельца). Удаление
       морфа не меняет: это подтверждение действия, а не превращение
       сообщения в форму. */
    const bubbleRef = useRef(null);
    /* Куда вынести панели порталом. Своё место в разметке им нужно ВНЕ
       .message-actions: та гаснет целиком, и панель, лежащая внутри неё,
       погасла бы вместе с кнопками. У правки и удаления приёмники РАЗНЫЕ:
       на быстром переключении обе панели ненадолго смонтированы, а два
       портала в один узел React расставляет по соседству ненадёжно. */
    const editLayerRef = useRef(null);
    const deleteLayerRef = useRef(null);

    const hasAttachments = Array.isArray(message.attachments) && message.attachments.length > 0;
    const popoverOpen = editOpen || deleteOpen;
    const [contextMenu, setContextMenu] = useState({
        open: false,
        x: 0,
        y: 0,
        closing: false,
        id: 0,
    });
    const contextMenuRef = useRef(null);    

    /* 1) Ловим клик мимо / Escape. Ставим closing=true — с этого момента
    играет fade-out, но элемент ещё в DOM. */
    useEffect(() => {
        if (!contextMenu.open || contextMenu.closing) return;

        const handleClickOutside = () => {
            setContextMenu(prev =>
                prev.open && !prev.closing ? { ...prev, closing: true } : prev
            );
        };
        const handleEscape = (e) => {
            if (e.key === 'Escape') handleClickOutside();
        };

        const timeoutId = setTimeout(() => {
            document.addEventListener('pointerdown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('pointerdown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [contextMenu.open, contextMenu.closing]);

    /* 2) Когда closing=true — ждём окончания анимации (110ms с запасом
    над 0.1s CSS) и убираем меню из DOM. */
    useEffect(() => {
        if (!contextMenu.closing) return undefined;
        const t = setTimeout(() => {
            setContextMenu(prev => ({ ...prev, open: false, closing: false }));
        }, 110);
        return () => clearTimeout(t);
    }, [contextMenu.closing]);

    // Обработчик правого клика
    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();

        setContextMenu(prev => ({
            open: true,
            x: e.clientX,
            y: e.clientY,
            closing: false,
            id: prev.id + 1,
        }));
    };

    /* Меряем меню после монтирования: если не влезает по вертикали —
    переворачиваем вверх (y = clientY - height). То же для горизонтали.
    Выполняется ДО paint, поэтому пользователь не видит «прыжка».
    Зависимости — только open/id: обновление y не должно запускать
    измерение заново. */
    useLayoutEffect(() => {
        if (!contextMenu.open || !contextMenuRef.current) return;

        const menu = contextMenuRef.current;
        const rect = menu.getBoundingClientRect();
        const margin = 8;
        const viewportH = window.innerHeight;
        const viewportW = window.innerWidth;

        let nextY = contextMenu.y;
        let nextX = contextMenu.x;

        // Вертикаль: по умолчанию — вниз; если не влезает, но влезает
        // наверх — переворачиваем. Если не влезает никуда — прижимаем к
        // верхней кромке вьюпорта.
        const spaceBelow = viewportH - contextMenu.y - margin;
        const spaceAbove = contextMenu.y - margin;

        if (rect.height > spaceBelow) {
            if (rect.height <= spaceAbove) {
                nextY = contextMenu.y - rect.height;
            } else {
                nextY = margin;
            }
        }
        if (nextY < margin) nextY = margin;

        // Горизонталь: если вылезаем вправо — сдвигаем влево.
        const spaceRight = viewportW - contextMenu.x - margin;
        if (rect.width > spaceRight) {
            const spaceLeft = contextMenu.x - margin;
            if (rect.width <= spaceLeft) {
                nextX = contextMenu.x - rect.width;
            } else {
                nextX = margin;
            }
        }
        if (nextX < margin) nextX = margin;

        if (nextY !== contextMenu.y || nextX !== contextMenu.x) {
            setContextMenu(prev => ({ ...prev, y: nextY, x: nextX }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contextMenu.open, contextMenu.id]);

    const triggerHiddenPopover = (selector) => {
        const container = messageRef.current;
        if (!container) return;

        const wrapper = container.querySelector(selector);
        if (!wrapper) {
            console.warn('[ChatMessage] trigger target not found:', selector);
            return;
        }

        const btn = wrapper.tagName === 'BUTTON'
            ? wrapper
            : (wrapper.querySelector('button, [role="button"]') || wrapper);

        // Фокус — активирует :focus-within → pointer-events: auto
        try { btn.focus({ preventScroll: true }); } catch {}

        // .click() — самый надёжный путь для onClick-триггеров PopoverTrigger.
        try { btn.click(); } catch (e) { console.error('[ChatMessage] click failed:', e); }
    };

    const openEditFromMenu = () => {
        setContextMenu(prev => prev.open && !prev.closing ? { ...prev, closing: true } : prev);
        requestAnimationFrame(() => {
            triggerHiddenPopover('.message-actions .edit-btn');
        });
    };

    const openDeleteFromMenu = () => {
        setContextMenu(prev => prev.open && !prev.closing ? { ...prev, closing: true } : prev);
        requestAnimationFrame(() => {
            triggerHiddenPopover('.message-actions .delete-btn');
        });
    };

    // Функция форматирования полной даты для меню
    const formatFullDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const openGallery = (index) => {
        if (onImageClick && message.attachments) {
            onImageClick(message.attachments, index);
        }
    };

    useEffect(() => {
        const mql = window.matchMedia('(max-width: 768px)');
        const apply = () => setIsMobile(Boolean(mql.matches));
        apply();
        if (mql.addEventListener) {
            mql.addEventListener('change', apply);
            return () => mql.removeEventListener('change', apply);
        }
        mql.addListener(apply);
        return () => mql.removeListener(apply);
    }, []);

    useEffect(() => {
        if (!mobileActionsOpen) return;
        const onPointerDown = (e) => {
            if (messageRef.current && !messageRef.current.contains(e.target)) {
                setMobileActionsOpen(false);
            }
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [mobileActionsOpen]);

    /* Панель действий обязана пережить закрытие поповера — ей возвращается
       фокус. Но если закрыли щелчком МИМО, пользователь уже ушёл: тогда
       панель не воскрешаем, иначе она зависла бы на экране. */
    const keepActionsAlive = (reason) => {
        if (reason === 'outside') return;
        if (isMobile) {
            setMobileActionsOpen(true);
        }
    };

    const handleEditOpenChange = (open, reason) => {
        setEditOpen(open);
        if (open) {
            setSaveError('');
        } else {
            keepActionsAlive(reason);
        }
    };

    const handleDeleteOpenChange = (open, reason) => {
        setDeleteOpen(open);
        if (open) {
            setDeleteError('');
        } else {
            keepActionsAlive(reason);
        }
    };

    /* Контракт PopoverForm: `false` — панель остаётся открытой (видна
       ошибка сервера), `true` — панель схлопывается обратно в кнопку. */
    const handleEditSubmit = async (note) => {
        if (isSaving) return false;
        const text = (note || '').trim();
        if (!text && !hasAttachments) {
            setSaveError('Сообщение не может быть пустым');
            return false;
        }
        setIsSaving(true);
        setSaveError('');
        try {
            await editMessage(message.id, { text });
            onEdit(message.id, text);
            return true;
        } catch (error) {
            setSaveError(error?.message || 'Не удалось сохранить изменения');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (isDeleting) return;
        setIsDeleting(true);
        setDeleteError('');
        try {
            await deleteMessage(message.id);
            onDelete(message.id);
            setMobileActionsOpen(false);
        } catch (error) {
            setDeleteError(error?.message || 'Не удалось удалить сообщение');
        } finally {
            setIsDeleting(false);
        }
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    };

    const handleMessageTap = (e) => {
        if (!isOwn || popoverOpen) return;
        if (!isMobile) return;
        if (e.target.closest('.message-actions')) return;
        if (e.target.closest('.message-sender.clickable')) return;
        setMobileActionsOpen((prev) => !prev);
    };

    return (
        <div
            ref={messageRef}
            className={[
                'chat-message-shell',
                isOwn ? 'own' : 'other',
                mobileActionsOpen ? 'is-actions-open' : '',
                popoverOpen ? 'is-popover-open' : '',
                /* Обе панели занимают МЕСТО сообщения: пузырь и панель
                   действий гаснут, а карточка вырастает из освободившейся
                   кромки — и правка, и подтверждение удаления. */
                popoverOpen ? 'is-inplace' : '',
            ].filter(Boolean).join(' ')}
            onClick={handleMessageTap}
        >
            <div className={`chat-message ${isOwn ? 'own' : 'other'}`} 
            ref={bubbleRef}
            onContextMenu={handleContextMenu}
            >
                <div className="message-header">
                    {/* Подпись отправителя открывает профиль — это действие,
                        поэтому кнопка, а не <span onClick>: иначе к ней не
                        добраться ни табом, ни Enter. */}
                    {senderClickable ? (
                        <button
                            type="button"
                            className="message-sender clickable text-none"
                            onClick={() => {
                                if (onSenderClick) {
                                    onSenderClick(message);
                                }
                            }}
                        >
                            {senderLabel || (isOwn ? 'Вы' : 'Техподдержка')}
                        </button>
                    ) : (
                        <span className="message-sender">
                            {senderLabel || (isOwn ? 'Вы' : 'Техподдержка')}
                        </span>
                    )}
                    <span className="message-time">
                        {formatTime(message.created_at)}
                    </span>
                    {isOwn && (
                        <span
                            className={[    
                                'message-status',
                                isPending ? 'message-status--pending' : '',
                                message.read_at ? 'message-status--read' : 'message-status--sent',
                            ].filter(Boolean).join(' ')}
                            aria-label={
                                isPending ? 'Отправляется'
                                : message.read_at ? 'Прочитано'
                                : 'Отправлено'
                            }
                            title={
                                isPending ? 'Отправляется'
                                : message.read_at ? 'Прочитано'
                                : 'Отправлено'
                            }
                        >
                            {message.read_at ? <DoubleCheckIcon /> : <SingleCheckIcon />}
                        </span>
                    )}
                </div>

                {/* Вложение открывает просмотрщик — тоже действие, тоже кнопка.
                    Размеры и наведение переехали в chatMessage.css: инлайновый
                    transition не умеет уступать prefers-reduced-motion. */}
                {hasAttachments && (
                    <div className="message-attachments">
                        {message.attachments.length === 1 ? (
                            // Одно изображение — показываем в полный размер
                            <button
                                type="button"
                                className="message-attachment single"
                                onClick={() => openGallery(0)}
                                aria-label={
                                    message.attachments[0].name
                                        ? `Открыть изображение: ${message.attachments[0].name}`
                                        : 'Открыть изображение'
                                }
                            >
                                <img src={message.attachments[0].url} alt="" />
                            </button>
                        ) : (
                            // Несколько изображений — показываем как галерею
                            <div className="message-attachments-grid">
                                {message.attachments.map((att, index) => (
                                    <button
                                        type="button"
                                        key={index}
                                        className="message-attachment grid-item"
                                        onClick={() => openGallery(index)}
                                        aria-label={`Открыть изображение ${index + 1} из ${message.attachments.length}`}
                                    >
                                        <img src={att.url} alt="" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {message.text && (
                    <div className="message-text text-none">
                        {splitLinks(message.text).map((part, i) =>
                            part.type === 'url' ? (
                                <a
                                    key={i}
                                    href={normalizeUrl(part.value)}
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    className="message-link"
                                    /* В мобильной версии клик по пузырю переключает панель
                                    действий — ссылка не должна это триггерить. */
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {part.value}
                                </a>
                            ) : (
                                <React.Fragment key={i}>{part.value}</React.Fragment>
                            )
                        )}
                    </div>
                )}
            </div>

            {/* Приёмники порталов. Пустые блоки без размеров: на раскладку не
                влияют, но дают панелям место в разметке рядом с пузырём, а не
                внутри гаснущей панели действий. */}
            <div className="message-edit-layer" ref={editLayerRef} />
            <div className="message-edit-layer" ref={deleteLayerRef} />

            {/* Панель действий смонтирована ВСЕГДА у своего сообщения: пока она
                появлялась по наведению мыши, кнопок просто не было в разметке и
                клавиатура их не находила. Теперь она невидима (opacity), но
                достижима: показ — наведение, фокус внутри, раскрытая карточка.

                Стоит ПОСЛЕ сообщения: панель — absolute, порядок в DOM на вид
                не влияет, а первым ребёнком она заставляла скринридер и таб
                читать «Изменить/Удалить» раньше самого текста.

                role="group", а не "toolbar": toolbar обещает переход стрелками
                при одном tab-stop на панель (roving tabindex) — этого здесь
                нет, а обещать поведение, которого нет, хуже, чем не обещать. */}
            {isOwn && (
                <div
                    className={`message-actions${isMobile ? ' message-actions--mobile' : ''}`}
                    role="group"
                    aria-label="Действия с сообщением"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Правка: кнопка на глазах превращается в форму правки */}
                    <PopoverRoot
                        className="message-popover-root"
                        initialNote={message.text || ''}
                        onOpenChange={handleEditOpenChange}
                        morphFrom={bubbleRef}
                    >
                        <PopoverTrigger
                            className="message-action-btn edit-btn"
                            aria-label="Изменить сообщение"
                        >
                            <PencilIcon className="message-action-icon" />
                        </PopoverTrigger>
                        <PopoverContent
                            className="message-popover message-popover--edit"
                            /* side="top" — нижняя кромка формы совпадает с
                               нижней кромкой сообщения: форма растёт ВВЕРХ,
                               а не свисает под пузырём (решение владельца). */
                            side="top"
                            align="end"
                            anchorTo={bubbleRef}
                            portalTo={editLayerRef}
                        >
                            <PopoverForm onSubmit={handleEditSubmit}>
                                <PopoverHeader>
                                    <PopoverLabel htmlFor>Изменить сообщение</PopoverLabel>
                                </PopoverHeader>
                                <PopoverTextarea
                                    placeholder="Текст сообщения"
                                    disabled={isSaving}
                                    maxLength={4000}
                                />
                                {saveError && (
                                    <p className="astra-popover-error" role="alert">
                                        {saveError}
                                    </p>
                                )}
                                <PopoverFooter>
                                    <PopoverCancel disabled={isSaving} />
                                    <PopoverSubmitButton
                                        disabled={isSaving}
                                        aria-busy={isSaving || undefined}
                                    >
                                        {isSaving ? 'Сохраняем…' : 'Сохранить'}
                                    </PopoverSubmitButton>
                                </PopoverFooter>
                                <PopoverCloseButton />
                            </PopoverForm>
                        </PopoverContent>
                    </PopoverRoot>

                    <span className="message-actions-divider" aria-hidden />

                    {/* Удаление: та же механика и тот же морф из сообщения */}
                    <PopoverRoot
                        className="message-popover-root"
                        onOpenChange={handleDeleteOpenChange}
                        morphFrom={bubbleRef}
                    >
                        <PopoverTrigger
                            className="message-action-btn delete-btn"
                            aria-label="Удалить сообщение"
                        >
                            <TrashIcon className="message-action-icon" />
                        </PopoverTrigger>
                        <PopoverContent
                            className="message-popover message-popover--delete"
                            side="top"
                            align="end"
                            anchorTo={bubbleRef}
                            portalTo={deleteLayerRef}
                        >
                            <PopoverHeader>
                                <PopoverLabel>Удалить сообщение?</PopoverLabel>
                            </PopoverHeader>
                            <PopoverBody>
                                <p>Сообщение исчезнет у обеих сторон — вернуть его нельзя.</p>
                                {deleteError && (
                                    <p className="astra-popover-error" role="alert">
                                        {deleteError}
                                    </p>
                                )}
                            </PopoverBody>
                            <PopoverFooter>
                                <PopoverCancel disabled={isDeleting} />
                                <PopoverButton
                                    variant="danger"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    aria-busy={isDeleting || undefined}
                                >
                                    {isDeleting ? 'Удаляем…' : 'Удалить'}
                                </PopoverButton>
                            </PopoverFooter>
                            <PopoverCloseButton />
                        </PopoverContent>
                    </PopoverRoot>
                </div>
            )}

            {contextMenu.open && createPortal(
                <div
                    key={contextMenu.id}
                    ref={contextMenuRef}
                    className={`message-context-menu${contextMenu.closing ? ' is-closing' : ''}`}
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    {isOwn && (
                        <>
                            <button
                                type="button"
                                className="message-context-action"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={openEditFromMenu}
                            >
                                <span className="message-context-action-text">Изменить</span>
                                <PencilIcon className="message-context-icon" />
                            </button>
                            <button
                                type="button"
                                className="message-context-action is-danger"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={openDeleteFromMenu}
                            >
                                <span className="message-context-action-text">Удалить</span>
                                <TrashIcon className="message-context-icon" />
                            </button>
                            <div className="message-context-divider" aria-hidden="true" />
                        </>
                    )}

                    <div className="message-context-row">
                        <span className="message-context-label">Отправлено:</span>
                        <span className="message-context-value">{formatFullDate(message.created_at)}</span>
                    </div>

                    {isOwn && (
                        <div className="message-context-row">
                            <span className="message-context-label">Прочитано:</span>
                            <span className="message-context-value">
                                {isPending
                                    ? 'Отправляется...'
                                    : message.read_at
                                        ? formatFullDate(message.read_at)
                                        : 'Еще не прочитано'}
                            </span>
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
};

export default ChatMessage;
