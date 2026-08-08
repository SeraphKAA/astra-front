export const SQL_INJECTION_ERROR = "Недопустимые символы или конструкции в тексте";

const SQL_INJECTION_PATTERNS = [
  /'\s*;\s*(?:drop|delete|insert|update|select|alter|create|truncate)\b/i,
  /"\s*;\s*(?:drop|delete|insert|update|select|alter|create|truncate)\b/i,
  /\bunion\b.+\bselect\b/i,
  /\b(?:select|insert|update|delete|alter|create|truncate)\b.+\b(?:from|into|table|database|set|where)\b/i,
  /\bdrop\s+(?:table|database|index|schema)\b/i,
  /\b(?:or|and)\b\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?\b/i,
  /(?:'\s*or\s*'|"\s*or\s*"|'\s*and\s*'|"\s*and\s*")/i,
  /\b(?:sleep|benchmark|waitfor\s+delay)\s*\(/i,
  /\bxp_\w+/i,
  /\/\*.*\*\//i,
  /(?:--|#)(?:\s|$)/,
  /\b1\s*=\s*1\b/i,
  /\bchar\s*\(\s*\d+/i,
  /\b0x[0-9a-f]{4,}\b/i,
];

const QUICK_SQL_TOKENS = [
  "';",
  '";',
  "1=1",
  "' or ",
  '" or ',
  "' and ",
  '" and "',
];

export function containsSqlInjection(value) {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  if (text.length < 3) return false;
  const lowered = text.toLowerCase();

  if (QUICK_SQL_TOKENS.some((token) => lowered.includes(token))) {
    if (/(?:'\s*or\s*'|"\s*or\s*"|'\s*and\s*'|"\s*and\s*"|1\s*=\s*1)/i.test(text)) {
      return true;
    }
    return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(text));
  }

  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

export function getSqlInjectionError(value, label = "") {
  if (!containsSqlInjection(value)) return "";
  return label ? `${label}: ${SQL_INJECTION_ERROR}` : SQL_INJECTION_ERROR;
}

export function validateNoSqlInjection(value, label = "") {
  const error = getSqlInjectionError(value, label);
  return error;
}

export function collectSqlInjectionErrors(value, path = "") {
  const errors = [];
  if (typeof value === "string") {
    const error = getSqlInjectionError(value, path || "значение");
    if (error) errors.push(error);
    return errors;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    Object.entries(value).forEach(([key, nested]) => {
      const nestedPath = path ? `${path}.${key}` : key;
      errors.push(...collectSqlInjectionErrors(nested, nestedPath));
    });
    return errors;
  }
  if (Array.isArray(value)) {
    value.forEach((nested, index) => {
      const nestedPath = path ? `${path}[${index}]` : `[${index}]`;
      errors.push(...collectSqlInjectionErrors(nested, nestedPath));
    });
  }
  return errors;
}
