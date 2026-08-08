import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Modal } from "../../shared/ui/Modal/Modal";

const STEAM_ACCOUNT_URL = "https://store.steampowered.com/account/";

const HelpChipIcon = ({ type }) => {
  if (type === "currency") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M9.5 9.25c0-1.2 1.4-2.1 2.5-2.1s2.5.9 2.5 2.1c0 1.1-1.1 1.75-2.5 2.15-1.55.45-2.5 1.15-2.5 2.35 0 1.2 1.4 2.1 2.5 2.1s2.5-.9 2.5-2.1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path d="M12 6.75v10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M6.75 18.25c0-2.9 2.35-5.25 5.25-5.25s5.25 2.35 5.25 5.25"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const SteamRefillHelpChip = ({ onClick, children, type = "login" }) => (
  <button
    type="button"
    className={`steam-refill-help-chip steam-refill-help-chip--${type}`}
    onClick={onClick}
  >
    <span className="steam-refill-help-chip-icon">
      <HelpChipIcon type={type === "currency" ? "currency" : "login"} />
    </span>
    <span className="steam-refill-help-chip-text">{children}</span>
  </button>
);

export const SteamLoginHelpModal = ({ isOpen, onClose }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Как узнать свой логин Steam?" variant="wide">
    <div className="steam-refill-info-modal">
      <p>
        Логин Steam — это то, что вы вводите для входа в аккаунт. Его можно узнать на{" "}
        <a href={STEAM_ACCOUNT_URL} target="_blank" rel="noopener noreferrer">
          странице настроек аккаунта Steam
        </a>
        .
      </p>
      <p className="steam-refill-info-modal-note">
        Это <strong>не</strong> никнейм в игре и <strong>не</strong> Steam ID (длинное число).
      </p>
      <img
        className="steam-refill-info-modal-img"
        src={`${process.env.PUBLIC_URL || ""}/images/steam-login-help.png`}
        alt="Пример: логин Steam указан в настройках аккаунта"
      />
      <p className="steam-refill-info-modal-warning">
        Будьте внимательны! Если вы введёте неправильный логин, средства зачислятся на аккаунт
        другого пользователя.
      </p>
      <button type="button" className="steam-refill-info-modal-btn" onClick={onClose}>
        Понятно
      </button>
    </div>
  </Modal>
);

export const SteamCurrencyHelpModal = ({ isOpen, onClose }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Как работает валюта при пополнении" variant="wide">
    <div className="steam-refill-info-modal">
      <ol className="steam-refill-info-list">
        <li>
          <strong>Валюта суммы</strong> — можно указать зачисление в рублях, тенге или долларах.
          Курс конвертации актуален на момент расчёта.
        </li>
        <li>
          <strong>Оплата</strong> — всегда в рублях: сумма зачисления пересчитывается по курсу + комиссия
          сервиса 5%.
        </li>
        <li>
          <strong>Валюта кошелька Steam</strong> зависит от региона аккаунта. После проверки логина
          показываем регион; если валюта кошелька отличается от выбранной, в чеке будет строка
          «≈ в валюте кошелька».
        </li>
        <li>
          Небольшие расхождения из-за курса или округления возможны. При первом пополнении Steam
          может сменить валюту аккаунта — для первого раза лучше выбрать небольшую сумму.
        </li>
      </ol>
      <button type="button" className="steam-refill-info-modal-btn" onClick={onClose}>
        Понятно
      </button>
    </div>
  </Modal>
);

export const SteamRefillImportantInfo = () => (
  <section className="steam-refill-info-block">
    <h2 className="steam-refill-info-title">Важная информация</h2>
    <ol className="steam-refill-info-list">
      <li>
        <strong>Первое пополнение:</strong> если аккаунт ранее не пополнялся, валюта может
        автоматически измениться на иностранную (€, ₸, $). Рекомендуется первое пополнение делать
        на небольшую сумму.
      </li>
      <li>
        <strong>ДНР, ЛНР, Крым:</strong> перед пополнением закройте все сессии в Steam и переведите
        телефон в авиарежим на 30 минут.
      </li>
      <li>
        <strong>Регион и валюта:</strong> если регион и валюта вашего аккаунта отличаются от
        определённых при проверке логина, пополнение может не пройти.
      </li>
    </ol>
    <p className="steam-refill-info-footer">
      При возникновении проблем — свяжитесь с поддержкой на{" "}
      <Link to="/support" className="steam-refill-info-link">
        странице поддержки
      </Link>
      .
    </p>
  </section>
);

export const useSteamRefillInfoModals = () => {
  const [loginHelpOpen, setLoginHelpOpen] = useState(false);
  const [currencyHelpOpen, setCurrencyHelpOpen] = useState(false);

  return {
    loginHelpOpen,
    currencyHelpOpen,
    openLoginHelp: () => setLoginHelpOpen(true),
    closeLoginHelp: () => setLoginHelpOpen(false),
    openCurrencyHelp: () => setCurrencyHelpOpen(true),
    closeCurrencyHelp: () => setCurrencyHelpOpen(false),
  };
};
