import { useState, useEffect, useCallback } from 'react';
import { LS } from "../utilities/utilLocalStorage";
import { getMyProfile, refreshTokens } from "../entities/user/api/userApi";

export const useAuth = () => {
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const [refreshToken, setRefreshToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Загрузка профиля пользователя
    const loadUserProfile = useCallback(async () => {
        try {
            const profile = await getMyProfile();
            setUser(profile);
            setIsAuthenticated(true);
            return profile;
        } catch (error) {
            // console.error("Error loading user profile:", error);
            // Если не удалось загрузить профиль, выходим из системы
            await logout();
            return null;
        }
    }, []);

    // Инициализация при загрузке
    useEffect(() => {
        const initAuth = async () => {
            setIsLoading(true);
            try {
                const storedAccessToken = await LS.get("access_token");
                const storedRefreshToken = await LS.get("refresh_token");

                if (storedAccessToken && storedRefreshToken) {
                    setAccessToken(storedAccessToken);
                    setRefreshToken(storedRefreshToken);
                    await loadUserProfile();
                } else {
                    setIsAuthenticated(false);
                    setUser(null);
                }
            } catch (error) {
                // console.error("Auth initialization error:", error);
                setIsAuthenticated(false);
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();
    }, [loadUserProfile]);

    // Telegram Login Widget / WebApp auth lives in AuthProvider (app/auth/AuthProvider.jsx)
    const login = useCallback(async () => {
        throw new Error("Deprecated: use AuthProvider login methods instead");
    }, []);

    // Обновление токенов
    const refreshAuthTokens = useCallback(async () => {
        try {
            const currentRefreshToken = await LS.get("refresh_token");
            if (!currentRefreshToken) {
                throw new Error("No refresh token");
            }

            const response = await refreshTokens(currentRefreshToken);

            if (response.access_token && response.refresh_token) {
                await LS.set("access_token", response.access_token);
                await LS.set("refresh_token", response.refresh_token);
                setAccessToken(response.access_token);
                setRefreshToken(response.refresh_token);
                return response.access_token;
            }

            return null;
        } catch (error) {
            // console.error("Token refresh error:", error);
            await logout();
            throw error;
        }
    }, []);

    // Выход из системы
    const logout = useCallback(async () => {
        try {
            await LS.remove("access_token");
            await LS.remove("refresh_token");
            setAccessToken(null);
            setRefreshToken(null);
            setUser(null);
            setIsAuthenticated(false);
        } catch (error) {
            // console.error("Logout error:", error);
        }
    }, []);

    // Проверка роли пользователя
    const hasRole = useCallback((role) => {
        if (!user) return false;
        if (Array.isArray(role)) {
            return role.includes(user.role);
        }
        return user.role === role;
    }, [user]);

    // Проверка статуса пользователя
    const isActive = useCallback(() => {
        return user?.is_active === true && user?.status === "active";
    }, [user]);

    // Обновление данных пользователя
    const updateUser = useCallback((updatedData) => {
        setUser(prev => ({ ...prev, ...updatedData }));
    }, []);

    return {
        user,
        accessToken,
        refreshToken,
        isLoading,
        isAuthenticated,
        login,
        logout,
        refreshTokens: refreshAuthTokens,
        hasRole,
        isActive,
        updateUser,
        loadUserProfile
    };
};