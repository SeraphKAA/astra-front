import { apiRequest } from "../../../shared/commonApi";

export const logoutUser = () => {
    return apiRequest(
        {
            url: "/users/logout/user",
            method: "POST",
            // credentials: "include",
            // authorized: true,
        }
    );
};


/* ========================
   CURRENT USER
======================== */

export const getMyProfile = () => {
    return apiRequest({
        url: "/users/me",
    });
};

export const updateMyProfile = (data) => {
    return apiRequest({
        url: "/users/me",
        method: "PUT",
        body: data,
    });
};

export const sendBindEmailCode = (email) => {
    return apiRequest({
        url: "/auth/email/bind/send-code",
        method: "POST",
        body: { email },
    });
};

export const verifyBindEmailCode = (email, code) => {
    return apiRequest({
        url: "/auth/email/bind/verify",
        method: "POST",
        body: { email, code },
    });
};

export const setMyReferralCode = (refCode) => {
    return apiRequest({
        url: "/users/me/referral",
        method: "PATCH",
        body: { ref_code: refCode },
    });
};


/* ========================
   PUBLIC
======================== */

export const getUserPublic = (userId) => {
    return apiRequest({
        url: `/users/public/${userId}`,
        authorized: false,
    });
};


/* ========================
   ADMIN
======================== */

export const getUsersList = ({ page = 1, size = 20, role, status, search }) => {
    const params = new URLSearchParams({
        page: String(page),
        size: String(size),
    });

    if (role) params.append("role", role);
    if (status) params.append("status", status);
    if (search?.trim()) params.append("search", search.trim());

    return apiRequest({
        url: `/users?${params.toString()}`,
    });
};

export const getUsersCount = ({ role, status }) => {
    const params = new URLSearchParams();

    if (role) params.append("role", role);
    if (status) params.append("status", status);

    return apiRequest({
        url: `/users/stats/count?${params.toString()}`,
    });
};

export const changeUserRole = (data) => {
    return apiRequest({
        url: "/users/change-role",
        method: "PATCH",
        body: data,
    });
};

export const changeUserStatus = (userId, status) => {
    return apiRequest({
        url: `/users/${userId}/status?status=${status}`,
        method: "PATCH",
    });
};

export const adminUpdateUser = (userId, data) => {
    return apiRequest({
        url: `/users/${userId}/admin`,
        method: "PUT",
        body: data,
    });
};

export const getUserById = (userId) => {
    return apiRequest({
        url: `/users/${userId}`,
    });
};

export const getUserByTelegramId = (telegramId) => {
    return apiRequest({
        url: `/users/telegram/${telegramId}`,
    });
};

// export const getAdminDashboardStats = () => {
//     return apiRequest({
//         url: "/users/admin/count",
//     });
// };
