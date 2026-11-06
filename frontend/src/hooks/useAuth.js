import { useState, useEffect, useCallback } from 'react';
import { getMyProfile, logoutUser } from "../entities/user/api/userApi";

export const useAuth = () => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Загрузка профиля пользователя
    const loadUserProfile = useCallback(async () => {
        try {
            const profile = await getMyProfile();
            setUser(profile);
            setIsAuthenticated(true);
            return profile;
        } catch {
            await logout();
            return null;
        }
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            setIsLoading(true);
            try {
                await loadUserProfile();
            } catch {
                // уже обработано в loadUserProfile
            } finally {
                setIsLoading(false);
            }
        };
        initAuth();
    }, [loadUserProfile]);

    const logout = useCallback(async () => {
        try {
            await logoutUser();
        } catch {}
        setUser(null);
        setIsAuthenticated(false);
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
        isLoading,
        isAuthenticated,
        logout,
        hasRole,
        isActive,
        updateUser,
        loadUserProfile
    };
};