// BaseProduct — canonical shared product card ("ash and signal" v3):
// 4:3 image on top, Unbounded 700 soft-pink price + honest −% badge +
// struck old price (same Unbounded voice as the live price), quiet name
// below. The whole card is the click target.
//
// Round 6: the card no longer links to /product/:id — that route is gone.
// It is a BUTTON that opens the quick-buy popup: the host page owns
// `useQuickBuy()` and passes `openProduct` as `onOpen` (same contract as
// the main page and search results). Without `onOpen` the card renders
// inert rather than pointing at a dead route.
import React, { useState } from "react";
import { normalizeMediaUrl } from "../../../shared/commonApi";
import AstraMark from "../../../shared/brand/AstraMark";
import "./baseProduct.css";

const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/* ru-RU thousands: 4290 → «4 290» */
const formatPrice = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString("ru-RU") : String(value);
};

/* Старая цена — только если API реально её отдаёт и она выше текущей. */
const getOldPrice = (product) => {
    const current = Number(product?.price);
    if (!Number.isFinite(current) || current <= 0) return null;
    const candidates = [product?.old_price, product?.price_old, product?.oldPrice];
    for (const candidate of candidates) {
        if (candidate === null || candidate === undefined || candidate === "") continue;
        const n = Number(candidate);
        if (Number.isFinite(n) && n > current) return n;
    }
    return null;
};

/* Скидка — из реальной старой цены либо реального discount-поля. Без выдумок. */
const getDiscountPercent = (product, oldPrice) => {
    const price = Number(product?.price);
    if (oldPrice !== null && Number.isFinite(price) && price > 0) {
        const pct = Math.round((1 - price / oldPrice) * 100);
        return pct >= 1 ? pct : null;
    }
    const direct = Number(product?.discount_percent ?? product?.discount);
    if (Number.isFinite(direct) && direct >= 1 && direct < 100) return Math.round(direct);
    return null;
};

/* «Новинка» — только если created_at реально есть и моложе 14 дней. */
const isFresh = (product) => {
    if (!product?.created_at) return false;
    const t = Date.parse(product.created_at);
    return Number.isFinite(t) && Date.now() - t <= NEW_WINDOW_MS;
};

export const BaseProduct = ({ product, onOpen = null, pending = false }) => {
    const [imgError, setImgError] = useState(false);
    const imageSrc =
        !imgError && product?.image_main ? normalizeMediaUrl(product.image_main) : null;
    /* mini-list items may omit price — hide the row gracefully */
    const hasPrice =
        product?.price !== null && product?.price !== undefined && product?.price !== "";
    const oldPrice = getOldPrice(product);
    const discount = getDiscountPercent(product, oldPrice);
    const inactive = product?.is_active === false;
    const fresh = !inactive && isFresh(product);

    return (
        <button
            type="button"
            className={`product-link astra-press ${inactive ? "inactive" : ""}${pending ? " is-pending" : ""}`}
            aria-busy={pending || undefined}
            disabled={!onOpen}
            onClick={() => onOpen?.(product)}
        >
            <article className="mini-product">
                <div className="product_image_wrap">
                    {imageSrc ? (
                        <img
                            className="product_image"
                            src={imageSrc}
                            alt=""
                            loading="lazy"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <div className="product_image_fallback" aria-hidden="true">
                            <AstraMark className="product_fallback_mark" />
                        </div>
                    )}
                    {fresh && <span className="product_new_badge">Новинка</span>}
                    {inactive && <span className="product_state_badge">Недоступен</span>}
                </div>
                {hasPrice && (
                    <div className="product_price_row">
                        <span className="product_price">{formatPrice(product.price)} ₽</span>
                        {discount !== null && (
                            <span className="astra-badge astra-badge--drop product_discount">
                                −{discount}%
                            </span>
                        )}
                        {oldPrice !== null && (
                            <s className="product_old_price">{formatPrice(oldPrice)} ₽</s>
                        )}
                    </div>
                )}
                <h3 className="product_title">{product.name}</h3>
            </article>
        </button>
    );
};

export default BaseProduct;
