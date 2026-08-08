import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./basket.css";

import { useToast } from "../../shared/ui/Toast/ToastProvider";
import {
  clearCart,
  getCart,
  removeCartItem,
  updateCartItemQuantity,
} from "../../entities/cart/api/cartApi";
import { createOrderFromCart, initRobokassaPayment } from "../../entities/order/api/orderApi";
import { getCartCheckoutRequirements } from "../../entities/checkoutSchema/api/checkoutSchemaApi";
import { normalizeMediaUrl } from "../../shared/commonApi";
import { CheckoutDataModal } from "../../widgets/CheckoutDataModal";
import { validateNoSqlInjection } from "../../shared/validation";

const formatMoney = (n) => {
  const num = Number(n || 0);
  return new Intl.NumberFormat("ru-RU").format(num);
};

const calcItemTotal = (item, quantity) => {
  const unit = Number(item?.product?.price ?? 0);
  return unit * quantity;
};

const calcCartTotal = (items) =>
  (items || []).reduce((sum, item) => sum + Number(item.total_price || 0), 0);

const patchCartItem = (cart, itemId, updater) => {
  const items = cart.items.map((item) => (item.id === itemId ? updater(item) : item));
  return {
    ...cart,
    items,
    total_price: calcCartTotal(items),
  };
};

