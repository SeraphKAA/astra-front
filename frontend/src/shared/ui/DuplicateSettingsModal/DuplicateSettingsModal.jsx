import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "../Modal/Modal";
import { Button } from "../Button/Button";
import styles from "./DuplicateSettingsModal.module.css";

export const DuplicateSettingsModal = ({
  isOpen,
  onClose,
  title,
  sourceLabel,
  fieldOptions,
  targets,
  onSubmit,
  busy = false,
}) => {
  const [selectedFields, setSelectedFields] = useState(() => new Set());
  const [selectedTargets, setSelectedTargets] = useState(() => new Set());
  const [targetSearch, setTargetSearch] = useState("");
  const [resultSummary, setResultSummary] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedFields(new Set());
    setSelectedTargets(new Set());
    setTargetSearch("");
    setResultSummary(null);
  }, [isOpen, sourceLabel]);

  const filteredTargets = useMemo(() => {
    const q = targetSearch.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter(
      (t) =>
        String(t.id).includes(q) ||
        String(t.label || "")
          .toLowerCase()
          .includes(q)
    );
  }, [targets, targetSearch]);

  const toggleField = (key) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleTarget = (id) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllTargets = () => {
    setSelectedTargets(new Set(filteredTargets.map((t) => t.id)));
  };

  const clearTargets = () => setSelectedTargets(new Set());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedFields.size === 0 || selectedTargets.size === 0) return;
    setResultSummary(null);
    const options = fieldOptions.reduce((acc, field) => {
      acc[field.key] = selectedFields.has(field.key);
      return acc;
    }, {});
    const result = await onSubmit({
      targetIds: Array.from(selectedTargets),
      options,
    });
    if (result?.results) {
      const ok = result.results.filter((r) => r.ok).length;
      const failed = result.results.length - ok;
      const warnings = result.warnings || [];
      setResultSummary({ ok, failed, results: result.results, warnings });
      if (failed === 0 && warnings.length === 0) {
        setTimeout(() => onClose?.(), 800);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !busy && onClose?.()} title={title}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <p className={styles.source}>
          Источник: <strong>{sourceLabel}</strong>
        </p>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Что копировать</div>
          <div className={styles.checkboxGrid}>
            {fieldOptions.map((field) => (
              <label key={field.key} className={styles.checkboxItem}>
                <input
                  type="checkbox"
                  checked={selectedFields.has(field.key)}
                  onChange={() => toggleField(field.key)}
                />
                <span>{field.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionTitle}>Куда копировать</div>
            <div className={styles.sectionActions}>
              <button type="button" className={styles.linkBtn} onClick={selectAllTargets}>
                Выбрать все
              </button>
              <button type="button" className={styles.linkBtn} onClick={clearTargets}>
                Сбросить
              </button>
            </div>
          </div>
          <input
            className={styles.search}
            value={targetSearch}
            onChange={(e) => setTargetSearch(e.target.value)}
            placeholder="Поиск по id или названию"
          />
          <div className={styles.targetList}>
            {filteredTargets.length === 0 ? (
              <div className={styles.emptyTargets}>Ничего не найдено</div>
            ) : (
              filteredTargets.map((target) => (
                <label
                  key={target.id}
                  className={styles.targetItem}
                  style={{ paddingLeft: `${12 + (target.depth || 0) * 14}px` }}
                >
                  <input
                    type="checkbox"
                    checked={selectedTargets.has(target.id)}
                    onChange={() => toggleTarget(target.id)}
                  />
                  <span className={styles.targetLabel}>
                    <span className={styles.targetId}>#{target.id}</span>
                    {target.label}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        {resultSummary && (
          <div className={styles.resultBox}>
            <div>
              Готово: {resultSummary.ok}, ошибок: {resultSummary.failed}
            </div>
            {resultSummary.warnings?.length > 0 && (
              <ul className={styles.resultList}>
                {resultSummary.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
            {resultSummary.failed > 0 && (
              <ul className={styles.resultList}>
                {resultSummary.results
                  .filter((r) => !r.ok)
                  .slice(0, 8)
                  .map((r) => (
                    <li key={r.target_id}>
                      #{r.target_id}: {r.error || "ошибка"}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={busy || selectedFields.size === 0 || selectedTargets.size === 0}
          >
            {busy ? "Копирование…" : "Применить"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
