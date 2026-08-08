import React, { useState } from "react";
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