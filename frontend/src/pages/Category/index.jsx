import React, { useCallback, useEffect, useState } from "react";
import { NavLink, useParams } from "react-router-dom";

import "./category.css";
import { getCategoryTree } from "../../entities/category/api/categoryApi";
import { getProductsByCategory } from "../../entities/product/api/productApi";
import { normalizeMediaUrl } from "../../shared/commonApi";
import { getCategoryDisplayName } from "../../entities/product/mainCategoryLabels";
import { useInfiniteScroll } from "../../shared/hooks/useInfiniteScroll";

const PAGE_SIZE = 20;

const CategoryPage = () => {
  const { categoryId } = useParams();
  const [category, setCategory] = useState(null);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryError, setCategoryError] = useState("");

  const fetchProductsPage = useCallback(
    ({ page, size }) =>
      getProductsByCategory(categoryId, { page, size }).then((data) => ({
        items: data?.products ?? [],
        pages: data?.pages ?? 1,
      })),
    [categoryId]
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
    resetKey: categoryId,
  });

  useEffect(() => {
    const loadCategory = async () => {
      if (!categoryId) return;
      setCategoryLoading(true);
      setCategoryError("");
      try {
        const categoryData = await getCategoryTree(categoryId);
        setCategory(categoryData);
      } catch (e) {
        setCategoryError(e?.message || "Не удалось загрузить категорию");
      } finally {
        setCategoryLoading(false);
      }
    };

    loadCategory();
  }, [categoryId]);

  if (categoryLoading) {
    return <div className="category-page category-loading">Загрузка категории...</div>;
  }

  const error = categoryError || productsError;

  const categoryTitle = category?.name ? getCategoryDisplayName(category.name) : "Категория";
  const productsCount = products.length;

  return (
    <div className="category-page">
      <div className="category-container">
        <header className="category-hero">
          <h1 className="category-title">{categoryTitle}</h1>
          <div className="category-title-divider" aria-hidden />
        </header>

        {error && <div className="category-error">{error}</div>}

        {Array.isArray(category?.children) && category.children.length > 0 && (
          <>
            <p className="category-section-label">Подкатегории</p>
            <div className="category-children">
              {category.children.map((child) => (
                <NavLink key={child.id} to={`/category/${child.id}`} className="category-chip">
                  {getCategoryDisplayName(child.name)}
                </NavLink>
              ))}
            </div>
          </>
        )}

        <p className="category-section-label">Товары</p>
        <div className="category-products">
          {productsLoading && products.length === 0 ? (
            <div className="category-loading">Загрузка товаров…</div>
          ) : products.length > 0 ? (
            products.map((product) => (
              <NavLink key={product.id} to={`/product/${product.id}`} className="category-product-card">
                <div className="category-product-image-wrap">
                  {product.image_url ? (
                    <img src={normalizeMediaUrl(product.image_url)} alt={product.name} loading="lazy" />
                  ) : (
                    <div className="category-product-image-placeholder">Нет фото</div>
                  )}
                </div>
                <div className="category-product-body">
                  <div className="category-product-name">{product.name}</div>
                  <div className="category-product-footer">
                    <div className="category-product-price">{product.price} ₽</div>
                    <span className="category-product-cta">Смотреть</span>
                  </div>
                </div>
              </NavLink>
            ))
          ) : (
            <div className="category-empty">В этой категории пока нет товаров.</div>
          )}
        </div>
        {hasMore && (
          <div ref={sentinelRef} className="category-scroll-sentinel" aria-hidden="true">
            {loadingMore ? "Загрузка…" : ""}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryPage;
