import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
// import { User } from "../../features/auth/user";
import { SignInSvg } from "../../shared/svgIcons";
import { Label, Input } from "../../shared/FieldAuthReg/textfield";
import { PasswordFieldAuth } from "../../shared/ui/PasswordField";
import logo from "../../shared/ASTRA Shop.png";
import { useAuth } from "../../app/auth/AuthContext";
import { LS } from "../../utilities/utilLocalStorage";
import { OtpInput } from "../../shared/ui/OtpInput/OtpInput";
import { isEmailLike, trimAndLimit } from "../../shared/validation";

import "./register.css";


const Register = ({ setIsLogged }) => {
    const { registerWithEmail, verifyEmailCode, resendEmailCode, loadUserProfile } = useAuth();
    const [email, setEmail] = useState('');
    const [password1, setPassword1] = useState('');
    const [password2, setPassword2] = useState('');
    const [error, setError] = useState('');
    const [step, setStep] = useState("register"); // register | verify
    const [code, setCode] = useState("");
    const [info, setInfo] = useState("");
    // profile setup modal is handled after navigation (/menu) globally
    const [resendLeft, setResendLeft] = useState(0);
    const [isVerifying, setIsVerifying] = useState(false);
    const [acceptTerms, setAcceptTerms] = useState(false);
    const verifyTimerRef = useRef(null);
    const lastVerifiedCodeRef = useRef("");

    const normalizeOtp = (v) => String(v || "").replace(/\D/g, "").slice(0, 6);

    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setInfo("");

        const emailClean = trimAndLimit(email, 255);
        if (!isEmailLike(emailClean)) {
            return setError("Введите корректный email");
        }

        if (password1 !== password2) {
            return setError('Пароли не совпадают!');
        }

        if (password1.length < 8) {
            return setError("Длина пароля должна быть не менее 8 символов");
        }

        if (!acceptTerms) {
            return setError("Необходимо принять пользовательское соглашение");
        }

        try {
            await registerWithEmail({
                email: emailClean,
                password: password1,
                acceptTerms: true,
            });
            setInfo("Мы отправили код подтверждения на почту. Введите его ниже.");
            setStep("verify");
        } catch (error) {
            setError(error?.message || "Ошибка регистрации");
        }
    };

    const handleVerify = async (event) => {
        event.preventDefault();
        setError("");
        setInfo("");
        setIsVerifying(true);
        try {
            lastVerifiedCodeRef.current = code;
            await verifyEmailCode({ email: trimAndLimit(email, 255), code });
            await LS.remove("pending_ref_code");
            await loadUserProfile();
            navigate("/menu");
        } catch (e) {
            setError(e?.message || "Неверный код");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResend = async () => {
        setError("");
        setInfo("");
        try {
            await resendEmailCode({ email });
            setInfo("Код отправлен повторно.");
            setResendLeft(60);
        } catch (e) {
            setError(e?.message || "Не удалось отправить код повторно");
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
        if (verifyTimerRef.current) {
            window.clearTimeout(verifyTimerRef.current);
            verifyTimerRef.current = null;
        }
        if (step !== "verify") return;
        if (isVerifying) return;
        if (code.length !== 6) return;
        if (lastVerifiedCodeRef.current === code) return;
        verifyTimerRef.current = window.setTimeout(() => {
            handleVerify({ preventDefault: () => {} });
        }, 400);
        return () => {
            if (verifyTimerRef.current) {
                window.clearTimeout(verifyTimerRef.current);
                verifyTimerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code, step, isVerifying]);

    return (
        <>
            <div className="body-wrapper">
                <div className="main">

                    <img src={logo} alt="ASTRA SHOP" className="logo" />
                    <h1 className="auth-page-title">
                        {step === "register" ? "Регистрация" : "Подтверждение почты"}
                    </h1>
                    <div className="auth-subtitle-divider" aria-hidden />

                    <div className="login-methods" style={{ marginTop: 10 }}>
                        <button
                            type="button"
                            className={`method-btn ${step === "register" ? "is-active" : ""}`}
                            onClick={() => setStep("register")}
                        >
                            Через почту
                        </button>
                        <button
                            type="button"
                            className={`method-btn ${step === "verify" ? "is-active" : ""}`}
                            onClick={() => step === "verify" && setStep("verify")}
                            disabled={step !== "verify"}
                            title={step !== "verify" ? "Сначала отправьте код на почту" : ""}
                        >
                            Ввод кода
                        </button>
                    </div>

                    {step === "register" ? (
                        <form onSubmit={handleSubmit}>
                            <Label htmlFor="email" className="register-label">
                                Почта (логин):
                            </Label>
                            <Input
                                type="text"
                                id="email"
                                name="email"
                                placeholder="Введите email"
                                required
                                className="register-input"
                                value={email}
                                onChange={(event) => setEmail(trimAndLimit(event.target.value, 255))}
                            />

                            <Label htmlFor="password" className="register-label">
                                Пароль:
                            </Label>
                            <PasswordFieldAuth
                                id="password"
                                name="password"
                                placeholder="Введите пароль"
                                required
                                inputClassName="register-input"
                                value={password1}
                                onChange={(event) => setPassword1(event.target.value)}
                                autoComplete="new-password"
                            />

                            <Label htmlFor="password2" className="register-label">
                                Повторите пароль:
                            </Label>
                            <PasswordFieldAuth
                                id="password2"
                                name="password2"
                                placeholder="Повторите введённый пароль"
                                required
                                inputClassName="register-input"
                                value={password2}
                                onChange={(event) => setPassword2(event.target.value)}
                                autoComplete="new-password"
                            />

                            <label className="register-checkbox register-terms-label">
                                <input
                                    type="checkbox"
                                    checked={acceptTerms}
                                    onChange={(e) => setAcceptTerms(e.target.checked)}
                                />
                                <span>
                                    Я принимаю{" "}
                                    <Link to="/user-agreement" className="register-terms-link">
                                        пользовательское соглашение
                                    </Link>
                                </span>
                            </label>

                            <div className="wrap">
                                <button
                                    type="submit"
                                    className="register-button"
                                    disabled={!acceptTerms}
                                >
                                    Зарегистрироваться
                                    <SignInSvg />
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleVerify}>
                            <p className="auth-verify-hint">
                                Мы отправили код на <strong>{email}</strong>. Введите его ниже.
                            </p>
                            <Label htmlFor="code" className="register-label">
                                Код из письма:
                            </Label>
                            <OtpInput
                                value={code}
                                onChange={(v) => setCode(normalizeOtp(v))}
                                length={6}
                                autoFocus
                                disabled={isVerifying}
                                name="code"
                            />

                            <div className="wrap" style={{ marginTop: 10 }}>
                                <button
                                    type="button"
                                    className="register-button"
                                    onClick={handleResend}
                                    disabled={resendLeft > 0}
                                >
                                    {resendLeft > 0 ? `Отправить ещё раз (${resendLeft}с)` : "Отправить код ещё раз"}
                                </button>
                            </div>
                        </form>
                    )}

                    {info && <div className="auth-alert auth-alert--info">{info}</div>}
                    {error && <div className="auth-alert auth-alert--error">{error}</div>}

                    <p className="text-login">
                        Уже есть аккаунт?<br />
                        <Link to="/sign_in" className="login-href">Войти</Link>
                    </p>
                </div>
            </div>

        </>
    );
};

export default Register;