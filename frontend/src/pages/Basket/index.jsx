import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./basket.css";

import { useAuth } from "../../app/auth/AuthContext";
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import {
  clearCart,
  getCart,
  removeCartItem,
  updateCartItemQuantity,
} from "../../entities/cart/api/cartApi";
import {
  buildGuestItem,
  clampQty,
  clearGuestRows,
  readGuestCart,
  removeGuestRow,
  setGuestQuantity,
} from "../../entities/cart/model/guestCart";
import { getProductById } from "../../entities/product/api/productApi";
import { createOrderFromCart } from "../../entities/order/api/orderApi";
import { getCartCheckoutRequirements } from "../../entities/checkoutSchema/api/checkoutSchemaApi";
import { validatePromocode } from "../../entities/promocode/api/promocodeApi";
import { normalizeMediaUrl, getApiErrorMessage } from "../../shared/commonApi";
import { CheckoutDataModal } from "../../widgets/CheckoutDataModal";
import { validateNoSqlInjection } from "../../shared/validation";
import AstraAvatar from "../../shared/brand/AstraAvatar";
import SlidingNumber from "../../shared/fx/SlidingNumber";
import { useRevealOnce } from "../../shared/fx/motionUtils";
import { TrashIcon } from "../../shared/svgIcons";
import { openPayment } from "../../widgets/PaymentDialog";

/** Ключ передачи промокода из попапа быстрой покупки (одноразовый). */
const PROMO_HANDOFF_KEY = "astra:promocode";
/** Одноразовая отметка об успешной оплате (переживает перезагрузку). */
const POST_PAYMENT_KEY = "astra:post_payment";
/** Сколько показывать «Спасибо за заказ!» после оплаты (1 час). */
const POST_PAYMENT_TTL_MS = 60 * 60 * 1000;

/** Ответ API мог прийти обёрнутым — достаём сам товар, не выдумывая полей. */
const unwrapProduct = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  if (raw.id != null) return raw;
  if (raw.product && typeof raw.product === "object" && raw.product.id != null) return raw.product;
  return null;
};

const AVATAR_VARIANTS = ["pink", "red", "violet"];

