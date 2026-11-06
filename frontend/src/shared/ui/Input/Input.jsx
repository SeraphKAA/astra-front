import React, { useId } from 'react';
import styles from './input.module.css';

export const Input = ({
  label,
  error,
  className = '',
  id: idProp,
  ...props
}) => {
  const uid = useId();
  const id = idProp || `astra-input-${uid}`;
  const errorId = `${id}-error`;
  const inputClass = `${styles.input} ${error ? styles.error : ''} ${className}`.trim();

  return (
    <div className={styles.inputGroup}>
      {label && (
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      )}
      <input
        id={id}
        className={inputClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && (
        <span className={styles.errorMessage} id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
