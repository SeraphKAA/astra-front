import { apiRequest } from "../../../shared/commonApi";

/* ========================
   ADMIN
======================== */

// Создание товара
export const createProduct = (data) => {
    return apiRequest({
        url: "/product/",
        method: "POST",
        body: data,
    });
};

// Обновление товара
export const updateProduct = (productId, data) => {
    return apiRequest({
        url: `/product/${productId}`,
        method: "PATCH",
        body: data,
    });
};

// Удаление товара
export const deleteProduct = (productId) => {
    return apiRequest({
        url: `/product/${productId}`,
        method: "DELETE",
    });
};

export const duplicateProductSettings = (sourceProductId, body) => {
    return apiRequest({
        url: `/product/${sourceProductId}/duplicate-settings`,
        method: "POST",
        body,
    });
};

/** Массовый импорт: JSON в теле (массив товаров как при создании одного) */
export const importProductsBulk = (products) => {
    return apiRequest({
        url: "/product/import/bulk",
        method: "POST",
        body: { products },
    });
};

// Округление цен у товаров до 9 
export const roundPricesToNine = () => {
    return apiRequest({
        url: "/product/admin/round-prices-to-nine",
        method: "POST",
    });
};


/** Импорт из файла: .json или .xlsx (multipart, поле file) */
export const importProductsFromFile = (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiRequest({
        url: "/product/import/file",
        method: "POST",
        body: fd,
    });
};

/* ========================
   PUBLIC
======================== */

// Товары по категории (пагинация)
export const getProductsByCategory = (categoryId, { page = 1, size = 20 } = {}) => {
    const params = new URLSearchParams({
        page: String(page),
        size: String(size),
    });
    return apiRequest({
        url: `/product/category/${categoryId}?${params.toString()}`,
    });
};

/** Пагинированный список товаров (краткая информация) */
export const getProductsMiniList = (dto = {}) => {
    const {
        page = 1,
        size = 20,
        search,
        main_category,
        is_active,
        category_id,
        price_min,
        price_max,
        quantity_min,
        quantity_max,
        platform,
        delivery_type,
        by_priority,
        sort,             // задел на будущее (popularity | price_asc | price_desc | newest)
    } = dto;

    const params = new URLSearchParams({
        page: String(page),
        size: String(size),
    });

    // Один сериализатор вместо простыни if-ов. Пустые значения и
    // служебное "all" не уходят на бэк — эндпоинт читает отсутствие
    // параметра как "фильтр не задан".
    const append = (key, value) => {
        if (value === undefined || value === null || value === "") return;
        if (value === "all") return;
        params.set(key, String(value));
    };

    append("search",        search);
    append("main_category", main_category);
    append("is_active",     is_active);
    append("category_id",   category_id);
    append("price_min",     price_min);
    append("price_max",     price_max);
    append("quantity_min",  quantity_min);
    append("quantity_max",  quantity_max);
    append("platform",      platform);
    append("delivery_type", delivery_type);
    append("sort",          sort);
    append("by_priority",   by_priority);

    return apiRequest({
        url: `/product/mini-info?${params.toString()}`,
    });
};

export const getProductById = (product_id) => {
    return apiRequest({
        url: `/product/${product_id}`,
    });
};


export const searchProducts = (query, { page = 1, size = 24 } = {}) => {
    const params = new URLSearchParams({ q: query });
    if (page > 1) params.set("page", String(page));
    if (size !== 24) params.set("size", String(size));
    return apiRequest({
        url: `/product/search?${params.toString()}`,
    });
};

// Deprecated: используйте getProductsMiniList
export const getAllProductsMiniInfo = () => {
    return apiRequest({
        url: "/product/mini-info/all",
    });
};


/* ========================
   PUBLIC PRODUCT IMAGES
======================== */


export const getProductImages = (product_id) => {
    return apiRequest(
        {
            url: `/files/products/${product_id}/images`,
            authorized: false,
        }
    );
};