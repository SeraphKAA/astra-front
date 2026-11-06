import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthAlert } from "../../shared/FieldAuthReg/textfield";
import AstraMark from "../../shared/brand/AstraMark";
import AstraWordmark from "../../shared/brand/AstraWordmark";
import { useRevealOnce, revealDelay } from "../../shared/fx/motionUtils";
import { useAuth } from "../../app/auth/AuthContext";
import { resendEmailCode, verifyEmailCode } from "../../entities/auth/model/authFlows";
import { OtpInput } from "../../shared/ui/OtpInput/OtpInput";

import "./signInCode.css";

const SignInCode = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { loadUserProfile } = useAuth();

  const initialEmail = useMemo(() => {
    return location?.state?.email || "";
  }, [location?.state?.email]);

  const [email] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendLeft, setResendLeft] = useState(0);
  const submitTimerRef = useRef(null);
  const lastSubmittedCodeRef = useRef("");
  /* Появление один раз: карточка поднимается, строки входят стаггером
     (60мс на шаг, кап 6 — бюджет моторики) */
  const cardRef = useRevealOnce();

  const normalizeOtp = (v) => String(v || "").replace(/\D/g, "").slice(0, 6);

  const checkProfileAndGo = async () => {
    await loadUserProfile();
    navigate("/main");
  };

  const onResend = async () => {
    try {
      setError("");
      setInfo("");
      await resendEmailCode({ email });
      setInfo("Код отправлен повторно.");
      setResendLeft(60);
    } catch (e) {
      setError(e?.message || "Не удалось отправить код");
    }
  };

  const doSubmit = async () => {
    try {
      setError("");
      setInfo("");
      setIsSubmitting(true);
      lastSubmittedCodeRef.current = code;
      await verifyEmailCode({ email, code });
      await checkProfileAndGo();
    } catch (e) {
      setError(e?.message || "Неверный код");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (resendLeft <= 0) return;
    const t = window.setInterval(() => {
      setResendLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [resendLeft]);

  useEffect(() => {
    if (submitTimerRef.current) {
      window.clearTimeout(submitTimerRef.current);
      submitTimerRef.current = null;
    }
    if (isSubmitting) return;
    if (code.length !== 6) return;
    if (lastSubmittedCodeRef.current === code) return;
    submitTimerRef.current = window.setTimeout(() => {
      doSubmit();
    }, 400);
    return () => {
      if (submitTimerRef.current) {
        window.clearTimeout(submitTimerRef.current);
        submitTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isSubmitting]);

  if (!email) {
    return <Navigate to="/sign_in" replace />;
  }

  return (
    <div className="astra-auth">
      <div className="astra-auth-wash" aria-hidden="true" />

      <div className="astra-auth-card astra-reveal" ref={cardRef}>
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

        <h1 className="astra-auth-title">Ввод кода</h1>
        <p className="astra-auth-sub">
          Мы отправили код на <strong>{email}</strong>. Введите его ниже.
        </p>

        {/* key по тексту: новое сообщение — новый узел, значит вход
            (fade + 2px) играет и при смене текста */}
        {info && <AuthAlert key={info} tone="info">{info}</AuthAlert>}
        {error && (
          <AuthAlert key={error} tone="error" fix="Проверьте цифры из письма или запросите новый код.">
            {error}
          </AuthAlert>
        )}

        <form className="astra-auth-form" onSubmit={(e) => e.preventDefault()}>
          <div className="astra-auth-field astra-auth-rise" style={revealDelay(0)}>
            {/* Подпись группы: у OtpInput нет одного управляемого поля,
                поэтому это заголовок, а не <label for> */}
            <div className="astra-auth-label">Код из письма:</div>
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

          {isSubmitting && (
            <p className="astra-auth-status" role="status">
              <span className="astra-auth-spin" aria-hidden="true" />
              Проверяем код…
            </p>
          )}

          {/* Код уходит на проверку сам, как только набраны 6 цифр —
              единственное ручное действие здесь и есть повтор отправки */}
          <span className="astra-ring astra-auth-cta-ring astra-auth-rise" style={revealDelay(1)}>
            <button
              type="button"
              className="astra-btn astra-auth-cta"
              onClick={onResend}
              disabled={isSubmitting || resendLeft > 0}
            >
              {resendLeft > 0 ? `Отправить ещё раз (${resendLeft}с)` : "Отправить код ещё раз"}
            </button>
          </span>
        </form>

        <div className="astra-auth-rule" aria-hidden="true" />

        <p className="astra-auth-foot">
          Ошибся с почтой?
          <br />
          <Link to="/sign_in" className="astra-auth-link">
            Вернуться назад
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignInCode;
