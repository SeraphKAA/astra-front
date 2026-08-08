import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { SignInSvg } from "../../shared/svgIcons";
import { Label, Input } from "../../shared/FieldAuthReg/textfield";
import logo from "../../shared/ASTRA Shop.png";
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

  const normalizeOtp = (v) => String(v || "").replace(/\D/g, "").slice(0, 6);

  const checkProfileAndGo = async () => {
    await loadUserProfile();
    navigate("/menu");
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
    <>
      <div className="body-wrapper-log">
        <div className="div_for_login_ auth-code-card">
          <img src={logo} alt="ASTRA SHOP" className="logo" />

          <h1 className="auth-page-title">Ввод кода</h1>
          <div className="auth-subtitle-divider" aria-hidden />
          <p className="auth-hint">
            Мы отправили код на <strong>{email}</strong>. Введите его ниже.
          </p>

          <form onSubmit={(e) => e.preventDefault()}>
            <div className="form-group">
              <Label htmlFor="code" required>
                Код из письма:
              </Label>
              <OtpInput
                value={code}
                onChange={(v) => setCode(normalizeOtp(v))}
                length={6}
                autoFocus
                disabled={isSubmitting}
                name="code"
              />
            </div>

            <div className="wrap" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="login-button"
                onClick={onResend}
                disabled={isSubmitting || resendLeft > 0}
              >
                {resendLeft > 0 ? `Отправить ещё раз (${resendLeft}с)` : "Отправить код ещё раз"}
                <SignInSvg />
              </button>
            </div>
          </form>

          {info && <div className="auth-alert auth-alert--info">{info}</div>}
          {error && <div className="auth-alert auth-alert--error">{error}</div>}

          <p className="text-login">
            Ошибся с почтой? <br />
            <Link to="/sign_in" className="login-href">
              Вернуться назад
            </Link>
          </p>
        </div>
      </div>

    </>
  );
};

export default SignInCode;

