import React from "react";
import styles from "./Spinner.module.css";

export const Spinner = ({ size = 40, color = "#FF0198", label, className = "" }) => {
  const style = {
    width: size,
    height: size,
    borderWidth: Math.max(2, Math.round(size / 12)),
  };

  return (
    <div className={`${styles.wrapper} ${className}`}>
      <div className={styles.spinner} style={style} aria-label={label || "Загрузка"} />
      {label ? <p className={styles.label}>{label}</p> : null}
    </div>
  );
};

