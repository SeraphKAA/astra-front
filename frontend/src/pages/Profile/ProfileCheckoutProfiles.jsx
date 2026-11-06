import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "../../shared/ui/Modal/Modal";
import { Button } from "../../shared/ui/Button/Button";
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import {
  deleteMyUserProfile,
  listMyUserProfiles,
  listProfileTemplates,
  upsertMyUserProfile,
} from "../../entities/userProfile/api/userProfileApi";
import { listActiveCheckoutSchemas } from "../../entities/checkoutSchema/api/checkoutSchemaApi";
import { normalizeMediaUrl } from "../../shared/commonApi";
import { collectCheckoutFieldErrors, isCheckoutFieldRequired } from "../../shared/validation/checkoutField";

const FieldInput = ({ field, value, onChange }) => {
  const label = field.label || field.key;
  return (
    <label className="profile-checkout-field">
      <span>
        {label}
        {isCheckoutFieldRequired(field) ? " *" : ""}
      </span>
      <input
        type={field.type === "number" ? "number" : "text"}
        value={value || ""}
        placeholder={field.placeholder || ""}
        onChange={(e) => onChange(field.key, e.target.value)}
      />
    </label>
  );
};

export const ProfileCheckoutProfiles = () => {
  const { pushToast } = useToast();
  const [profiles, setProfiles] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [selectedSchema, setSelectedSchema] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [saving, setSaving] = useState(false);

  const schemaByType = useMemo(() => {
    const map = {};
    for (const s of schemas) {
      map[String(s.profile_type).toLowerCase()] = s;
    }
    return map;
  }, [schemas]);

  const load = async () => {
    setLoading(true);
    try {
      const [profList, schemaList, templateList] = await Promise.all([
        listMyUserProfiles(),
        listActiveCheckoutSchemas(),
        listProfileTemplates().catch(() => []),
      ]);
      setProfiles(Array.isArray(profList) ? profList : []);
      const merged = [
        ...(Array.isArray(schemaList) ? schemaList : []),
        ...(Array.isArray(templateList) ? templateList : []),
      ];
      const unique = [];
      const seen = new Set();
      for (const s of merged) {
        const key = String(s.profile_type || "").toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        unique.push(s);
      }
      setSchemas(unique);
    } catch (e) {
      pushToast({ type: "error", message: e?.message || "Не удалось загрузить данные" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openEdit = (profile) => {
    let schema = schemaByType[String(profile.profile_type).toLowerCase()];
    if (!schema && profile.schema_id) {
      schema = schemas.find(s => String(s.id) === String(profile.schema_id));
    }
    if (!schema) {
      const fakeFields = Object.keys(profile.data || {}).map(key => ({
        key,
        label: key,
        type: 'text',
        required: false,
      }));
      schema = {
        id: 'fallback',
        profile_type: profile.profile_type,
        title: profile.profile_type,
        fields: fakeFields,
      };
    }
    setEditingProfile(profile);
    setSelectedSchema(schema);
    setFormValues({ ...(profile.data || {}) });
    setModalOpen(true);
  };

  const onSchemaPick = (schemaId) => {
    const schema = schemas.find((s) => String(s.id) === String(schemaId));
    setSelectedSchema(schema || null);
    setFormValues({});
  };

  const onSave = async () => {
    if (!selectedSchema) {
      pushToast({ type: "error", message: "Выберите игру / платформу" });
      return;
    }
    const { missing, invalid } = collectCheckoutFieldErrors(
      selectedSchema.fields || [],
      formValues
    );
    if (missing.length) {
      pushToast({
        type: "error",
        message: `Заполните: ${missing.join(", ")}`,
      });
      return;
    }
    if (invalid.length) {
      pushToast({
        type: "error",
        message: invalid.join("; "),
      });
      return;
    }
    setSaving(true);
    try {
      const data = {};
      for (const f of selectedSchema.fields || []) {
        const v = formValues[f.key];
        if (typeof v === "string" && v.trim()) data[f.key] = v.trim();
        else if (v !== undefined && v !== null && v !== "") data[f.key] = v;
      }
      await upsertMyUserProfile({
        provider: selectedSchema.provider || "shop",
        profile_type: selectedSchema.profile_type,
        data,
      });
      pushToast({ type: "success", message: "Данные сохранены" });
      setModalOpen(false);
      await load();
    } catch (e) {
      pushToast({ type: "error", message: e?.message || "Не удалось сохранить" });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (profileId) => {
    try {
      await deleteMyUserProfile(profileId);
      pushToast({ type: "success", message: "Удалено" });
      await load();
    } catch (e) {
      pushToast({ type: "error", message: e?.message || "Не удалось удалить" });
    }
  };

  return (
    <section className="profile-card">
      <div className="profile-avatars-head">
        <h2>Данные для заказов</h2>
      </div>
      <p className="profile-checkout-hint">
        UID, сервер и другие данные для игр — при оплате корзины их можно перепроверить.
      </p>
      {loading ? (
        <div className="profile-loading">Загружаем данные...</div>
      ) : profiles.length === 0 ? (
        <div className="profile-empty">
          Пока нет сохранённых данных.
        </div>
      ) : (
        <div className="profile-checkout-list">
          {profiles.map((p) => {
            const schema = schemaByType[String(p.profile_type).toLowerCase()];
            const title = schema?.title || p.profile_type;
            return (
              <div className="profile-checkout-item" key={p.id}>
                <div className="profile-checkout-item-head">
                  {schema?.icon_url ? (
                    <img
                      src={normalizeMediaUrl(schema.icon_url)}
                      alt=""
                      className="profile-checkout-item-icon"
                    />
                  ) : null}
                  <div>
                    <div className="profile-checkout-item-title">{title}</div>
                    <div className="profile-checkout-item-meta">
                      {Object.entries(p.data || {})
                        .slice(0, 3)
                        .map(([k, v]) => {
                          /* Показываем человеческую подпись поля из схемы,
                             а не сырой ключ (uid → «UID игрока») */
                          const fieldLabel =
                            (schema?.fields || []).find((f) => f.key === k)?.label || k;
                          return `${fieldLabel}: ${v}`;
                        })
                        .join(" · ")}
                    </div>
                  </div>
                </div>
                <div className="profile-checkout-item-actions">
                  <button type="button" onClick={() => openEdit(p)}>
                    Изменить
                  </button>
                  <button type="button" className="danger" onClick={() => onDelete(p.id)}>
                    Удалить
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingProfile ? "Изменить данные" : "Добавить данные для игры"}
        /* «Закрыть» во время сохранения выключен явно, а не молчит */
        closeDisabled={saving}
        closeDisabledLabel="Сохраняем данные — закрыть нельзя"
      >
        {!editingProfile && (
          <label className="profile-checkout-field" style={{ marginBottom: 12 }}>
            <span>Игра / платформа</span>
            <select
              value={selectedSchema?.id || ""}
              onChange={(e) => onSchemaPick(e.target.value)}
            >
              <option value="">Выберите из списка</option>
              {schemas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        )}
        {(selectedSchema?.fields || []).map((f) => (
          <FieldInput
            key={f.key}
            field={f}
            value={formValues[f.key] || ""}
            onChange={(key, val) => setFormValues((prev) => ({ ...prev, [key]: val }))}
          />
        ))}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setModalOpen(false)}
            disabled={saving}
          >
            Отмена
          </Button>
          <Button type="button" onClick={onSave} disabled={saving || !selectedSchema}>
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </Modal>
    </section>
  );
};
