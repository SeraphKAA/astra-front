import React, { useId, useState } from "react";
import { EyeIcon, EyeOffIcon } from "../../svgIcons";
import "./passwordFieldAuth.css";

/**
 * Поле пароля с переключателем видимости — для страниц логина и регистрации
 * (совместимо с правилами в login.css / register.css).
 */
export const PasswordFieldAuth = ({
    value,
    onChange,
    disabled = false,
    placeholder = "",
    id: idProp,
    name,
    className = "",
    inputClassName = "",
    autoComplete = "current-password",
    required = false,
}) => {
    const uid = useId();
    const id = idProp || `pwd-auth-${uid}`;
    const [visible, setVisible] = useState(false);

    return (
        <div className={`password-field-auth-wrap ${className}`.trim()}>
            <input
                id={id}
                name={name}
                type={visible ? "text" : "password"}
                className={`password-field-auth-input ${inputClassName}`.trim()}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete={autoComplete}
                required={required}
            />
            {/* Клавиатура должна доставать переключатель: tabIndex={-1} убран,
                фокус виден через :focus-visible (passwordFieldAuth.css) */}
            <button
                type="button"
                className="password-field-auth-toggle"
                onClick={() => setVisible((v) => !v)}
                disabled={disabled}
                aria-pressed={visible}
                aria-controls={id}
                aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
            >
                {visible ? (
                    <EyeOffIcon className="password-field-auth-icon" />
                ) : (
                    <EyeIcon className="password-field-auth-icon" />
                )}
            </button>
        </div>
    );
};
