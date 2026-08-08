import React, { useEffect, useMemo, useRef, useState } from "react";
import "./profile.css";

import { useAuth } from "../../app/auth/AuthContext";
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import { Modal } from "../../shared/ui/Modal/Modal";
import { updateMyProfile, sendBindEmailCode, verifyBindEmailCode } from "../../entities/user/api/userApi";
import { OtpInput } from "../../shared/ui/OtpInput/OtpInput";
import {
  activateAvatar,
  deleteAvatar,
  getMyAvatars,
  getFileLimits,
  uploadAvatar,
} from "../../entities/files/api/fileApi";
import { setMyReferralCode } from "../../entities/user/api/userApi";
import { PencilIcon, LockIcon } from "../../shared/svgIcons";
import { PasswordFieldModal } from "../../shared/ui/PasswordField";
import { initBalanceTopupPayment } from "../../entities/payment/api/paymentApi";
import { normalizeMediaUrl } from "../../shared/commonApi";
import { validateNickname, validateNoSqlInjection } from "../../shared/validation";
import { ProfileCheckoutProfiles } from "./ProfileCheckoutProfiles";

const getDeviceTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    return null;
  }
};

const normalizeForm = (user, deviceTimezone) => ({
  nickname: user?.nickname || "",
  bio: user?.bio || "",
  timezone: user?.timezone || deviceTimezone || "Europe/Moscow",
  notifications_enabled: Boolean(user?.notifications_enabled),
});

