import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Button } from "../../shared/ui/Button/Button";
import { Modal } from "../../shared/ui/Modal/Modal";
import { Input } from "../../shared/ui/Input/Input";
import { Pagination } from "../../shared/ui/Pagination/Pagination";
import { useToast } from "../../shared/ui/Toast/ToastProvider";
import {
    createProduct,
    deleteProduct,
    duplicateProductSettings,
    getProductsMiniList,
    getProductById,
    updateProduct,
    importProductsFromFile,
} from "../../entities/product/api/productApi";
import { getAllCategories } from "../../entities/category/api/categoryApi";
import {
    changeMainProductImage,
    deleteProductImage,
    getProductImages,
    uploadProductImage,
} from "../../entities/files/api/fileApi";
import { normalizeMediaUrl, getApiErrorMessage } from "../../shared/commonApi";
import { CheckoutFieldsEditor, sanitizeCheckoutFields } from "../../shared/ui/CheckoutFieldsEditor/CheckoutFieldsEditor";
import {
    getMainCategoryLabel,
    MAIN_CATEGORY_LABELS,
    MAIN_CATEGORY_OPTIONS,
} from "../../entities/product/mainCategoryLabels";
import {
    DESSLYHUB_TEMPLATES,
    DESSLYHUB_TEMPLATE_OPTIONS,
} from "../../entities/product/desslyhubTemplates";
import { DuplicateIcon, CameraIcon, PencilIcon, TrashIcon } from "../../shared/svgIcons";
import { DuplicateSettingsModal } from "../../shared/ui/DuplicateSettingsModal/DuplicateSettingsModal";
import styles from './admin.module.css';

const PRODUCT_DUPLICATE_FIELDS = [
    { key: "image", label: "Главное фото" },
    { key: "images_all", label: "Все фото" },
    { key: "description", label: "Описание" },
    { key: "category_id", label: "Категория" },
    { key: "price", label: "Цена" },
    { key: "platform", label: "Платформа" },
    { key: "delivery_type", label: "Тип выдачи" },
    { key: "is_auto_delivery", label: "Автовыдача" },
    { key: "is_active", label: "Статус активности" },
    { key: "popularity", label: "Популярность" },
    { key: "quantity", label: "Остаток" },
    { key: "fulfillment_provider", label: "Провайдер" },
    { key: "provider_service", label: "Сервис провайдера" },
    { key: "provider_params", label: "Параметры провайдера" },
    { key: "checkout_requirements", label: "Checkout requirements" },
    { key: "extra_checkout_fields", label: "Доп. поля заказа" },
    { key: "price_markup_percent", label: "Процент комиссии" },
];

const DEFAULT_PAGE_SIZE = 20;

