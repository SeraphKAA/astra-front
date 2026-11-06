import React, { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Modal } from "../../shared/ui/Modal/Modal";
import { prefersReducedMotion } from "../../shared/fx/motionUtils";

const STEAM_ACCOUNT_URL = "https://store.steampowered.com/account/";

/** Раскрытие/схлопывание справки — --astra-t-move (300мс), одна кривая. */
const DISCLOSURE_MS = 300;

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
  <Modal isOpen={isOpen} onClose={onClose} title="Как узнать свой логин Steam?" variant="wide" returnFocus={false}>
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
      <button type="button" className="astra-btn-ghost" onClick={onClose}>
        Понятно
      </button>
    </div>
  </Modal>
);

/* Текст один — и в диалоге, и в раскрывающейся справке под полем суммы. */
const CurrencyHelpBody = () => (
  <ol className="steam-refill-info-list">
    <li>
      <strong>Валюта суммы</strong> — можно указать зачисление в рублях, гривнах, тенге или долларах.
      Курс конвертации актуален на момент расчёта.
    </li>
    <li>
      <strong>Оплата</strong> — всегда в рублях: сумма зачисления пересчитывается по курсу + комиссия
      сервиса 11%.
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
);

/** Совместимость: диалоговая версия той же справки (страница её не открывает). */
export const SteamCurrencyHelpModal = ({ isOpen, onClose }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Как работает валюта при пополнении" variant="wide">
    <div className="steam-refill-info-modal">
      <CurrencyHelpBody />
      <button type="button" className="astra-btn-ghost" onClick={onClose}>
        Понятно
      </button>
    </div>
  </Modal>
);

/* Императивная анимация высоты: явный height (не max-height), reflow между
   стартовым и целевым значением, класс .is-animating живёт только на время
   перехода — в покое ничего не обрезается. Та же грамматика, что у
   раскрывающейся сетки на главной. */
const clearHeight = (clip) => {
  if (!clip) return;
  clip.style.height = "";
  clip.style.opacity = "";
  clip.classList.remove("is-animating");
};

const runHeight = (clip, from, to, fromOpacity, toOpacity, onEnd) => {
  clip.classList.add("is-animating");
  clip.style.height = `${from}px`;
  clip.style.opacity = String(fromOpacity);
  /* фиксируем стартовое значение до смены на целевое */
  void clip.offsetHeight;
  clip.style.height = `${to}px`;
  clip.style.opacity = String(toOpacity);
  return setTimeout(onEnd, DISCLOSURE_MS);
};

/**
 * «Как работает валюта при пополнении» — раскрывающаяся справка под полем
 * суммы. Раньше объяснение появлялось и исчезало мгновенно; теперь оно
 * растёт и схлопывается по высоте с сопутствующим fade: 300мс, общая
 * кривая --astra-ease, prefers-reduced-motion — мгновенно, без анимации.
 *
 * Контейнер живёт в DOM всегда (aria-controls должен указывать на
 * существующий узел) и прячется правилом :empty, пока содержимое снято.
 */
export const SteamCurrencyHelpDisclosure = ({ id, open = false, onClose }) => {
  const [rendered, setRendered] = useState(open);
  const clipRef = useRef(null);
  const innerRef = useRef(null);
  const timerRef = useRef(null);
  const lastRef = useRef(open ? "open" : "closed");

  /* Монтируем содержимое ДО измерения высоты — в том же кадре. */
  useLayoutEffect(() => {
    if (open && !rendered) setRendered(true);
  }, [open, rendered]);

  useLayoutEffect(() => {
    const want = open ? "open" : "closed";
    if (lastRef.current === want) return;

    const clip = clipRef.current;
    const inner = innerRef.current;

    if (want === "open") {
      /* содержимое ещё не смонтировано — доиграем на следующем коммите */
      if (!clip || !inner) return;
      lastRef.current = "open";
      if (prefersReducedMotion()) return;
      clearTimeout(timerRef.current);
      timerRef.current = runHeight(clip, 0, inner.offsetHeight, 0, 1, () => clearHeight(clip));
      return;
    }

    lastRef.current = "closed";
    if (!clip || !inner || prefersReducedMotion()) {
      setRendered(false);
      return;
    }
    clearTimeout(timerRef.current);
    /* Инлайновые стили НЕ снимаем здесь: между их снятием и снятием
       содержимого мог бы проскочить кадр полной высоты. Их уберёт
       эффект ниже — уже после того, как содержимое ушло из DOM. */
    timerRef.current = runHeight(clip, inner.offsetHeight, 0, 1, 0, () => setRendered(false));
  }, [open, rendered]);

  useLayoutEffect(() => {
    if (rendered) return;
    clearHeight(clipRef.current);
  }, [rendered]);

  useLayoutEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className="steam-refill-disclosure" id={id} ref={clipRef}>
      {rendered && (
        <div className="steam-refill-disclosure-inner" ref={innerRef}>
          <p className="steam-refill-disclosure-title">Как работает валюта при пополнении</p>
          <CurrencyHelpBody />
          <button type="button" className="astra-btn-ghost" onClick={onClose}>
            Понятно
          </button>
        </div>
      )}
    </div>
  );
};

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

export const SteamLinkHelpModal = ({ isOpen, onClose }) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="Как узнать ссылку на Steam?"
    variant="wide"
    returnFocus={false}
  >
    <div className="steam-refill-info-modal">
      <p>
        Ссылка на Steam — это уникальный адрес вашего профиля, который начинается с{" "}
        <code>https://s.team/</code>. По ней бот отправит вам подарок.
      </p>
      <p className="steam-refill-info-modal-note">Как её найти:</p>
      <ol className="steam-refill-info-list">
        <li>Войдите в Steam и откройте навбар (меню вверху).</li>
        <li>Нажмите на <strong>свой ник</strong> в правом верхнем углу.</li>
        <li>Выберите пункт <strong>«Профиль»</strong>.</li>
        <li>
          На странице профиля нажмите на кнопку <strong>«Приглашение»</strong> (или «Друзья» →
          «Ссылка-приглашение»).
        </li>
        <li>
          Скопируйте ссылку, которая начинается с <code>https://s.team/</code>.
        </li>
      </ol>
      <p className="steam-refill-info-modal-warning">
        Будьте внимательны! Ссылка на магазин или игру не подойдёт — нужна именно ссылка-приглашение
        в профиль.
      </p>
      <button type="button" className="astra-btn-ghost" onClick={onClose}>
        Понятно
      </button>
    </div>
  </Modal>
);

export const useSteamRefillInfoModals = () => {
  const [loginHelpOpen, setLoginHelpOpen] = useState(false);
  const [currencyHelpOpen, setCurrencyHelpOpen] = useState(false);
  const [linkHelpOpen, setLinkHelpOpen] = useState(false); // <-- новое

  return {
    loginHelpOpen,
    currencyHelpOpen,
    linkHelpOpen, // <-- новое
    openLoginHelp: () => setLoginHelpOpen(true),
    closeLoginHelp: () => setLoginHelpOpen(false),
    openCurrencyHelp: () => setCurrencyHelpOpen(true),
    closeCurrencyHelp: () => setCurrencyHelpOpen(false),
    openLinkHelp: () => setLinkHelpOpen(true), // <-- новое
    closeLinkHelp: () => setLinkHelpOpen(false), // <-- новое
    toggleCurrencyHelp: () => setCurrencyHelpOpen((v) => !v),
  };
};
