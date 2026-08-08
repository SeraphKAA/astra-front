import React, { useEffect, useMemo, useRef } from "react";

import styles from "./otpInput.module.css";

const toDigits = (v, length) => String(v || "").replace(/\D/g, "").slice(0, length);

export const OtpInput = ({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = false,
  name = "otp",
  className = "",
}) => {
  const rootStyle = {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    marginTop: 6,
  };

  const cellStyle = {
    width: 44,
    height: 54,
    borderRadius: 14,
    border: "1px solid rgba(255, 255, 255, 0.22)",
    background: "rgba(18, 18, 18, 0.35)",
    color: "rgba(255, 255, 255, 0.92)",
    fontSize: 20,
    fontWeight: 800,
    textAlign: "center",
    outline: "none",
    boxShadow: "0 10px 26px rgba(0, 0, 0, 0.12)",
  };

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
      className={`${styles.root} ${className}`}
      style={rootStyle}
      role="group"
      aria-label="One-time code"
    >
      {/* hidden input for forms/autofill */}
      <input type="hidden" name={name} value={toDigits(value, length)} />

      {digits.map((d, idx) => (
        <input
          // eslint-disable-next-line react/no-array-index-key
          key={idx}
          ref={(el) => {
            inputsRef.current[idx] = el;
          }}
          className={styles.cell}
          style={cellStyle}
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
          aria-label={`Digit ${idx + 1}`}
        />
      ))}
    </div>
  );
};

