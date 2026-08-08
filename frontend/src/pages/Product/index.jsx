import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./product.css";
import { getProductById } from "../../entities/product/api/productApi";
import { addToCart } from "../../entities/cart/api/cartApi";
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import { getCategoryFaqByCategoryId } from "../../entities/faq/api/faqApi";
import { normalizeMediaUrl } from "../../shared/commonApi";

const formatMoney = (n) => {
    const num = Number(n || 0);
    return new Intl.NumberFormat("ru-RU").format(num);
};

const Product = () => {
    const { id } = useParams();
    const { pushToast } = useToast();
    const [product, setProduct] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [faq, setFaq] = useState(null);
    const [additionalInfo, setAdditionalInfo] = useState(null);

    useEffect(() => {
        const loadProduct = async () => {
            setIsLoading(true);
            try {
                const data = await getProductById(id);
                setProduct(data);
            } catch (e) {
                pushToast({ type: "error", message: e?.message || "Не удалось загрузить товар" });
                
            } finally {
                setIsLoading(false);
            }
        };
        if (id) {
            loadProduct();
        }
    }, [id]);

    useEffect(() => {
        const loadCategoryContent = async () => {
            const categoryId = product?.category_id;
            if (!categoryId) {
                setFaq(null);
                setAdditionalInfo(null);
                return;
            }
            try {
                const data = await getCategoryFaqByCategoryId(categoryId);
                setFaq(data?.faq || null);
                setAdditionalInfo(data?.additional_info || null);
            } catch {
                setFaq(null);
                setAdditionalInfo(null);
            }
        };
        loadCategoryContent();
    }, [product?.category_id]);

    const onAddToCart = async () => {
        try {
            if (!product?.id) {
                throw new Error("Товар не найден");
            }
            await addToCart({ productId: product.id, quantity: 1 });
            pushToast({ type: "success", message: "Товар добавлен в корзину" });
        } catch (e) {
            const msg = e?.message || "Не удалось добавить товар в корзину";
            pushToast({ type: "error", message: msg });
        }
    };

    if (isLoading) {
        return <div className="product-page product-loading">Загрузка товара...</div>;
    }

    return (
        <div className="product-page">
            <div className="product-container">
                {additionalInfo?.info ? (
                    <div className="product-additional-info">{additionalInfo.info}</div>
                ) : null}

                <div className="product-card">
                    <div className="product-cover-wrap">
                        {product?.image_url ? (
                            <img
                                src={normalizeMediaUrl(product.image_url)}
                                alt={product.name}
                                className="product-cover"
                            />
                        ) : (
                            <div className="product-cover-placeholder">Нет изображения</div>
                        )}
                    </div>
                    <div className="product-meta">
                        <h1>{product?.name || "Товар"}</h1>
                        <div className="product-title-divider" aria-hidden />
                        {product?.is_active === false && (
                            <p className="product_inactive_label">Товар не активен</p>
                        )}
                        <p className="product-description">{product?.description || "Описание отсутствует."}</p>
                        <div className="product-purchase">
                            <div className="product-price-wrap">
                                <span className="product-price-label">Цена</span>
                                <div>
                                    <span className="product-price">{formatMoney(product?.price)}</span>
                                    <span className="product-price-currency"> ₽</span>
                                </div>
                            </div>
                            <button type="button" className="product-add-btn" onClick={onAddToCart}>
                                Добавить в корзину
                            </button>
                        </div>
                    </div>
                </div>

                {faq?.faq && Object.keys(faq.faq || {}).length > 0 && (
                    <div className="product-faq">
                        <h2 className="product-faq-title">Вопросы и ответы</h2>
                        <div className="product-faq-list">
                            {Object.entries(faq.faq).map(([q, a]) => (
                                <div className="product-faq-item" key={q}>
                                    <div className="product-faq-q">{q}</div>
                                    <div className="product-faq-a">{a}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Product;