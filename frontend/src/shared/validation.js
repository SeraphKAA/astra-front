import {
  SQL_INJECTION_ERROR,
  containsSqlInjection,
  getSqlInjectionError,
  validateNoSqlInjection,
  collectSqlInjectionErrors,
} from "./validation/safeText";

export {
  SQL_INJECTION_ERROR,
  containsSqlInjection,
  getSqlInjectionError,
  validateNoSqlInjection,
  collectSqlInjectionErrors,
};

export const trimAndLimit = (value, maxLen) => {

  const s = String(value ?? "").trim();
  if (typeof maxLen === "number" && maxLen > 0) return s.slice(0, maxLen);
  return s;
};

export const isEmailLike = (value) => {
  const s = String(value ?? "").trim();
  // lightweight email validation; backend remains source of truth
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
};

export const normalizeDigits = (value, maxLen) => {
  const s = String(value ?? "").replace(/\D/g, "");
  if (typeof maxLen === "number" && maxLen > 0) return s.slice(0, maxLen);
  return s;
};

export const normalizeMoneyInput = (value) => {
  const s = String(value ?? "");
  const cleaned = s.replace(",", ".").replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;
};

/**
 * Санитайзер ДЛЯ НАБОРА: только белый список символов и длина.
 * Защиту от инъекций здесь не запускаем — она возвращает пустую строку,
 * и поле очищалось прямо под курсором на промежуточном вводе («--»).
 * Проверка живёт в normalizeSearchQuery, который вызывается при отправке.
 */
export const normalizeSearchTyping = (value, maxLen = 60) => {
  const s = String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s\p{P}\p{S}]/gu, "");
  return s.slice(0, maxLen);
};

export const normalizeSearchQuery = (value, maxLen = 60) => {
  const s = normalizeSearchTyping(value, maxLen).trim();
  const sqlError = validateNoSqlInjection(s, "Поиск");
  if (sqlError) return "";
  return s;
};

export const validateNickname = (value) => {
  const s = String(value ?? "").trim();
  if (s.length < 2) return "Никнейм должен быть не короче 2 символов";
  if (s.length > 30) return "Никнейм должен быть не длиннее 30 символов";
  if (!/^[a-zA-Z0-9_]+$/.test(s)) return "Никнейм: только латиница, цифры и _";
  const sqlError = validateNoSqlInjection(s, "Никнейм");
  if (sqlError) return sqlError;
  return "";
};

