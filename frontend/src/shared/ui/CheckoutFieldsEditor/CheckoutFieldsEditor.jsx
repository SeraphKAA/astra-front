import React from "react";
import { Button } from "../Button/Button";
import { Input } from "../Input/Input";
import styles from "./checkoutFieldsEditor.module.css";

const emptyField = () => ({
  key: "",
  label: "",
  type: "text",
  required: true,
  placeholder: "",
  help_text: "",
});

export const CheckoutFieldsEditor = ({ fields, onChange }) => {
  const list = Array.isArray(fields) && fields.length > 0 ? fields : [emptyField()];

  const updateAt = (idx, patch) => {
    onChange(list.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeAt = (idx) => {
    const next = list.filter((_, i) => i !== idx);
    onChange(next.length ? next : [emptyField()]);
  };

  return (
    <div className={styles.editor}>
      {list.map((f, idx) => (
        <div key={idx} className={styles.fieldCard}>
          <Input
            label={`Ключ поля #${idx + 1}`}
            value={f.key || ""}
            onChange={(e) => updateAt(idx, { key: e.target.value })}
            placeholder="uid"
          />
          <Input
            label="Подпись"
            value={f.label || ""}
            onChange={(e) => updateAt(idx, { label: e.target.value })}
            placeholder="UID в игре"
          />
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor={`checkout-field-type-${idx}`}>
              Тип
            </label>
            <select
              id={`checkout-field-type-${idx}`}
              className={styles.select}
              value={f.type || "text"}
              onChange={(e) => updateAt(idx, { type: e.target.value })}
            >
              <option value="text">Текст</option>
              <option value="number">Число</option>
              <option value="email">Email</option>
              <option value="game_id_or_email">ID или email</option>
              <option value="select">Выбор</option>
            </select>
          </div>
          <Input
            label="Placeholder"
            value={f.placeholder || ""}
            onChange={(e) => updateAt(idx, { placeholder: e.target.value })}
          />
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={Boolean(f.required)}
              onChange={(e) => updateAt(idx, { required: e.target.checked })}
            />
            Обязательное поле
          </label>
          <Button type="button" variant="secondary" onClick={() => removeAt(idx)}>
            Удалить поле
          </Button>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={() => onChange([...list, emptyField()])}>
        + Поле
      </Button>
    </div>
  );
};

export const sanitizeCheckoutFields = (fields) => {
  if (!Array.isArray(fields)) return [];
  return fields
    .map((f) => ({
      key: String(f?.key || "").trim(),
      label: String(f?.label || f?.key || "").trim(),
      type: String(f?.type || "text"),
      required: f?.required !== false,
      placeholder: String(f?.placeholder || ""),
      help_text: String(f?.help_text || ""),
      options: Array.isArray(f?.options) ? f.options : [],
    }))
    .filter((f) => f.key);
};
