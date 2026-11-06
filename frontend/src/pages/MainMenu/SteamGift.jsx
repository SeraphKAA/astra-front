import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/auth/AuthContext";
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import { useRevealOnce, useDelayedPending } from "../../shared/fx/motionUtils";
import SlidingNumber from "../../shared/fx/SlidingNumber";
import { PendingSwap } from "./TileGrid";
import { getProductsMiniList, getProductById } from "../../entities/product/api/productApi";
import { addToCart } from "../../entities/cart/api/cartApi";
import { addToGuestCart } from "../../entities/cart/model/guestCart";
import { upsertMyUserProfile } from "../../entities/userProfile/api/userProfileApi";
import { normalizeMediaUrl, getApiErrorMessage } from "../../shared/commonApi";
import { SteamGlyph } from "./SteamTopUp";
import {
  SteamLinkHelpModal,
  useSteamRefillInfoModals,
} from "../SteamRefill/SteamRefillInfo";

/* Раздел каталога, к которому относятся все подарочные товары.
   Совпадает со значением ProductCategory.STEAM_GIFT на бэке. */
const GIFT_MAIN_CATEGORY = "steam_gift";

const SEARCH_DEBOUNCE_MS = 350;

/* Принимаем: профиль, trade URL, короткую ссылку подарка. Всё остальное
   (например, store.steampowered.com) отсекаем: его нельзя превратить в
   получателя — заказ ушёл бы «в никуда». */
const STEAM_LINK_RE = new RegExp(
    "^https?:\\/\\/(www\\.)?" +
        "(?:" +
            "steamcommunity\\.com\\/(id|profiles|tradeoffer|trade)\\/" +
            "|" +
            "s\\.team\\/p\\/" +
        ")" +
        "\\S+$",
    "i"
);
const isValidSteamLink = (v) => STEAM_LINK_RE.test(String(v || "").trim());

const formatPrice = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value ?? "");
    const rounded = Math.round(n * 100) / 100;
    const digits = Number.isInteger(rounded) ? 0 : 2;
    return rounded.toLocaleString("ru-RU", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
};

const GiftGlyph = () => (
    <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" focusable="false">
        <path
            d="M20 7H4a1 1 0 0 0-1 1v3h18V8a1 1 0 0 0-1-1zM11 12H4v8a1 1 0 0 0 1 1h6v-9zm2 0v9h6a1 1 0 0 0 1-1v-8h-7zM12 3.5a2.5 2.5 0 0 0-4.95-.5H5.5A1.5 1.5 0 0 0 4 4.5V6h7V4.5a1 1 0 0 0-1-1h2zm2.95.5A2.5 2.5 0 0 0 12 3.5V6h7V4.5a1.5 1.5 0 0 0-1.5-1.5h-1.55z"
            fill="currentColor"
        />
    </svg>
);

const HelpIcon = () => (
    <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
    >
        <circle cx="12" cy="12" r="9" />
        <path d="M9.6 9.2a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.7-.9 1.3v.5" />
        <path d="M12 16.8h.01" />
    </svg>
);

/**
 * Секция «Подарок Steam».
 *
 * Логика целиком на существующих ручках:
 *  1. getProductsMiniList({ main_category: "steam_gift", search })
 *     даёт список подарочных товаров и поиск по ним.
 *  2. По выбору тянем getProductById — из него берём checkout_requirements,
 *     чтобы узнать profile_type и ключ поля для ссылки на Steam. Этот
 *     profile_type — тот же, что показал бы CheckoutDataModal.
 *  3. Ссылку сохраняем как user profile (тот же API, что использует
 *     CheckoutDataModal для предзаполнения полей). Ничего нового для
 *     этого на бэке не нужно — профиль уже так устроен.
 *  4. Товар кладём в корзину (addToCart / addToGuestCart) и ведём на
 *     /basket: там пользователь жмёт «Перейти к оплате», CheckoutDataModal
 *     видит сохранённый профиль и подставляет ссылку — остаётся
 *     подтвердить.
 *
 * Ошибка на любом шаге не «съедается» — тост говорит, что именно упало:
 * товар не добавился / ссылка не сохранилась. Молча уводить в корзину
 * с потерянной ссылкой нельзя — заказ ушёл бы без адресата.
 */
