import { apiRequest } from "../../../shared/commonApi";

/* ========================
   AVATARS
======================== */

export const uploadAvatar = (file) => {
    const formData = new FormData();
    formData.append("file", file);

    return apiRequest({
        url: "/files/avatars/upload",
        method: "POST",
        body: formData,
    });
};

export const getMyAvatars = () => {
    return apiRequest({
        url: "/files/avatars/my",
    });
};

export const activateAvatar = (avatarId) => {
    return apiRequest({
        url: `/files/avatars/${avatarId}/activate`,
        method: "POST",
    });
};

export const deleteAvatar = (avatarId) => {
    return apiRequest({
        url: `/files/avatars/${avatarId}`,
        method: "DELETE",
    });
};

export const getActiveAvatarByUserId = (userId) => {
    return apiRequest({
        url: `/files/avatars/user/active?user_id=${userId}`,
        authorized: false,
    });
};

export const getAvatarById = (imageId) => {
    return apiRequest({
        url: `/files/avatars/images/${imageId}`,
        authorized: false,
    });
};

export const getFileLimits = () => {
    return apiRequest({
        url: "/files/limits",
        authorized: false,
    });
};



/* ========================
   PRODUCT IMAGES
======================== */

export const uploadProductImage = (productId, file, imageType = "main") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("image_type", imageType);

    return apiRequest({
        url: `/files/products/${productId}/images`,
        method: "POST",
        body: formData,
    });
};

// export const changeMainProductImage = (imageId, isMain) => {
//     const formData = new FormData();
//     formData.append("is_main", isMain);

//     return apiRequest({
//         url: `/files/products/images/${imageId}`,
//         method: "PATCH",
//         body: formData,
//     });
// };

export const changeProductImageType = (imageId, imageType) => {
    const formData = new FormData();
    formData.append("image_type", imageType);

    return apiRequest({
        url: `/files/products/images/${imageId}/type`,
        method: "PATCH",
        body: formData,
    });
};

export const getProductImages = (productId) => {
    return apiRequest({
        url: `/files/products/${productId}/images`,
        authorized: false,
    });
};

export const getProductMainImage = (productId) => {
    return apiRequest({
        url: `/files/products/${productId}/images/main`,
        authorized: false,
    });
};

export const deleteProductImage = (imageId) => {
    return apiRequest({
        url: `/files/products/images/${imageId}`,
        method: "DELETE",
    });
};


/* ========================
   CATEGORY IMAGES
======================== */

export const uploadCategoryImage = (categoryId, file, isMain = true) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("is_main", isMain);

    return apiRequest({
        url: `/files/categories/${categoryId}/images`,
        method: "POST",
        body: formData,
    });
};

export const getCategoryImages = (categoryId) => {
    return apiRequest({
        url: `/files/categories/${categoryId}/images`,
        authorized: false,
    });
};

export const deleteCategoryImage = (imageId) => {
    return apiRequest({
        url: `/files/categories/images/${imageId}`,
        method: "DELETE",
    });
};


/* ========================
   TEMPORARY FILES
======================== */

export const uploadTemporaryFile = (file, expiresHours = 24) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("expires_hours", expiresHours);

    return apiRequest({
        url: "/files/temporary/upload",
        method: "POST",
        body: formData,
    });
};
