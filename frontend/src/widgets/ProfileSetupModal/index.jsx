import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "../../shared/ui/Modal/Modal";
import { Label, Input } from "../../shared/FieldAuthReg/textfield";
import { TextField } from "../../shared/ui/fields";
import { updateMyProfile } from "../../entities/user/api/userApi";
import { validateNickname, trimAndLimit } from "../../shared/validation";

const isProfileComplete = (user) => {
  if (!user) return false;
  // Минимум: nickname и timezone (можно расширить позже)
  return Boolean(user.nickname) && Boolean(user.timezone);
};

const getDeviceTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    return null;
  }
};

export const ProfileSetupModal = ({ isOpen, user, onDone, onClose }) => {
  const [nickname, setNickname] = useState(user?.nickname || "");
  const [timezone, setTimezone] = useState(user?.timezone || getDeviceTimezone() || "Europe/Moscow");
  const [language, setLanguage] = useState(user?.language || "ru");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const alreadyComplete = useMemo(() => isProfileComplete(user), [user]);

  useEffect(() => {
    setNickname(user?.nickname || "");
    setTimezone(user?.timezone || getDeviceTimezone() || "Europe/Moscow");
    setLanguage(user?.language || "ru");
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const nicknameClean = trimAndLimit(nickname, 30);
      const nickErr = validateNickname(nicknameClean);
      if (nickErr) {
        setError(nickErr);
        return;
      }
      const updated = await updateMyProfile({
        nickname: nicknameClean,
        timezone,
        language,
      });
      onDone?.(updated);
      onClose?.();
    } catch (err) {
      setError(err?.message || "Не удалось сохранить профиль");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen && !alreadyComplete}
      onClose={onClose}
      title="Заполните профиль"
    >
      <TextField
        text="Нужно заполнить данные для продолжения"
        variant="body"
      />

      <form onSubmit={handleSave}>
        <div style={{ marginTop: 12 }}>
          <Label htmlFor="nickname" required>
            Никнейм:
          </Label>
          <Input
            id="nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Например: astra_user"
            className="login-input"
            required
          />
        </div>

        {/* <div style={{ marginTop: 12 }}>
          <Label htmlFor="timezone" required>
            Часовой пояс:
          </Label>
          <Input
            id="timezone"
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="Europe/Moscow"
            className="login-input"
            required
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <Label htmlFor="language">
            Язык (ru/en):
          </Label>
          <Input
            id="language"
            type="text"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="ru"
            className="login-input"
          />
        </div> */}

        {error && <p style={{ color: "red" }}>{error}</p>}

        <div className="wrap" style={{ marginTop: 14 }}>
          <button
            type="submit"
            className="login-button"
            disabled={isSaving}
          >
            {isSaving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

