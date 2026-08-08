import React, { useEffect, useRef, useState } from 'react';
import { editMessage, deleteMessage } from '../api/chatApi';
import { PencilIcon, TrashIcon } from '../../../shared/svgIcons';
import './chatMessage.css';

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
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(message.text || '');
    const [showActions, setShowActions] = useState(false);
    const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const messageRef = useRef(null);

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

    // Синхронизация editText при изменении текста сообщения
    useEffect(() => {
        setEditText(message.text || '');
    }, [message.text]);

    const handleEdit = async () => {
        try {
            await editMessage(message.id, { text: editText });
            onEdit(message.id, editText);
            setIsEditing(false);
            setMobileActionsOpen(false);
            setShowActions(false);
        } catch (error) {
            // console.error('Error editing message:', error);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Удалить сообщение?')) return;
        try {
            await deleteMessage(message.id);
            onDelete(message.id);
            setMobileActionsOpen(false);
            setShowActions(false);
        } catch (error) {
            // console.error('Error deleting message:', error);
        }
    };

    const startEditing = (e) => {
        e?.stopPropagation?.();
        setIsEditing(true);
        setMobileActionsOpen(false);
        setShowActions(false);
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    };

    const handleMessageTap = (e) => {
        if (!isOwn || isEditing) return;
        if (!isMobile) return;
        if (e.target.closest('.message-actions')) return;
        if (e.target.closest('.message-sender.clickable')) return;
        setMobileActionsOpen((prev) => !prev);
    };

    const actionsVisible = isOwn && !isEditing && (isMobile ? mobileActionsOpen : showActions);

    // Отображение вложений (если есть)
    // const renderAttachments = () => {
    //     if (!message.attachments || message.attachments.length === 0) return null;
    //     return (
    //         <div className="message-attachments">
    //             {message.attachments.map((att, idx) => {
    //                 // Проверяем mime_type вместо type
    //                 if (att.mime_type && att.mime_type.startsWith('image/')) {
    //                     return (
    //                         <img
    //                             key={idx}
    //                             src={att.url}
    //                             alt={att.original_filename || 'изображение'}
    //                             className="message-image"
    //                             loading="lazy"
    //                             onClick={(e) => {
    //                                 e.stopPropagation();
    //                                 window.open(att.url, '_blank');
    //                             }}
    //                         />
    //                     );
    //                 }
    //                 return null;
    //             })}
    //         </div>
    //     );
    // };

    return (
        <div
            ref={messageRef}
            className={[
                'chat-message-shell',
                isOwn ? 'own' : 'other',
                mobileActionsOpen ? 'is-actions-open' : '',
                !isMobile && showActions ? 'is-actions-visible' : '',
            ].filter(Boolean).join(' ')}
            onMouseEnter={() => {
                if (!isMobile && isOwn && !isEditing) setShowActions(true);
            }}
            onMouseLeave={() => {
                if (!isMobile) setShowActions(false);
            }}
            onClick={handleMessageTap}
        >
            {actionsVisible && (
                <div
                    className={`message-actions${isMobile ? ' message-actions--mobile' : ''}`}
                    role="toolbar"
                    aria-label="Действия с сообщением"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        onClick={startEditing}
                        className="message-action-btn edit-btn"
                        aria-label="Изменить сообщение"
                    >
                        <PencilIcon className="message-action-icon" />
                    </button>
                    <span className="message-actions-divider" aria-hidden />
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="message-action-btn delete-btn"
                        aria-label="Удалить сообщение"
                    >
                        <TrashIcon className="message-action-icon" />
                    </button>
                </div>
            )}

            <div className={`chat-message ${isOwn ? 'own' : 'other'}`}>
                <div className="message-header">
                    <span
                        className={`message-sender ${senderClickable ? 'clickable' : ''}`}
                        onClick={() => {
                            if (senderClickable && onSenderClick) {
                                onSenderClick(message);
                            }
                        }}
                    >
                        {senderLabel || (isOwn ? 'Вы' : 'Техподдержка')}
                    </span>
                    <span className="message-time">
                        {formatTime(message.created_at)}
                    </span>
                </div>

                {message.attachments && message.attachments.length > 0 && (
                    <div className="message-attachments">
                        {message.attachments.length === 1 ? (
                            // Одно изображение - показываем в полный размер
                            <div 
                                className="message-attachment single"
                                onClick={() => openGallery(0)}
                                style={{ cursor: 'pointer' }}
                            >
                                <img 
                                    src={message.attachments[0].url} 
                                    alt={message.attachments[0].name || 'вложение'} 
                                    style={{ 
                                        maxWidth: '300px', 
                                        maxHeight: '300px', 
                                        objectFit: 'contain',
                                        borderRadius: '8px'
                                    }}
                                />
                            </div>
                        ) : (
                            // Несколько изображений - показываем как галерею
                            <div className="message-attachments-grid">
                                {message.attachments.map((att, index) => (
                                    <div 
                                        key={index} 
                                        className="message-attachment grid-item"
                                        onClick={() => openGallery(index)}
                                        style={{ 
                                            cursor: 'pointer',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            borderRadius: '8px'
                                        }}
                                    >
                                        <img 
                                            src={att.url} 
                                            alt={att.name || `вложение ${index + 1}`} 
                                            style={{ 
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                transition: 'transform 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                                            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* {message.attachments && message.attachments.length > 0 && (
                    <div className="message-attachments">
                        {message.attachments.map((att, index) => (
                            <div 
                                key={index} 
                                className="message-attachment"
                                onClick={() => onImageClick && onImageClick(att.url, att.name || 'Изображение')}
                                style={{ cursor: 'pointer' }}
                            >
                                <img 
                                    src={att.url} 
                                    alt={att.name || 'вложение'} 
                                    style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'contain' }}
                                />
                            </div>
                        ))}
                    </div>
                )} */}

                {isEditing ? (
                    <div className="message-edit">
                        <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="edit-input"
                            autoFocus
                        />
                        <div className="edit-actions">
                            <button type="button" onClick={handleEdit} className="save-btn">Сохранить</button>
                            <button type="button" onClick={() => setIsEditing(false)} className="cancel-btn">Отмена</button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Текст сообщения */}
                        {message.text && <div className="message-text">{message.text}</div>}
                        {/* Вложения */}
                        {/* {renderAttachments()} */}
                    </>
                )}
            </div>
        </div>
    );
};

export default ChatMessage;