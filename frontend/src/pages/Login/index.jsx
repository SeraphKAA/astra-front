import { React, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
// import { User } from "../../features/auth/user";
import { SignInSvg } from "../../shared/svgIcons";
import { Label, Input } from "../../shared/FieldAuthReg/textfield";
import { PasswordFieldAuth } from "../../shared/ui/PasswordField";
import logo from "../../shared/ASTRA Shop.png";
import { useAuth } from "../../app/auth/AuthContext";
import { resendEmailCode } from "../../entities/auth/model/authFlows";
import { isEmailLike, trimAndLimit } from "../../shared/validation";
import { getApiErrorMessage } from "../../shared/commonApi";
import { useToast } from "../../shared/ui/Toast/ToastProvider";

import "./login.css";


const Login = ({ setIsLogged }) => {
  const { loginWithEmail, loginWithTelegramWebApp, loginWithTelegramWidget, user, loadUserProfile } = useAuth();
  const { pushToast } = useToast();
  const [email, setLogin] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState("password"); // password | code | telegram_widget
  const [isSubmitting, setIsSubmitting] = useState(false);
  const widgetContainerRef = useRef(null);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setError("");
      if (method === "password") {
        const emailClean = trimAndLimit(email, 255);
        if (!isEmailLike(emailClean)) {
          setError("Введите корректный email");
          return;
        }
        if ((password || "").length < 8) {
          setError("Пароль должен быть не короче 8 символов");
          return;
        }
        setIsSubmitting(true);
        await loginWithEmail({ email, password });
        await loadUserProfile();
        navigate("/menu", { replace: true });
      } else if (method === "code") {
        const emailClean = trimAndLimit(email, 255);
        if (!isEmailLike(emailClean)) {
          setError("Введите корректный email");
          return;
        }
        await resendEmailCode({ email });
        navigate("/sign_in/code", { state: { email } });
      }
    } catch (error) {
      const msg = getApiErrorMessage(error, "Ошибка входа");
      setError(msg);
      try {
        pushToast({ type: "error", message: msg });
      } catch (toastErr) {
        console.warn("pushToast failed", toastErr);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const canUseTelegram = useMemo(() => {
    return Boolean(window?.Telegram?.WebApp?.initData);
  }, []);

  const tgBotUsername = import.meta.env.VITE_TG_BOT_USERNAME || "";

  useEffect(() => {
    // Telegram Login Widget calls global function specified in data-onauth
    window.onTelegramAuth = async (tgUser) => {
      try {
        setError("");
        await loginWithTelegramWidget(tgUser);
        await loadUserProfile();
        navigate("/menu", { replace: true });
      } catch (e) {
        const msg = getApiErrorMessage(e, "Ошибка входа через Telegram");
        setError(msg);
        try {
          pushToast({ type: "error", message: msg });
        } catch (toastErr) {
          console.warn("pushToast failed", toastErr);
        }
      }
    };

    return () => {
      try {
        delete window.onTelegramAuth;
      } catch (e) {
        // ignore
      }
    };
  }, [loadUserProfile, loginWithTelegramWidget, navigate, pushToast]);

  useEffect(() => {
    if (method !== "telegram_widget") return;
    if (!tgBotUsername) return;
    if (!widgetContainerRef.current) return;

    // Recreate widget script each time we enter the tab to ensure it renders.
    widgetContainerRef.current.innerHTML = "";

    const s = document.createElement("script");
    s.async = true;
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.setAttribute("data-telegram-login", tgBotUsername);
    s.setAttribute("data-size", "large");
    s.setAttribute("data-onauth", "onTelegramAuth(user)");
    s.setAttribute("data-request-access", "write");
    s.setAttribute("data-userpic", "false");
    s.onerror = () => setError("Не удалось загрузить Telegram Login Widget");

    widgetContainerRef.current.appendChild(s);
  }, [method, tgBotUsername]);

  const handleTelegram = async () => {
    try {
      setError("");
      await loginWithTelegramWebApp();
      await loadUserProfile();
      navigate("/menu", { replace: true });
    } catch (e) {
      const msg = getApiErrorMessage(e, "Ошибка входа через Telegram");
      setError(msg);
      try {
        pushToast({ type: "error", message: msg });
      } catch (toastErr) {
        console.warn("pushToast failed", toastErr);
      }
    }
  };


  return (
    <>
      <div className="body-wrapper-log">
        <div className="div_for_login_">

          <img src={logo} alt="ASTRA SHOP" className="logo" />
          <h1 className="auth-page-title">Вход в аккаунт</h1>
          <div className="auth-subtitle-divider" aria-hidden />

          {error && <div className="auth-alert auth-alert--error">{error}</div>}

          <div className="login-methods">
            <button
              type="button"
              className={`method-btn ${method === "password" ? "is-active" : ""}`}
              onClick={() => setMethod("password")}
            >
              Почта+пароль
            </button>
            <button
              type="button"
              className={`method-btn ${method === "code" ? "is-active" : ""}`}
              onClick={() => setMethod("code")}
            >
              Почта+код
            </button>
            <button
              type="button"
              className={`method-btn ${method === "telegram_widget" ? "is-active" : ""}`}
              onClick={() => setMethod("telegram_widget")}
            >
              Telegram
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {method === "code" && (
              <div className="wrap" style={{ marginBottom: 10 }}>
                <button
                  type="button"
                  className="login-button"
                  onClick={async () => {
                    try {
                      setError("");
                      await resendEmailCode({ email });
                      navigate("/sign_in/code", { state: { email } });
                    } catch (e) {
                      setError(e?.message || "Не удалось отправить код");
                    }
                  }}
                >
                  Отправить код на почту
                </button>
              </div>
            )}
            {method !== "telegram_widget" &&
              <div className="form-group">
                <Label htmlFor="email" required>
                  Логин:
                </Label>
                <Input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setLogin(trimAndLimit(e.target.value, 255))}
                  placeholder="Введите email"
                  className="login-input"
                  required
                />
              </div>}

            {method === "password" && (
              <div className="form-group">
                <Label htmlFor="password" required>
                  Пароль:
                </Label>
                <PasswordFieldAuth
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите пароль"
                  inputClassName="login-input"
                  autoComplete="current-password"
                  required
                />
              </div>
            )}

            {/* ввод кода вынесен на отдельную страницу /sign_in/code */}

            {method === "telegram_widget" && (
              <div className="form-group">
                {!tgBotUsername ? (
                  <div className="auth-alert">
                    VITE_TG_BOT_USERNAME не задан. Невозможно показать Telegram Login Widget.
                  </div>
                ) : (
                  <div className="auth-telegram-wrap">
                    <div ref={widgetContainerRef} />
                  </div>
                )}
              </div>
            )}

            {method !== "telegram_widget" && (
              <div className="wrap">
                <button type="submit" className="login-button" disabled={isSubmitting}>
                  {isSubmitting ? "Вход…" : "Войти"}
                  <SignInSvg />
                </button>
              </div>
            )}
          </form>

          {canUseTelegram && (
            <div className="wrap" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="login-button"
                onClick={handleTelegram}
              >
                Войти через Telegram
              </button>
            </div>
          )}

          <p className="text-login">
            Ещё нет аккаунта?<br />
            <Link to="/sign_up" className="login-href"> Зарегистрироваться</Link>
          </p>
        </div>
      </div>
    </>
  );
};

export default Login;