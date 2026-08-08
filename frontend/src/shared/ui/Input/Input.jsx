import React from 'react';
import styles from './input.module.css';

export const Input = ({ 
  label, 
  error, 
  className = '', 
  ...props 
}) => {
  const inputClass = `${styles.input} ${error ? styles.error : ''} ${className}`;
  const groupClass = `${styles.inputGroup}`;
  
  return (
    <div className={groupClass}>
      {label && <label className={styles.label}>{label}</label>}
      <input className={inputClass} {...props} />
      {error && <span className={styles.errorMessage}>{error}</span>}
    </div>
  );
};