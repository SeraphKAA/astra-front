import { getSqlInjectionError } from "./safeText";

const GAME_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_\-.@+#/]{0,127}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isCheckoutFieldRequired(field) {
  const value = field?.required;
  if (value === false || value === 0) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  }
  if (value === true || value === 1) return true;
  return true;
}

export function validateCheckoutFieldValue(field, value) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const label = field?.label || field?.key || "";
  const sqlError = getSqlInjectionError(text, label);
  if (sqlError) {
    return sqlError.startsWith(`${label}: `)
      ? sqlError.slice(label.length + 2)
      : sqlError;
  }

  const type = String(field?.type || "text").toLowerCase();

  if (type === "email") {
    return EMAIL_PATTERN.test(text) ? null : "Некорректный email";
  }

  if (type === "game_id_or_email") {
    if (text.includes("@")) {
      return EMAIL_PATTERN.test(text) ? null : "Некорректный email";
    }
    return GAME_ID_PATTERN.test(text)
      ? null
      : "Недопустимый формат ID (буквы, цифры, - _ . @ + # /)";
  }

  return null;
}

export function collectCheckoutFieldErrors(fields, values) {
  const missing = [];
  const invalid = [];

  for (const field of fields || []) {
    const key = field.key;
    if (!key) continue;
    const label = field.label || key;
    const raw = values?.[key];
    const text = typeof raw === "string" ? raw.trim() : raw;

    if (isCheckoutFieldRequired(field) && (text === undefined || text === null || text === "")) {
      missing.push(label);
      continue;
    }

    const err = validateCheckoutFieldValue(field, text);
    if (err) invalid.push(`${label}: ${err}`);
  }

  return { missing, invalid };
}

export function collectCheckoutGroupErrors(groups, forms) {
  const errors = [];
  for (const group of groups || []) {
    const values = forms?.[group.profile_type] || {};
    const { missing, invalid } = collectCheckoutFieldErrors(group.fields, values);
    if (missing.length || invalid.length) {
      errors.push({
        profileType: group.profile_type,
        missing,
        invalid,
      });
    }
  }
  return errors;
}

export function canSubmitCheckoutGroups(groups, forms) {
  return collectCheckoutGroupErrors(groups, forms).length === 0;
}
