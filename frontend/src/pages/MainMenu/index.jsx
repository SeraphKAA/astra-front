import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import "./main_menu.css";
import { getFirstCategory, getCategoryTree } from "../../entities/category/api/categoryApi";
import { getApiErrorMessage } from "../../shared/commonApi";
import { useQuickBuy } from "../../widgets/CategoryQuickBuy";
import CategoryTabs from "./CategoryTabs";
import { consumeIndividualOrderReturn } from "./IndividualOrder";
import RecommendedProducts from "./RecommendedProducts";
import EdgeBlur from "../../shared/fx/EdgeBlur";
import GlassLensDefs from "../../shared/fx/LiquidGlass";
import {
    useRevealOnce,
    useDelayedPending,
    prefersReducedMotion,
} from "../../shared/fx/motionUtils";
import Banners from "../../shared/ui/Banners/Banners";

/* ============================================================
   «Выбирают в ASTRA» — кураторские слоты по ключевым словам поверх
   живых L2-категорий. Порядок показа — владельческий список; матчинг
   идёт от самого специфичного, чтобы общий discord-тест не съел
   «Оформление Discord». Слот без живого совпадения — SYNTHETIC
   плитка «Скоро». Дублирование с тематическими вкладками — норма
   витрины: кураторство читается только порядком, без молний.
   ============================================================ */
/* match получает ИМЯ В НИЖНЕМ РЕГИСТРЕ (см. buildBuckets) — регистровых
   вариантов в этих регэкспах быть не должно. */
const FEATURED_SLOTS = [
    { key: "nitro", title: "Discord Nitro", match: (n) => /nitro/.test(n) || /discord/.test(n) },
    // { key: "decor", title: "Оформление Discord", match: (n) => /discord/.test(n) && /(оформлен|decor)/.test(n) },
    { key: "spotify", title: "Spotify", match: (n) => /spotify/.test(n) },
    { key: "gpt", title: "ChatGPT", match: (n) => /(chatgpt|gpt|openai)/.test(n) },
    { key: "fortnite", title: "Fortnite", match: (n) => /fortnite/.test(n) },
    { key: "valorant", title: "Valorant", match: (n) => /valorant/.test(n) },
    // { key: "telegram", title: "Telegram Premium", match: (n) => /(telegram|телеграм)/.test(n) },
    { key: "claude", title: "Claude", match: (n) => /claude/.test(n) },
    // { key: "steam", title: "Steam", match: (n) => /(steam|стим)/.test(n) },
];
const FEATURED_MATCH_ORDER = ["nitro", "spotify", "gpt", "fortnite", "valorant", "claude"];

const GIFT_RE = /карт|gift|подароч|itunes|псн|psn|номинал/i;
const MOBILE_RE = /pubg|mobile|brawl|clash|standoff|genshin|honkai|free ?fire|легенд/i;
const PC_RE = /ключ|playstation|ps ?plus|xbox|epic|ea |game ?pass/i;
const GAME_PARENTS = new Set(["games", "game_currency", "services"]);

const nameOf = (t) => String(t?.name || "");

const statusRank = (s) => (s === "soon" ? 1 : 0);

const scriptRank = (name) => {
    const ch = String(name || "").trim().charAt(0).toLowerCase();
    if (ch >= "a" && ch <= "z") return 0;
    if ((ch >= "а" && ch <= "я") || ch === "ё") return 1;
    return 2; // цифры, символы — в хвост
};

const compareCategories = (a, b) => {
    const byStatus = statusRank(a?.status) - statusRank(b?.status);
    if (byStatus !== 0) return byStatus;

    const byScript = scriptRank(a?.name) - scriptRank(b?.name);
    if (byScript !== 0) return byScript;

    return String(a?.name || "").localeCompare(String(b?.name || ""), "ru", {
        sensitivity: "base",
        numeric: true,
    });
};

/* Корзины вкладок: каждая живая L2 попадает ровно в одну тематическую
   вкладку (по родителю или регэкспу) — недостижимых категорий нет.
   Отдельной steam-корзины больше нет: вкладка «Пополнение Steam» — это
   форма и правила, без плиток, поэтому Steam-категории («Ключи Steam»,
   «Пополнение Steam») идут своим тематическим путём в «Игры» и остаются
   доступными. Подарочные карты забираются из общего пула первыми, чтобы
   не дублироваться; витрина «Выбирают в ASTRA» матчится по ПОЛНОМУ
   списку (дублирование — ок). */
const buildBuckets = (all) => {
    const usedBySlots = new Set();
    const bySlot = new Map();
    FEATURED_MATCH_ORDER.forEach((slotKey) => {
        const slot = FEATURED_SLOTS.find((s) => s.key === slotKey);
        const hit = all.find(
            (t) => !usedBySlots.has(t.id) && slot.match(nameOf(t).toLowerCase())
        );
        if (hit) {
            usedBySlots.add(hit.id);
            bySlot.set(slotKey, hit);
        }
    });
    const featured = FEATURED_SLOTS.map((slot) => ({
        slot,
        category: bySlot.get(slot.key) || null,
    }));

    let pool = [...all];
    const take = (test) => {
        const hits = pool.filter(test);
        const ids = new Set(hits.map((h) => h.id));
        pool = pool.filter((t) => !ids.has(t.id));
        return hits;
    };

    take((t) => t.parentName === "steam_gift");

    const gift = take((t) => GIFT_RE.test(nameOf(t)));
    const subs = take((t) => t.parentName === "subscriptions");
    const ai = take((t) => t.parentName === "neural_networks");
    const games = take(
        (t) =>
            GAME_PARENTS.has(t.parentName) ||
            MOBILE_RE.test(nameOf(t)) ||
            PC_RE.test(nameOf(t))
    );

    return {
        featured,
        games: [...games, ...pool],
        subs,
        ai,
        gift,
    };
};

