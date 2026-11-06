import { apiRequest } from "../../../shared/commonApi";

export const emailRegister = async ({ email, password, refCode, acceptTerms }) => {
  return apiRequest({
    url: "/auth/email/register",
    method: "POST",
    authorized: false,
    body: {
      email,
      password,
      ref_code: refCode || undefined,
      accept_terms: Boolean(acceptTerms),
    },
  });
};

export const emailVerify = async ({ email, code }) => {
  const data = await apiRequest({
    url: "/auth/email/verify",
    method: "POST",
    authorized: false,
    body: { email, code },
  });

  return data;
};

export const emailResendCode = async ({ email }) => {
  return apiRequest({
    url: "/auth/email/resend-code",
    method: "POST",
    authorized: false,
    body: { email },
  });
};

export const emailLogin = async ({ email, password }) => {
  const data = await apiRequest({
    url: "/auth/email/login",
    method: "POST",
    authorized: false,
    body: { email, password },
  });

  return data;
};


export const requestPasswordResetApi = (body) =>
  apiRequest({
    url: "/auth/password-reset/request",
    method: "POST",
    body,
  });

export const verifyPasswordResetCodeApi = (body) =>
  apiRequest({
    url: "/auth/password-reset/verify",
    method: "POST",
    body,
  });

export const resetPasswordApi = ({ email, code, newPassword }) =>
  apiRequest({
    url: "/auth/password-reset/reset",
    method: "POST",
    body: { email, code, new_password: newPassword },
  });

export const telegramBotStart = ({ refCode } = {}) =>
  apiRequest({
    url: "/auth/telegram/bot/start",
    method: "POST",
    authorized: false,
    body: { ref_code: refCode || undefined },
  });

export const telegramBotStatus = ({ code }) =>
  apiRequest({
    url: `/auth/telegram/bot/status?code=${encodeURIComponent(code)}`,
    method: "GET",
    authorized: false,
  });

export const telegramLinkStart = () =>
  apiRequest({
    url: "/auth/telegram/bot/link/start",
    method: "POST",
    authorized: true,
  });

export const telegramLinkStatus = ({ code }) =>
  apiRequest({
    url: `/auth/telegram/bot/link/status?code=${encodeURIComponent(code)}`,
    method: "GET",
    authorized: true,
  });