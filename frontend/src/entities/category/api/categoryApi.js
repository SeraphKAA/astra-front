import { apiRequest } from "../../../shared/commonApi";

/* ========================
   PUBLIC
======================== */

// Все категории
export const getAllCategories = () => {
    return apiRequest({
        url: "/categories/all",
        authorized: false,
    });
};

// Первая категория (ALL)
export const getFirstCategory = () => {
    return apiRequest({
        url: "/categories/first",
        authorized: false,
    });
};

// Дерево категории по id
export const getCategoryTree = (categoryId) => {
    return apiRequest({
        url: `/categories/${categoryId}`,
        authorized: false,
    });
};


/* ========================
   ADMIN
======================== */

// Создать категорию
export const createCategory = (data) => {
    return apiRequest({
        url: "/categories/",
        method: "POST",
        body: data,
    });
};

// Удалить категорию
export const deleteCategory = (categoryId) => {
    return apiRequest({
        url: `/categories/${categoryId}`,
        method: "DELETE",
    });
};

export const duplicateCategorySettings = (sourceCategoryId, body) => {
    return apiRequest({
        url: `/categories/${sourceCategoryId}/duplicate-settings`,
        method: "POST",
        body,
    });
};
