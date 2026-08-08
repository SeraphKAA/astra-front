import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./main_menu.css";
import { BaseProduct } from "../../entities/product/ui/baseProduct";
import BaseCategory from "../../entities/category/ui/baseCategory";
import { getProductsMiniList } from "../../entities/product/api/productApi";
import { getFirstCategory, getCategoryTree } from "../../entities/category/api/categoryApi";
import mainPhoto from "../../shared/mainPhoto.png";
import { CrownIcon } from "../../shared/svgIcons";
import { getCategoryDisplayName } from "../../entities/product/mainCategoryLabels";
import { useInfiniteScroll } from "../../shared/hooks/useInfiniteScroll";

const PAGE_SIZE = 20;

const MainMenu = () => {
    const navigate = useNavigate();
    const [level1, setLevel1] = useState([]);
    const [activeL1, setActiveL1] = useState(null);
    const [level2, setLevel2] = useState([]);

    const fetchProductsPage = useCallback(
        ({ page, size }) =>
            getProductsMiniList({ page, size }).then((data) => ({
                items: data?.products ?? [],
                pages: data?.pages ?? 1,
            })),
        []
    );

    const {
        items: products,
        loading: productsLoading,
        loadingMore,
        error: productsError,
        hasMore,
        sentinelRef,
    } = useInfiniteScroll({
        fetchPage: fetchProductsPage,
        pageSize: PAGE_SIZE,
        resetKey: "main-menu",
    });

    useEffect(() => {
        const fetchData = async () => {
            const dataCategory = await getFirstCategory();
            const l1 = (dataCategory?.children || []).filter(
                (c) => c?.name && String(c.name).toLowerCase() !== "all"
            );
            setLevel1(l1);
        };

        fetchData();
    }, []);

    useEffect(() => {
        if (!level1.length) {
            setActiveL1(null);
            return;
        }
        setActiveL1((prev) => {
            if (prev && level1.some((c) => c.id === prev.id)) return prev;
            return level1[0];
        });
    }, [level1]);

    useEffect(() => {
        if (!activeL1?.id) {
            setLevel2([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const node = await getCategoryTree(activeL1.id);
                if (!cancelled) {
                    setLevel2(Array.isArray(node?.children) ? node.children : []);
                }
            } catch (e) {
                if (!cancelled) setLevel2([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeL1]);

    return (
        <>
            <div className="main-menu">
                <div className="content main-menu-content">
                    <button
                        type="button"
                        className="mainPhoto-banner"
                        onClick={() => navigate("/steam-refill")}
                        aria-label="Пополнить Steam"
                    >
                        <img
                            src={mainPhoto}
                            alt=""
                            className="mainPhoto"
                            draggable={false}
                        />
                        <span className="mainPhoto-banner-cta" aria-hidden="true">
                            Пополнить Steam
                            <span className="mainPhoto-banner-arrow">→</span>
                        </span>
                    </button>

                    <div className="mainmenu-section-title">Категории</div>

                    {level1.length > 1 && (
                        <div className="mainmenu-l1-tabs" role="tablist" aria-label="Уровень категорий">
                            {level1.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    className={`mainmenu-l1-tab ${activeL1?.id === c.id ? "is-active" : ""}`}
                                    onClick={() => setActiveL1(c)}
                                >
                                    {getCategoryDisplayName(c.name)}
                                </button>
                            ))}
                        </div>
                    )}

                    {level2.length > 0 && (
                        <>
                            <div className="mainmenu-section-title mainmenu-subtitle">Подкатегории</div>
                            <div className="cont-items mainmenu-l2">
                                {level2.map((category) => (
                                    <BaseCategory key={category.id} category={category} />
                                ))}
                            </div>
                        </>
                    )}

                    <div className="divider-mainmenu" />

                    <div>
                        <h3>
                            <CrownIcon /> Популярные товары
                        </h3>
                    </div>
                    <div className="cont-items mainmenu-products">
                        {productsLoading && products.length === 0 ? (
                            <p>Загрузка…</p>
                        ) : productsError ? (
                            <p>{productsError}</p>
                        ) : products.length > 0 ? (
                            products.map((product) => <BaseProduct key={product.id} product={product} />)
                        ) : (
                            <p>Товары не найдены</p>
                        )}
                    </div>
                    {hasMore && (
                        <div ref={sentinelRef} className="mainmenu-scroll-sentinel" aria-hidden="true">
                            {loadingMore ? "Загрузка…" : ""}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default MainMenu;
