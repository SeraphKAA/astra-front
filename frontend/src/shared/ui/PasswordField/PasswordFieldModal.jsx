import React, { useId, useState } from "react";
import { EyeIcon, EyeOffIcon } from "../../svgIcons";
import "./passwordFieldModal.css";

/**
 * Поле пароля с переключателем видимости — для модальных окон (профиль и т.д.),
 * где нужна своя вёрстка без зависимости от login.css / register.css.
 */
export const PasswordFieldModal = ({
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
    const id = idProp || `pwd-modal-${uid}`;
    const [visible, setVisible] = useState(false);

    return (
        <div className={`password-field-modal-wrap ${className}`.trim()}>
            <input
                id={id}
                name={name}
                type={visible ? "text" : "password"}
                className={`password-field-modal-input ${inputClassName}`.trim()}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete={autoComplete}
                required={required}
            />
            {/* Клавиатура должна доставать переключатель: tabIndex={-1} убран,
                фокус виден через :focus-visible (passwordFieldModal.css) */}
            <button
                type="button"
                className="password-field-modal-toggle"
                onClick={() => setVisible((v) => !v)}
                disabled={disabled}
                aria-pressed={visible}
                aria-controls={id}
                aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
            >
                {visible ? (
                    <EyeOffIcon className="password-field-modal-icon" />
                ) : (
                    <EyeIcon className="password-field-modal-icon" />
                )}
            </button>
        </div>
    );
};
