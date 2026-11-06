import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "../Modal/Modal";
import { Button } from "../Button/Button";
import styles from "./DuplicateSettingsModal.module.css";

const parseNumber = (v) => {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export const DuplicateSettingsModal = ({
  isOpen,
  onClose,
  title,
  sourceLabel,
  fieldOptions,
  targets,
  categoryOptions = [],
  onSubmit,
  busy = false,
}) => {
  const [selectedFields, setSelectedFields] = useState(() => new Set());
  const [selectedTargets, setSelectedTargets] = useState(() => new Set());
  const [targetSearch, setTargetSearch] = useState("");
  const [resultSummary, setResultSummary] = useState(null);

  // Фильтры — те же, что в шапке страницы «Товары».
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterPriceMin, setFilterPriceMin] = useState("");
  const [filterPriceMax, setFilterPriceMax] = useState("");
  const [filterQuantity, setFilterQuantity] = useState("all");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterDeliveryType, setFilterDeliveryType] = useState("all");

  useEffect(() => {
    if (!isOpen) return;
    setSelectedFields(new Set());
    setSelectedTargets(new Set());
    setTargetSearch("");
    setResultSummary(null);
    setFilterCategoryId("");
    setFilterPriceMin("");
    setFilterPriceMax("");
    setFilterQuantity("all");
    setFilterPlatform("all");
    setFilterDeliveryType("all");
  }, [isOpen, sourceLabel]);

  const filteredTargets = useMemo(() => {
    const q = targetSearch.trim().toLowerCase();
    const categoryId = filterCategoryId ? Number(filterCategoryId) : undefined;
    const priceMin = parseNumber(filterPriceMin);
    const priceMax = parseNumber(filterPriceMax);

    return targets.filter((t) => {
      if (q) {
        const matchesSearch =
          String(t.id).includes(q) ||
          String(t.label || "")
            .toLowerCase()
            .includes(q);
        if (!matchesSearch) return false;
      }

      if (categoryId !== undefined && t.category_id !== categoryId) {
        return false;
      }

      if (priceMin !== undefined) {
        if (t.price == null || Number(t.price) < priceMin) return false;
      }
      if (priceMax !== undefined) {
        if (t.price == null || Number(t.price) > priceMax) return false;
      }

      if (filterQuantity === "in_stock" && !(Number(t.quantity) > 0)) return false;
      if (filterQuantity === "out_of_stock" && Number(t.quantity) > 0) return false;

      if (filterPlatform !== "all" && t.platform !== filterPlatform) return false;
      if (filterDeliveryType !== "all" && t.delivery_type !== filterDeliveryType) {
        return false;
      }

      return true;
    });
  }, [
    targets,
    targetSearch,
    filterCategoryId,
    filterPriceMin,
    filterPriceMax,
    filterQuantity,
    filterPlatform,
    filterDeliveryType,
  ]);

  const resetFilters = () => {
    setTargetSearch("");
    setFilterCategoryId("");
    setFilterPriceMin("");
    setFilterPriceMax("");
    setFilterQuantity("all");
    setFilterPlatform("all");
    setFilterDeliveryType("all");
  };

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

  /* «Выбрать все» доливает к уже выбранному то, что прошло фильтр:
     раньше Set пересоздавался, и выбранное до сужения фильтра молча
     терялось. Пользователь ожидает не «заменить выбор», а «добавить
     всё видимое». */
  const selectAllTargets = () => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      filteredTargets.forEach((t) => next.add(t.id));
      return next;
    });
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
    <Modal 
      isOpen={isOpen} 
      onClose={() => !busy && onClose?.()} 
      title={
        <div>
          {title}
          <button
            type="button"
            className="order-modal-close-btn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <p className={styles.source}>
          Источник: <strong className="text-none">{sourceLabel}</strong>
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
              <button
                type="button"
                className={styles.linkBtn}
                onClick={selectAllTargets}
              >
                Выбрать все
              </button>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={clearTargets}
              >
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

          <div className={styles.filterRow}>
            <select
              className={styles.filterSelect}
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              title="Точная категория товара"
            >
              <option value="">Все категории</option>
              {categoryOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>

            <input
              type="number"
              min={0}
              className={styles.filterInput}
              placeholder="Цена от"
              value={filterPriceMin}
              onChange={(e) => setFilterPriceMin(e.target.value)}
            />
            <input
              type="number"
              min={0}
              className={styles.filterInput}
              placeholder="Цена до"
              value={filterPriceMax}
              onChange={(e) => setFilterPriceMax(e.target.value)}
            />

            <select
              className={styles.filterSelect}
              value={filterQuantity}
              onChange={(e) => setFilterQuantity(e.target.value)}
            >
              <option value="all">Любой остаток</option>
              <option value="in_stock">В наличии</option>
              <option value="out_of_stock">Нет в наличии</option>
            </select>

            <select
              className={styles.filterSelect}
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
            >
              <option value="all">Любая платформа</option>
              <option value="pc">pc</option>
              <option value="mobile">mobile</option>
              <option value="service">service</option>
            </select>

            <select
              className={styles.filterSelect}
              value={filterDeliveryType}
              onChange={(e) => setFilterDeliveryType(e.target.value)}
            >
              <option value="all">Любая выдача</option>
              <option value="code">code</option>
              <option value="login_password">login_password</option>
              <option value="email_password">email_password</option>
              <option value="email_code">email_code</option>
              <option value="game_id">game_id</option>
              <option value="activation_link">activation_link</option>
              <option value="qr_login">qr_login</option>
            </select>

            <button
              type="button"
              className={styles.linkBtn}
              onClick={resetFilters}
            >
              Сбросить фильтры
            </button>
          </div>

          <div className={styles.targetList}>
            {filteredTargets.length === 0 ? (
              <div className={styles.emptyTargets}>Ничего не найдено</div>
            ) : (
              filteredTargets.map((target) => (
                <label
                  key={target.id}
                  className={styles.targetItem}
                  style={{
                    paddingLeft: `${12 + (target.depth || 0) * 14}px`,
                    textTransform: "none",
                  }}
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
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={busy}
          >
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={
              busy || selectedFields.size === 0 || selectedTargets.size === 0
            }
          >
            {busy ? "Копирование…" : "Применить"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
