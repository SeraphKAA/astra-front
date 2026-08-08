import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../shared/ui/Button/Button";
import { useAuth } from "../../app/auth/AuthContext";
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import { initRobokassaPayment } from "../../entities/order/api/orderApi";
import {
  checkSteamUsername,
  createSteamRefillOrder,
  getSteamRefillRates,
  quoteSteamRefill,
} from "../../entities/steamRefill/api/steamRefillApi";
import {
  SteamCurrencyHelpModal,
  SteamLoginHelpModal,
  SteamRefillImportantInfo,
  useSteamRefillInfoModals,
} from "./SteamRefillInfo";
import "./steam_refill.css";

const REGION_LABELS = {
  RU: "Россия",
  KZ: "Казахстан",
  UA: "Украина",
  US: "США",
  EU: "Еврозона",
};

const CURRENCIES = [
  { code: "RUB", symbol: "₽", label: "Рубли" },
  { code: "USD", symbol: "$", label: "Доллары" },
  { code: "KZT", symbol: "₸", label: "Тенге" },
  { code: "UAH", symbol: "₴", label: "Гривны" },
];

const CURRENCY_SYMBOLS = Object.fromEntries(CURRENCIES.map((c) => [c.code, c.symbol]));

const normalizeMoneyInput = (v) => {
  const s = String(v ?? "");
  const cleaned = s.replace(",", ".").replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;
};

const submitRobokassaForm = (actionUrl) => {
  const formEl = document.createElement("form");
  formEl.method = "POST";
  formEl.action = actionUrl;
  formEl.style.display = "none";
  formEl.target = "_blank";

  document.body.appendChild(formEl);
  formEl.submit();
  window.setTimeout(() => {
    try {
      document.body.removeChild(formEl);
    } catch {
      /* ignore */
    }
  }, 1000);
};

