import { apiRequest } from "../../../shared/commonApi";
import { LS } from "../../../utilities/utilLocalStorage";

const storeTokensIfPresent = async (data) => {
  if (data?.access_token && data?.refresh_token) {
    await LS.set("access_token", data.access_token);
    await LS.set("refresh_token", data.refresh_token);
  }
};

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
  await storeTokensIfPresent(data);
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
  await storeTokensIfPresent(data);
  return data;
};

export const telegramWebAppLogin = async ({ initData, refCode }) => {
  const data = await apiRequest({
    url: "/auth/telegram/webapp",
    method: "POST",
    authorized: false,
    body: { initData, ref_code: refCode || undefined },
  });
  await storeTokensIfPresent(data);
  return data;
};

export const telegramWidgetLogin = async ({ payload, refCode }) => {
  const data = await apiRequest({
    url: "/auth/telegram/widget",
    method: "POST",
    authorized: false,
    body: { ...(payload || {}), ref_code: refCode || undefined },
  });
  await storeTokensIfPresent(data);
  return data;
};

