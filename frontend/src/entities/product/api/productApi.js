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
export const getProductsMiniList = ({
    page = 1,
    size = 20,
    search,
    main_category,
    is_active,
    category_id,
} = {}) => {
    const params = new URLSearchParams({
        page: String(page),
        size: String(size),
    });
    if (search) params.set("search", search);
    if (main_category && main_category !== "all") params.set("main_category", main_category);
    if (is_active && is_active !== "all") params.set("is_active", is_active);
    if (category_id) params.set("category_id", String(category_id));
    return apiRequest({
        url: `/product/mini-info?${params.toString()}`,
    });
};

export const getProductById = (product_id) => {
    return apiRequest({
        url: `/product/${product_id}`,
    });
};


export const searchProducts = (query) => {
    return apiRequest({
        url: `/product/search?q=${encodeURIComponent(query)}`,
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