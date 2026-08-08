import { emailResendCode as emailResendCodeApi, emailVerify as emailVerifyApi } from "../api/authApi";

export const resendEmailCode = async ({ email }) => {
  return emailResendCodeApi({ email });
};

export const verifyEmailCode = async ({ email, code }) => {
  return emailVerifyApi({ email, code });
};