const Basket = () => {
  const { pushToast } = useToast();
  const [cart, setCart] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState("");
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutGroups, setCheckoutGroups] = useState([]);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const syncQtyTimers = useRef({});

  const items = cart?.items || [];
  const total = cart?.total_price ?? 0;

  const loadCheckoutRequirements = useCallback(async () => {
    const data = await getCartCheckoutRequirements();
    const groups = Array.isArray(data?.groups) ? data.groups : [];
    setCheckoutGroups(groups);
    return groups;
  }, []);

  const load = useCallback(
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

  useEffect(() => {
    load({ showSpinner: true });
    return () => {
      Object.values(syncQtyTimers.current).forEach(clearTimeout);
    };
  }, [load]);

  const applyQtyChange = useCallback(
    (item, rawQty, { debounceMs = 0 } = {}) => {
      const qty = Math.max(1, Math.min(999, Number(rawQty || 1)));

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

      if (syncQtyTimers.current[item.id]) {
        clearTimeout(syncQtyTimers.current[item.id]);
      }

      if (debounceMs > 0) {
        syncQtyTimers.current[item.id] = setTimeout(runSync, debounceMs);
      } else {
        runSync();
      }
    },
    [load, pushToast]
  );

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
  const discount = appliedPromoCode ? Math.round(Number(total || 0) * 0.1) : 0;
  const totalWithDiscount = Math.max(Number(total || 0) - discount, 0);

  const onApplyPromo = () => {
    const nextCode = promoCode.trim();
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
    setAppliedPromoCode(nextCode);
    pushToast({ type: "success", message: `Промокод ${nextCode} применён` });
  };

  const onCheckout = async () => {
    setError("");
    setIsCheckoutLoading(true);
    try {
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
  }, [load, pushToast]);

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
      const orders = await createOrderFromCart(checkoutProfiles);
      const firstOrder = Array.isArray(orders) ? orders[0] : null;
      
      if (!firstOrder?.public_id) {
        throw new Error("Не удалось создать заказ для оплаты");
      }

      await clearCart();
      setCart({ items: [], total_price: 0 });
      await loadCheckoutRequirements();

      const paymentData = await initRobokassaPayment(firstOrder.public_id);
      
      if (paymentData?.payment_method === "POST" && paymentData?.payment_action_url) {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = paymentData.payment_action_url;
        form.target = "_blank";

        if (paymentData.payment_params) {
          Object.entries(paymentData.payment_params).forEach(([key, value]) => {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = key;
            input.value = value;
            form.appendChild(input);
          });
        }

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
        
        setCheckoutModalOpen(false);
        pushToast({ 
          type: "success", 
          message: "Заказ создан! Вы будете перенаправлены на оплату." 
        });
        
      } else {
        pushToast({ type: "success", message: "Заказ оплачен с баланса" });
        setCheckoutModalOpen(false);
        await load({ showSpinner: false });
      }
      
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

  return (
    <div className="basket-page">
      <div className="basket-content">
        <h1 className="basket-title">Корзина</h1>
        <div className="basket-title-divider" aria-hidden />

        {error && <div className="basket-error">{error}</div>}

        {isInitialLoading ? (
          <div className="basket-loading">Загрузка...</div>
        ) : isEmpty ? (
          <div className="basket-empty">
            <div className="basket-empty-title">В корзине пока пусто</div>
            <div className="basket-empty-sub">
              Добавьте товары — и они появятся здесь.
            </div>
          </div>
        ) : (
          <>
            <div className="basket-list">
              {items.map((item) => {
                const p = item.product;
                return (
                  <div className="basket-item" key={item.id}>
                    <div className="basket-item-left">
                      <div className="basket-thumb">
                        {p?.image_url ? (
                          <img src={normalizeMediaUrl(p.image_url)} alt={p?.name || "product"} />
                        ) : (
                          <div className="basket-thumb-placeholder" />
                        )}
                      </div>

                      <div className="basket-item-info">
                        <div className="basket-item-name">{p?.name || "Товар"}</div>
                        <div className="basket-item-price">
                          {formatMoney(p?.price)} ₽
                        </div>
                      </div>
                    </div>

                    <div className="basket-item-right">
                      <div className="basket-qty">
                        <button
                          className="basket-qty-btn"
                          type="button"
                          disabled={item.quantity <= 1}
                          onClick={() => onChangeQty(item, item.quantity - 1)}
                        >
                          −
                        </button>
                        <input
                          className="basket-qty-input"
                          value={item.quantity}
                          onChange={(e) => onQtyInputChange(item, e.target.value)}
                          inputMode="numeric"
                        />
                        <button
                          className="basket-qty-btn"
                          type="button"
                          onClick={() => onChangeQty(item, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>

                      <div className="basket-item-total">
                        {formatMoney(item.total_price)} ₽
                      </div>

                      <button
                        className="basket-remove"
                        type="button"
                        onClick={() => onRemove(item)}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="basket-summary">
              <div className="basket-promo">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Введите промокод"
                />
                <button type="button" onClick={onApplyPromo}>
                  Применить
                </button>
              </div>

              {checkoutGroups.length > 0 && (
                <div className="basket-checkout-hint">
                  Перед оплатой нужно подтвердить данные для выдачи ({checkoutGroups.length}{" "}
                  {checkoutGroups.length === 1 ? "игра" : "игры/платформы"}).
                </div>
              )}
              {appliedPromoCode && (
                <div className="basket-promo-applied">
                  Промокод <b>{appliedPromoCode}</b> применен (demo скидка 10%).
                </div>
              )}
              <div className="basket-summary-row">
                <div className="basket-summary-label">Итого</div>
                <div className="basket-summary-value">{formatMoney(total)} ₽</div>
              </div>
              {appliedPromoCode && (
                <div className="basket-summary-row basket-summary-row-discount">
                  <div className="basket-summary-label">Со скидкой</div>
                  <div className="basket-summary-value">{formatMoney(totalWithDiscount)} ₽</div>
                </div>
              )}

              <div className="basket-summary-actions">
                <button
                  className="basket-clear"
                  type="button"
                  onClick={onClear}
                  disabled={isClearing}
                >
                  {isClearing ? "Очистка..." : "Очистить корзину"}
                </button>

                <button
                  className="basket-checkout"
                  type="button"
                  onClick={onCheckout}
                  disabled={isCheckoutLoading}
                >
                  {isCheckoutLoading ? "Переход..." : "Перейти к оплате"}
                </button>
              </div>
            </div>
          </>
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