/* Совместимость старых якорей: #sec-… из шапки/закладок выбирает
   ближайшую вкладку; #sec-recommended скроллит к товарам. */
const HASH_TO_TAB = {
    "sec-featured": "featured",
    "sec-social": "subs",
    "sec-music": "subs",
    "sec-mobile": "games",
    "sec-pc": "games",
    "sec-currency": "games",
    "sec-other": "games",
    "sec-ai": "ai",
    "sec-gift": "gift",
    "sec-steam-gift": "steam_gift",
    "sec-gift-steam": "steam_gift",  // на случай, если где-то уже была такая
    "sec-steam": "steam",
    "sec-individual": "individual",
};

const MainMenu = () => {
    const { openCategory, openProduct, modal, pendingCategoryId, pendingProductId } =
        useQuickBuy();
    const [allL2, setAllL2] = useState([]);
    const [catLoading, setCatLoading] = useState(true);
    const [catError, setCatError] = useState("");
    const [retryKey, setRetryKey] = useState(0);
    const [activeTab, setActiveTab] = useState(() => consumeIndividualOrderReturn() ? "individual" : "featured");
    /* Скелетон плиток — только если каталог реально задержался. Быстрый
       (или уже закэшированный) ответ показывает плитки сразу, без серой
       вспышки: скелетон здесь сигнал «данные задерживаются», а не этап. */
    const showCatSkeleton = useDelayedPending(catLoading);
    const headRef = useRevealOnce();

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setCatLoading(true);
            setCatError("");
            try {
                const root = await getFirstCategory();
                const l1 = (root?.children || []).filter(
                    (c) =>
                        c?.name &&
                        String(c.name).toLowerCase() !== "all" &&
                        c?.status !== "hidden"
                );
                const trees = await Promise.all(
                    l1.map((c) => getCategoryTree(c.id).catch(() => null))
                );
                const flat = [];
                trees.forEach((node, i) => {
                    const kids = Array.isArray(node?.children) ? node.children : [];
                    const parentName = String(l1[i]?.name || "").toLowerCase();
                    kids.forEach((kid) => {
                        if (kid?.status === "hidden") return;
                        flat.push({ ...kid, parentName });
                    });
                });
                flat.sort(compareCategories);
                if (!cancelled) setAllL2(flat);
            } catch (e) {
                if (!cancelled) {
                    setCatError(getApiErrorMessage(e, "Не удалось загрузить каталог"));
                }
            } finally {
                if (!cancelled) setCatLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [retryKey]);

    const buckets = useMemo(() => buildBuckets(allL2), [allL2]);

    /* Якорная совместимость: React Router не скроллит к hash сам. */
    const location = useLocation();
    useEffect(() => {
        const hash = (location.hash || "").replace("#", "");
        if (!hash) return undefined;
        const scrollToId = (id) => {
            const el = document.getElementById(id);
            if (!el) return undefined;
            const behavior = prefersReducedMotion() ? "auto" : "smooth";
            const raf = requestAnimationFrame(() => {
                el.scrollIntoView({ behavior, block: "start" });
            });
            return () => cancelAnimationFrame(raf);
        };
        if (hash === "sec-recommended") return scrollToId("sec-recommended");
        const tab = HASH_TO_TAB[hash];
        if (!tab) return undefined;
        setActiveTab(tab);
        return scrollToId("sec-featured");
    }, [location.hash]);

    return (
        <div className="main-menu mm-root">
            {/* SVG-defs линзы liquid-glass — один раз на страницу */}
            <GlassLensDefs />

            <div className="mm-page">
                <section id="sec-featured" className="mm-section" aria-labelledby="mm-cats-h">
                    <Banners onSelect={setActiveTab} />
                    <div className="mm-head astra-reveal" ref={headRef}>
                        <h2 id="mm-cats-h" className="astra-h mm-h">Категории</h2>
                    </div>

                    <CategoryTabs
                        active={activeTab}
                        onSelect={setActiveTab}
                        buckets={buckets}
                        loading={catLoading}
                        showSkeleton={showCatSkeleton}
                        error={catError}
                        onRetry={() => setRetryKey((k) => k + 1)}
                        catalogEmpty={!catLoading && !catError && allL2.length === 0}
                        openCategory={openCategory}
                        pendingCategoryId={pendingCategoryId}
                    />
                </section>

                <RecommendedProducts
                    onOpenProduct={openProduct}
                    pendingProductId={pendingProductId}
                />
            </div>

            <EdgeBlur />

            {modal}
        </div>
    );
};

export default MainMenu;
