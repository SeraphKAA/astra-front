import React, { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { normalizeMediaUrl } from "../../../shared/commonApi";
import "./baseProduct.css";

export const BaseProduct = ({ product }) => {
    const [imgError, setImgError] = useState(false);
    const fallbackSrc = useMemo(() => {
        const svg =
            `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">` +
            `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
            `<stop offset="0" stop-color="#2b2b30"/><stop offset="1" stop-color="#1f1f22"/>` +
            `</linearGradient></defs>` +
            `<rect width="512" height="512" fill="url(#g)"/>` +
            `<path d="M168 188c24-30 52-46 88-46s64 16 88 46" fill="none" stroke="#51515a" stroke-width="14" stroke-linecap="round"/>` +
            `<circle cx="214" cy="126" r="18" fill="#51515a"/><circle cx="298" cy="126" r="18" fill="#51515a"/>` +
            `</svg>`;
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }, []);
    const imageSrc =
        !imgError && product?.image_url ? normalizeMediaUrl(product.image_url) : fallbackSrc;

    return (
        <NavLink to={`/product/${product.id}`} className={`mini-product product-link ${!product.is_active ? "inactive" : ""}`}>
            <div className="product_image_wrap">
                <img
                    className="product_image"
                    src={imageSrc}
                    alt={product?.name || "product"}
                    loading="lazy"
                    onError={() => setImgError(true)}
                />
            </div>
            <h3 className="product_title">{product.name}</h3>
            {/* {product.is_active === false && (
                <p className="product_inactive_label">Товар не активен</p>
            )} */}
            {/* <p className="product_description">{product.description}</p> */}
            <div className="product_cta">
                {/* <div className="product_price">{product.price} ₽</div> */}
                <div className="product_action">Подробнее</div>
            </div>
        </NavLink>
    );
};

export default BaseProduct;