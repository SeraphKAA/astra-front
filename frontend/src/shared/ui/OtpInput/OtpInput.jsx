import React, { useEffect, useMemo, useRef } from "react";

import styles from "./otpInput.module.css";

const toDigits = (v, length) => String(v || "").replace(/\D/g, "").slice(0, length);

/**
 * Поле одноразового кода: N отдельных ячеек, одна цифра в каждой.
 *
 * Раскраска целиком живёт в otpInput.module.css (инлайн-стили убраны —
 * они не давали страницам переопределять вид без !important).
 * Доступные имена — по-русски: группа «Одноразовый код», ячейка
 * «Цифра N из M». Клавиатурное поведение (Backspace, стрелки, вставка,
 * автопереход) не менялось.
 */
export const OtpInput = ({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = false,
  name = "otp",
  className = "",
}) => {
  const digits = useMemo(() => {
    const normalized = toDigits(value, length);
    return Array.from({ length }, (_, i) => normalized[i] || "");
  }, [value, length]);

  const inputsRef = useRef([]);

  const focusIndex = (idx) => {
    const el = inputsRef.current[idx];
    if (el) el.focus();
  };

  const setAt = (idx, nextDigit) => {
    const arr = [...digits];
    arr[idx] = nextDigit;
    const nextValue = arr.join("").replace(/\D/g, "").slice(0, length);
    onChange?.(nextValue);
  };

  const handlePaste = (e, idx) => {
    const pasted = toDigits(e.clipboardData?.getData("text") || "", length);
    if (!pasted) return;
    e.preventDefault();

    const arr = [...digits];
    for (let i = 0; i < pasted.length && idx + i < length; i += 1) {
      arr[idx + i] = pasted[i];
    }
    const nextValue = arr.join("").replace(/\D/g, "").slice(0, length);
    onChange?.(nextValue);

    const nextFocus = Math.min(idx + pasted.length, length - 1);
    focusIndex(nextFocus);
  };

  const handleChange = (e, idx) => {
    const d = toDigits(e.target.value, 1);
    if (!d) {
      setAt(idx, "");
      return;
    }
    setAt(idx, d);
    if (idx < length - 1) focusIndex(idx + 1);
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[idx]) {
        setAt(idx, "");
        return;
      }
      if (idx > 0) {
        focusIndex(idx - 1);
        setAt(idx - 1, "");
      }
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (idx > 0) focusIndex(idx - 1);
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (idx < length - 1) focusIndex(idx + 1);
      return;
    }

    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      return;
    }
  };

  useEffect(() => {
    if (!autoFocus) return;
    const firstEmpty = digits.findIndex((d) => !d);
    focusIndex(firstEmpty === -1 ? length - 1 : firstEmpty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`${styles.root} ${className}`.trim()}
      role="group"
      aria-label="Одноразовый код"
    >
      {/* скрытое поле для форм и автозаполнения */}
      <input type="hidden" name={name} value={toDigits(value, length)} />

      {digits.map((d, idx) => (
        <input
          // eslint-disable-next-line react/no-array-index-key
          key={idx}
          ref={(el) => {
            inputsRef.current[idx] = el;
          }}
          className={styles.cell}
          data-otp-cell=""
          type="text"
          inputMode="numeric"
          autoComplete={idx === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={(e) => handleChange(e, idx)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          onPaste={(e) => handlePaste(e, idx)}
          aria-label={`Цифра ${idx + 1} из ${length}`}
        />
      ))}
    </div>
  );
};