const formatMoney = (n, fractionDigits = 2) => {
  const num = Number(n);
  if (Number.isNaN(num)) return "—";
  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

const convertAmountBetweenCurrencies = (amount, fromCurrency, toCurrency, rates) => {
  const num = Number(amount);
  const fromRate = Number(rates?.[fromCurrency]);
  const toRate = Number(rates?.[toCurrency]);
  if (!num || num <= 0 || !fromRate || !toRate) return "";
  const usd = num / fromRate;
  const converted = usd * toRate;
  return normalizeMoneyInput(String(Math.round(converted * 100) / 100));
};

const SteamRefillPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { pushToast } = useToast();

  const [username, setUsername] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditCurrency, setCreditCurrency] = useState("RUB");
  const [exchangeRates, setExchangeRates] = useState({ RUB: 95, USD: 1, KZT: 450 });
  const [checkState, setCheckState] = useState({ loading: false, result: null, error: "" });
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState("");
  const quoteRequestIdRef = useRef(0);
  const appliedPromoRef = useRef(appliedPromoCode);
  const {
    loginHelpOpen,
    currencyHelpOpen,
    openLoginHelp,
    closeLoginHelp,
    openCurrencyHelp,
    closeCurrencyHelp,
  } = useSteamRefillInfoModals();

  const trimmedLogin = username.trim();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getSteamRefillRates();
        if (!cancelled && data?.rates) {
          setExchangeRates(data.rates);
        }
      } catch {
        /* keep fallback rates */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!trimmedLogin || trimmedLogin.length < 2) {
      setCheckState({ loading: false, result: null, error: "" });
      return undefined;
    }

    let cancelled = false;
    setCheckState((prev) => ({ ...prev, loading: true, error: "" }));

    const timer = window.setTimeout(async () => {
      try {
        const result = await checkSteamUsername(trimmedLogin);
        if (!cancelled) {
          setCheckState({ loading: false, result, error: "" });
        }
      } catch (e) {
        if (!cancelled) {
          setCheckState({
            loading: false,
            result: null,
            error: e?.message || "Не удалось проверить логин",
          });
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmedLogin]);

  const amountNum = useMemo(() => {
    const s = normalizeMoneyInput(creditAmount).trim();
    const n = Number(s);
    return s && !Number.isNaN(n) ? n : null;
  }, [creditAmount]);

  const activeRates = quote?.exchange_rates || exchangeRates;
  const currencySymbol = CURRENCY_SYMBOLS[creditCurrency] || creditCurrency;

  const amountInputWidthCh = useMemo(() => {
    const text = normalizeMoneyInput(creditAmount).trim();
    const placeholder =
      creditCurrency === "KZT" ? "5000" :
      creditCurrency === "UAH" ? "1000" :
      creditCurrency === "USD" ? "10" : "1000";
    return Math.max((text || placeholder).length, 3);
  }, [creditAmount, creditCurrency]);

  const onCurrencyChange = (nextCurrency) => {
    if (nextCurrency === creditCurrency) return;
    setCreditAmount((prev) => {
      const converted = convertAmountBetweenCurrencies(
        normalizeMoneyInput(prev),
        creditCurrency,
        nextCurrency,
        activeRates
      );
      return converted || prev;
    });
    setCreditCurrency(nextCurrency);
    setQuoteError("");
  };

  const loadQuote = useCallback(async () => {
    if (!trimmedLogin || !amountNum || amountNum <= 0) {
      setQuote(null);
      setQuoteError("");
      return;
    }
    if (!checkState.result?.can_refill) {
      setQuote(null);
      return;
    }

    const promoForRequest = appliedPromoCode;
    const requestId = quoteRequestIdRef.current + 1;
    quoteRequestIdRef.current = requestId;

    setQuoteLoading(true);
    setQuoteError("");
    try {
      const data = await quoteSteamRefill({
        username: trimmedLogin,
        credit_amount: String(amountNum),
        credit_currency: creditCurrency,
        region: checkState.result?.region || undefined,
        regional_currency: checkState.result?.regional_currency || undefined,
        ...(promoForRequest ? { promocode: promoForRequest } : {}),
      });
      if (requestId !== quoteRequestIdRef.current) return;
      setQuote(data);
      if (data?.exchange_rates) {
        setExchangeRates(data.exchange_rates);
      }
    } catch (e) {
      if (requestId !== quoteRequestIdRef.current) return;

      const msg = e?.message || "Не удалось рассчитать сумму";
      if (promoForRequest) {
        pushToast({ type: "error", message: msg });
        setAppliedPromoCode("");
        return;
      }

      setQuote(null);
      setQuoteError(msg);
    } finally {
      if (requestId === quoteRequestIdRef.current) {
        setQuoteLoading(false);
      }
    }
  }, [
    trimmedLogin,
    amountNum,
    creditCurrency,
    checkState.result,
    appliedPromoCode,
    pushToast,
  ]);

  useEffect(() => {
    const promoChanged = appliedPromoRef.current !== appliedPromoCode;
    appliedPromoRef.current = appliedPromoCode;
    const delayMs = promoChanged ? 0 : 400;
    const timer = window.setTimeout(loadQuote, delayMs);
    return () => window.clearTimeout(timer);
  }, [loadQuote, appliedPromoCode]);

  const canPay =
    isAuthenticated &&
    checkState.result?.can_refill &&
    quote &&
    amountNum > 0 &&
    !paying &&
    !quoteLoading;

  const regionLabel = useMemo(() => {
    const reg = checkState.result?.region;
    if (!reg) return null;
    return REGION_LABELS[reg] || reg;
  }, [checkState.result?.region]);

  const onApplyPromo = () => {
    const nextCode = promoCode.trim();
    if (!nextCode) {
      pushToast({ type: "error", message: "Введите промокод" });
      return;
    }
    if (!isAuthenticated) {
      pushToast({ type: "error", message: "Войдите в аккаунт, чтобы применить промокод" });
      return;
    }
    setAppliedPromoCode(nextCode);
    setQuoteError("");
  };

  const onClearPromo = () => {
    setPromoCode("");
    setAppliedPromoCode("");
    setQuoteError("");
  };

  const onPay = async () => {
    if (!canPay) return;
    setPaying(true);
    try {
      const order = await createSteamRefillOrder({
        username: trimmedLogin,
        credit_amount: String(amountNum),
        credit_currency: creditCurrency,
        region: checkState.result?.region || undefined,
        regional_currency: checkState.result?.regional_currency || undefined,
        ...(appliedPromoCode ? { promocode: appliedPromoCode } : {}),
      });
      const paymentData = await initRobokassaPayment(order.public_id);
      if (
        paymentData?.payment_method === "POST" &&
        paymentData?.payment_action_url
      ) {
        submitRobokassaForm(paymentData.payment_action_url);
        return;
      }

      pushToast({ type: "success", message: "Заказ оплачен" });
      navigate("/orders");
    } catch (e) {
      pushToast({ type: "error", message: e?.message || "Не удалось оформить заказ" });
    } finally {
      setPaying(false);
    }
  };

  const showWalletEquivalent =
    quote?.regional_amount != null &&
    quote?.regional_currency &&
    quote.regional_currency !== quote.credit_currency;

  return (
    <div className="steam-refill-page">
      <div className="steam-refill-container">
        <header className="steam-refill-hero">
          <h1>Пополнение Steam</h1>
          <p>
            Укажите Steam login и сумму зачисления в рублях, тенге или долларах.
            Курс конвертации актуален на момент расчёта. Комиссия сервиса 5% добавляется к оплате в ₽.
          </p>
        </header>

        <section className="steam-refill-card">
          <div className="steam-refill-field">
            <div className="steam-refill-field-head">
              <label htmlFor="steam-refill-login">Steam login</label>
              <button type="button" className="steam-refill-micro-link" onClick={openLoginHelp}>
                Как узнать?
              </button>
            </div>
            <input
              id="steam-refill-login"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Логин Steam"
              autoComplete="username"
            />
          </div>

          {checkState.loading ? (
            <div className="steam-refill-hint">Проверяем аккаунт…</div>
          ) : null}
          {checkState.error ? (
            <div className="steam-refill-error">{checkState.error}</div>
          ) : null}
          {checkState.result && !checkState.loading ? (
            <div
              className={`steam-refill-check ${checkState.result.can_refill ? "is-ok" : "is-bad"
                }`}
            >
              {checkState.result.can_refill ? (
                <>
                  Аккаунт найден
                  {regionLabel ? (
                    <span className="steam-refill-region">
                      {" "}
                      · регион: {regionLabel}
                      {checkState.result.regional_currency
                        ? ` (${checkState.result.regional_currency})`
                        : ""}
                    </span>
                  ) : null}
                </>
              ) : (
                checkState.result.message || "Пополнение недоступно"
              )}
            </div>
          ) : null}

          <div className="steam-refill-amount-panel">
            <div className="steam-refill-amount-panel-head">
              <span className="steam-refill-amount-panel-label">Сумма</span>
              <div className="steam-refill-currency-switch" role="group" aria-label="Валюта суммы">
                {CURRENCIES.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    className={`steam-refill-currency-switch-btn ${creditCurrency === item.code ? "is-active" : ""
                      }`}
                    onClick={() => onCurrencyChange(item.code)}
                    aria-pressed={creditCurrency === item.code}
                    title={item.label}
                  >
                    {item.symbol}
                  </button>
                ))}
              </div>
            </div>
            <label htmlFor="steam-refill-amount" className="steam-refill-amount-panel-value">
              <input
                id="steam-refill-amount"
                className="steam-refill-amount-panel-input"
                type="text"
                inputMode="decimal"
                value={creditAmount}
                onChange={(e) => setCreditAmount(normalizeMoneyInput(e.target.value))}
                placeholder={creditCurrency === "KZT" ? "5000" : creditCurrency === "USD" ? "10" : "1000"}
                aria-label={`Сумма пополнения в ${currencySymbol}`}
                style={{ width: `${amountInputWidthCh}ch` }}
              />
              <span className="steam-refill-amount-panel-currency" aria-hidden="true">
                {currencySymbol}
              </span>
            </label>
            <div className="steam-refill-amount-panel-foot">
              <span className="steam-refill-amount-panel-hint">
                Зачисление на кошелёк Steam в {CURRENCIES.find((c) => c.code === creditCurrency)?.label?.toLowerCase()}
              </span>
              <button type="button" className="steam-refill-micro-link" onClick={openCurrencyHelp}>
                О валюте
              </button>
            </div>
          </div>

          {quoteError ? <div className="steam-refill-error">{quoteError}</div> : null}

          {isAuthenticated ? (
            <div className="steam-refill-promo">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Промокод"
              />
              <button type="button" onClick={onApplyPromo} disabled={quoteLoading}>
                Применить
              </button>
            </div>
          ) : null}
          {appliedPromoCode && quote?.promocode ? (
            <div className="steam-refill-promo-applied">
              Промокод <b>{quote.promocode}</b>
              {quote.promocode_discount_percent
                ? ` (−${quote.promocode_discount_percent}%)`
                : ""}
              {" · "}
              <button type="button" className="steam-refill-link" onClick={onClearPromo}>
                убрать
              </button>
            </div>
          ) : null}

          {quoteLoading ? <div className="steam-refill-hint">Считаем…</div> : null}

          {quote && !quoteLoading ? (
            <div className="steam-refill-breakdown">
              <div className="steam-refill-breakdown-row">
                <span>Зачисление на Steam</span>
                <strong>
                  {/* !!! quote.credit_amount || quote.net_rub */}
                  {formatMoney(quote.net_rub, quote.credit_currency === "USD" ? 2 : 2)}{" "}
                  {CURRENCY_SYMBOLS[quote.credit_currency] || quote.credit_currency}
                </strong>
              </div>
              <div className="steam-refill-breakdown-row">
                <span>Комиссия ({quote.commission_percent}%)</span>
                <strong>{formatMoney(quote.commission_rub)} ₽</strong>
              </div>
              {Number(quote.discount_rub) > 0 ? (
                <div className="steam-refill-breakdown-row steam-refill-discount">
                  <span>
                    Скидка по промокоду
                    {quote.promocode_discount_percent
                      ? ` (${quote.promocode_discount_percent}%)`
                      : ""}
                  </span>
                  <strong>−{formatMoney(quote.discount_rub)} ₽</strong>
                </div>
              ) : null}
              {showWalletEquivalent ? (
                <div className="steam-refill-breakdown-row steam-refill-regional">
                  <span>≈ в валюте кошелька</span>
                  <strong>
                    {formatMoney(quote.regional_amount)}{" "}
                    {CURRENCY_SYMBOLS[quote.regional_currency] || quote.regional_currency}
                  </strong>
                </div>
              ) : null}
              <div className="steam-refill-breakdown-total">
                <span>Итого к оплате</span>
                <strong>{formatMoney(quote.total_rub)} ₽</strong>
              </div>
            </div>
          ) : null}

          {!isAuthenticated ? (
            <p className="steam-refill-auth-hint">
              Для оплаты{" "}
              <button type="button" className="steam-refill-link" onClick={() => navigate("/sign_in")}>
                войдите в аккаунт
              </button>
            </p>
          ) : null}

          <Button type="button" onClick={onPay} disabled={!canPay}>
            {paying ? "Переход к оплате…" : "Оплатить"}
          </Button>
        </section>

        <SteamRefillImportantInfo />
      </div>

      <SteamLoginHelpModal isOpen={loginHelpOpen} onClose={closeLoginHelp} />
      <SteamCurrencyHelpModal isOpen={currencyHelpOpen} onClose={closeCurrencyHelp} />
    </div>
  );
};

export default SteamRefillPage;