export const ProductsPage = () => {
    const { pushToast } = useToast();
    const importFileRef = useRef(null);
    const [importBusy, setImportBusy] = useState(false);
    const [importSummary, setImportSummary] = useState(null);
    const [products, setProducts] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);
    const [filterText, setFilterText] = useState("");
    const [filterDebounced, setFilterDebounced] = useState("");
    const [filterMainCategory, setFilterMainCategory] = useState("all");
    const [filterActive, setFilterActive] = useState("all");
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const initialFormData = {
        name: "",
        description: "",
        price: "",
        category_id: "",
        main_category: "all",
        platform: "pc",
        delivery_type: "code",
        is_auto_delivery: false,
        is_active: true,
        popularity: 0,
        extra_checkout_fields: [],
        fulfillment_provider: "none",
        provider_service: "",
        provider_params_json: "",
        checkout_requirements_json: "",
    };
    const [formData, setFormData] = useState(initialFormData);
    const [categories, setCategories] = useState([]);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState("");
    const [productImages, setProductImages] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
    const [duplicateSource, setDuplicateSource] = useState(null);
    const [duplicateTargets, setDuplicateTargets] = useState([]);
    const [duplicateBusy, setDuplicateBusy] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setFilterDebounced(filterText.trim()), 350);
        return () => clearTimeout(t);
    }, [filterText]);

    useEffect(() => {
        setPage(1);
    }, [filterDebounced, filterMainCategory, filterActive, pageSize]);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getProductsMiniList({
                page,
                size: pageSize,
                search: filterDebounced || undefined,
                main_category: filterMainCategory !== "all" ? filterMainCategory : undefined,
                is_active: filterActive !== "all" ? filterActive : undefined,
            });
            const list = Array.isArray(data?.products) ? data.products : [];
            const nextTotal = data?.total ?? list.length;
            const nextPages = data?.pages ?? 1;
            setProducts(list);
            setTotal(nextTotal);
            setPages(nextPages);
            if (page > nextPages && nextPages >= 1) {
                setPage(nextPages);
            }
        } catch (error) {
            // console.error('Error fetching products:', error);
            setProducts([]);
            setTotal(0);
            setPages(1);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, filterDebounced, filterMainCategory, filterActive]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const tree = await getAllCategories();
            const flattened = [];
            const walk = (nodes = [], level = 0, firstParent = null) => {
                nodes.forEach((node) => {
                    const topParentId = level === 1 ? node.id : firstParent;
                    flattened.push({ ...node, level, topParentId });
                    if (Array.isArray(node.children) && node.children.length > 0) {
                        walk(node.children, level + 1, topParentId);
                    }
                });
            };
            walk(Array.isArray(tree) ? tree : [tree], 0, null);
            setCategories(flattened);
        } catch (error) {
            // console.error('Error fetching categories:', error);
            setCategories([]);
        }
    };

    const categoryOptions = useMemo(() => {
        return categories.filter((cat) => cat.level > 1).map((cat) => {
            const prefix = cat.level === 2 ? "— " : "";
            return {
                id: cat.id,
                label: `${prefix}${cat.name}`,
                topParentId: cat.level === 1 ? cat.id : cat.topParentId,
            };
        });
    }, [categories]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");
        try {
            let providerParams = null;
            let checkoutReq = null;

            const providerParamsRaw = (formData.provider_params_json || "").trim();
            if (providerParamsRaw) {
                try {
                    providerParams = JSON.parse(providerParamsRaw);
                } catch {
                    throw new Error("provider_params: некорректный JSON");
                }
            }

            const checkoutReqRaw = (formData.checkout_requirements_json || "").trim();
            if (checkoutReqRaw) {
                try {
                    checkoutReq = JSON.parse(checkoutReqRaw);
                } catch {
                    throw new Error("checkout_requirements: некорректный JSON");
                }
            }

            const payload = {
                ...formData,
                price: Number(formData.price),
                popularity: Math.max(0, Number(formData.popularity) || 0),
                category_id: Number(formData.category_id),
                fulfillment_provider: formData.fulfillment_provider || "none",
                provider_service: (formData.provider_service || "").trim() || null,
                provider_params: providerParams,
                checkout_requirements: checkoutReq,
                extra_checkout_fields: sanitizeCheckoutFields(formData.extra_checkout_fields),
            };
            delete payload.provider_params_json;
            delete payload.checkout_requirements_json;
            if (editingProduct) {
                await updateProduct(editingProduct.id, payload);
            } else {
                await createProduct(payload);
            }
            fetchProducts();
            setModalOpen(false);
            resetForm();
        } catch (error) {
            // console.error('Error saving product:', error);
            setError(error?.message || "Не удалось сохранить товар");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Вы уверены, что хотите удалить этот товар?')) {
            try {
                await deleteProduct(id);
                fetchProducts();
            } catch (error) {
                // console.error('Error deleting product:', error);
            }
        }
    };

    const handleImageUpload = async (e) => {
        e.preventDefault();
        if (!imageFile || !selectedProduct) return;

        const formData = new FormData();
        formData.append('file', imageFile);

        try {
            await uploadProductImage(selectedProduct.id, imageFile, productImages.length === 0);
            const images = await getProductImages(selectedProduct.id);
            setProductImages(images || []);
            fetchProducts();
            setImageFile(null);
            setImagePreview('');
        } catch (error) {
            // console.error('Error uploading image:', error);
        }
    };

    const handleDeleteImage = async (productId, imageId) => {
        if (window.confirm('Удалить изображение?')) {
            try {
                await deleteProductImage(imageId);
                const images = await getProductImages(productId);
                setProductImages(images || []);
                fetchProducts();
            } catch (error) {
                // console.error('Error deleting image:', error);
            }
        }
    };

    const resetForm = () => {
        setEditingProduct(null);
        setFormData(initialFormData);
    };

    const handleImportProductsFile = async (e) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        setImportBusy(true);
        setImportSummary(null);
        try {
            const res = await importProductsFromFile(file);
            setImportSummary(res);
            const failed = Number(res?.failed || 0);
            const created = Number(res?.created || 0);
            pushToast({
                type: failed > 0 ? "info" : "success",
                message: `Импорт завершён: создано ${created}, с ошибками ${failed}`,
            });
            await fetchProducts();
        } catch (err) {
            pushToast({ type: "error", message: err?.message || "Не удалось импортировать товары" });
        } finally {
            setImportBusy(false);
            if (e?.target) e.target.value = "";
        }
    };

    const openDuplicateModal = async (product) => {
        setDuplicateSource(product);
        setDuplicateModalOpen(true);
        try {
            const data = await getProductsMiniList({ page: 1, size: 100 });
            const list = Array.isArray(data?.products) ? data.products : [];
            setDuplicateTargets(
                list
                    .filter((item) => item.id !== product.id)
                    .map((item) => ({
                        id: item.id,
                        label: item.name,
                        depth: 0,
                    }))
            );
        } catch {
            setDuplicateTargets([]);
            pushToast({ type: "error", message: "Не удалось загрузить список товаров" });
        }
    };

    const closeDuplicateModal = () => {
        if (duplicateBusy) return;
        setDuplicateModalOpen(false);
        setDuplicateSource(null);
        setDuplicateTargets([]);
    };

    const onDuplicateProductSettings = async ({ targetIds, options }) => {
        if (!duplicateSource?.id) return null;
        setDuplicateBusy(true);
        try {
            const result = await duplicateProductSettings(duplicateSource.id, {
                target_product_ids: targetIds,
                options,
            });
            const ok = result?.results?.filter((r) => r.ok).length || 0;
            const failed = (result?.results?.length || 0) - ok;
            if (result?.warnings?.length) {
                pushToast({
                    type: "info",
                    message: result.warnings.join(". "),
                });
            }
            pushToast({
                type: failed > 0 ? "info" : "success",
                message: `Скопировано в ${ok} товаров${failed > 0 ? `, ошибок: ${failed}` : ""}`,
            });
            await fetchProducts();
            return result;
        } catch (err) {
            pushToast({
                type: "error",
                message: getApiErrorMessage(err, "Не удалось скопировать настройки"),
            });
            return null;
        } finally {
            setDuplicateBusy(false);
        }
    };

    const openEditModal = async (product) => {
        setError("");
        setEditingProduct(product);
        // Mini DTO doesn't include provider fields; load full product
        try {
            const full = await getProductById(product.id);
            setFormData({
                name: full.name,
                description: full.description || "",
                price: full.price,
                category_id: full.category_id,
                main_category: full.main_category || "games",
                platform: full.platform || "pc",
                delivery_type: full.delivery_type || "code",
                is_auto_delivery: Boolean(full.is_auto_delivery),
                is_active: Boolean(full.is_active),
                popularity: full.popularity ?? 0,
                fulfillment_provider: full.fulfillment_provider || "none",
                provider_service: full.provider_service || "",
                provider_params_json: full.provider_params ? JSON.stringify(full.provider_params, null, 2) : "",
                checkout_requirements_json: full.checkout_requirements ? JSON.stringify(full.checkout_requirements, null, 2) : "",
                extra_checkout_fields: Array.isArray(full.extra_checkout_fields) ? full.extra_checkout_fields : [],
            });
        } catch (e) {
            // Fallback to minimal fields if fetch failed
            setFormData({
                ...initialFormData,
                name: product.name,
                description: product.description || "",
                price: product.price,
                category_id: product.category_id,
                main_category: product.main_category || "games",
                platform: product.platform || "pc",
                delivery_type: product.delivery_type || "code",
                is_auto_delivery: Boolean(product.is_auto_delivery),
                is_active: Boolean(product.is_active),
                popularity: product.popularity ?? 0,
                extra_checkout_fields: [],
            });
            setError(e?.message || "Не удалось загрузить детали товара");
        }
        setModalOpen(true);
    };

    const openImageModal = async (product) => {
        setSelectedProduct(product);
        try {
            const images = await getProductImages(product.id);
            setProductImages(images || []);
        } catch (e) {
            setProductImages([]);
        }
        setImageModalOpen(true);
    };

    if (loading && products.length === 0) {
        return <div className={styles.loading}>Загрузка...</div>;
    }

    return (
        <div>
            <div className={styles.adminHeader}>
                <h1 className={styles.pageTitle}>Товары</h1>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                        ref={importFileRef}
                        type="file"
                        accept=".json,.xlsx,application/json"
                        style={{ display: "none" }}
                        onChange={handleImportProductsFile}
                    />
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={importBusy}
                        onClick={() => importFileRef.current?.click()}
                    >
                        {importBusy ? "Импорт…" : "Импорт из файла"}
                    </Button>
                    <Button onClick={() => setModalOpen(true)}>+ Добавить товар</Button>
                </div>
            </div>

            {importSummary && (
                <div
                    className={styles.formGroup}
                    style={{
                        marginBottom: 12,
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid rgba(226, 121, 155, 0.35)",
                        background: "rgba(18, 18, 18, 0.55)",
                        color: "#f2f2f2",
                        fontSize: 14,
                    }}
                >
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Результат импорта</div>
                    <div>Создано: {importSummary.created ?? 0}, ошибок: {importSummary.failed ?? 0}</div>
                    {Array.isArray(importSummary.items) && importSummary.failed > 0 && (
                        <ul style={{ margin: "8px 0 0", paddingLeft: 18, maxHeight: 180, overflow: "auto" }}>
                            {importSummary.items
                                .filter((it) => !it?.ok)
                                .slice(0, 30)
                                .map((it) => (
                                    <li key={`${it.index}-${it.sheet_row ?? "r"}`}>
                                        {it.sheet_row != null ? `Строка ${it.sheet_row}: ` : `#${it.index + 1}: `}
                                        {it.error || "ошибка"}
                                    </li>
                                ))}
                        </ul>
                    )}
                </div>
            )}

            <div className={styles.formGroup} style={{ marginBottom: 12 }}>
                <Input
                    placeholder="Поиск (id, название, категория, платформа...)"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <select
                        className={styles.formSelect}
                        value={filterMainCategory}
                        onChange={(e) => setFilterMainCategory(e.target.value)}
                        style={{ maxWidth: 240 }}
                    >
                        <option value="all">{MAIN_CATEGORY_LABELS.all}</option>
                        {MAIN_CATEGORY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <select
                        className={styles.formSelect}
                        value={filterActive}
                        onChange={(e) => setFilterActive(e.target.value)}
                        style={{ maxWidth: 240 }}
                    >
                        <option value="all">Любой статус</option>
                        <option value="active">Активные</option>
                        <option value="inactive">Неактивные</option>
                    </select>
                    <button type="button" className={styles.adminButtonSecondary} onClick={fetchProducts} disabled={loading}>
                        Обновить
                    </button>
                </div>
            </div>

            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Изображение</th>
                            <th>Название</th>
                            <th>Цена</th>
                            <th>Популярность</th>
                            <th>Категория</th>
                            <th>Раздел</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.length > 0 ? (
                            products.map((product) => (
                                <tr key={product.id}>
                                    <td>{product.id}</td>
                                    <td>
                                        {product.image_url && (
                                            <img
                                                src={normalizeMediaUrl(product.image_url)}
                                                alt={product.name}
                                                className={styles.productImage}
                                            />
                                        )}
                                        {!product.image_url && (
                                            <div className={styles.productImagePlaceholder}>
                                                📦
                                            </div>
                                        )}
                                    </td>
                                    <td>{product.name}</td>
                                    <td>{product.price} ₽</td>
                                    <td>{product.popularity ?? 0}</td>
                                    <td>{product.category_id}</td>
                                    <td>{getMainCategoryLabel(product.main_category)}</td>
                                    <td>
                                        <span className={`${styles.badge} ${product.is_active ? styles.active : styles.inactive}`}>
                                            {product.is_active ? 'Активен' : 'Неактивен'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className={styles.actionButtons}>
                                            <button
                                                type="button"
                                                className={`${styles.iconButton} ${styles.iconButtonDuplicate}`}
                                                onClick={() => openDuplicateModal(product)}
                                                title="Копировать настройки в другие товары"
                                                aria-label="Копировать настройки"
                                            >
                                                <DuplicateIcon className={styles.adminActionIcon} />
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.iconButton} ${styles.iconButtonImage}`}
                                                onClick={() => openImageModal(product)}
                                                title="Управление изображением"
                                                aria-label="Изображение"
                                            >
                                                <CameraIcon className={styles.adminActionIcon} />
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.iconButton} ${styles.iconButtonEdit}`}
                                                onClick={() => openEditModal(product)}
                                                title="Редактировать"
                                                aria-label="Редактировать"
                                            >
                                                <PencilIcon className={styles.adminActionIcon} />
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.iconButton} ${styles.iconButtonDelete}`}
                                                onClick={() => handleDelete(product.id)}
                                                title="Удалить"
                                                aria-label="Удалить"
                                            >
                                                <TrashIcon className={styles.adminActionIcon} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                                    Товары не найдены
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination
                page={page}
                pages={pages}
                total={total}
                pageSize={pageSize}
                loading={loading}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 20, 50, 100]}
            />

            {/* Product Modal */}
            <Modal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); resetForm(); }}
                title={editingProduct ? 'Редактировать товар' : 'Добавить товар'}
            >
                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Название</label>
                        <input
                            type="text"
                            className={styles.formInput}
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Описание</label>
                        <textarea
                            className={styles.formTextarea}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={4}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Цена</label>
                        <input
                            type="number"
                            className={styles.formInput}
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Популярность</label>
                        <input
                            type="number"
                            min={0}
                            step={1}
                            className={styles.formInput}
                            value={formData.popularity}
                            onChange={(e) => setFormData({ ...formData, popularity: e.target.value })}
                        />
                        <span style={{ display: "block", marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                            Чем выше значение, тем выше товар в каталоге и на главной
                        </span>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Категория</label>
                        <select
                            className={styles.formSelect}
                            value={formData.category_id}
                            onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                            required
                        >
                            <option value="">Выберите категорию</option>
                            {categoryOptions.map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Платформа</label>
                        <select
                            className={styles.formSelect}
                            value={formData.platform}
                            onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                            required
                        >
                            <option value="pc">pc</option>
                            <option value="mobile">mobile</option>
                            <option value="service">service</option>
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Тип доставки</label>
                        <select
                            className={styles.formSelect}
                            value={formData.delivery_type}
                            onChange={(e) => setFormData({ ...formData, delivery_type: e.target.value })}
                            required
                        >
                            <option value="code">code</option>
                            <option value="login_password">login_password</option>
                            <option value="email_password">email_password</option>
                            <option value="email_code">email_code</option>
                            <option value="game_id">game_id</option>
                            <option value="activation_link">activation_link</option>
                            <option value="qr_login">qr_login</option>
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                            <input
                                type="checkbox"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            />
                            {' '}Активен
                        </label>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                            <input
                                type="checkbox"
                                checked={formData.is_auto_delivery}
                                onChange={(e) => setFormData({ ...formData, is_auto_delivery: e.target.checked })}
                            />
                            {' '}Автовыдача
                        </label>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                            Доп. поля при заказе (поверх схемы категории)
                        </label>
                        <CheckoutFieldsEditor
                            fields={formData.extra_checkout_fields}
                            onChange={(fields) => setFormData({ ...formData, extra_checkout_fields: fields })}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Fulfillment provider</label>
                        <select
                            className={styles.formSelect}
                            value={formData.fulfillment_provider}
                            onChange={(e) => setFormData({ ...formData, fulfillment_provider: e.target.value })}
                        >
                            <option value="none">none</option>
                            <option value="desslyhub">desslyhub</option>
                        </select>
                    </div>

                    {formData.fulfillment_provider === "desslyhub" && (
                        <>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Шаблон конфигурации</label>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                    <select
                                        className={styles.formSelect}
                                        defaultValue=""
                                        onChange={(e) => {
                                            const key = e.target.value;
                                            if (!key) return;
                                            const tpl = DESSLYHUB_TEMPLATES[key];
                                            if (!tpl) return;
                                            setFormData((prev) => ({
                                                ...prev,
                                                provider_service: tpl.provider_service || key,
                                                provider_params_json: JSON.stringify(tpl.provider_params || {}, null, 2),
                                                checkout_requirements_json: JSON.stringify(tpl.checkout_requirements || {}, null, 2),
                                            }));
                                            // reset selector so the same template can be re-applied later
                                            e.target.value = "";
                                        }}
                                    >
                                        <option value="">Выбрать шаблон...</option>
                                        {DESSLYHUB_TEMPLATE_OPTIONS.map((opt) => (
                                            <option key={opt.key} value={opt.key}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <span style={{ fontSize: 12, opacity: 0.8 }}>
                                        Шаблон заполнит provider_service, provider_params и checkout_requirements.
                                    </span>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>DesslyHub service</label>
                                <input
                                    type="text"
                                    className={styles.formInput}
                                    value={formData.provider_service || ""}
                                    onChange={(e) => setFormData({ ...formData, provider_service: e.target.value })}
                                    placeholder="напр. steam_gift / steam_topup / voucher_code / game_topup_id"
                                />
                                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                                    Свободный ключ — пайплайн использует то, что указано в checkout_requirements.request.
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>
                                    provider_params (JSON)
                                </label>
                                <textarea
                                    className={styles.formTextarea}
                                    value={formData.provider_params_json}
                                    onChange={(e) => setFormData({ ...formData, provider_params_json: e.target.value })}
                                    rows={6}
                                    placeholder={`{\n  \"package_id\": \"12345\",\n  \"region\": \"RU\"\n}`}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>
                                    checkout_requirements (JSON)
                                </label>
                                <textarea
                                    className={styles.formTextarea}
                                    value={formData.checkout_requirements_json}
                                    onChange={(e) => setFormData({ ...formData, checkout_requirements_json: e.target.value })}
                                    rows={12}
                                    placeholder={`{\n  \"profile_type\": \"steam_gift\",\n  \"fields\": [\n    {\"key\": \"invite_url\", \"label\": \"Steam invite URL\", \"required\": true}\n  ],\n  \"request\": {\n    \"method\": \"POST\",\n    \"path\": \"/steamgift\",\n    \"body\": {\n      \"invite_url\": \"{{profile.invite_url}}\",\n      \"package_id\": \"{{product.package_id}}\",\n      \"region\": \"{{product.region}}\",\n      \"reference\": \"{{order.public_id}}\"\n    }\n  },\n  \"response\": { \"transaction_id_path\": \"transaction_id\" }\n}`}
                                />
                            </div>
                        </>
                    )}
                    {error && <div className={styles.loading}>{error}</div>}

                    <div className={styles.formActions}>
                        <button
                            type="button"
                            className={styles.adminButtonSecondary}
                            onClick={() => { setModalOpen(false); resetForm(); }}
                        >
                            Отмена
                        </button>
                        <button type="submit" className={styles.adminButton}>
                            {isSubmitting ? "Сохранение..." : "Сохранить"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Image Upload Modal */}
            <Modal
                isOpen={imageModalOpen}
                onClose={() => { setImageModalOpen(false); setImageFile(null); setImagePreview(''); }}
                title="Управление изображениями"
            >
                <div className={styles.imageUpload}>
                    <form onSubmit={handleImageUpload} className={styles.form}>
                        <div
                            className={styles.uploadArea}
                            onClick={() => document.getElementById('imageInput').click()}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    document.getElementById('imageInput').click();
                                }
                            }}
                            role="button"
                            tabIndex={0}
                        >
                            <input
                                id="imageInput"
                                type="file"
                                className={styles.uploadInput}
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        setImageFile(file);
                                        setImagePreview(URL.createObjectURL(file));
                                    }
                                }}
                            />
                            {imagePreview ? (
                                <img src={imagePreview} alt="Preview" className={styles.imagePreview} />
                            ) : (
                                <div className={styles.uploadPlaceholder}>
                                    <div>📸</div>
                                    <div>Нажмите для выбора изображения</div>
                                    <div className={styles.uploadHint}>PNG, JPG, GIF до 5MB</div>
                                </div>
                            )}
                        </div>
                        <button
                            type="submit"
                            className={styles.adminButton}
                            disabled={!imageFile}
                        >
                            Загрузить
                        </button>
                    </form>
                    <div className={styles.formGroup}>
                        {(productImages || []).map((image) => (
                            <div key={image.id} className={styles.actionButtons}>
                                <img
                                    src={normalizeMediaUrl(image.url)}
                                    alt="product"
                                    className={styles.productImage}
                                />
                                <button
                                    type="button"
                                    className={styles.adminButtonSecondary}
                                    onClick={() => changeMainProductImage(image.id, true).then(() => getProductImages(selectedProduct.id)).then((images) => setProductImages(images || []))}
                                >
                                    {image.is_main ? "Главное" : "Сделать главным"}
                                </button>
                                <button
                                    type="button"
                                    className={styles.adminButtonSecondary}
                                    onClick={() => handleDeleteImage(selectedProduct.id, image.id)}
                                >
                                    Удалить
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>

            <DuplicateSettingsModal
                isOpen={duplicateModalOpen}
                onClose={closeDuplicateModal}
                title="Копировать настройки товара"
                sourceLabel={duplicateSource ? `${duplicateSource.name} (#${duplicateSource.id})` : ""}
                fieldOptions={PRODUCT_DUPLICATE_FIELDS}
                targets={duplicateTargets}
                onSubmit={onDuplicateProductSettings}
                busy={duplicateBusy}
            />
        </div>
    );
};