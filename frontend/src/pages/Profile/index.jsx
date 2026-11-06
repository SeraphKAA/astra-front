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
import { PencilIcon } from "../../shared/svgIcons";
import { PasswordFieldModal } from "../../shared/ui/PasswordField";
import { openPayment, PaymentHistory } from "../../widgets/PaymentDialog";
import { normalizeMediaUrl } from "../../shared/commonApi";
import { validateNickname, validateNoSqlInjection } from "../../shared/validation";
import { ProfileCheckoutProfiles } from "./ProfileCheckoutProfiles";
import { telegramLinkStart, telegramLinkStatus } from "../../entities/auth/api/authApi";

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
  notifications_email: Boolean(user?.notifications_enabled && user?.notifications_email),
  notifications_telegram: Boolean(user?.notifications_enabled && user?.notifications_telegram),
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
  const frontendBaseUrl = window.location.origin;
  const referralWebLink = user?.ref_code
    ? `${frontendBaseUrl}/sign_up?ref=${encodeURIComponent(user.ref_code)}`
    : "";
  const [tgLinkCode, setTgLinkCode] = useState(null);
  const [tgLinkStatus, setTgLinkStatus] = useState("idle");
  const confirmedRef = useRef(false);
  const botUsername = process.env.REACT_APP_TG_BOT_USERNAME || "astra_auth_bot";
  const buildTgUrl = (startParam) =>
    botUsername ? `https://t.me/${botUsername}?start=${encodeURIComponent(startParam)}` : "";


  const onStartTelegramLink = async () => {
    confirmedRef.current = false;
    try {
      setTgLinkStatus("waiting");
      const res = await telegramLinkStart();
      setTgLinkCode(res.code);
      const url = buildTgUrl(res.start_param);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        pushToast({
          type: "info",
          message: "Откройте бота в Telegram и нажмите «Старт» — привязка подтвердится автоматически.",
        });
      } else {
        setTgLinkStatus("idle");
        pushToast({ type: "error", message: "Не задан REACT_APP_TG_BOT_USERNAME" });
      }
    } catch (e) {
      setTgLinkStatus("idle");
      pushToast({ type: "error", message: e?.message || "Не удалось начать привязку" });
    }
  };

  const FIRST_CHECK_DELAY_MS = 20000;   // первый запрос к /link/status — через 20с
  const POLL_INTERVAL_MS = 2000;         // последующие — каждые 2с
  const MAX_ATTEMPTS = 150;              // ~5 минут общего ожидания

  useEffect(() => {
    if (tgLinkStatus !== "waiting" || !tgLinkCode) return;

    let cancelled = false;
    let timer = null;
    let attempts = 0;
    let notifiedPending = false;

    const finish = (status, toast) => {
      if (toast) pushToast(toast);
      setTgLinkStatus(status);            // "idle" → кнопка снова активна
      setTgLinkCode(null);                // эффект self-cancel через deps
      confirmedRef.current = status === "idle" ? confirmedRef.current : false;
    };

    const check = async () => {
      if (cancelled) return;

      if (++attempts > MAX_ATTEMPTS) {
        finish("idle", { type: "error", message: "Время ожидания истекло — попробуйте снова" });
        return;
      }

      let res;
      try {
        res = await telegramLinkStatus({ code: tgLinkCode });
      } catch {
        if (!cancelled) timer = window.setTimeout(check, POLL_INTERVAL_MS);
        return;
      }
      if (cancelled) return;

      // 1. Успех
      if (res?.status === "confirmed") {
        confirmedRef.current = true;
        try { await loadUserProfile(); } catch { /* noop */ }
        finish("idle", { type: "success", message: "Telegram привязан" });
        return;
      }

      if (confirmedRef.current) return;

      // 2. Явные ошибки
      if (res?.status === "error") {
        finish("idle", { type: "error", message: "Этот Telegram уже привязан к другому аккаунту" });
        return;
      }
      if (res?.status === "expired") {
        finish("idle", { type: "error", message: "Ссылка истекла — попробуйте ещё раз" });
        return;
      }

      // 3. Pending. На первой итерации (уже после 20с ожидания) один раз
      //    напомним пользователю, что нужно нажать «Старт» в боте.
      if (!notifiedPending) {
        notifiedPending = true;
        pushToast({
          type: "info",
          message: "Telegram пока не подтверждён. Откройте бота и нажмите «Старт».",
        });
      }

      timer = window.setTimeout(check, POLL_INTERVAL_MS);
    };

    // ⬇ Первый и единственный запрос уходит РОВНО через 20 секунд
    timer = window.setTimeout(check, FIRST_CHECK_DELAY_MS);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [tgLinkCode, tgLinkStatus, loadUserProfile, pushToast]);

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
        notifications_email: form.notifications_enabled ? form.notifications_email : false,
        notifications_telegram: form.notifications_enabled ? form.notifications_telegram : false,
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

    /* Лимит проверяем ДО отправки: подпись «До N МБ» — обещание, а не
       декорация, и гонять мегабайты ради серверного отказа незачем.
       Тот же приём, что в чатах (SupportChat/OrderChat). */
    if (avatarMaxMb && file.size > avatarMaxMb * 1024 * 1024) {
      pushToast({
        type: "error",
        message: `Файл больше ${avatarMaxMb} МБ — выберите файл поменьше`,
      });
      return;
    }

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

  /* Возвращает true только при УСПЕШНОЙ отправке: повторная отправка в
     модалке заводит 60-секундный отсчёт лишь по этому признаку — сбой сети
     не должен запирать пользователя на минуту без письма. */
  const onSendBindCode = async () => {
    const email = bindEmail?.trim();
    if (!email) {
      pushToast({ type: "error", message: "Введите email" });
      return false;
    }
    setSendBindLoading(true);
    try {
      await sendBindEmailCode(email);
      pushToast({ type: "success", message: "Код отправлен на почту" });
      setIsBindCodeModalOpen(true);
      return true;
    } catch (err) {
      pushToast({ type: "error", message: err?.message || "Не удалось отправить код" });
      return false;
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

  const openTopup = () => openPayment({ purpose: "balance" });

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
            Личные данные, почта и пароль, аватары и данные для заказов.
          </p>
          {/* обработчик один — на настоящей кнопке; div-обёртка без onClick,
              иначе каждый клик всплывал и вызывал openTopup дважды */}
          <div className="profile-balance-card">
            <button
              type="button"
              className="profile-balance-btn"
              onClick={openTopup}
              aria-label="Пополнить баланс"
              title="Нажмите, чтобы пополнить баланс"
            >
              <span className="profile-balance-info">
                <span className="profile-balance-label">Баланс</span>
                <span className="profile-balance-amount">
                  <strong>{user?.balance ?? "-"}</strong>
                  <span className="profile-balance-currency">₽</span>
                </span>
              </span>
              <span className="profile-balance-cta" aria-hidden>
                Пополнить
              </span>
            </button>
          </div>
        </header>

        <div className="profile-grid">
          {/* Левая рельса — аккаунт: кто вы и как входите */}
          <div className="profile-col profile-col--account">
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
                </div>
              </div>
              <form onSubmit={onSaveProfile} className="profile-form">
                <div className="profile-field">
                  <label className="profile-field-label" htmlFor="profile-nickname">
                    Никнейм
                  </label>
                  <input
                    id="profile-nickname"
                    type="text"
                    value={form.nickname}
                    onChange={(e) => onFormFieldChange("nickname", e.target.value)}
                    minLength={2}
                    maxLength={30}
                    required
                    disabled={!isEditMode}
                    aria-describedby={isEditMode ? "profile-nickname-hint" : undefined}
                  />
                  {isEditMode && (
                    <span className="profile-field-hint" id="profile-nickname-hint">
                      От 2 до 30 символов: латиница, цифры и «_».
                    </span>
                  )}
                </div>

                <div className="profile-field">
                  <label className="profile-field-label" htmlFor="profile-bio">
                    О себе
                  </label>
                  <textarea
                    id="profile-bio"
                    value={form.bio}
                    onChange={(e) => onFormFieldChange("bio", e.target.value)}
                    maxLength={500}
                    rows={4}
                    disabled={!isEditMode}
                  />
                </div>

                {/* <div className="profile-field">
                  <label className="profile-field-label" htmlFor="profile-timezone">
                    Часовой пояс
                  </label>
                  <input
                    id="profile-timezone"
                    type="text"
                    value={form.timezone}
                    onChange={(e) => onFormFieldChange("timezone", e.target.value)}
                    disabled={!isEditMode}
                  />
                  {isEditMode && (
                    <p className="profile-field-hint">
                      Определился автоматически — поправьте, если не совпадает.
                    </p>
                  )}
                </div> */}

                <div className="profile-notifications-group">
                  <label className="profile-checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.notifications_enabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setForm((prev) => ({
                          ...prev,
                          notifications_enabled: checked,
                          // При выключении главного — выключаем и каналы
                          notifications_email: checked ? prev.notifications_email : false,
                          notifications_telegram: checked ? prev.notifications_telegram : false,
                        }));
                      }}
                      disabled={!isEditMode}
                    />
                    <span>Получать уведомления в чатах</span>
                  </label>

                  {form.notifications_enabled && (
                    <div className="profile-notifications-channels">
                      <label className="profile-checkbox-row">
                        <input
                          type="checkbox"
                          checked={form.notifications_email}
                          onChange={(e) => onFormFieldChange("notifications_email", e.target.checked)}
                          // Если почта не подтверждена — не даем включить (или можно дать, но с подсказкой)
                          disabled={!isEditMode || !user?.email}
                        />
                        <span>По электронной почте {(!user?.email) && "(не привязана)"}</span>
                      </label>
                      
                      <label className="profile-checkbox-row">
                        <input
                          type="checkbox"
                          checked={form.notifications_telegram}
                          onChange={(e) => onFormFieldChange("notifications_telegram", e.target.checked)}
                          // Если телеграм не привязан — не даем включить
                          disabled={!isEditMode || !user?.telegram_id}
                        />
                        <span>В Telegram {(!user?.telegram_id) && "(не привязан)"}</span>
                      </label>
                    </div>
                  )}
                </div>

                {isEditMode && (
                  <div className="profile-form-actions">
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="astra-btn profile-save-btn"
                    >
                      {isSavingProfile ? "Сохранение..." : "Сохранить изменения"}
                    </button>
                  </div>
                )}
              </form>
            </section>

            <section className="profile-card">
              <h2>Безопасность и почта</h2>
              <div className="profile-security">
                <div className="profile-field">
                  <label className="profile-field-label" htmlFor="profile-email">
                    Почта
                  </label>
                  {user?.is_email_verified ? (
                    <div className="profile-ref-row">
                      <input id="profile-email" type="email" readOnly value={user?.email || ""} />
                      <span className="profile-email-ok">Подтверждена</span>
                    </div>
                  ) : (
                    <>
                      <div className="profile-ref-row">
                        <input
                          id="profile-email"
                          type="email"
                          placeholder="you@example.com"
                          value={bindEmail}
                          onChange={(e) => setBindEmail(e.target.value)}
                          disabled={sendBindLoading}
                        />
                        {bindEmail.trim() ? (
                          <button
                            type="button"
                            className="astra-btn-ghost profile-inline-btn"
                            onClick={onSendBindCode}
                            disabled={sendBindLoading}
                          >
                            {sendBindLoading ? "Отправка..." : "Отправить код"}
                          </button>
                        ) : null}
                      </div>
                      <span className="profile-field-hint">
                        Отправим код подтверждения — введёте его в открывшемся окне.
                      </span>
                    </>
                  )}
                </div>

                <div className="profile-security-divider" aria-hidden />

                <div className="profile-field">
                  <span className="profile-field-label">Telegram</span>
                  <span className="profile-field-hint" style={{ marginBottom: 15 }}>
                    {user?.telegram_id
                      ? `Привязан: ${user.telegram_username ? `@${user.telegram_username}` : user.telegram_id}`
                      : "Привяжите Telegram — сможете входить через бота."}
                  </span>
                  {!user?.telegram_id ? (
                    <button
                      type="button"
                      className="astra-btn-ghost profile-inline-btn"
                      onClick={onStartTelegramLink}
                      disabled={tgLinkStatus === "waiting"}
                    >
                      {tgLinkStatus === "waiting" ? "Ожидаем подтверждения…" : "Привязать Telegram"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="astra-btn-ghost profile-inline-btn"
                      onClick={onStartTelegramLink}
                      disabled={tgLinkStatus === "waiting"}
                      title="Заменить привязанный Telegram"
                    >
                      {tgLinkStatus === "waiting" ? "Ожидаем подтверждения…" : "Перепривязать"}
                    </button>
                  )}
                </div>


                <div className="profile-security-divider" aria-hidden />

                <div className="profile-field">
                  <span className="profile-field-label">Пароль</span>
                  <span className="profile-field-hint" style={{marginBottom: 15}}>
                    {user?.has_password
                      ? "Пароль установлен. Вход по почте и паролю доступен."
                      : "Нужен для входа по почте и паролю."}
                  </span>
                  <button
                    type="button"
                    className="astra-btn-ghost profile-inline-btn"
                    onClick={onOpenSetPassword}
                    aria-label={user?.has_password ? "Сменить пароль" : "Установить пароль"}
                    title={user?.has_password ? "Сменить пароль" : "Установить пароль"}
                  >
                    {user?.has_password ? "Сменить пароль" : "Установить пароль"}
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* Правая рельса — имущество: аватары, данные для заказов, рефералка */}
          <div className="profile-col profile-col--extras">
            <section className="profile-card">
              <div className="profile-avatars-head">
                <h2>Аватары</h2>
                {typeof avatarMaxMb === "number" && (
                  <div className="profile-avatar-limit">До {avatarMaxMb} МБ</div>
                )}
                <label className="astra-btn-ghost profile-inline-btn profile-upload-btn">
                  {isUploadingAvatar ? "Загрузка..." : "Загрузить"}
                  {/* disabled на время отправки: иначе «Загрузка…» — только
                      надпись, а второй файл уходит параллельно первому */}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={onUploadAvatar}
                    disabled={isUploadingAvatar}
                  />
                </label>
              </div>

              {isLoadingAvatars ? (
                <div className="profile-loading">Загружаем аватары...</div>
              ) : avatars.length === 0 ? (
                <div className="profile-empty">Пока нет аватаров — загрузите первое изображение.</div>
              ) : (
                <div className="profile-avatars-grid">
                  {avatars.map((avatar) => {
                    const isActive = avatar.id === activeAvatarId;
                    return (
                      <div className="profile-avatar-card" key={avatar.id}>
                        <div className={`profile-avatar-preview${isActive ? " is-active" : ""}`}>
                          <img src={normalizeMediaUrl(avatar.url)} alt="Аватар" />
                        </div>
                        <div className="profile-avatar-actions">
                          <button
                            type="button"
                            className={`profile-avatar-action ${isActive ? "is-active" : ""}`}
                            onClick={() => onSetActiveAvatar(avatar.id)}
                            disabled={isActive}
                          >
                            {isActive ? "Активный" : "Выбрать"}
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

            <ProfileCheckoutProfiles />

            <section className="profile-card">
              <h2>Реферальная программа</h2>
              <div className="profile-ref-box">
                <div className="profile-field">
                  <label className="profile-field-label" htmlFor="profile-ref-code">
                    Ваш реферальный код
                  </label>
                  <div className="profile-ref-row">
                    <input id="profile-ref-code" type="text" readOnly value={user?.ref_code || ""} />
                    <button
                      type="button"
                      className="astra-btn-ghost profile-inline-btn"
                      onClick={onCopyRefCode}
                      aria-label="Скопировать реферальный код"
                    >
                      Скопировать
                    </button>
                  </div>
                </div>

                <div className="profile-ref-links">
                  <div className="profile-field">
                    <label className="profile-field-label" htmlFor="profile-ref-web">
                      Ссылка для сайта
                    </label>
                    <div className="profile-ref-row">
                      <input id="profile-ref-web" type="text" readOnly value={referralWebLink} />
                      <button
                        type="button"
                        className="astra-btn-ghost profile-inline-btn"
                        onClick={() => onCopyReferralLink(referralWebLink)}
                        aria-label="Скопировать ссылку для сайта"
                      >
                        Скопировать
                      </button>
                    </div>
                  </div>
                  <span className="profile-field-hint">
                    Поделитесь ссылкой — после регистрации по ней код применится автоматически.
                  </span>
                </div>

                {!user?.referred_by ? (
                  <div className="profile-field">
                    <label className="profile-field-label" htmlFor="profile-ref-input">
                      Код приглашения
                    </label>
                    <div className="profile-ref-row">
                      <input
                        id="profile-ref-input"
                        type="text"
                        placeholder="Введите код"
                        value={refCodeInput}
                        onChange={(e) => setRefCodeInput(e.target.value)}
                      />
                      <button
                        type="button"
                        className="astra-btn-ghost profile-inline-btn"
                        onClick={onSaveReferralCode}
                        disabled={isSavingRefCode}
                      >
                        {isSavingRefCode ? "Сохранение..." : "Применить"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="profile-ref-info">Вас пригласил пользователь {user.ref_name}</div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      <Modal isOpen={isBindCodeModalOpen} onClose={onCloseBindModal} title="Подтверждение почты">
        <p className="profile-modal-text">
          Код отправлен на <strong>{bindEmail?.trim() || "почту"}</strong>
        </p>

        <div className="profile-otp-wrap">
          <OtpInput
            value={bindCode}
            onChange={(v) => setBindCode(normalizeOtp(v))}
            length={6}
            autoFocus
            disabled={verifyBindLoading}
            name="bind_code"
          />
        </div>

        <p className="profile-modal-hint" style={{ marginTop: 10, marginBottom: 0 }}>
          Не пришёл код? Проверьте папку «Спам» или отправьте ещё раз.
        </p>

        <div className="profile-modal-actions">
          <button
            type="button"
            className="astra-btn-ghost profile-inline-btn"
            onClick={async () => {
              /* отсчёт — только если письмо реально ушло */
              const sent = await onSendBindCode();
              if (sent) setBindResendLeft(60);
            }}
            disabled={sendBindLoading || bindResendLeft > 0}
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
        closeDisabled={setPasswordLoading}
        closeDisabledLabel="Сохраняем пароль — закрыть нельзя"
      >
        <form className="profile-password-modal" onSubmit={onSetPassword}>
          <p className="profile-modal-hint">Пароль нужен для входа по почте и паролю.</p>

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

          <div className="profile-modal-actions">
            <button type="submit" className="astra-btn" disabled={setPasswordLoading}>
              {setPasswordLoading ? "Сохранение..." : user?.has_password ? "Сохранить" : "Установить"}
            </button>
          </div>
        </form>
      </Modal>

      <PaymentHistory />
    </div>
  );
};

export default Profile;