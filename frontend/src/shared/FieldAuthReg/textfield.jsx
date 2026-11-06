import React from "react";
import "./textfield.css";


export const Label = ({
    htmlFor,
    children,
    className = 'login-label'
}) => {
    return (
        <label
            htmlFor={htmlFor}
            className={className}
        >
            {children}
        </label>
    );
};

export const Input = ({
    id,
    type = 'text',
    placeholder = '',
    value,
    onChange,
    className = 'login-input',
    ...props
}) => {
    return (
        <input
            id={id}
            type={type}
            className={className}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            {...props}
        />
    );
};

/* Авторские глифы (stroke 2, круглые концы) — не эмодзи */
const ProblemGlyph = () => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" width="100%" height="100%">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 16.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const NoticeGlyph = () => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" width="100%" height="100%">
        <path
            d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
        />
        <path d="m5 8 7 5 7-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/**
 * Сообщение экрана авторизации: называет проблему И способ её починить.
 * tone: "error" (красный статус) | "info" (фиолетовая информация).
 * Стили — .astra-auth-alert* в shared/styles/authPages.css.
 */
export const AuthAlert = ({ tone = "error", fix, children }) => {
    const isError = tone === "error";
    return (
        <div
            className={`astra-auth-alert astra-auth-alert--${isError ? "error" : "info"}`}
            role={isError ? "alert" : "status"}
        >
            <span className="astra-auth-alert-icon" aria-hidden="true">
                {isError ? <ProblemGlyph /> : <NoticeGlyph />}
            </span>
            <span className="astra-auth-alert-body">
                <span className="astra-auth-alert-text">{children}</span>
                {fix ? <span className="astra-auth-alert-fix">{fix}</span> : null}
            </span>
        </div>
    );
};
