import React, { useCallback, useEffect, useMemo, useState } from "react";

import { AuthContext } from "./AuthContext";
import { LS } from "../../utilities/utilLocalStorage";
import { getMyProfile, logoutUser } from "../../entities/user/api/userApi";
import {
  emailLogin,
  emailRegister,
  emailResendCode,
  emailVerify,
  telegramBotStart,
  telegramBotStatus,
  requestPasswordResetApi,
  verifyPasswordResetCodeApi,
  resetPasswordApi,
} from "../../entities/auth/api/authApi";
import { getActiveAvatarByUserId } from "../../entities/files/api/fileApi";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeAvatar, setActiveAvatar] = useState(null);

  useEffect(() => {
    const tgStartParam = window?.Telegram?.WebApp?.initDataUnsafe?.start_param;
    const urlRefCode = new URLSearchParams(window.location.search).get("ref");
    const parsedTgCode =
      typeof tgStartParam === "string" && tgStartParam.startsWith("ref_")
        ? tgStartParam.slice(4)
        : "";
    const referralCode = parsedTgCode || urlRefCode || "";
    if (referralCode) {
      LS.set("pending_ref_code", referralCode);
    }
  }, []);

  const loadUserProfile = useCallback(async () => {
    const profile = await getMyProfile();
    setUser(profile);
    setIsAuthenticated(true);
    return profile;
  }, []);

  // const logout = useCallback(async () => {
  //   await LS.remove("access_token");
  //   await LS.remove("refresh_token");
  //   setUser(null);
  //   setActiveAvatar(null);
  //   setIsAuthenticated(false);
  // }, []);
  const logout = useCallback(async () => {
    try {
      await logoutUser(); // вызовет POST /users/logout с куками
    } catch {
      // игнорируем ошибки при логауте
    }
    setUser(null);
    setActiveAvatar(null);
    setIsAuthenticated(false);
  }, []);

  const loadActiveAvatar = useCallback(async (profileUser) => {
    const targetUserId = profileUser?.id || user?.id;
    if (!targetUserId) {
      setActiveAvatar(null);
      return null;
    }

    try {
      const avatar = await getActiveAvatarByUserId(targetUserId);
      setActiveAvatar(avatar || null);
      return avatar || null;
    } catch (e) {
      setActiveAvatar(null);
      return null;
    }
  }, [user?.id]);

  // const refreshTokens = useCallback(async () => {
  //   const rt = await LS.get("refresh_token");
  //   if (!rt) throw new Error("No refresh token");
  //   const data = await refreshTokensApi(rt);
  //   if (data?.access_token && data?.refresh_token) {
  //     await LS.set("access_token", data.access_token);
  //     await LS.set("refresh_token", data.refresh_token);
  //     return data.access_token;
  //   }
  //   return null;
  // }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        await loadUserProfile();
      } catch {
        await logout();
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [loadUserProfile]);

  const loginWithEmail = useCallback(
    async ({ email, password }) => {
      // Не трогаем глобальный isLoading: в App он скрывает весь UI спиннером,
      // из‑за чего размонтируется /sign_in и теряется локальное состояние ошибок.
      const data = await emailLogin({ email, password });
      if (data?.user_data) {
        setUser(data.user_data);
        await loadActiveAvatar(data.user_data);
      } else {
        const profile = await loadUserProfile();
        await loadActiveAvatar(profile);
      }
      setIsAuthenticated(true);
      return data;
    },
    [loadActiveAvatar, loadUserProfile]
  );

  const registerWithEmail = useCallback(async ({ email, password, acceptTerms }) => {
    const refCode = await LS.get("pending_ref_code");
    return emailRegister({ email, password, refCode, acceptTerms });
  }, []);

  const verifyEmailCode = useCallback(
    async ({ email, code }) => {
      const data = await emailVerify({ email, code });
      if (data?.user_data) {
        setUser(data.user_data);
        await loadActiveAvatar(data.user_data);
      } else {
        const profile = await loadUserProfile();
        await loadActiveAvatar(profile);
      }
      setIsAuthenticated(true);
      return data;
    },
    [loadActiveAvatar, loadUserProfile]
  );

  const resendEmailCode = useCallback(async ({ email }) => {
    return emailResendCode({ email });
  }, []);

  const buildTgUrl = (startParam) => {
    const botUsername = process.env.REACT_APP_TG_BOT_USERNAME || "astra_auth_bot";
    if (!botUsername) return "";
    return `https://t.me/${botUsername}?start=${encodeURIComponent(startParam)}`;
  };

  const startTelegramBotLogin = useCallback(async () => {
    const refCode = await LS.get("pending_ref_code");
    const res = await telegramBotStart({ refCode });
    return { ...res, bot_url: buildTgUrl(res.start_param) };
  }, []);

  const pollTelegramBotLogin = useCallback(async (code) => {
    const res = await telegramBotStatus({ code });
    if (res?.status === "confirmed" && res.user) {
      setUser(res.user);
      await loadActiveAvatar(res.user);
      setIsAuthenticated(true);
      await LS.remove("pending_ref_code");
    }
    return res;
  }, [loadActiveAvatar]);

  const requestPasswordReset = useCallback(async ({ email }) => {
    return requestPasswordResetApi({ email });
  }, []);

  const verifyResetCode = useCallback(async ({ email, code }) => {
    return verifyPasswordResetCodeApi({ email, code });
  }, []);

  const resetPassword = useCallback(async ({ email, code, newPassword }) => {
    return resetPasswordApi({ email, code, newPassword });
  }, []);


  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setActiveAvatar(null);
      return;
    }
    loadActiveAvatar(user);
  }, [isAuthenticated, loadActiveAvatar, user]);

  const hasRole = useCallback(
    (role) => {
      if (!user) return false;
      if (Array.isArray(role)) return role.includes(user.role);
      return user.role === role;
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      activeAvatar,
      loadUserProfile,
      loadActiveAvatar,
      logout,
      // refreshTokens,
      loginWithEmail,
      registerWithEmail,
      verifyEmailCode,
      resendEmailCode,
      startTelegramBotLogin,
      pollTelegramBotLogin,
      hasRole,
      requestPasswordReset,
      verifyResetCode,
      resetPassword,
    }),
    [
      user,
      isLoading,
      isAuthenticated,
      activeAvatar,
      loadUserProfile,
      loadActiveAvatar,
      logout,
      // refreshTokens,
      loginWithEmail,
      registerWithEmail,
      verifyEmailCode,
      resendEmailCode,
      startTelegramBotLogin,
      pollTelegramBotLogin,
      hasRole,
      requestPasswordReset,
      verifyResetCode,
      resetPassword,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