const Profile = () => {
  const { user, isAuthenticated, loadUserProfile, loadActiveAvatar } = useAuth();
  const { pushToast } = useToast();
  const deviceTimezone = useMemo(() => getDeviceTimezone(), []);
  const [timezoneTouched, setTimezoneTouched] = useState(false);
  const [form, setForm] = useState(normalizeForm(user, deviceTimezone));
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [avatars, setAvatars] = useState([]);
  const [isLoadingAvatars, setIsLoadingAvatars] = useState(true);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarMaxMb, setAvatarMaxMb] = useState(null);
  const [refCodeInput, setRefCodeInput] = useState("");
  const [isSavingRefCode, setIsSavingRefCode] = useState(false);
  const [bindEmail, setBindEmail] = useState("");
  const [bindCode, setBindCode] = useState("");
  const [sendBindLoading, setSendBindLoading] = useState(false);
  const [verifyBindLoading, setVerifyBindLoading] = useState(false);
  const [isBindCodeModalOpen, setIsBindCodeModalOpen] = useState(false);
  const [bindResendLeft, setBindResendLeft] = useState(0);
  const bindVerifyTimerRef = useRef(null);
  const normalizeOtp = (v) => String(v || "").replace(/\D/g, "").slice(0, 6);
  const [isSetPasswordOpen, setIsSetPasswordOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setPasswordLoading, setSetPasswordLoading] = useState(false);
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupError, setTopupError] = useState("");
  const [isTopupLoading, setIsTopupLoading] = useState(false);
  const frontendBaseUrl = window.location.origin;
  const tgBotUsername = import.meta.env.VITE_TG_BOT_USERNAME || "<bot_username>";
  const tgAppShortName = import.meta.env.VITE_TG_APP_SHORT_NAME || "<app_short_name>";
  const referralWebLink = user?.ref_code
    ? `${frontendBaseUrl}/sign_up?ref=${encodeURIComponent(user.ref_code)}`
    : "";
  const referralTelegramLink = user?.ref_code
    ? `https://t.me/${tgBotUsername}/${tgAppShortName}?startapp=ref_${encodeURIComponent(user.ref_code)}`
    : "";

  useEffect(() => {
    setTimezoneTouched(false);
    setForm(normalizeForm(user, deviceTimezone));
    setBindEmail(user?.email || "");
    setBindCode("");
    setIsEditMode(false);
    setIsSetPasswordOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    setOldPassword("");
  }, [user, deviceTimezone]);

  const loadAvatars = async () => {
    if (!isAuthenticated) return;

    setIsLoadingAvatars(true);
    try {
      const data = await getMyAvatars();
      setAvatars(Array.isArray(data) ? data : []);
    } catch (e) {
      pushToast({ type: "error", message: e?.message || "Не удалось загрузить аватары" });
    } finally {
      setIsLoadingAvatars(false);
    }
  };

  useEffect(() => {
    loadAvatars();
  }, [isAuthenticated]);

  useEffect(() => {
    const loadLimits = async () => {
      try {
        const data = await getFileLimits();
        const mb = data?.avatar_max_file_size_mb;
        if (typeof mb === "number") {
          setAvatarMaxMb(mb);
        }
      } catch (e) {
        // non-critical
      }
    };
    loadLimits();
  }, []);

  const activeAvatarId = useMemo(() => {
    const activeAvatar = avatars.find((avatar) => avatar?.is_active);
    return activeAvatar?.id || null;
  }, [avatars]);

  const onFormFieldChange = (key, value) => {
    if (key === "timezone") setTimezoneTouched(true);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (user?.timezone) return;
    if (!deviceTimezone) return;
    if (timezoneTouched) return;

    setForm((prev) => {
      if (prev?.timezone && prev.timezone !== "Europe/Moscow") return prev;
      return { ...prev, timezone: deviceTimezone };
    });
  }, [deviceTimezone, timezoneTouched, user?.timezone]);

  const onSaveProfile = async (e) => {
    e.preventDefault();
    if (!isEditMode) return;
    setIsSavingProfile(true);

    try {
      const nicknameError = validateNickname(form.nickname);
      if (nicknameError) {
        pushToast({ type: "error", message: nicknameError });
        return;
      }
      const bioError = validateNoSqlInjection(form.bio, "О себе");
      if (bioError) {
        pushToast({ type: "error", message: bioError });
        return;
      }
      const timezoneError = validateNoSqlInjection(form.timezone, "Часовой пояс");
      if (timezoneError) {
        pushToast({ type: "error", message: timezoneError });
        return;
      }

      const payload = {
        nickname: form.nickname?.trim() ? form.nickname.trim() : form.nickname,
        bio: form.bio?.trim() ? form.bio.trim() : "",
        timezone: form.timezone?.trim() ? form.timezone.trim() : form.timezone,
        notifications_enabled: form.notifications_enabled,
      };
      await updateMyProfile(payload);
      await loadUserProfile();
      pushToast({ type: "success", message: "Профиль успешно сохранен" });
      setIsEditMode(false);
    } catch (err) {
      pushToast({ type: "error", message: err?.message || "Не удалось сохранить профиль" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const onCancelEdit = () => {
    setTimezoneTouched(false);
    setForm(normalizeForm(user, deviceTimezone));
    setBindEmail(user?.email || "");
    setBindCode("");
    setIsEditMode(false);
  };

  const onUploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      await uploadAvatar(file);
      await loadAvatars();
      await loadActiveAvatar();
      pushToast({ type: "success", message: "Аватар успешно загружен" });
    } catch (err) {
      pushToast({ type: "error", message: err?.message || "Не удалось загрузить аватар" });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const onSetActiveAvatar = async (avatarId) => {
    try {
      await activateAvatar(avatarId);
      await loadAvatars();
      await loadActiveAvatar();
      pushToast({ type: "success", message: "Активный аватар обновлен" });
    } catch (err) {
      pushToast({ type: "error", message: err?.message || "Не удалось активировать аватар" });
    }
  };

  const onDeleteAvatar = async (avatarId) => {
    try {
      await deleteAvatar(avatarId);
      await loadAvatars();
      await loadActiveAvatar();
      pushToast({ type: "success", message: "Аватар удален" });
    } catch (err) {
      pushToast({ type: "error", message: err?.message || "Не удалось удалить аватар" });
    }
  };

  const onCopyRefCode = async () => {
    if (!user?.ref_code) return;
    await navigator.clipboard.writeText(user.ref_code);
    pushToast({ type: "success", message: "Реферальный код скопирован" });
  };

  const onSaveReferralCode = async () => {
    if (!refCodeInput.trim()) return;
    setIsSavingRefCode(true);
    try {
      await setMyReferralCode(refCodeInput.trim());
      await loadUserProfile();
      pushToast({ type: "success", message: "Реферальный код применен" });
      setRefCodeInput("");
    } catch (err) {
      pushToast({ type: "error", message: err?.message || "Не удалось применить реферальный код" });
    } finally {
      setIsSavingRefCode(false);
    }
  };

  const onCopyReferralLink = async (link) => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    pushToast({ type: "success", message: "Реферальная ссылка скопирована" });
  };

  const onSendBindCode = async () => {
    const email = bindEmail?.trim();
    if (!email) {
      pushToast({ type: "error", message: "Введите email" });
      return;
    }
    setSendBindLoading(true);
    try {
      await sendBindEmailCode(email);
      pushToast({ type: "success", message: "Код отправлен на почту" });
      setIsBindCodeModalOpen(true);
    } catch (err) {
      pushToast({ type: "error", message: err?.message || "Не удалось отправить код" });
    } finally {
      setSendBindLoading(false);
    }
  };

  const onVerifyBind = async () => {
    const email = bindEmail?.trim();
    const code = bindCode?.trim();
    if (!email || !code) {
      pushToast({ type: "error", message: "Введите email и код" });
      return;
    }
    if (code.length !== 6) {
      pushToast({ type: "error", message: "Код должен содержать 6 цифр" });
      return;
    }
    setVerifyBindLoading(true);
    try {
      await verifyBindEmailCode(email, code);
      await loadUserProfile();
      setBindCode("");
      pushToast({ type: "success", message: "Email подтверждён" });
      setIsBindCodeModalOpen(false);
    } catch (err) {
      pushToast({ type: "error", message: err?.message || "Неверный код или ошибка" });
    } finally {
      setVerifyBindLoading(false);
    }
  };

  const onCloseBindModal = () => {
    setIsBindCodeModalOpen(false);
    setBindCode("");
  };

  const onOpenSetPassword = () => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setIsSetPasswordOpen(true);
  };

  const onCloseSetPassword = () => {
    if (setPasswordLoading) return;
    setIsSetPasswordOpen(false);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const onSetPassword = async (e) => {
    e?.preventDefault?.();
    const p0 = oldPassword || "";
    const p1 = newPassword || "";
    const p2 = confirmPassword || "";

    if (user?.has_password && !p0.trim()) {
      pushToast({ type: "error", message: "Введите текущий пароль" });
      return;
    }
    if (p1.length < 8) {
      pushToast({ type: "error", message: "Пароль должен быть не короче 8 символов" });
      return;
    }
    if (p1 !== p2) {
      pushToast({ type: "error", message: "Пароли не совпадают" });
      return;
    }

    setSetPasswordLoading(true);
    try {
      const payload = user?.has_password
        ? { old_password: p0, password: p1 }
        : { password: p1 };
      await updateMyProfile(payload);
      await loadUserProfile();
      pushToast({
        type: "success",
        message: user?.has_password ? "Пароль изменён" : "Пароль установлен",
      });
      onCloseSetPassword();
    } catch (err) {
      const msg = err?.message || "Не удалось сохранить пароль";
      const lower = String(msg).toLowerCase();
      if (lower.includes("invalid current password")) {
        pushToast({ type: "error", message: "Неверный текущий пароль" });
      } else {
        pushToast({ type: "error", message: msg });
      }
    } finally {
      setSetPasswordLoading(false);
    }
  };

  useEffect(() => {
    if (bindResendLeft <= 0) return;
    const t = window.setInterval(() => {
      setBindResendLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [bindResendLeft]);

  useEffect(() => {
    if (bindVerifyTimerRef.current) {
      window.clearTimeout(bindVerifyTimerRef.current);
      bindVerifyTimerRef.current = null;
    }
    if (!isBindCodeModalOpen) return;
    if (verifyBindLoading) return;
    if (bindCode.length !== 6) return;
    bindVerifyTimerRef.current = window.setTimeout(() => {
      onVerifyBind();
    }, 400);
    return () => {
      if (bindVerifyTimerRef.current) {
        window.clearTimeout(bindVerifyTimerRef.current);
        bindVerifyTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindCode, isBindCodeModalOpen, verifyBindLoading]);

  const openTopup = () => {
    setTopupError("");
    setTopupAmount("");
    setIsTopupOpen(true);
  };

  const closeTopup = () => {
    if (isTopupLoading) return;
    setIsTopupOpen(false);
    setTopupError("");
  };

  const normalizeMoneyInput = (v) => {
    const s = String(v ?? "");
    const cleaned = s.replace(",", ".").replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length <= 1) return cleaned;
    return `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;
  };

  const submitRobokassaForm = (actionUrl) => {
    const formEl = document.createElement("form");
    formEl.method = "POST";
    formEl.action = actionUrl;
    formEl.style.display = "none";
    formEl.target = "_blank";

    document.body.appendChild(formEl);
    formEl.submit();
    window.setTimeout(() => {
      try {
        document.body.removeChild(formEl);
      } catch { }
    }, 1000);
  };

  const onTopup = async (e) => {
    e?.preventDefault?.();
    setTopupError("");
    const amountStr = normalizeMoneyInput(topupAmount).trim();
    const amount = Number(amountStr);
    if (!amountStr || Number.isNaN(amount) || amount <= 0) {
      setTopupError("Введите корректную сумму");
      return;
    }
    if (amount > 1000000) {
      setTopupError("Сумма слишком большая");
      return;
    }

    setIsTopupLoading(true);
    try {
      const res = await initBalanceTopupPayment({ amount: amountStr });
      if (!res?.payment_action_url) {
        throw new Error("Не удалось создать платеж");
      }
      closeTopup();
      submitRobokassaForm(res.payment_action_url);
    } catch (err) {
      setTopupError(err?.message || "Не удалось создать платеж");
    } finally {
      setIsTopupLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <header className="profile-hero">
            <h1 className="profile-title">Профиль</h1>
            <div className="profile-title-divider" aria-hidden />
          </header>
          <div className="profile-not-auth">Войдите в аккаунт, чтобы открыть профиль.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <header className="profile-hero">
          <h1 className="profile-title">Профиль</h1>
          <div className="profile-title-divider" aria-hidden />
          <p className="profile-subtitle">
            Редактируйте данные аккаунта, управляйте аватарами и персональными настройками.
          </p>
          <div className="profile-balance-card" onClick={openTopup}>
            <span className="profile-balance-label">Баланс</span>
            <button
              type="button"
              className="profile-balance-btn"
              onClick={openTopup}
              aria-label="Пополнить баланс"
              title="Нажмите, чтобы пополнить баланс"
            >
              <strong>{user?.balance ?? "-"}</strong>
              <span className="profile-balance-currency">₽</span>
            </button>
            <span className="profile-balance-hint">Нажмите, чтобы пополнить</span>
          </div>
        </header>

        <div className="profile-grid">
          <section className="profile-card">
            <div className="profile-card-head">
              <h2>Основные данные</h2>
              <div className="profile-card-head-actions">
                {!isEditMode ? (
                  <button
                    type="button"
                    className="profile-edit-btn"
                    onClick={() => setIsEditMode(true)}
                    aria-label="Редактировать профиль"
                    title="Редактировать"
                  >
                    <PencilIcon />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="profile-edit-btn"
                    onClick={onCancelEdit}
                    aria-label="Отменить редактирование"
                    title="Отмена"
                  >
                    ×
                  </button>
                )}
                <button
                  type="button"
                  className="profile-edit-btn"
                  onClick={onOpenSetPassword}
                  aria-label={user?.has_password ? "Сменить пароль" : "Установить пароль"}
                  title={user?.has_password ? "Сменить пароль" : "Установить пароль"}
                >
                  <LockIcon />
                </button>
              </div>
            </div>
            <form onSubmit={onSaveProfile} className="profile-form">
              <label>
                Никнейм
                <input
                  type="text"
                  value={form.nickname}
                  onChange={(e) => onFormFieldChange("nickname", e.target.value)}
                  minLength={2}
                  maxLength={30}
                  required
                  disabled={!isEditMode}
                />
              </label>

              {user?.is_email_verified ? (
                <label>
                  Email
                  <input type="email" readOnly value={user?.email || ""} />
                </label>
              ) : (
                <div className="profile-email-bind">
                  <div className="profile-ref-label">Email (подтверждение по коду)</div>
                  <div className="profile-ref-row">
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={bindEmail}
                      onChange={(e) => setBindEmail(e.target.value)}
                      disabled={!isEditMode}
                    />
                    {bindEmail.trim() ? (
                      <button
                        type="button"
                        onClick={onSendBindCode}
                        disabled={!isEditMode || sendBindLoading}
                      >
                        {sendBindLoading ? "Отправка..." : "Отправить код"}
                      </button>
                    ) : null}
                  </div>
                  <div className="profile-ref-hint" style={{ marginTop: 8 }}>
                    После отправки кода откроется окно для ввода.
                  </div>
                </div>
              )}

              <label>
                Био
                <textarea
                  value={form.bio}
                  onChange={(e) => onFormFieldChange("bio", e.target.value)}
                  maxLength={500}
                  rows={4}
                  disabled={!isEditMode}
                />
              </label>

              <div className="profile-two-cols">
                {/* <label>
                  Часовой пояс
                  <input
                    type="text"
                    value={form.timezone}
                    onChange={(e) => onFormFieldChange("timezone", e.target.value)}
                    disabled={!isEditMode}
                  />
                </label> */}
              </div>

              <div className="profile-two-cols">
                <label className="profile-checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.notifications_enabled}
                    onChange={(e) =>
                      onFormFieldChange("notifications_enabled", e.target.checked)
                    }
                    disabled={!isEditMode}
                  />
                  <span>Получать уведомления</span>
                </label>
              </div>

              {isEditMode && (
                <button type="submit" disabled={isSavingProfile} className="profile-save-btn">
                  {isSavingProfile ? "Сохранение..." : "Сохранить изменения"}
                </button>
              )}
            </form>
          </section>

          <section className="profile-card">
            <h2>Реферальная система</h2>
            <div className="profile-ref-box">
              <div className="profile-ref-label">Ваш реферальный код</div>
              <div className="profile-ref-row">
                <input type="text" readOnly value={user?.ref_code || ""} />
                <button type="button" onClick={onCopyRefCode}>
                  Скопировать
                </button>
              </div>
              <div className="profile-ref-links">
                <div className="profile-ref-link-row">
                  <input type="text" readOnly value={referralWebLink} />
                  <button type="button" onClick={() => onCopyReferralLink(referralWebLink)}>
                    Копировать web
                  </button>
                </div>
                <div className="profile-ref-link-row">
                  <input type="text" readOnly value={referralTelegramLink} />
                  <button type="button" onClick={() => onCopyReferralLink(referralTelegramLink)}>
                    Копировать TG
                  </button>
                </div>
                <div className="profile-ref-hint">
                  Переходите по ссылке с `ref`/`startapp=ref_...` — код применится автоматически после регистрации.
                </div>
              </div>
              {!user?.referred_by ? (
                <div className="profile-ref-row">
                  <input
                    type="text"
                    placeholder="Введите реферальный код"
                    value={refCodeInput}
                    onChange={(e) => setRefCodeInput(e.target.value)}
                  />
                  <button type="button" onClick={onSaveReferralCode} disabled={isSavingRefCode}>
                    {isSavingRefCode ? "Сохранение..." : "Применить"}
                  </button>
                </div>
              ) : (
                <div className="profile-ref-info">Реферал закреплен: пользователь {user.ref_name}</div>
              )}
            </div>
          </section>

          <ProfileCheckoutProfiles />

          <section className="profile-card">
            <div className="profile-avatars-head">
              <h2>Аватары</h2>
              {typeof avatarMaxMb === "number" && (
                <div className="profile-avatar-limit">Макс. размер: {avatarMaxMb}MB</div>
              )}
              <label className="profile-upload-btn">
                {isUploadingAvatar ? "Загрузка..." : "Загрузить"}
                <input type="file" accept="image/*" onChange={onUploadAvatar} />
              </label>
            </div>

            {isLoadingAvatars ? (
              <div className="profile-loading">Загрузка аватаров...</div>
            ) : avatars.length === 0 ? (
              <div className="profile-empty">У вас пока нет загруженных аватаров.</div>
            ) : (
              <div className="profile-avatars-grid">
                {avatars.map((avatar) => {
                  const isActive = avatar.id === activeAvatarId;
                  return (
                    <div className="profile-avatar-card" key={avatar.id}>
                      <div className="profile-avatar-preview">
                        <img src={normalizeMediaUrl(avatar.url)} alt="avatar" />
                      </div>
                      <div className="profile-avatar-actions">
                        <button
                          type="button"
                          className={`profile-avatar-action ${isActive ? "is-active" : ""}`}
                          onClick={() => onSetActiveAvatar(avatar.id)}
                          disabled={isActive}
                        >
                          {isActive ? "Активный" : "Сделать активным"}
                        </button>
                        <button
                          type="button"
                          className="profile-avatar-action danger"
                          onClick={() => onDeleteAvatar(avatar.id)}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      <Modal isOpen={isBindCodeModalOpen} onClose={onCloseBindModal} title="Подтверждение email">
        <div className="profile-ref-label" style={{ marginBottom: 8 }}>
          Код отправлен на <strong>{bindEmail?.trim() || "email"}</strong>
        </div>

        <div style={{ marginTop: 6 }}>
          <OtpInput
            value={bindCode}
            onChange={(v) => setBindCode(normalizeOtp(v))}
            length={6}
            autoFocus
            disabled={!isEditMode || verifyBindLoading}
            name="bind_code"
          />
        </div>

        <div className="profile-ref-hint" style={{ marginTop: 10 }}>
          Не пришёл код? Проверьте спам или отправьте ещё раз.
        </div>

        <div className="profile-ref-row" style={{ marginTop: 10 }}>
          <div />
          <button
            type="button"
            onClick={async () => {
              await onSendBindCode();
              setBindResendLeft(60);
            }}
            disabled={!isEditMode || sendBindLoading || bindResendLeft > 0}
          >
            {bindResendLeft > 0
              ? `Отправить ещё раз (${bindResendLeft}с)`
              : sendBindLoading
                ? "Отправка..."
                : "Отправить код ещё раз"}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isSetPasswordOpen}
        onClose={onCloseSetPassword}
        title={user?.has_password ? "Сменить пароль" : "Установить пароль"}
      >
        <form className="profile-password-modal" onSubmit={onSetPassword}>
          <div className="profile-ref-hint" style={{ marginBottom: 10 }}>
            Пароль нужен для входа по почте+паролю и дополнительных настроек безопасности.
          </div>

          <div className="profile-password-field-stack">
            {user?.has_password ? (
              <PasswordFieldModal
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                disabled={setPasswordLoading}
                placeholder="Текущий пароль"
                autoComplete="current-password"
                id="profile-old-password"
              />
            ) : null}
            <PasswordFieldModal
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={setPasswordLoading}
              placeholder="Новый пароль (мин. 8 символов)"
              autoComplete="new-password"
              id="profile-new-password"
            />
            <PasswordFieldModal
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={setPasswordLoading}
              placeholder="Повторите пароль"
              autoComplete="new-password"
              id="profile-confirm-password"
            />
          </div>

          <div className="profile-ref-row" style={{ marginTop: 12 }}>
            <div />
            <button type="submit" disabled={setPasswordLoading}>
              {setPasswordLoading ? "Сохранение..." : user?.has_password ? "Сохранить" : "Установить"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isTopupOpen} onClose={closeTopup} title="Пополнение баланса">
        <form className="profile-form" onSubmit={onTopup}>
          <div className="profile-ref-hint" style={{ marginBottom: 10 }}>
            Введите сумму в рублях — после оплаты через Robokassa средства начислятся на ваш баланс.
          </div>

          <label>
            Сумма (₽)
            <input
              type="text"
              inputMode="decimal"
              value={topupAmount}
              onChange={(e) => setTopupAmount(normalizeMoneyInput(e.target.value))}
              placeholder="Например: 500"
              disabled={isTopupLoading}
            />
          </label>

          {topupError ? (
            <div className="profile-alert profile-alert-error" style={{ marginTop: 10 }}>
              {topupError}
            </div>
          ) : null}

          <div className="profile-ref-row" style={{ marginTop: 12 }}>
            <div />
            <button type="submit" disabled={isTopupLoading}>
              {isTopupLoading ? "Подготовка..." : "Перейти к оплате"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Profile;