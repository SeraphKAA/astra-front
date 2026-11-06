import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
// import { User } from "../../features/auth/user";
import { Label, Input, AuthAlert } from "../../shared/FieldAuthReg/textfield";
import { AuthTabs } from "../../shared/FieldAuthReg/AuthTabs";
import { PasswordFieldAuth } from "../../shared/ui/PasswordField";
import AstraMark from "../../shared/brand/AstraMark";
import AstraWordmark from "../../shared/brand/AstraWordmark";
import { useRevealOnce, revealDelay } from "../../shared/fx/motionUtils";
import { useAuth } from "../../app/auth/AuthContext";
import { resendEmailCode } from "../../entities/auth/model/authFlows";
import { isEmailLike, trimAndLimit } from "../../shared/validation";
import { getApiErrorMessage } from "../../shared/commonApi";
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import { Modal } from "../../shared/ui/Modal/Modal";
import "./login.css";


/* Порядок вкладок задаёт направление проезда панели: вправо или влево */
const METHODS = ["password", "code", "telegram"];

const METHOD_TABS = [
  { value: "password", label: "Почта / Пароль" },
  { value: "code", label: "Почта / Код" },
  { value: "telegram", label: "Telegram" },
];

const Login = ({ setIsLogged }) => {
  const { loginWithEmail, startTelegramBotLogin, pollTelegramBotLogin, loadUserProfile } = useAuth();
  const { pushToast } = useToast();
  const [email, setLogin] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState("password"); // password | code | telegram
  /* 0 — вкладку ещё не переключали: играет стаггер строк, а не проезд */
  const [dir, setDir] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  /* Появление один раз: карточка поднимается, строки входят стаггером */
  const cardRef = useRevealOnce();
  const stagger = dir === 0;
  const [tgLogin, setTgLogin] = useState(null);   // { code, bot_url }
  const [tgStatus, setTgStatus] = useState("idle"); // idle | waiting | confirmed | error

  const handleTelegramStart = async () => {
    setError("");
    setTgStatus("waiting");
    try {
      const res = await startTelegramBotLogin();
      if (!res?.bot_url) throw new Error("REACT_APP_TG_BOT_USERNAME  не задан");
      setTgLogin(res);
      window.open(res.bot_url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setTgStatus("error");
      setError(getApiErrorMessage(e, "Не удалось начать вход через Telegram"));
    }
  };

  useEffect(() => {
    if (tgStatus !== "waiting" || !tgLogin?.code) return;

    let cancelled = false;
    let timer = null;
    let confirmed = false;

    const tick = async () => {
      let res;
      try {
        res = await pollTelegramBotLogin(tgLogin.code);
      } catch {
        if (!cancelled) timer = window.setTimeout(tick, 3000);
        return;
      }
      if (cancelled) return;

      if (res?.status === "confirmed") {
        confirmed = true;
        setTgStatus("confirmed");
        try {
          await loadUserProfile();
        } catch {
          // cookies могли не прижиться — повторим один раз позже
        }
        navigate("/main", { replace: true });
        return;
      }

      // жёсткий барьер: после confirmed никакой expired/error не важен
      if (confirmed) return;

      if (res?.status === "expired" || res?.status === "error") {
        setTgStatus("error");
        setError("Ссылка истекла. Попробуйте ещё раз.");
        return;
      }

      timer = window.setTimeout(tick, 2000);
    };

    // ⬇ первый запрос уходит не синхронно, а на следующем тике —
    //    в StrictMode первый прогон эффекта успеет отмениться
    timer = window.setTimeout(tick, 0);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [tgLogin, tgStatus, pollTelegramBotLogin, loadUserProfile, navigate]);

  const switchMethod = (next) => {
    if (next === method) return;
    setError("");
    setDir(METHODS.indexOf(next) > METHODS.indexOf(method) ? 1 : -1);
    setMethod(next);
  };

  /* Класс строки формы: стаггер вешаем только на первой отрисовке,
     чтобы переключение вкладок его не переигрывало */
  const rowProps = (index) =>
    stagger
      ? { className: "astra-auth-field astra-auth-rise", style: revealDelay(index) }
      : { className: "astra-auth-field" };

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
        navigate("/main", { replace: true });
      } else if (method === "code") {
        const emailClean = trimAndLimit(email, 255);
        if (!isEmailLike(emailClean)) {
          setError("Введите корректный email");
          return;
        }
        if (email === "") {
          setError("Введите email");
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


  const methodHint =
    method === "password"
      ? "Введите почту и пароль от аккаунта ASTRA."
      : method === "code"
        ? "Пришлём разовый код на почту — пароль не понадобится."
        : "Подтвердите вход в Telegram.";

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

        <h1 className="astra-auth-title">Вход в аккаунт</h1>
        <p className="astra-auth-sub">{methodHint}</p>

        <AuthTabs
          label="Способ входа"
          value={method}
          onChange={switchMethod}
          items={METHOD_TABS}
        />

        {/* key по тексту: новое сообщение — новый узел, значит вход
            (fade + 2px) играет и при смене ошибки, а не только при
            её появлении */}
        {error && (
          <AuthAlert key={error} tone="error" fix="Проверьте введённые данные и попробуйте снова.">
            {error}
          </AuthAlert>
        )}

        {/* Панель под вкладками: вход направленный (--auth-dir),
            при первой отрисовке — без проезда, работает стаггер строк */}
        <div
          key={method}
          className={`astra-auth-panel${dir ? " is-switching" : ""}`}
          style={dir ? { "--auth-dir": dir } : undefined}
        >
          <form className="astra-auth-form" onSubmit={handleSubmit}>
            {method !== "telegram" && (
              <div {...rowProps(0)}>
                <Label htmlFor="email" className="astra-auth-label">
                  Логин
                </Label>
                <Input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setLogin(trimAndLimit(e.target.value, 255))}
                  placeholder="Введите email"
                  className="astra-auth-input"
                  autoComplete="email"
                  inputMode="email"
                  required
                />
              </div>
            )}

            {method === "password" && (
              <div {...rowProps(1)}>
                <Label htmlFor="password" className="astra-auth-label">
                  Пароль
                </Label>
                <PasswordFieldAuth
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите пароль"
                  autoComplete="current-password"
                  required
                />
              </div>
            )}

            {/* ввод кода вынесен на отдельную страницу /sign_in/code */}

            {method === "telegram" && (
              <div {...rowProps(0)}>
                <div className="astra-auth-tg">
                  <button
                    type="button"
                    className="astra-btn astra-auth-cta"
                    onClick={handleTelegramStart}
                    disabled={tgStatus === "waiting" || tgStatus === "confirmed"}
                  >
                    {tgStatus === "waiting" ? "Ожидаем подтверждения…" : "Открыть Telegram"}
                  </button>
                </div>
              </div>
            )}

            {method !== "telegram" && (
              /* .astra-ring: clip-path кнопки съедает outline — кольцо на обёртке */
              <span
                className={`astra-ring astra-auth-cta-ring${stagger ? " astra-auth-rise" : ""}`}
                style={stagger ? revealDelay(2) : undefined}
              >
                <button type="submit" className="astra-btn astra-auth-cta" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <span className="astra-auth-spin" aria-hidden="true" />
                      Вход…
                    </>
                  ) : (
                    "Войти"
                  )}
                </button>
              </span>
            )}

            {method === "code" && (
              <button
                type="button"
                className="astra-btn-ghost astra-auth-ghost"
                onClick={async () => {
                  try {
                    setError("");
                    if (email === "") {
                      setError("Введите email");
                      return;
                    }
                    await resendEmailCode({ email });
                    navigate("/sign_in/code", { state: { email } });
                  } catch (e) {
                    setError(e?.message || "Не удалось отправить код");
                  }
                }}
              >
                Отправить код на почту
              </button>
            )}
          </form>
        </div>

        <div className="astra-auth-rule" aria-hidden="true" />

        <p className="astra-auth-foot">
          <Link to="/reset-password" className="astra-auth-link">
            Забыли пароль?
          </Link>
        </p>
        <p className="astra-auth-foot">
          <Link to="/sign_up" className="astra-auth-link">
            Зарегистрироваться
          </Link>
        </p>

      </div>
    </div>
  );
};

export default Login;