const SteamGift = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { pushToast } = useToast();

    const { linkHelpOpen, openLinkHelp, closeLinkHelp } = useSteamRefillInfoModals();

    const searchId = useId();
    const searchLabelId = useId();
    const linkId = useId();
    const linkErrId = useId();

    const linkRef = useRef(null);
    const rulesRef = useRevealOnce();

    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedId, setSelectedId] = useState(null);

    const [steamLink, setSteamLink] = useState("");
    const [linkError, setLinkError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const showSkeleton = useDelayedPending(loading);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError("");
        getProductsMiniList({
            page: 1,
            size: 24,
            main_category: GIFT_MAIN_CATEGORY,
            search: debounced || undefined,
        })
            .then((data) => {
                if (cancelled) return;
                const list = Array.isArray(data?.products) ? data.products : [];
                setProducts(list);
                setSelectedId((prev) => {
                    if (prev && list.some((p) => p.id === prev)) return prev;
                    return list[0]?.id ?? null;
                });
            })
            .catch((e) => {
                if (cancelled) return;
                setError(getApiErrorMessage(e, "Не удалось загрузить подарочные карты"));
                setProducts([]);
                setSelectedId(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [debounced]);

    const selected = useMemo(
        () => products.find((p) => p.id === selectedId) || null,
        [products, selectedId]
    );

    const handleLinkChange = (e) => {
        setSteamLink(e.target.value);
        if (linkError) setLinkError("");
    };

    /* Достаём profile_type и ключ поля для ссылки из checkout_requirements
       товара — того же объекта, из которого CheckoutDataModal строит
       группу. Если админ не настроил поля — падаем на безопасные дефолты,
       но НЕ выдумываем неизвестный profile_type: лучше отдать категорию. */
    const resolveProfileShape = (full) => {
        const req = (full && typeof full.checkout_requirements === "object" && full.checkout_requirements) || {};
        const fields = Array.isArray(req.fields) ? req.fields : [];
        const linkField =
            fields.find((f) => f && /link|url|invite|steam|trade/i.test(String(f.key || ""))) ||
            fields[0] ||
            null;
        return {
            profileType: req.profile_type || `cat_${full.category_id}`,
            provider: full.fulfillment_provider || "shop",
            fieldKey: linkField?.key || "steam_link",
        };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;

        if (!selected) {
            pushToast({ type: "info", message: "Выберите товар для подарка" });
            return;
        }
        const link = steamLink.trim();
        if (!link) {
            setLinkError("Укажите ссылку на Steam — без неё непонятно, кому дарить");
            linkRef.current?.focus();
            return;
        }
        if (!isValidSteamLink(link)) {
            setLinkError(
                "Принимаем ссылку на профиль (steamcommunity.com/id/… или /profiles/…), trade URL либо короткую s.team/p/…"
            );
            linkRef.current?.focus();
            return;
        }

        setSubmitting(true);
        try {
            /* 1. Полная карточка — только ради checkout_requirements.
                 В mini DTO этого поля нет, а нам нужен profile_type. */
            const full = await getProductById(selected.id);
            const shape = resolveProfileShape(full);

            /* 2. Сохраняем ссылку как user profile — тот же API, что
                 CheckoutDataModal читает через listMyUserProfiles.
                 Гость сохранить не может (401) — вместо этого кладём
                 товар в гостевую корзину, а ссылку он введёт в модалке
                 после входа. Не притворяемся, что сохранили. */
            let profileSaved = false;
            if (isAuthenticated) {
                try {
                    await upsertMyUserProfile({
                        profile_type: shape.profileType,
                        provider: shape.provider,
                        data: { [shape.fieldKey]: link },
                    });
                    profileSaved = true;
                } catch (profileErr) {
                    /* Товар положим, но честно предупредим: ссылку придётся
                       ввести заново в оформлении. */
                    pushToast({
                        type: "info",
                        message:
                            "Ссылку сохранить не удалось — введите её ещё раз при оформлении",
                    });
                }
            }

            /* 3. Кладём товар в корзину. Гость — в гостевую; после
                 входа CheckoutDataModal всё равно покажет поле под ссылку. */
            const qty = 1;
            if (isAuthenticated) {
                await addToCart({ productId: selected.id, quantity: qty });
            } else {
                addToGuestCart({ productId: selected.id, quantity: qty });
            }

            /* 4. В корзину. Дальше — стандартный путь: «Перейти к оплате»
                 → CheckoutDataModal → createOrderFromCart. Ничего нового
                 для подарочного сценария не требуется. */
            pushToast({
                type: "success",
                message: profileSaved
                    ? "Товар добавлен, ссылка сохранена — подтвердите в оформлении"
                    : "Товар добавлен — укажите ссылку при оформлении",
            });
            navigate("/basket");
        } catch (err) {
            pushToast({
                type: "error",
                message: getApiErrorMessage(err, "Не удалось оформить подарок"),
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <section className="mm-steam astra-liquid" aria-labelledby="mm-gift-h">
                <div className="mm-steam-info">
                    <span className="mm-steam-glyphwrap" aria-hidden="true">
                        <span className="mm-steam-plate" />
                        <span className="mm-steam-glyph">
                            <GiftGlyph />
                        </span>
                    </span>
                    <div className="mm-steam-copy">
                        <h3 id="mm-gift-h" className="astra-h mm-steam-title">
                            Подарок Steam
                        </h3>
                        <p className="mm-steam-sub">
                            Найдите игру или подписку и укажите ссылку на свой Steam —
                            подарок уйдёт прямо на аккаунт.
                        </p>
                    </div>
                </div>

                <form className="mm-steam-form" onSubmit={handleSubmit} noValidate>
                    <div className="mm-field">
                        <div className="mm-field-head">
                            <label className="mm-field-label" htmlFor={searchId} id={searchLabelId}>
                                Что подарить
                            </label>
                        </div>
                        <div className="mm-input">
                            <input
                                id={searchId}
                                className="mm-input-el"
                                type="search"
                                autoComplete="off"
                                placeholder="Введите название игры и регион"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                aria-labelledby={searchLabelId}
                            />
                        </div>

                        {/* Та же политика скелетонов, что у плиток каталога:
                            серое появляется, только если ответ реально
                            задержался, тихое ожидание высоту не резервирует,
                            а подмена идёт кросс-фейдом ПОВЕРХ приехавшего
                            списка, а не рывком. */}
                        <PendingSwap
                            loading={loading}
                            showSkeleton={showSkeleton}
                            skeleton={
                                <div className="mm-gift-skeletons" aria-hidden="true">
                                    <span className="astra-skeleton mm-gift-skel" />
                                    <span className="astra-skeleton mm-gift-skel" />
                                    <span className="astra-skeleton mm-gift-skel" />
                                </div>
                            }
                        >
                            {error ? (
                                <p className="mm-field-error" role="alert">{error}</p>
                            ) : products.length === 0 ? (
                                <p className="mm-field-hint">
                                    {debounced
                                        ? "Ничего не нашлось — попробуйте другое название."
                                        : "Игры подарком появятся здесь, как только их добавят в каталог."}
                                </p>
                            ) : (
                                <div
                                    className="mm-gift-products"
                                    role="radiogroup"
                                    aria-label="Доступные подарки"
                                >
                                    {products.map((p) => {
                                        const isActive = p.id === selectedId;
                                        const src = p.image_main
                                            ? normalizeMediaUrl(p.image_main)
                                            : null;
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                role="radio"
                                                aria-checked={isActive}
                                                className={`mm-gift-card${
                                                    isActive ? " is-active" : ""
                                                }`}
                                                onClick={() => setSelectedId(p.id)}
                                            >
                                                <span className="mm-gift-card-art">
                                                    {src ? (
                                                        <img src={src} alt="" loading="lazy" />
                                                    ) : (
                                                        <span
                                                            className="mm-gift-card-glyph"
                                                            aria-hidden="true"
                                                        >
                                                            <SteamGlyph />
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="mm-gift-card-body">
                                                    <span className="mm-gift-card-name text-none">
                                                        {p.name}
                                                    </span>
                                                    <span className="mm-gift-card-price">
                                                        {formatPrice(p.price)} ₽
                                                    </span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </PendingSwap>
                    </div>

                    <div className="mm-field">
                        <div className="mm-field-head">
                            <label className="mm-field-label" htmlFor={linkId}>
                                Ссылка на Steam
                            </label>
                            <button
                                type="button"
                                className="mm-microlink"
                                aria-haspopup="dialog"
                                aria-expanded={linkHelpOpen}
                                onClick={openLinkHelp}
                            >
                                <HelpIcon />
                                Как узнать?
                            </button>
                        </div>
                        <div className={`mm-input${linkError ? " has-error" : ""}`}>
                            <input
                                id={linkId}
                                ref={linkRef}
                                className="mm-input-el"
                                type="url"
                                autoComplete="off"
                                spellCheck={false}
                                placeholder="https://steamcommunity.com/id/username"
                                value={steamLink}
                                onChange={handleLinkChange}
                                aria-invalid={linkError ? true : undefined}
                                aria-describedby={linkError ? linkErrId : undefined}
                            />
                        </div>
                        {linkError && (
                            <p className="mm-field-error" id={linkErrId} role="alert">
                                {linkError}
                            </p>
                        )}
                        <p className="mm-field-hint">
                            Подойдёт ссылка на профиль, trade URL или короткая s.team/p/… — куда отправить подарок.
                        </p>
                    </div>

                    <div className="mm-steam-foot">
                        {/* Сумма — деньги, а не подпись: свой голос
                            (--astra-soft, Unbounded 700, на ступень крупнее
                            копии) и цифровые барабаны SlidingNumber, потому
                            что она меняется при смене выбранного товара. */}
                        <p className="mm-steam-note">
                            {selected ? (
                                <>
                                    К оплате{" "}
                                    <span className="mm-steam-total">
                                        <SlidingNumber
                                            value={`${formatPrice(selected.price)} ₽`}
                                        />
                                    </span>{" "}
                                    за «{selected.name}».
                                </>
                            ) : (
                                "Сначала выберите товар — потом укажите ссылку."
                            )}
                        </p>
                        <span className="astra-ring mm-steam-cta">
                            <button
                                type="submit"
                                className="astra-btn"
                                disabled={!selected || submitting}
                                aria-busy={submitting || undefined}
                            >
                                {submitting ? "Добавляем…" : "Добавить в корзину"}
                            </button>
                        </span>
                    </div>
                </form>
            </section>

            <section
                className="mm-rules astra-reveal"
                ref={rulesRef}
                aria-labelledby="mm-gift-rules-h"
            >
                <h3 id="mm-gift-rules-h" className="astra-h mm-rules-title">
                    Важная информация
                </h3>
                <ol className="mm-rules-list">
                    <li>
                        <strong>Ссылка на Steam:</strong> подойдёт публичный профиль
                        (<code>/id/…</code> или <code>/profiles/…</code>), trade URL либо
                        короткая <code>s.team/p/…</code>. Приватный профиль подарок не примет.
                    </li>
                    <li>
                        <strong>Друзья:</strong> добавьте нашего бота-отправителя в друзья —
                        ссылку выдадим после оформления.
                    </li>
                    <li>
                        <strong>Регион:</strong> если регион аккаунта отличается от региона
                        товара, гифт может не активироваться.
                    </li>
                </ol>
                <p className="mm-rules-foot">
                    Возникли вопросы — напишите в{" "}
                    <Link to="/support" className="mm-rules-link">
                        поддержку
                    </Link>
                    .
                </p>
            </section>

            <SteamLinkHelpModal isOpen={linkHelpOpen} onClose={closeLinkHelp} />
        </>
    );
};

export default SteamGift;
