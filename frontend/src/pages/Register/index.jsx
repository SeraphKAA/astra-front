import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
// import { User } from "../../features/auth/user";
import { Label, Input, AuthAlert } from "../../shared/FieldAuthReg/textfield";
import { PasswordFieldAuth } from "../../shared/ui/PasswordField";
import AstraMark from "../../shared/brand/AstraMark";
import AstraWordmark from "../../shared/brand/AstraWordmark";
import { useRevealOnce, revealDelay } from "../../shared/fx/motionUtils";
import { useAuth } from "../../app/auth/AuthContext";
import { LS } from "../../utilities/utilLocalStorage";
import { OtpInput } from "../../shared/ui/OtpInput/OtpInput";
import { isEmailLike, trimAndLimit } from "../../shared/validation";

import "./register.css";


/* Порядок шагов задаёт направление проезда панели */
const STEPS = ["register", "verify"];

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
    const [isRegistering, setIsRegistering] = useState(false);
    const [acceptTerms, setAcceptTerms] = useState(false);
    /* 0 — шаг ещё не переключали: играет стаггер строк, а не проезд */
    const [dir, setDir] = useState(0);
    const verifyTimerRef = useRef(null);
    const lastVerifiedCodeRef = useRef("");
    /* Появление один раз: карточка поднимается, строки входят стаггером */
    const cardRef = useRevealOnce();
    const stagger = dir === 0;

    const goToStep = (next) => {
        if (next === step) return;
        setDir(STEPS.indexOf(next) > STEPS.indexOf(step) ? 1 : -1);
        setStep(next);
    };

    /* Класс строки формы: стаггер только на первой отрисовке */
    const rowProps = (index) =>
        stagger
            ? { className: "astra-auth-field astra-auth-rise", style: revealDelay(index) }
            : { className: "astra-auth-field" };

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

        setIsRegistering(true);
        try {
            await registerWithEmail({
                email: emailClean,
                password: password1,
                acceptTerms: true,
            });
            setInfo("Мы отправили код подтверждения на почту. Введите его ниже.");
            goToStep("verify");
        } catch (error) {
            setError(error?.message || "Ошибка регистрации");
        } finally {
            setIsRegistering(false);
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
            navigate("/main");
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

    const errorFix =
        step === "register"
            ? "Проверьте введённые данные и попробуйте снова."
            : "Проверьте цифры из письма или запросите новый код.";

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

                <h1 className="astra-auth-title">
                    {step === "register" ? "Регистрация" : "Подтверждение почты"}
                </h1>
                <p className="astra-auth-sub">
                    {step === "register" ? (
                        "Почта и пароль — этого хватит, чтобы начать."
                    ) : (
                        <>
                            Код отправлен на <strong>{email}</strong>
                        </>
                    )}
                </p>

                {/* <AuthTabs
                    label="Шаг регистрации"
                    value={step}
                    onChange={goToStep}
                    items={[
                        { value: "register", label: "Через почту" },
                        {
                            value: "verify",
                            label: "Ввод кода",
                            disabled: step !== "verify",
                            title: step !== "verify" ? "Сначала отправьте код на почту" : "",
                        },
                    ]}
                /> */}

                {/* key по тексту: новое сообщение — новый узел, значит вход
                    (fade + 2px) играет и при смене текста, а не только при
                    его появлении */}
                {info && <AuthAlert key={info} tone="info">{info}</AuthAlert>}
                {error && (
                    <AuthAlert key={error} tone="error" fix={errorFix}>
                        {error}
                    </AuthAlert>
                )}

                {/* Панель под вкладками: вход направленный (--auth-dir),
                    при первой отрисовке — без проезда, работает стаггер строк */}
                <div
                    key={step}
                    className={`astra-auth-panel${dir ? " is-switching" : ""}`}
                    style={dir ? { "--auth-dir": dir } : undefined}
                >
                    {step === "register" ? (
                        <form className="astra-auth-form" onSubmit={handleSubmit}>
                            <div {...rowProps(0)}>
                                <Label htmlFor="email" className="astra-auth-label">
                                    Почта (логин)
                                </Label>
                                <Input
                                    type="text"
                                    id="email"
                                    name="email"
                                    placeholder="Введите email"
                                    required
                                    className="astra-auth-input"
                                    autoComplete="email"
                                    inputMode="email"
                                    value={email}
                                    onChange={(event) => setEmail(trimAndLimit(event.target.value, 255))}
                                />
                            </div>

                            <div {...rowProps(1)}>
                                <Label htmlFor="password" className="astra-auth-label">
                                    Пароль
                                </Label>
                                <PasswordFieldAuth
                                    id="password"
                                    name="password"
                                    placeholder="Введите пароль"
                                    required
                                    value={password1}
                                    onChange={(event) => setPassword1(event.target.value)}
                                    autoComplete="new-password"
                                />
                            </div>

                            <div {...rowProps(2)}>
                                <Label htmlFor="password2" className="astra-auth-label">
                                    Повторите пароль
                                </Label>
                                <PasswordFieldAuth
                                    id="password2"
                                    name="password2"
                                    placeholder="Повторите введённый пароль"
                                    required
                                    value={password2}
                                    onChange={(event) => setPassword2(event.target.value)}
                                    autoComplete="new-password"
                                />
                            </div>

                            <label
                                className={`astra-auth-terms${stagger ? " astra-auth-rise" : ""}`}
                                style={stagger ? revealDelay(3) : undefined}
                            >
                                <input
                                    type="checkbox"
                                    checked={acceptTerms}
                                    onChange={(e) => setAcceptTerms(e.target.checked)}
                                />
                                <span>
                                    Я принимаю{" "}
                                    <Link to="/user-agreement" className="astra-auth-terms-link">
                                        пользовательское соглашение
                                    </Link>
                                </span>
                            </label>

                            {/* .astra-ring: clip-path кнопки съедает outline — кольцо на обёртке */}
                            <span
                                className={`astra-ring astra-auth-cta-ring${stagger ? " astra-auth-rise" : ""}`}
                                style={stagger ? revealDelay(4) : undefined}
                            >
                                <button
                                    type="submit"
                                    className="astra-btn astra-auth-cta"
                                    disabled={!acceptTerms || isRegistering}
                                >
                                    {isRegistering ? (
                                        <>
                                            <span className="astra-auth-spin" aria-hidden="true" />
                                            Регистрируем…
                                        </>
                                    ) : (
                                        "Зарегистрироваться"
                                    )}
                                </button>
                            </span>
                        </form>
                    ) : (
                        <form className="astra-auth-form" onSubmit={handleVerify}>
                            <div {...rowProps(0)}>
                                {/* Подпись группы: у OtpInput нет одного управляемого
                                    поля, поэтому это заголовок, а не <label for> */}
                                <div className="astra-auth-label">Код из письма</div>
                                <div className="astra-auth-otp">
                                    <OtpInput
                                        value={code}
                                        onChange={(v) => setCode(normalizeOtp(v))}
                                        length={6}
                                        autoFocus
                                        disabled={isVerifying}
                                        name="code"
                                    />
                                </div>
                            </div>

                            {isVerifying && (
                                <p className="astra-auth-status" role="status">
                                    <span className="astra-auth-spin" aria-hidden="true" />
                                    Проверяем код…
                                </p>
                            )}

                            {/* Код улетает на проверку сам, как только набраны 6 цифр —
                                единственное ручное действие здесь и есть повтор отправки */}
                            <span
                                className={`astra-ring astra-auth-cta-ring${stagger ? " astra-auth-rise" : ""}`}
                                style={stagger ? revealDelay(1) : undefined}
                            >
                                <button
                                    type="button"
                                    className="astra-btn astra-auth-cta"
                                    onClick={handleResend}
                                    disabled={resendLeft > 0}
                                >
                                    {resendLeft > 0 ? `Отправить ещё раз (${resendLeft}с)` : "Отправить код ещё раз"}
                                </button>
                            </span>
                        </form>
                    )}
                </div>

                <div className="astra-auth-rule" aria-hidden="true" />

                <p className="astra-auth-foot">
                    Уже есть аккаунт?
                    <br />
                    <Link to="/sign_in" className="astra-auth-link">
                        Войти
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Register;
