import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Label, Input, AuthAlert } from "../../shared/FieldAuthReg/textfield";
import { PasswordFieldModal } from "../../shared/ui/PasswordField";
import { OtpInput } from "../../shared/ui/OtpInput/OtpInput";
import AstraMark from "../../shared/brand/AstraMark";
import AstraWordmark from "../../shared/brand/AstraWordmark";
import { useRevealOnce } from "../../shared/fx/motionUtils";
import { useAuth } from "../../app/auth/AuthContext";
import { isEmailLike, trimAndLimit } from "../../shared/validation";
import { getApiErrorMessage } from "../../shared/commonApi";
import { useToast } from "../../shared/ui/Toast/ToastProvider";

import "./reset-password.css"; // оставляем только специфические стили (индикатор шагов)

const ResetPassword = () => {
  const { requestPasswordReset, verifyResetCode, resetPassword } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();

  // Шаги: "email" -> "code" -> "new-password"
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendLeft, setResendLeft] = useState(0);
  const [isResending, setIsResending] = useState(false);

  const verifyTimerRef = useRef(null);
  const lastVerifiedCodeRef = useRef("");
  const cardRef = useRevealOnce(); // для анимации появления

  const normalizeOtp = (v) => String(v || "").replace(/\D/g, "").slice(0, 6);

  // Шаг 1: отправка кода
  const handleSendCode = async (event) => {
    event.preventDefault();
    setError("");
    setInfo("");

    const emailClean = trimAndLimit(email, 255);
    if (!isEmailLike(emailClean)) {
      setError("Введите корректный email");
      return;
    }

    setIsSubmitting(true);
    try {
      await requestPasswordReset({ email: emailClean });
      setInfo("Код восстановления отправлен на вашу почту");
      setStep("code");
      setResendLeft(60);
    } catch (error) {
      const msg = getApiErrorMessage(error, "Не удалось отправить код восстановления");
      setError(msg);
      pushToast({ type: "error", message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Шаг 2: проверка кода
  const handleVerifyCode = async (event) => {
    if (event) event.preventDefault();
    setError("");
    setInfo("");

    if (code.length !== 6) {
      setError("Введите 6-значный код");
      return;
    }

    setIsSubmitting(true);
    try {
      lastVerifiedCodeRef.current = code;
      await verifyResetCode({ email: trimAndLimit(email, 255), code });
      setInfo("Код подтверждён. Установите новый пароль.");
      setStep("new-password");
    } catch (error) {
      const msg = getApiErrorMessage(error, "Неверный код");
      setError(msg);
      pushToast({ type: "error", message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Шаг 3: установка нового пароля
  const handleResetPassword = async (event) => {
    event.preventDefault();
    setError("");
    setInfo("");

    if (newPassword.length < 8) {
      setError("Пароль должен содержать не менее 8 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword({
        email: trimAndLimit(email, 255),
        code: code,
        newPassword: newPassword,
      });
      pushToast({ type: "success", message: "Пароль успешно изменён" });
      navigate("/sign_in", { replace: true });
    } catch (error) {
      const msg = getApiErrorMessage(error, "Не удалось изменить пароль");
      setError(msg);
      pushToast({ type: "error", message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Повторная отправка кода
  const handleResendCode = async () => {
    if (isResending || resendLeft > 0) return;
    setError("");
    setInfo("");
    setIsResending(true);
    try {
      await requestPasswordReset({ email: trimAndLimit(email, 255) });
      setInfo("Новый код отправлен на вашу почту");
      setResendLeft(60);
    } catch (error) {
      const msg = getApiErrorMessage(error, "Не удалось отправить код повторно");
      setError(msg);
      pushToast({ type: "error", message: msg });
    } finally {
      setIsResending(false);
    }
  };

  // Таймер для повторной отправки
  useEffect(() => {
    if (resendLeft <= 0) return;
    const t = window.setInterval(() => {
      setResendLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [resendLeft]);

  // Автоматическая проверка кода при вводе 6 символов
  useEffect(() => {
    if (verifyTimerRef.current) {
      window.clearTimeout(verifyTimerRef.current);
      verifyTimerRef.current = null;
    }
    if (step !== "code") return;
    if (isSubmitting) return;
    if (code.length !== 6) return;
    if (lastVerifiedCodeRef.current === code) return;

    verifyTimerRef.current = window.setTimeout(() => {
      handleVerifyCode({ preventDefault: () => {} });
    }, 400);

    return () => {
      if (verifyTimerRef.current) {
        window.clearTimeout(verifyTimerRef.current);
        verifyTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step, isSubmitting]);

  // Вспомогательные строки
  const getStepTitle = () => {
    switch (step) {
      case "email": return "Восстановление пароля";
      case "code": return "Подтверждение кода";
      case "new-password": return "Новый пароль";
      default: return "Восстановление пароля";
    }
  };

  const getButtonText = () => {
    switch (step) {
      case "email": return isSubmitting ? "Отправка..." : "Отправить код";
      case "code": return isSubmitting ? "Проверка..." : "Подтвердить";
      case "new-password": return isSubmitting ? "Сохранение..." : "Сохранить пароль";
      default: return "Продолжить";
    }
  };

  // Определяем текст подсказки под заголовком
  const getSubText = () => {
    switch (step) {
      case "email": return "На указанную почту будет отправлен код для восстановления пароля.";
      case "code": return `Мы отправили код на <strong>${email}</strong>. Введите его ниже.`;
      case "new-password": return "Пароль должен содержать не менее 8 символов.";
      default: return "";
    }
  };

  return (
    <div className="astra-auth">
      <div className="astra-auth-wash" aria-hidden="true" />

      <div className="astra-auth-card astra-reveal" ref={cardRef}>
        {/* Бренд-строка */}
        <div className="astra-auth-brand-row">
          <Link to="/main" className="astra-auth-brand" aria-label="ASTRA — на главную">
            <AstraMark className="astra-auth-mark" aria-hidden="true" focusable="false" />
            <AstraWordmark
              className="astra-auth-word"
              role="presentation"
              aria-hidden="true"
              focusable="false"
            />
          </Link>
        </div>

        <h1 className="astra-auth-title">{getStepTitle()}</h1>
        <p
          className="astra-auth-sub"
          dangerouslySetInnerHTML={{ __html: getSubText() }}
        />

        {/* Индикатор шагов (специфичный для восстановления) */}
        <div className="reset-steps">
          <div className={`step-indicator ${step === "email" ? "active" : step !== "email" ? "completed" : ""}`}>
            <span className="step-number">1</span>
            <span className="step-label">Почта</span>
          </div>
          <div className="step-line" />
          <div className={`step-indicator ${step === "code" ? "active" : step === "new-password" ? "completed" : ""}`}>
            <span className="step-number">2</span>
            <span className="step-label">Код</span>
          </div>
          <div className="step-line" />
          <div className={`step-indicator ${step === "new-password" ? "active" : ""}`}>
            <span className="step-number">3</span>
            <span className="step-label">Пароль</span>
          </div>
        </div>

        {/* Сообщения */}
        {info && <AuthAlert key={info} tone="info">{info}</AuthAlert>}
        {error && (
          <AuthAlert key={error} tone="error" fix="Проверьте введённые данные и попробуйте снова.">
            {error}
          </AuthAlert>
        )}

        {/* Панель формы – без анимации переключения, т.к. шаги меняются редко */}
        <div className="astra-auth-panel">
          {step === "email" && (
            <form className="astra-auth-form" onSubmit={handleSendCode}>
              <div className="astra-auth-field">
                <Label htmlFor="email" className="astra-auth-label">
                  Почта (логин)
                </Label>
                <Input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(trimAndLimit(e.target.value, 255))}
                  placeholder="Введите email"
                  className="astra-auth-input"
                  required
                  autoFocus
                />
              </div>

              <span className="astra-ring astra-auth-cta-ring">
                <button type="submit" className="astra-btn astra-auth-cta" disabled={isSubmitting}>
                  {getButtonText()}
                </button>
              </span>
            </form>
          )}

          {step === "code" && (
            <form className="astra-auth-form" onSubmit={handleVerifyCode}>
              <div className="astra-auth-field">
                <div className="astra-auth-label">Код из письма</div>
                <div className="astra-auth-otp">
                  <OtpInput
                    value={code}
                    onChange={(v) => setCode(normalizeOtp(v))}
                    length={6}
                    autoFocus
                    disabled={isSubmitting}
                    name="code"
                  />
                </div>
              </div>

              <div className="reset-actions">
                <button
                  type="button"
                  className="astra-btn-ghost astra-auth-ghost"
                  onClick={handleResendCode}
                  disabled={resendLeft > 0 || isResending}
                >
                  {resendLeft > 0
                    ? `Отправить ещё раз (${resendLeft}с)`
                    : isResending
                    ? "Отправка..."
                    : "Отправить код ещё раз"}
                </button>
              </div>

              <span className="astra-ring astra-auth-cta-ring">
                <button type="submit" className="astra-btn astra-auth-cta" disabled={isSubmitting}>
                  {getButtonText()}
                </button>
              </span>
            </form>
          )}

          {step === "new-password" && (
            <form className="astra-auth-form" onSubmit={handleResetPassword}>
              <div className="astra-auth-field">
                <Label htmlFor="new-password" className="astra-auth-label">
                  Новый пароль
                </Label>
                <PasswordFieldModal
                  id="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Введите новый пароль"
                  inputClassName="astra-auth-input"
                  autoComplete="new-password"
                  required
                  autoFocus
                />
              </div>

              <div className="astra-auth-field">
                <Label htmlFor="confirm-password" className="astra-auth-label">
                  Подтвердите пароль
                </Label>
                <PasswordFieldModal
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Повторите новый пароль"
                  inputClassName="astra-auth-input"
                  autoComplete="new-password"
                  required
                />
              </div>

              <span className="astra-ring astra-auth-cta-ring">
                <button type="submit" className="astra-btn astra-auth-cta" disabled={isSubmitting}>
                  {getButtonText()}
                </button>
              </span>
            </form>
          )}
        </div>

        <div className="astra-auth-rule" aria-hidden="true" />

        <p className="astra-auth-foot">
          Вспомнили пароль?
          <br />
          <Link to="/sign_in" className="astra-auth-link">Войти</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;