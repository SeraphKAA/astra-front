import React, { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { normalizeMediaUrl } from "../../../shared/commonApi";
import { getCategoryDisplayName } from "../../product/mainCategoryLabels";
import "./baseCategory.css";

export const BaseCategory = ({ category }) => {
    const [imgError, setImgError] = useState(false);
    const fallbackSrc = useMemo(() => {
        const svg =
            `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">` +
            `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
            `<stop offset="0" stop-color="#2b2b30"/><stop offset="1" stop-color="#1f1f22"/>` +
            `</linearGradient></defs>` +
            `<rect width="512" height="512" fill="url(#g)"/>` +
            `<path d="M170 170h172" stroke="#51515a" stroke-width="14" stroke-linecap="round"/>` +
            `<path d="M200 120h112" stroke="#51515a" stroke-width="14" stroke-linecap="round"/>` +
            `</svg>`;
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }, []);
    const imageSrc =
        !imgError && category?.image_url ? normalizeMediaUrl(category.image_url) : fallbackSrc;

    return (
        <NavLink to={`/category/${category.id}`} className="mini-category category-link">
            <div className="category_image_wrap">
                <img
                    className="category_image"
                    src={imageSrc}
                    alt={category?.name || "category"}
                    loading="lazy"
                    onError={() => setImgError(true)}
                />
            </div>
            <h3 className="category_title">{getCategoryDisplayName(category.name)}</h3>
        </NavLink>
    );
};

export default BaseCategory;