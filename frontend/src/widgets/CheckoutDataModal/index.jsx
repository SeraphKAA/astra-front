import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "../../shared/ui/Modal/Modal";
import { normalizeMediaUrl } from "../../shared/commonApi";
import { listMyUserProfiles } from "../../entities/userProfile/api/userProfileApi";
import {
  canSubmitCheckoutGroups,
  collectCheckoutGroupErrors,
  collectCheckoutFieldErrors,
  isCheckoutFieldRequired,
} from "../../shared/validation/checkoutField";
import "./checkoutDataModal.css";

const FieldInput = ({ field, value, onChange, showErrors }) => {
  const key = field.key;
  const label = field.label || key;
  const required = isCheckoutFieldRequired(field);
  const type = field.type || "text";
  const inputType =
    type === "number" ? "number" : type === "email" ? "email" : "text";

  const fieldErrors = useMemo(
    () => collectCheckoutFieldErrors([field], { [key]: value }),
    [field, key, value]
  );
  const hasError =
    showErrors && (fieldErrors.missing.length > 0 || fieldErrors.invalid.length > 0);
  const errorMessage = fieldErrors.invalid[0] || (fieldErrors.missing[0] ? "Заполните поле" : "");

  const inputClassName = hasError
    ? "checkout-data-input checkout-data-input-error"
    : "checkout-data-input";

  if (type === "select" && Array.isArray(field.options) && field.options.length > 0) {
    return (
      <label className="checkout-data-field">
        <span className="checkout-data-field-label">
          {label}
          {required ? <span className="checkout-data-req" aria-hidden="true"> *</span> : ""}
        </span>
        <select
          value={value || ""}
          onChange={(e) => onChange(key, e.target.value)}
          className={inputClassName}
          aria-invalid={hasError}
          required={required || undefined}
        >
          <option value="">—</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {hasError ? (
          <span className="checkout-data-field-error" role="alert">
            {errorMessage}
          </span>
        ) : null}
      </label>
    );
  }

  return (
    <label className="checkout-data-field">
      <span className="checkout-data-field-label">
        {label}
        {required ? <span className="checkout-data-req" aria-hidden="true"> *</span> : ""}
      </span>
      <input
        type={inputType}
        className={inputClassName}
        value={value || ""}
        placeholder={field.placeholder || ""}
        onChange={(e) => onChange(key, e.target.value)}
        aria-invalid={hasError}
        required={required || undefined}
      />
      {field.help_text ? (
        <span className="checkout-data-field-hint">{field.help_text}</span>
      ) : null}
      {hasError ? (
        <span className="checkout-data-field-error" role="alert">
          {errorMessage}
        </span>
      ) : null}
    </label>
  );
};