/** Стабильный вариант фирменного аватара по id (фолбэк вместо картинки). */
const pickAvatarVariant = (id) => {
  const s = String(id ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_VARIANTS[Math.abs(h) % AVATAR_VARIANTS.length];
};

/** Копейки округляем НА ГРАНИЦЕ: 199.99 × 3 уезжало в тело запроса
    промокода как «599.9699999999999». */
const round2 = (n) => {
  const num = Number(n);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
};

/* Одна грамматика денег с попапом быстрой покупки (его formatPrice):
   целое — без копеек, дробное — всегда две цифры. Иначе один и тот же
   товар читался «899,10 ₽» в попапе и «899,1 ₽» в корзине. */
const formatMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  const rounded = Math.round(n * 100) / 100;
  const digits = Number.isInteger(rounded) ? 0 : 2;
  return rounded.toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

/** «1 товар / 2 товара / 5 товаров» */
const pluralItems = (n) => {
  const count = Number(n) || 0;
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${count} товаров`;
  if (mod10 === 1) return `${count} товар`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} товара`;
  return `${count} товаров`;
};

const MinusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M3.5 8H12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M8 3.5V12.5M3.5 8H12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** Появление-однажды (.astra-reveal + useRevealOnce): хук живёт вместе с узлом. */
const Reveal = ({ as: Tag = "div", className = "", children, ...rest }) => {
  const ref = useRevealOnce();
  return (
    <Tag ref={ref} className={`astra-reveal ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
};

const calcItemTotal = (item, quantity) => {
  const unit = Number(item?.product?.price ?? 0);
  return round2(unit * quantity);
};

const calcCartTotal = (items) =>
  round2((items || []).reduce((sum, item) => sum + Number(item.total_price || 0), 0));

const patchCartItem = (cart, itemId, updater) => {
  const items = cart.items.map((item) => (item.id === itemId ? updater(item) : item));
  return {
    ...cart,
    items,
    total_price: calcCartTotal(items),
  };
};

const Basket = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const isGuest = !isAuthenticated;
  const { pushToast } = useToast();
  const [cart, setCart] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState("");
  const [promoCode, setPromoCode] = useState("");
  /* { code, percent, amount } — только то, что вернул сервис */
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutGroups, setCheckoutGroups] = useState([]);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  /* itemId -> { timer, run } для отложенных PATCH количества и множество
     уже улетевших запросов: перед созданием заказа их надо ДОЖДАТЬСЯ. */
  const syncQtyTimers = useRef({});
  const qtyInFlight = useRef(new Set());
  /* Сумма, под которую сервис реально проверял промокод. */
  const promoCheckedFor = useRef(null);

  const items = cart?.items || [];
  const total = cart?.total_price ?? 0;

  const [postPayment, setPostPayment] = useState(null);

  const dismissPostPayment = useCallback(() => {
    setPostPayment(null);
    try {
      window.sessionStorage?.removeItem(POST_PAYMENT_KEY);
    } catch {
      /* хранилище недоступно — просто пропускаем */
    }
  }, []);

  /* После успешной оплаты блок «Спасибо» должен пережить F5:
    replaceState чистит URL, и без sessionStorage факт оплаты
    терялся бы после первой же перезагрузки. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage?.getItem(POST_PAYMENT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      if (Date.now() - (Number(parsed.ts) || 0) > POST_PAYMENT_TTL_MS) {
        window.sessionStorage.removeItem(POST_PAYMENT_KEY);
        return;
      }
      setPostPayment(parsed);
    } catch {
      /* хранилище недоступно — просто пропускаем */
    }
  }, []);

  const loadCheckoutRequirements = useCallback(async () => {
    const data = await getCartCheckoutRequirements();
    const groups = Array.isArray(data?.groups) ? data.groups : [];
    setCheckoutGroups(groups);
    return groups;
  }, []);

  const loadAuthed = useCallback(
    async ({ showSpinner = false } = {}) => {
      if (showSpinner) setIsInitialLoading(true);
      setError("");
      try {
        const data = await getCart();
        setCart(data);
        try {
          await loadCheckoutRequirements();
        } catch (reqErr) {
          const reqMsg = reqErr?.message || "Не удалось проверить данные для заказа";
          pushToast({ type: "error", message: reqMsg });
        }
      } catch (e) {
        const msg = e?.message || "Не удалось загрузить корзину";
        setError(msg);
        if (showSpinner) {
          pushToast({ type: "error", message: msg });
        }
      } finally {
        if (showSpinner) setIsInitialLoading(false);
      }
    },
    [loadCheckoutRequirements, pushToast]
  );

  /* Гость: ни одного запроса к /cart. Читаем sessionStorage и
     оживляем строки публичным getProductById. Товар, который не
     ответил, НЕ выбрасываем из хранилища — иначе разовый сбой сети
     стирал бы корзину; просто не показываем его и говорим об этом. */
  const loadGuest = useCallback(async ({ showSpinner = false } = {}) => {
    if (showSpinner) setIsInitialLoading(true);
    setError("");
    try {
      const rows = readGuestCart();
      if (rows.length === 0) {
        setCart({ items: [], total_price: 0 });
        return;
      }
      const resolved = await Promise.all(
        rows.map(async (row) => {
          try {
            const product = unwrapProduct(await getProductById(row.productId));
            return product ? buildGuestItem(row, product) : null;
          } catch (e) {
            return null;
          }
        })
      );
      const nextItems = resolved.filter(Boolean);
      if (nextItems.length === 0) {
        setCart(null);
        setError("Не удалось загрузить товары корзины");
        return;
      }
      setCart({ items: nextItems, total_price: calcCartTotal(nextItems) });
      if (nextItems.length < rows.length) {
        setError("Часть товаров не загрузилась — показываем только доступные");
      }
    } finally {
      if (showSpinner) setIsInitialLoading(false);
    }
  }, []);

  const load = useCallback(
    (options) => (isGuest ? loadGuest(options) : loadAuthed(options)),
    [isGuest, loadGuest, loadAuthed]
  );

  useEffect(() => {
    load({ showSpinner: true });
    const timers = syncQtyTimers.current;
    return () => {
      Object.values(timers).forEach((entry) => clearTimeout(entry?.timer));
    };
  }, [load]);

  /* Код, оставленный попапом быстрой покупки: лежит в sessionStorage
     под PROMO_HANDOFF_KEY. НЕ удаляем сразу — вдруг это гость и мы его
     ещё не применили: удалим, когда действительно применим (или когда
     пользователь войдёт и он применится сам). */
  const [pendingPromoCode, setPendingPromoCode] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pendingPromoCode) return;
    try {
      const handoff = window.sessionStorage?.getItem(PROMO_HANDOFF_KEY);
      if (!handoff) return;
      const code = String(handoff).trim();
      if (code) setPendingPromoCode(code);
    } catch {
      /* sessionStorage недоступен — ничего страшного */
    }
  }, [pendingPromoCode]);

  useEffect(() => {
    if (isGuest) return;
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get("payment_status");
    const orderId = urlParams.get("order_id");

    if (paymentStatus === "success" && orderId) {
      const payload = { status: "success", orderId, ts: Date.now() };
      setPostPayment(payload);
      try {
        window.sessionStorage?.setItem(POST_PAYMENT_KEY, JSON.stringify(payload));
      } catch {
        /* ignore */
      }
      load({ showSpinner: false });
      pushToast({ type: "success", message: "Оплата прошла успешно!" });
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (paymentStatus === "fail") {
      pushToast({ type: "error", message: "Оплата не прошла. Попробуйте снова." });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [isGuest, load, pushToast]);

  const applyQtyChange = useCallback(
    (item, rawQty, { debounceMs = 0 } = {}) => {
      /* Поле — свободный текст: «abc» давал NaN, а обе границы Math его
         пропускают, и NaN утекал и в «Итого», и в PATCH корзины. Границы —
         те же, что у гостевой корзины (entities/cart/model/guestCart). */
      const qty = clampQty(rawQty);

      setCart((prev) => {
        if (!prev) return prev;
        const current = prev.items.find((row) => row.id === item.id);
        if (!current || current.quantity === qty) return prev;
        return patchCartItem(prev, item.id, (row) => ({
          ...row,
          quantity: qty,
          total_price: calcItemTotal(row, qty),
        }));
      });

      if (isGuest) {
        /* Сервера нет — «синхронизация» это одна запись в sessionStorage,
           дебаунсить нечего. */
        setGuestQuantity(item.productId ?? item.id, qty);
        return;
      }

      const runSync = async () => {
        try {
          const updated = await updateCartItemQuantity({ itemId: item.id, quantity: qty });
          setCart((prev) => {
            if (!prev) return prev;
            return patchCartItem(prev, item.id, (row) => ({
              ...row,
              quantity: updated.quantity,
              total_price: Number(updated.total_price),
              product: updated.product ?? row.product,
            }));
          });
        } catch (e) {
          await load({ showSpinner: false });
          const msg = e?.message || "Не удалось изменить количество";
          setError(msg);
          pushToast({ type: "error", message: msg });
        }
      };

      /* Запрос учитываем в qtyInFlight, пока он летит: оформление заказа
         обязано его дождаться, иначе заказ уйдёт со старым количеством. */
      const startSync = () => {
        delete syncQtyTimers.current[item.id];
        const p = runSync();
        qtyInFlight.current.add(p);
        p.finally(() => qtyInFlight.current.delete(p));
        return p;
      };

      const pending = syncQtyTimers.current[item.id];
      if (pending?.timer) clearTimeout(pending.timer);
      delete syncQtyTimers.current[item.id];

      if (debounceMs > 0) {
        syncQtyTimers.current[item.id] = {
          run: startSync,
          timer: setTimeout(startSync, debounceMs),
        };
      } else {
        startSync();
      }
    },
    [isGuest, load, pushToast]
  );

  /* Печать количества уходит на сервер с задержкой в 400мс, а заказ
     создаётся из СЕРВЕРНОЙ корзины. Перед оформлением отложенные PATCH-и
     не отменяем, а выпускаем немедленно и дожидаемся: иначе заказ уедет
     со старым количеством, а осиротевший запрос упадёт уже после
     очистки корзины и покажет ошибку поверх «Заказ создан!». */
  const flushQtySyncs = useCallback(async () => {
    Object.keys(syncQtyTimers.current).forEach((id) => {
      const entry = syncQtyTimers.current[id];
      delete syncQtyTimers.current[id];
      if (entry?.timer) clearTimeout(entry.timer);
      entry?.run?.();
    });
    if (qtyInFlight.current.size > 0) {
      await Promise.all(Array.from(qtyInFlight.current));
    }
  }, []);

  const onChangeQty = (item, nextQty) => {
    applyQtyChange(item, nextQty, { debounceMs: 0 });
  };

  const onQtyInputChange = (item, nextQty) => {
    applyQtyChange(item, nextQty, { debounceMs: 400 });
  };

  const onRemove = async (item) => {
    setCart((prev) => {
      if (!prev) return prev;
      const nextItems = prev.items.filter((row) => row.id !== item.id);
      return {
        ...prev,
        items: nextItems,
        total_price: calcCartTotal(nextItems),
      };
    });

    if (isGuest) {
      removeGuestRow(item.productId ?? item.id);
      return;
    }

    try {
      await removeCartItem({ itemId: item.id });
      await loadCheckoutRequirements();
    } catch (e) {
      await load({ showSpinner: false });
      const msg = e?.message || "Не удалось удалить товар";
      setError(msg);
      pushToast({ type: "error", message: msg });
    }
  };

  const onClear = async () => {
    setIsClearing(true);
    setError("");
    setCart((prev) => (prev ? { ...prev, items: [], total_price: 0 } : prev));

    if (isGuest) {
      clearGuestRows();
      pushToast({ type: "success", message: "Корзина очищена" });
      setIsClearing(false);
      return;
    }

    try {
      await clearCart();
      await loadCheckoutRequirements();
      pushToast({ type: "success", message: "Корзина очищена" });
    } catch (e) {
      await load({ showSpinner: false });
      const msg = e?.message || "Не удалось очистить корзину";
      setError(msg);
      pushToast({ type: "error", message: msg });
    } finally {
      setIsClearing(false);
    }
  };

  const isEmpty = useMemo(() => items.length === 0, [items.length]);

  /* База для скидки — сумма товаров без вычета промокода. Это то, что
     видит сервис validatePromocode, и то, от чего считается процент. */
  const subtotal = round2(total);

  /* Сколько именно спишется по промокоду. Приоритет — server amount:
     сервер уже учёл max_discount и округления, выдумывать своё нельзя. */
  const discountAmount = useMemo(() => {
    if (!appliedPromo || subtotal <= 0) return 0;
    if (appliedPromo.amount != null) {
      return Math.min(round2(appliedPromo.amount), subtotal);
    }
    if (appliedPromo.percent != null) {
      return round2((subtotal * appliedPromo.percent) / 100);
    }
    return 0;
  }, [appliedPromo, subtotal]);

  /* Итоговая сумма — база минус скидка. Именно она уходит в оплату
     и именно её показывает SlidingNumber в смете. */
  const payable = round2(subtotal - discountAmount);

  /* Промокод проверяется ПОД конкретную сумму. Проверили на 5 000 ₽, удалили
     товары до 100 ₽ — и на экране висел бейдж от суммы, которой сервис
     никогда не видел. Сумма изменилась — отметка снимается. */
  useEffect(() => {
    if (!appliedPromo) return;
    if (promoCheckedFor.current === subtotal) return;
    promoCheckedFor.current = null;
    setAppliedPromo(null);
    if (items.length > 0) {
      pushToast({
        type: "info",
        message: "Сумма корзины изменилась — проверьте промокод заново",
      });
    }
  }, [subtotal, appliedPromo, items.length, pushToast]);

  /* Единая точка применения кода: и «Применить», и авто-подхват из
     быстрой покупки, и будущие вызовы из других мест ходят сюда.
     Валидируем против SUBTOTAL (сумма товаров, без скидки) — именно
     эту базу видит сервис промокодов. */
  const applyPromoCode = useCallback(
    async (rawCode) => {
      const nextCode = String(rawCode || "").trim();
      if (!nextCode) {
        const msg = "Введите промокод";
        setError(msg);
        pushToast({ type: "error", message: msg });
        return;
      }
      const sqlError = validateNoSqlInjection(nextCode, "Промокод");
      if (sqlError) {
        setError(sqlError);
        pushToast({ type: "error", message: sqlError });
        return;
      }
      setError("");
      setPromoChecking(true);
      try {
        const res = await validatePromocode(nextCode, subtotal);
        const percent = Number(res?.discount_percent ?? res?.percent);
        const amount = Number(res?.discount_amount ?? res?.discount);
        const explicitlyInvalid = res?.valid === false || res?.is_valid === false;
        if (explicitlyInvalid) throw new Error("Промокод не найден или истёк");
        promoCheckedFor.current = subtotal;
        setAppliedPromo({
          code: nextCode,
          percent: Number.isFinite(percent) && percent > 0 ? percent : null,
          amount: Number.isFinite(amount) && amount > 0 ? amount : null,
        });
        pushToast({ type: "success", message: `Промокод ${nextCode} применён` });
      } catch (e) {
        promoCheckedFor.current = null;
        setAppliedPromo(null);
        const msg =
          e?.status === 404 || e?.status === 400
            ? "Промокод не найден или истёк"
            : getApiErrorMessage(e, "Не удалось проверить промокод");
        setError(msg);
        pushToast({ type: "error", message: msg });
      } finally {
        setPromoChecking(false);
      }
    },
    [subtotal, pushToast]
  );

  const onApplyPromo = () => applyPromoCode(promoCode);

  useEffect(() => {
    if (!pendingPromoCode) return;
    if (isGuest) return;                 // гость применит после входа
    if (isInitialLoading || !cart) return;
    if (items.length === 0) return;      // корзина пуста — код ни к чему

    if (appliedPromo?.code === pendingPromoCode) {
      setPendingPromoCode(null);
      try { window.sessionStorage?.removeItem(PROMO_HANDOFF_KEY); } catch {}
      return;
    }

    const code = pendingPromoCode;
    setPendingPromoCode(null);
    try { window.sessionStorage?.removeItem(PROMO_HANDOFF_KEY); } catch {}
    setPromoCode(code);
    applyPromoCode(code);
  }, [
    pendingPromoCode, isGuest, isInitialLoading, cart,
    items.length, appliedPromo?.code, applyPromoCode,
  ]);

  /* Снять проверенный промокод: сумма к оплате не менялась, поэтому
     здесь нечего пересчитывать — просто убираем отметку и поле. */
  const onClearPromo = () => {
    promoCheckedFor.current = null;
    setAppliedPromo(null);
    setPromoCode("");
    setError("");
  };

  const onPromoKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!promoChecking) onApplyPromo();
  };

  /* Гость не «оформляет заказ» — он идёт входить. Никакой имитации
     оплаты и никаких обещаний про перенос корзины на сервер. */
  const onGuestSignIn = () => {
    pushToast({ type: "info", message: "Войдите, чтобы оформить заказ" });
    navigate("/sign_in");
  };

  const onCheckout = async () => {
    setError("");
    setIsCheckoutLoading(true);
    try {
      /* Набрали количество и нажали «Перейти к оплате» внутри 400мс —
         PATCH ещё висит в дебаунсе. Сначала догоняем сервер, потом
         спрашиваем требования и создаём заказ. */
      await flushQtySyncs();

      let groups = checkoutGroups;
      try {
        groups = await loadCheckoutRequirements();
      } catch (reqErr) {
        const msg = reqErr?.message || "Не удалось проверить данные для заказа";
        setError(msg);
        pushToast({ type: "error", message: msg });
        return;
      }

      if (groups.length > 0) {
        setCheckoutModalOpen(true);
        return;
      }

      await proceedToPayment([]);
    } catch (e) {
      const msg = e?.message || "Не удалось перейти к оплате";
      setError(msg);
      pushToast({ type: "error", message: msg });
    } finally {
      setIsCheckoutLoading(false);
    }
  };


  useEffect(() => {
    if (isGuest) return;
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment_status');
    const orderId = urlParams.get('order_id');

    if (paymentStatus === 'success' && orderId) {
      load({ showSpinner: false });
      pushToast({ type: "success", message: "Оплата прошла успешно!" });
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (paymentStatus === 'fail') {
      pushToast({ type: "error", message: "Оплата не прошла. Попробуйте снова." });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [isGuest, load, pushToast]);

  // ✅ Обновление корзины при возврате на страницу
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isInitialLoading) {
        load({ showSpinner: false });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [load, isInitialLoading]);

  const proceedToPayment = async (checkoutProfiles) => {
    setError("");
    setIsCheckoutLoading(true);

    try {
      /* Последний рубеж перед созданием заказа: заказ собирается из
         серверной корзины, значит все отложенные PATCH-и количества
         должны уже долететь. */
      await flushQtySyncs();

      const rawPromo = (appliedPromo?.code || promoCode || "").trim();
      const promoToSend = rawPromo || null;

      if (promoToSend) {
          const sqlError = validateNoSqlInjection(promoToSend, "Промокод");
          if (sqlError) {
              setError(sqlError);
              pushToast({ type: "error", message: sqlError });
              throw new Error(sqlError);
          }
      }

      const orders = await createOrderFromCart({
        checkout_profiles: checkoutProfiles,
        promocode_code: promoToSend,
      });
      /* Ответ может прийти списком или одиночным заказом — принимаем оба.
         Раньше не-массив молча превращался в null и КАЖДОЕ оформление
         падало с «Не удалось создать заказ», хотя заказ уже был создан. */
      const createdOrders = (Array.isArray(orders) ? orders : [orders]).filter(
        (o) => o && o.public_id
      );
      const firstOrder = createdOrders[0] ?? null;

      if (!firstOrder?.public_id) {
        throw new Error("Не удалось создать заказ для оплаты");
      }

      // The server has already cleared the cart while creating these orders.
      setCart({ items: [], total_price: 0 });
      setCheckoutModalOpen(false);
      openPayment({ purpose: "orders", order_public_ids: createdOrders.map((order) => order.public_id), onConfirmed: () => load({ showSpinner: false }) });

    } catch (e) {
      const msg = e?.message || "Не удалось перейти к оплате";
      setError(msg);
      pushToast({ type: "error", message: msg });
      throw e;
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const onConfirmCheckoutModal = async (checkoutProfiles) => {
    setIsCheckoutLoading(true);
    try {
      await proceedToPayment(checkoutProfiles);
    } catch (e) {
      const msg = e?.message || "Не удалось перейти к оплате";
      setError(msg);
      pushToast({ type: "error", message: msg });
      throw e;
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const headNote = isInitialLoading
    ? "Проверяем содержимое…"
    : !cart
      ? "Данные не загрузились"
      : isEmpty
        ? "Пока ничего не выбрано"
        : pluralItems(items.length);

  return (
    <div className="basket-page">
      <div className="basket-content">
        <Reveal className="basket-head">
          <h1 className="basket-title astra-h">Корзина</h1>
          <p className="basket-head-note">{headNote}</p>
          {isGuest && (
            <p className="basket-head-note basket-head-note--guest">
              Вы не вошли — эта корзина хранится только в этой вкладке и
              исчезнет, когда вы её закроете.
            </p>
          )}
        </Reveal>

        {/* Негрубая ошибка (корзина уже на экране): называем проблему + «Повторить» */}
        {/* {error && !isInitialLoading && cart && (
          <div className="basket-error" role="alert">
            <span className="basket-error-text">{error}</span>
            <button
              type="button"
              className="astra-btn-ghost astra-press basket-error-retry"
              onClick={() => load({ showSpinner: true })}
            >
              Повторить
            </button>
          </div>
        )} */}

        {isInitialLoading ? (
          <div className="basket-skeletons" role="status" aria-live="polite">
            <span className="basket-sr-only">Загружаем корзину…</span>
            {[0, 1, 2].map((row) => (
              <div className="basket-skel-row" key={row} aria-hidden="true">
                <span className="astra-skeleton basket-skel-thumb" />
                <span className="basket-skel-lines">
                  <span className="astra-skeleton basket-skel-line" />
                  <span className="astra-skeleton basket-skel-line basket-skel-line--short" />
                </span>
                <span className="astra-skeleton basket-skel-ctrl" />
              </div>
            ))}
          </div>
        ) : !cart ? (
          <Reveal className="basket-state" role="alert">
            <h2 className="basket-state-title">Корзина не загрузилась</h2>
            <p className="basket-state-text">{error || "Не удалось загрузить корзину"}</p>
            <button
              type="button"
              className="astra-btn-ghost astra-press"
              onClick={() => load({ showSpinner: true })}
            >
              Повторить
            </button>
          </Reveal>
        ) : postPayment?.status === "success" && isEmpty ? (
          <Reveal className="basket-success" role="status">
            <span className="basket-success-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12.8 9.2 18 20 6.6" />
              </svg>
            </span>
            <h2 className="basket-success-title">Спасибо за заказ!</h2>
            <p className="basket-success-text">
              {postPayment.orderId
                ? `Заказ №${postPayment.orderId} принят в обработку.`
                : "Заказ принят в обработку."}{" "}
              Статус заказа можно посмотреть в разделе «Мои заказы».
            </p>
            <div className="basket-success-actions">
              {/* TODO: убедитесь, что маршрут /orders существует в приложении */}
              <Link
                className="astra-btn astra-press basket-success-primary"
                to="/orders"
                onClick={dismissPostPayment}
              >
                Мои заказы
              </Link>
              <Link
                className="astra-btn-ghost astra-press"
                to="/main"
                onClick={dismissPostPayment}
              >
                Продолжить покупки
              </Link>
            </div>
          </Reveal>
        ) : isEmpty ? (
          <Reveal className="basket-empty">
            <span className="basket-empty-art" aria-hidden="true">
              <AstraAvatar variant="violet" className="basket-empty-avatar" />
            </span>
            <h2 className="basket-empty-title">В корзине пока пусто</h2>
            <p className="basket-empty-sub">Добавьте товары — и они появятся здесь.</p>
            <Link className="astra-btn-ghost astra-press basket-empty-link bnt-r" to="/main">
              В каталог
            </Link>
          </Reveal>
        ) : (
          <div className="basket-layout">
            <ul className="basket-list">
              {items.map((item, index) => {
                const p = item.product;
                const name = p?.name || "Товар";
                const imageUrl = p?.image_main ? normalizeMediaUrl(p.image_main) : null;
                return (
                  <li
                    className="basket-item"
                    key={item.id}
                    style={{ "--basket-i": Math.min(index, 5) }}
                  >
                    <div className="basket-thumb">
                      {imageUrl ? (
                        <img src={imageUrl} alt="" loading="lazy" />
                      ) : (
                        <AstraAvatar
                          variant={pickAvatarVariant(p?.id ?? item.id)}
                          className="basket-thumb-art"
                          preserveAspectRatio="xMidYMid slice"
                        />
                      )}
                    </div>

                    <div className="basket-item-info">
                      <h2 className="basket-item-name">{name}</h2>
                      <p className="basket-item-price">
                        {formatMoney(p?.price)} ₽
                        <span className="basket-item-unit"> / шт.</span>
                      </p>
                    </div>

                    <div className="basket-item-controls">
                      <div className="basket-qty" role="group" aria-label={`Количество: ${name}`}>
                        <button
                          className="basket-qty-btn astra-press"
                          type="button"
                          aria-label="Уменьшить количество"
                          disabled={item.quantity <= 1}
                          onClick={() => onChangeQty(item, item.quantity - 1)}
                        >
                          <MinusIcon />
                        </button>
                        <input
                          className="basket-qty-input astra-field"
                          value={item.quantity}
                          onChange={(e) => onQtyInputChange(item, e.target.value)}
                          inputMode="numeric"
                          aria-label="Количество"
                        />
                        <button
                          className="basket-qty-btn astra-press"
                          type="button"
                          aria-label="Увеличить количество"
                          onClick={() => onChangeQty(item, item.quantity + 1)}
                        >
                          <PlusIcon />
                        </button>
                      </div>

                      <p className="basket-item-total" aria-live="polite">
                        {formatMoney(item.total_price)} ₽
                      </p>

                      <button
                        className="basket-remove astra-press"
                        type="button"
                        onClick={() => onRemove(item)}
                        aria-label={`Удалить «${name}» из корзины`}
                      >
                        <TrashIcon className="basket-remove-icon" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <aside className="basket-aside">
              <Reveal className="basket-summary">
                <h2 className="basket-summary-title">Заказ</h2>

                {isGuest ? (
                  /* Проверка промокода требует авторизации — не показываем
                     поле, которое гостю ответит 401. */
                  <p className="basket-quiet">Промокод можно проверить после входа.</p>
                ) : (
                  <div className="basket-promo">
                    <label className="basket-promo-label" htmlFor="basket-promo">
                      Промокод
                    </label>
                    <div className="basket-promo-row">
                      <input
                        id="basket-promo"
                        className="basket-promo-input astra-field"
                        type="text"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        onKeyDown={onPromoKeyDown}
                        placeholder="Введите промокод"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="astra-btn-ghost astra-press basket-promo-btn"
                        onClick={onApplyPromo}
                        disabled={promoChecking}
                        aria-busy={promoChecking}
                      >
                        {promoChecking ? "Проверяем…" : "Применить"}
                      </button>
                    </div>
                  </div>
                )}

                {appliedPromo && (
                  <div className="basket-promo-ok" role="status">
                    <div className="basket-promo-ok-head">
                      <span className="basket-promo-code">{appliedPromo.code}</span>
                      {discountAmount > 0 && (
                        <span className="astra-badge astra-badge--drop">
                          −{formatMoney(discountAmount)} ₽
                        </span>
                      )}
                      <button
                        type="button"
                        className="basket-promo-clear astra-press"
                        onClick={onClearPromo}
                        aria-label={`Убрать промокод ${appliedPromo.code}`}
                      >
                        Убрать
                      </button>
                    </div>
                    <p className="basket-promo-ok-text">
                      Скидка применится при оформлении, итоговая сумма
                      уже пересчитана ниже.
                    </p>
                  </div>
                )}

                {checkoutGroups.length > 0 && (
                  <p className="basket-note">
                    Перед оплатой нужно подтвердить данные для выдачи ({checkoutGroups.length}{" "}
                    {checkoutGroups.length === 1 ? "игра" : "игры/платформы"}).
                  </p>
                )}

                <dl className="basket-sum">
                  <div className="basket-sum-row">
                    <dt className="basket-sum-label">Товары</dt>
                    <dd className="basket-sum-value">{formatMoney(subtotal)} ₽</dd>
                  </div>
                  {appliedPromo && discountAmount > 0 && (
                    <div className="basket-sum-row">
                      <dt className="basket-sum-label">
                        Скидка ({appliedPromo.percent}%)
                      </dt>
                      <dd className="basket-sum-value basket-sum-value--discount">
                        −{formatMoney(discountAmount)} ₽
                      </dd>
                    </div>
                  )}
                  <div className="basket-sum-row basket-sum-row--total">
                    <dt className="basket-sum-label basket-sum-label--total">Итого</dt>
                    <dd className="basket-total" aria-live="polite">
                      <SlidingNumber value={`${formatMoney(payable)} ₽`} />
                    </dd>
                  </div>
                </dl>

                {!isGuest && (
                  /* Инициализация оплаты уходит с use_balance=true: если на счёте
                     есть деньги, они списываются первыми. Сумму назвать нельзя —
                     баланс знает только сервер, — но умолчать о списании нельзя
                     тем более. */
                  <p className="basket-quiet">
                    При оплате сначала списывается доступный баланс аккаунта, если он
                    есть, — картой доплачивается остаток. Точную сумму к оплате
                    покажет платёжная страница.
                  </p>
                )}

                {/* .astra-ring: clip-path кнопки съедает outline — кольцо на обёртке */}
                <span className="astra-ring basket-checkout-ring">
                  <button
                    className="astra-btn astra-press basket-checkout"
                    type="button"
                    onClick={isGuest ? onGuestSignIn : onCheckout}
                    disabled={!isGuest && isCheckoutLoading}
                  >
                    {isGuest
                      ? "Войти и оформить"
                      : isCheckoutLoading
                        ? "Переход…"
                        : "Перейти к оплате"}
                  </button>
                </span>

                {isGuest && (
                  /* Никакого слияния корзин на сервере нет — так и говорим. */
                  <p className="basket-quiet">
                    Корзина сохранится, пока открыта эта вкладка. Автоматически
                    перенести её в аккаунт мы пока не умеем — после входа добавьте
                    товары заново.
                  </p>
                )}

                <button
                  className="astra-btn-ghost astra-press basket-clear"
                  type="button"
                  onClick={onClear}
                  disabled={isClearing}
                >
                  {isClearing ? "Очищаем…" : "Очистить корзину"}
                </button>
              </Reveal>
            </aside>
          </div>
        )}
      </div>

      <CheckoutDataModal
        isOpen={checkoutModalOpen}
        onClose={() => !isCheckoutLoading && setCheckoutModalOpen(false)}
        groups={checkoutGroups}
        onConfirm={onConfirmCheckoutModal}
        isLoading={isCheckoutLoading}
      />
    </div>
  );
};

export default Basket;
