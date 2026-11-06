import React, { useState } from "react";
import { apiRequest } from "../../shared/commonApi";
import styles from "./admin.module.css";

export const rabbitDefaults = (service = "discord_boosts") => service === "discord_boosts"
  ? { duration: "oneMonth", count: 2, customize: false } : { sku_id: "" };

export const withRabbitService = (form, service) => ({ ...form, provider_service: service,
  provider_params_json: JSON.stringify(rabbitDefaults(service)), checkout_requirements_json: "",
  extra_checkout_fields: [], is_auto_delivery: true, platform: "service",
  delivery_type: service === "discord_decoration" ? "activation_link" : "code",
});

export function RabbitBoostSettings({ form, onChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  let params;
  try { params = JSON.parse(form.provider_params_json || "{}"); } catch { params = {}; }
  const update = (values) => onChange({ ...form, provider_params_json: JSON.stringify({ ...params, ...values }) });
  return <>
    <div className={styles.formGroup}><label className={styles.formLabel} htmlFor="rabbit-service">Услуга RabbitBoost</label>
      <select id="rabbit-service" className={styles.formSelect} value={form.provider_service || "discord_boosts"} onChange={(e) => { onChange(withRabbitService(form, e.target.value)); setResults([]); setError(""); }}>
        <option value="discord_boosts">Бусты Discord</option><option value="discord_decoration">Украшение Discord</option>
      </select>
    </div>
    {form.provider_service === "discord_decoration" ? <>
      <div className={styles.formGroup}><label className={styles.formLabel} htmlFor="rabbit-sku">SKU украшения</label>
        <input id="rabbit-sku" className={styles.formInput} value={params.sku_id || ""} onChange={(e) => update({ sku_id: e.target.value.trim() })} placeholder="Идентификатор из каталога RabbitBoost" required pattern="[0-9]{10,25}" />
        <p>Покупатель получит ссылку на подарок Discord. Каждая единица товара создаёт отдельный заказ.</p>
      </div>
      <div className={styles.formGroup}><label className={styles.formLabel} htmlFor="rabbit-search">Найти украшение у поставщика</label>
        <input id="rabbit-search" className={styles.formInput} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Название или SKU" />
        <button type="button" className={styles.adminButtonSecondary} disabled={busy || !query.trim()} onClick={async () => {
          setBusy(true); setError("");
          try { const items = await apiRequest({ url: `/rabbitboost/decorations?q=${encodeURIComponent(query.trim())}` }); setResults(items); if (!items.length) setError("Украшения не найдены"); }
          catch { setError("Каталог недоступен. Поиск заработает после подключения RabbitBoost; SKU можно указать вручную."); }
          finally { setBusy(false); }
        }}>{busy ? "Ищем…" : "Найти"}</button>
        {results.length > 0 && <select className={styles.formSelect} aria-label="Украшения RabbitBoost" value="" onChange={(e) => update({ sku_id: e.target.value })}><option value="">Выберите украшение</option>{results.map((item) => <option key={item.sku_id} value={item.sku_id}>{item.name} · цена поставщика {item.price_rub} ₽</option>)}</select>}
        {error && <p role="alert">{error}</p>}
      </div>
    </> : <>
      <div className={styles.formGroup}><label className={styles.formLabel} htmlFor="rabbit-duration">Срок бустов</label><select id="rabbit-duration" className={styles.formSelect} value={params.duration || "oneMonth"} onChange={(e) => update({ duration: e.target.value })}><option value="oneMonth">1 месяц</option><option value="threeMonth">3 месяца</option></select></div>
      <div className={styles.formGroup}><label className={styles.formLabel} htmlFor="rabbit-count">Бустов в одной единице товара</label><input id="rabbit-count" className={styles.formInput} type="number" min="2" max="10000" step="1" required value={params.count ?? 2} onChange={(e) => update({ count: e.target.value === "" ? "" : Number(e.target.value) })} /></div>
      <div className={styles.formGroup}><label className={styles.formLabel}><input type="checkbox" checked={params.customize === true} onChange={(e) => update({ customize: e.target.checked })} /> Применить кастомизацию профиля</label></div>
      <p>При оформлении покупатель укажет приглашение на сервер Discord. Цена товара задаётся в рублях выше.</p>
    </>}
  </>;
}