export const CheckoutDataModal = ({
  isOpen,
  onClose,
  groups,
  onConfirm,
  isLoading,
}) => {
  const [forms, setForms] = useState({});
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [error, setError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setShowErrors(false);
    setTouched(false);
    const load = async () => {
      setPrefillLoading(true);
      try {
        const profiles = await listMyUserProfiles();
        const next = {};
        for (const g of groups || []) {
          const pt = g.profile_type;
          const match =
            (profiles || []).find(
              (p) =>
                String(p.profile_type).toLowerCase() === String(pt).toLowerCase() &&
                (p.provider === g.provider ||
                  p.provider === "shop" ||
                  p.provider === "desslyhub")
            ) || null;
          next[pt] = { ...(match?.data || {}) };
        }
        setForms(next);
      } catch {
        const empty = {};
        for (const g of groups || []) {
          empty[g.profile_type] = {};
        }
        setForms(empty);
      } finally {
        setPrefillLoading(false);
      }
    };
    load();
  }, [isOpen, groups]);

  const canSubmit = useMemo(
    () => !prefillLoading && !isLoading && canSubmitCheckoutGroups(groups, forms),
    [groups, forms, prefillLoading, isLoading]
  );

  const onFieldChange = (profileType, key, value) => {
    setTouched(true);
    setForms((prev) => ({
      ...prev,
      [profileType]: { ...(prev[profileType] || {}), [key]: value },
    }));
  };

  const buildCheckoutProfiles = () =>
    (groups || []).map((g) => {
      const raw = forms[g.profile_type] || {};
      const data = {};
      for (const f of g.fields || []) {
        const v = raw[f.key];
        if (typeof v === "string") {
          const t = v.trim();
          if (t !== "") data[f.key] = t;
        } else if (v !== undefined && v !== null && v !== "") {
          data[f.key] = v;
        }
      }
      return {
        profile_type: g.profile_type,
        provider: g.provider || "shop",
        data,
      };
    });

  const handleConfirm = async () => {
    setError("");
    setShowErrors(true);

    const validationErrors = collectCheckoutGroupErrors(groups, forms);
    if (validationErrors.length > 0) {
      const parts = [];
      for (const item of validationErrors) {
        if (item.missing.length) {
          parts.push(`${item.profileType}: ${item.missing.join(", ")}`);
        }
        if (item.invalid.length) {
          parts.push(item.invalid.join(" • "));
        }
      }
      setError(`Заполните обязательные поля (${parts.join(" • ")})`);
      return;
    }

    try {
      await onConfirm(buildCheckoutProfiles());
    } catch (e) {
      setError(e?.message || "Не удалось продолжить оплату");
    }
  };

  if (!groups || groups.length === 0) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Проверьте данные для заказа"
      closeDisabled={isLoading}
      closeDisabledLabel="Идёт оплата — подождите"
    >
      <p className="checkout-data-intro">
        Убедитесь, что данные верны — они будут использованы для выдачи товара.
        Поля со звёздочкой обязательны.
      </p>
      {prefillLoading ? (
        <div className="checkout-data-loading" role="status" aria-live="polite" aria-busy="true">
          <span className="astra-skeleton checkout-data-skel checkout-data-skel--wide" aria-hidden="true" />
          <span className="astra-skeleton checkout-data-skel" aria-hidden="true" />
          <span className="astra-skeleton checkout-data-skel checkout-data-skel--short" aria-hidden="true" />
          <span className="checkout-data-loading-text">Загружаем сохранённые данные…</span>
        </div>
      ) : (
        <div className="checkout-data-groups">
          {(groups || []).map((g) => (
            <section className="checkout-data-group" key={g.profile_type}>
              <div className="checkout-data-group-head">
                {g.icon_url ? (
                  <img
                    src={normalizeMediaUrl(g.icon_url)}
                    alt=""
                    className="checkout-data-icon"
                  />
                ) : null}
                <div className="checkout-data-group-meta">
                  <div className="checkout-data-group-title">{g.title || g.profile_type}</div>
                  {g.product_names?.length > 0 ? (
                    <div className="checkout-data-products">
                      Товары: {g.product_names.join(", ")}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="checkout-data-fields">
                {(g.fields || []).map((f) => (
                  <FieldInput
                    key={f.key}
                    field={f}
                    value={(forms[g.profile_type] || {})[f.key] || ""}
                    onChange={(key, val) => onFieldChange(g.profile_type, key, val)}
                    showErrors={showErrors || touched}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {error ? (
        <div className="checkout-data-error" role="alert">
          {error}
        </div>
      ) : null}
      {!canSubmit && !prefillLoading && !error ? (
        <div className="checkout-data-hint">Заполните все обязательные поля, чтобы продолжить</div>
      ) : null}
      <div className="checkout-data-actions">
        <button
          type="button"
          className="astra-btn-ghost astra-press checkout-data-cancel"
          onClick={onClose}
          disabled={isLoading}
        >
          Отмена
        </button>
        {/* .astra-ring: clip-path кнопки съедает outline — кольцо на обёртке */}
        <span className="astra-ring checkout-data-submit-ring">
          <button
            type="button"
            className="astra-btn astra-press checkout-data-submit"
            onClick={handleConfirm}
            disabled={!canSubmit}
            aria-busy={isLoading || undefined}
          >
            {isLoading ? "Оплачиваем…" : "Подтвердить и оплатить"}
          </button>
        </span>
      </div>
    </Modal>
  );
};
