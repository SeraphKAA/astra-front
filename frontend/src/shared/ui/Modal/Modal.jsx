import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import styles from "./Modal.module.css";
import { lockScroll, unlockScroll } from "../../fx/scrollLock";

/* Вход 300мс / выход 150мс — три длительности системы, одна кривая. */
const CLOSE_MS = 300;

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "[contenteditable]:not([contenteditable='false'])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

let titleSeq = 0;

/* ---------- стопка открытых диалогов ----------
   Escape закрывает ТОЛЬКО верхний диалог. На странице поддержки поверх
   профиля открывается карточка заказа, и один Escape не должен схлопывать
   оба: слушатель висит на окне у каждого открытого диалога, поэтому
   каждый кладёт свой id в стопку и реагирует, лишь если он последний.
   Снятие ищем по значению — размонтирование может прийти в любом порядке. */
let modalSeq = 0;
const openModals = [];

const pushModal = (id) => {
  openModals.push(id);
};

const popModal = (id) => {
  const index = openModals.lastIndexOf(id);
  if (index !== -1) {
    openModals.splice(index, 1);
  }
};

const isTopModal = (id) => openModals.length > 0 && openModals[openModals.length - 1] === id;

/* Замок прокрутки — общий на всё приложение (shared/fx/scrollLock):
   свой счётчик у каждого оверлея приводил к тому, что снятие не по стеку
   навсегда оставляло страницу заблокированной. */

/**
 * Базовый диалог ASTRA (v3 «Ash and Signal»).
 *
 * Видимого «×» нет: закрывают Escape, клик по подложке и одна
 * визуально скрытая кнопка «Закрыть» внутри ловушки фокуса (она
 * проявляется, когда до неё доходят с клавиатуры). Панель — пепельная
 * карточка с волосяной рамкой и ОДНОЙ мягкой тенью; жидкого стекла нет
 * (именно линза давала зеркальный артефакт). Вход — прозрачность плюс
 * короткий подъём, 300мс на общей кривой.
 *
 * API не менялся: { isOpen, onClose, title, children, variant }.
 */
export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  variant = "default",
  /** Владелец диалога может временно запретить выход (например, идёт оплата). */
  closeDisabled = false,
  closeDisabledLabel = "Идёт операция — подождите",
  returnFocus = false,
}) => {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const pressedOnOverlayRef = useRef(false);
  const titleIdRef = useRef(null);
  const modalIdRef = useRef(null);

  const handleCloseClick = useCallback(() => {
    closeRef.current?.blur(); // снимаем фокус с кнопки
    onClose();
  }, [onClose]);

  if (titleIdRef.current === null) {
    titleSeq += 1;
    titleIdRef.current = `astra-modal-title-${titleSeq}`;
  }

  if (modalIdRef.current === null) {
    modalSeq += 1;
    modalIdRef.current = modalSeq;
  }

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
      return undefined;
    }

    if (!isRendered) {
      return undefined;
    }

    setIsClosing(true);
    const timer = window.setTimeout(() => {
      setIsRendered(false);
      setIsClosing(false);
    }, CLOSE_MS);

    return () => window.clearTimeout(timer);
  }, [isOpen, isRendered]);

  /* Прокрутка заблокирована ровно пока диалог на экране. */
  useEffect(() => {
    if (!isRendered) return undefined;
    lockScroll();
    return unlockScroll;
  }, [isRendered]);

  /* Регистрация в стопке зависит ТОЛЬКО от isOpen: если бы сюда попал
     onClose (у вызывающих он часто новая стрелка на каждый рендер),
     диалог перескакивал бы наверх стопки при любом ререндере соседа. */
  useEffect(() => {
    if (!isOpen) return undefined;
    const id = modalIdRef.current;
    pushModal(id);
    return () => popModal(id);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEsc = (e) => {
      if (e.key !== "Escape") return;
      /* Слушателей столько же, сколько открытых диалогов: закрывается
         только верхний, нижний остаётся на экране. */
      if (!isTopModal(modalIdRef.current)) return;
      onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  /* Ловушка фокуса + возврат фокуса тому, кто открыл диалог. */
  useEffect(() => {
    if (!isRendered || isClosing) return undefined;
    const panel = panelRef.current;
    if (!panel) return undefined;

    const opener = document.activeElement;
    (closeRef.current || panel).focus({ preventScroll: true });

    const onKeyDown = (e) => {
      if (e.key !== "Tab") return;
      const nodes = Array.prototype.filter.call(
        panel.querySelectorAll(FOCUSABLE),
        (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
      );
      if (nodes.length === 0) {
        e.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    panel.addEventListener("keydown", onKeyDown);
    return () => {
      panel.removeEventListener("keydown", onKeyDown);
      if (returnFocus && opener && typeof opener.focus === "function" && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [isRendered, isClosing, returnFocus]);

  const onOverlayMouseDown = useCallback((e) => {
    pressedOnOverlayRef.current = e.target === e.currentTarget;
  }, []);

  /* Закрываем только если нажатие И отпускание пришлись на подложку —
     иначе выделение текста мышью «вытягивалось» бы в закрытие. */
  const onOverlayClick = useCallback(
    (e) => {
      const started = pressedOnOverlayRef.current;
      pressedOnOverlayRef.current = false;

      if (started && e.target === e.currentTarget) {
        // Убедимся, что под курсором в момент клика не находится панель
        const elementUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
        if (
          elementUnderCursor &&
          panelRef.current &&
          panelRef.current.contains(elementUnderCursor)
        ) {
          return; // клик был на панели (или внутри неё) — не закрываем
        }
        closeRef.current?.blur();
        onClose();
      }
    },
    [onClose]
  );

  if (!isRendered) return null;

  const modalClass = [
    styles.modal,
    variant === "wide" ? styles.modalWide : "",
    isClosing ? styles.modalClosing : "",
  ]
    .filter(Boolean)
    .join(" ");

  const overlayClass = [styles.overlay, isClosing ? styles.overlayClosing : ""]
    .filter(Boolean)
    .join(" ");

  const modalContent = (
    <div
      className={overlayClass}
      onMouseDown={onOverlayMouseDown}
      onClick={onOverlayClick}
    >
      <div
        className={modalClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleIdRef.current : undefined}
        aria-label={title ? undefined : "Диалог"}
        tabIndex={-1}
        ref={panelRef}
      >
        {/* Единственная кнопка закрытия: скрыта визуально, живёт в ловушке
            фокуса и проявляется, когда до неё дошли с клавиатуры.
            Если хозяин диалога запретил закрытие (например, идёт оплата) —
            кнопка честно выключена и говорит почему, а не молча не работает. */}
        <button
          type="button"
          ref={closeRef}
          className={styles.closeSr}
          onClick={handleCloseClick}
          disabled={closeDisabled}
          aria-disabled={closeDisabled || undefined}
        >
          {closeDisabled ? closeDisabledLabel : ""}
        </button>

        {title ? (
          <div className={styles.header}>
            <h2 className={styles.title} id={titleIdRef.current}>
              {title}
            </h2>
          </div>
        ) : null}

        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};