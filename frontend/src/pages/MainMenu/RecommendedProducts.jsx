import React, { useEffect, useState } from "react";
import { getProductsMiniList } from "../../entities/product/api/productApi";
import { normalizeMediaUrl, getApiErrorMessage } from "../../shared/commonApi";
import AstraAvatar from "../../shared/brand/AstraAvatar";
import { PendingSwap, pickAvatarVariant } from "./TileGrid";
import { useRevealOnce, revealDelay, useDelayedPending } from "../../shared/fx/motionUtils";

const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

const formatPrice = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? new Intl.NumberFormat("ru-RU").format(n) : String(value);
};

/** Честная старая цена: зачёркиваем только реальное поле old_price/price_old. */
const getOldPrice = (item) => {
    const price = Number(item?.price);
    const old = Number(item?.old_price ?? item?.price_old);
    if (Number.isFinite(price) && price > 0 && Number.isFinite(old) && old > price) {
        return old;
    }
    return null;
};

/** −N% только из реального источника скидки в данных. */
const getDiscountPercent = (item) => {
    const price = Number(item?.price);
    const old = getOldPrice(item);
    if (old != null && Number.isFinite(price) && price > 0) {
        return Math.round((1 - price / old) * 100);
    }
    const direct = Number(item?.discount_percent);
    if (Number.isFinite(direct) && direct > 0 && direct < 100) return Math.round(direct);
    return null;
};

const isFresh = (item) => {
    if (!item?.created_at) return false;
    const t = Date.parse(item.created_at);
    return Number.isFinite(t) && Date.now() - t <= NEW_WINDOW_MS;
};

/**
 * Карточка в грамматике Kupikod, цвета v3: картинка 4:3 сверху, цена
 * Unbounded 700 в --astra-soft, NEW — фиолетовый wash, −N% — БЕЛЫЕ
 * чернила на пурпуре --astra-drop (скидка носит свой цвет; розовый
 * остаётся сигналом действия). Reveal-once — на обёртке ячейки (60мс
 * стаггер).
 * Карточка — кнопка: открывает попап быстрой покупки, а не уводит на
 * страницу товара (грамматика вида не меняется).
 */
const ProductCard = ({ item, index = 0, pending = false, onOpen }) => {
    const [imgError, setImgError] = useState(false);
    const revealRef = useRevealOnce();
    const src = !imgError && item?.image_main
    ? normalizeMediaUrl(item.image_main)
    : (item?.image_url ? normalizeMediaUrl(item.image_url) : null);
    const discount = getDiscountPercent(item);
    const oldPrice = getOldPrice(item);
    const hasPrice = item?.price !== null && item?.price !== undefined && item?.price !== "";

    return (
        <div className="mm-cell astra-reveal" ref={revealRef} style={revealDelay(index)}>
            <button
                type="button"
                className={`mm-prod astra-press${pending ? " is-pending" : ""}`}
                aria-busy={pending || undefined}
                onClick={() => onOpen?.(item)}
            >
                <span className="mm-prod-media">
                    {src ? (
                        <img
                            className="mm-prod-img"
                            src={src}
                            alt=""
                            loading="lazy"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <AstraAvatar
                            variant={pickAvatarVariant(item.id)}
                            className="mm-prod-avatar"
                            preserveAspectRatio="xMidYMid slice"
                        />
                    )}
                    {isFresh(item) && (
                        <span className="astra-badge astra-badge--new mm-prod-new">NEW</span>
                    )}
                </span>
                <span className="mm-prod-body">
                    {hasPrice && (
                        <span className="mm-prod-pricerow">
                            <span className="mm-prod-price">{formatPrice(item.price)} ₽</span>
                            {discount != null && (
                                <span className="astra-badge astra-badge--drop">−{discount}%</span>
                            )}
                            {oldPrice != null && (
                                <s className="mm-prod-old">{formatPrice(oldPrice)} ₽</s>
                            )}
                        </span>
                    )}
                    <span className="mm-prod-name text-none">{item.name}</span>
                </span>
            </button>
        </div>
    );
};

/**
 * «Рекомендованные товары» — единственная товарная секция страницы
 * (id="sec-recommended").
 */
const RecommendedProducts = ({ onOpenProduct, pendingProductId = null }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [retryKey, setRetryKey] = useState(0);
    /* Та же политика, что у вкладок каталога: серые карточки появляются,
       только если ответ реально задержался. */
    const showSkeleton = useDelayedPending(loading);
    const headRef = useRevealOnce();

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError("");
        getProductsMiniList({ page: 1, size: 12 })
            .then((data) => {
                if (!cancelled) setItems(Array.isArray(data?.products) ? data.products : []);
            })
            .catch((e) => {
                if (!cancelled) setError(getApiErrorMessage(e, "Не удалось загрузить товары"));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [retryKey]);

    return (
        <section id="sec-recommended" className="mm-section" aria-labelledby="sec-recommended-h">
            <div className="mm-head astra-reveal" ref={headRef}>
                <h2 id="sec-recommended-h" className="astra-h mm-h">Рекомендованные товары</h2>
            </div>

            <PendingSwap
                loading={loading}
                showSkeleton={showSkeleton}
                skeleton={
                    <div className="mm-prods" aria-hidden="true">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="mm-prod-skel astra-skeleton" />
                        ))}
                    </div>
                }
            >
                {error ? (
                    <div className="mm-state" role="alert">
                        <p className="mm-state-text">{error}</p>
                        <button
                            type="button"
                            className="astra-btn-ghost astra-press"
                            onClick={() => setRetryKey((k) => k + 1)}
                        >
                            Повторить
                        </button>
                    </div>
                ) : items.length > 0 ? (
                    <div className="mm-prods">
                        {items.map((item, i) => (
                            <ProductCard
                                key={item.id}
                                item={item}
                                index={i}
                                onOpen={onOpenProduct}
                                pending={pendingProductId === item.id}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="mm-state">
                        <p className="mm-state-text">В каталоге пока нет товаров</p>
                    </div>
                )}
            </PendingSwap>
        </section>
    );
};

export default RecommendedProducts;
