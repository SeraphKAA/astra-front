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
    roundPricesToNine,
} from "../../entities/product/api/productApi";
import { getAllCategories } from "../../entities/category/api/categoryApi";
import {
    changeProductImageType,
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
import { RabbitBoostSettings, withRabbitService } from "./RabbitBoostSettings";

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
    { key: "priority", label: "Приоритет" },
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
        quantity: 0,
        category_id: "",
        main_category: "all",
        platform: "pc",
        delivery_type: "code",
        is_auto_delivery: false,
        is_active: true,
        popularity: 0,
        priority: 0,
        extra_checkout_fields: [],
        fulfillment_provider: "none",
        provider_service: "",
        provider_params_json: "",
        checkout_requirements_json: "",
    };
    const [rounding, setRounding] = useState(false);
    const [formData, setFormData] = useState(initialFormData);
    const [categories, setCategories] = useState([]);
    
    const [filterCategoryId, setFilterCategoryId] = useState("");
    const [filterPriceMin, setFilterPriceMin] = useState("");
    const [filterPriceMax, setFilterPriceMax] = useState("");
    const [filterQuantity, setFilterQuantity] = useState("all"); // all | in_stock | out_of_stock
    const [filterPlatform, setFilterPlatform] = useState("all");
    const [filterDeliveryType, setFilterDeliveryType] = useState("all");
    const [filterByPriority, setFilterByPriority] = useState(false);
    
    const [applied, setApplied] = useState({
        search: "",
        mainCategory: "all",
        isActive: "all",
        categoryId: "",
        priceMin: "",
        priceMax: "",
        quantity: "all",
        platform: "all",
        deliveryType: "all",
        byPriority: false,
    });

    useEffect(() => {
        const t = setTimeout(() => {
            setApplied({
                search: filterText.trim(),
                mainCategory: filterMainCategory,
                isActive: filterActive,
                categoryId: filterCategoryId,
                priceMin: filterPriceMin,
                priceMax: filterPriceMax,
                quantity: filterQuantity,
                platform: filterPlatform,
                deliveryType: filterDeliveryType,
                byPriority: filterByPriority,
            });
        }, 350);
        return () => clearTimeout(t);
    }, [
        filterText, filterMainCategory, filterActive,
        filterCategoryId, filterPriceMin, filterPriceMax,
        filterQuantity, filterPlatform, filterDeliveryType,
        filterByPriority, 
    ]);

    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState("");
    const [productImages, setProductImages] = useState([]);
    const [uploadImageType, setUploadImageType] = useState("main");

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
    }, [applied, pageSize]);

    const parseNumber = (v) => {
        if (v === "" || v == null) return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
    };

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getProductsMiniList({
                page,
                size: pageSize,
                search: applied.search || undefined,
                main_category: applied.mainCategory !== "all" ? applied.mainCategory : undefined,
                is_active: applied.isActive !== "all" ? applied.isActive : undefined,

                category_id: applied.categoryId ? Number(applied.categoryId) : undefined,

                price_min: parseNumber(applied.priceMin),
                price_max: parseNumber(applied.priceMax),

                quantity_min: applied.quantity === "in_stock" ? 1 : undefined,
                quantity_max: applied.quantity === "out_of_stock" ? 0 : undefined,

                platform: applied.platform !== "all" ? applied.platform : undefined,
                delivery_type: applied.deliveryType !== "all" ? applied.deliveryType : undefined,
                by_priority: applied.byPriority || undefined,
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
            pushToast({ type: "error", message: error?.message || "Не удалось загрузить товары" });
            setProducts([]);
            setTotal(0);
            setPages(1);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, applied]);

    const filterCategoryOptions = useMemo(
        () =>
            categories
                .filter((cat) => cat.level >= 1)
                .map((cat) => ({
                    id: cat.id,
                    label: `${cat.level > 1 ? "— " : ""}${cat.name}`,
                })),
        [categories]
    );

    const resetFilters = () => {
        setFilterText("");
        setFilterMainCategory("all");
        setFilterActive("all");
        setFilterCategoryId("");
        setFilterPriceMin("");
        setFilterPriceMax("");
        setFilterQuantity("all");
        setFilterPlatform("all");
        setFilterDeliveryType("all");
        setFilterByPriority(false);
    };

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
            pushToast({ type: "error", message: error?.message || "Не удалось загрузить изображение" });
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

    const handleRoundPrices = async () => {
        if (rounding) return;
        setRounding(true);
        try {
            const result = await roundPricesToNine();
            pushToast({
                type: "success",
                message: result?.updated
                    ? `Обновлено цен: ${result.updated}`
                    : "Все цены уже оканчиваются на 9 — менять нечего",
            });
            await fetchProducts();
        } catch (e) {
            pushToast({
                type: "error",
                message: getApiErrorMessage(e, "Не удалось округлить цены"),
            });
        } finally {
            setRounding(false);
        }
    };

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
                quantity: Number(formData.quantity) || 0,
                popularity: Math.max(0, Number(formData.popularity) || 0),
                priority: Math.max(0, Number(formData.priority) || 0),
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
                pushToast({ type: "error", message: error?.message || "Не удалось удалить товар" });
            }
        }
    };

    const handleImageUpload = async (e) => {
        e.preventDefault();
        if (!imageFile || !selectedProduct) return;

        try {
            // Передаём выбранный тип (main/desktop/mobile)
            await uploadProductImage(selectedProduct.id, imageFile, uploadImageType);
            const images = await getProductImages(selectedProduct.id);
            setProductImages(images || []);
            fetchProducts();
            setImageFile(null);
            setImagePreview("");
            pushToast({ type: "success", message: "Изображение загружено" });
        } catch (error) {
            pushToast({ type: "error", message: error?.message || "Не удалось загрузить изображение" });
        }
    };

    const handleChangeImageType = async (imageId, newType) => {
        try {
            await changeProductImageType(imageId, newType);
            // Обновляем список изображений
            const images = await getProductImages(selectedProduct.id);
            setProductImages(images || []);
            pushToast({ type: "success", message: "Тип изображения обновлён" });
        } catch (error) {
            pushToast({ type: "error", message: error?.message || "Не удалось изменить тип" });
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
                pushToast({ type: "error", message: error?.message || "Не удалось удалить изображение" });
            }
        }
    };

    const resetForm = () => {
        setEditingProduct(null);
        setFormData(initialFormData);
    };

    const handleImportProductsFile = async (e) => {
        const files = Array.from(e.target?.files || []);
        if (files.length === 0) return;

        setImportBusy(true);
        setImportSummary(null);

        const summary = { created: 0, failed: 0, updated: 0, items: [] };

        try {
            for (let i = 0; i < files.length; i += 1) {
                const file = files[i];
                try {
                    const res = await importProductsFromFile(file);
                    const created = Number(res?.created || 0);
                    const updated = Number(res?.updated || 0);
                    const failed = Number(res?.failed || 0);
                    summary.created += created;
                    summary.updated += updated;
                    summary.failed += failed;

                    const items = Array.isArray(res?.items) ? res.items : [];
                    const baseIndex = summary.items.length;
                    for (const item of items) {
                        summary.items.push({
                            ...item,
                            /* индекс — сквозной, чтобы в UI было видно
                            «#42», а не «#3» у каждого второго файла */
                            index: baseIndex + Number(item.index || 0),
                            /* к строке добавляем имя файла — иначе по «Строка 5»
                            непонятно, в каком файле ошибка */
                            sheet_row: item.sheet_row,
                            file_name: file.name,
                        });
                    }
                } catch (err) {
                    /* Файл целиком не ушёл (не JSON, 500 и т.п.) —
                    фиксируем и продолжаем со следующим. */
                    summary.failed += 1;
                    summary.items.push({
                        index: summary.items.length,
                        sheet_row: null,
                        file_name: file.name,
                        ok: false,
                        error: err?.message || "Не удалось импортировать файл",
                    });
                }

                setImportSummary({ ...summary });
            }

            pushToast({
                type: summary.failed > 0 ? "info" : "success",
                message:
                    files.length > 1
                        ? `Импорт завершён: создано ${summary.created}, обновлено ${summary.updated}, с ошибками ${summary.failed} (${files.length} файлов)`
                        : `Импорт завершён: создано ${summary.created}, обновлено ${summary.updated}, с ошибками ${summary.failed}`,
            });

            await fetchProducts();
        } finally {
            setImportBusy(false);
            if (e?.target) e.target.value = "";
        }
    };
    // const handleImportProductsFile = async (e) => {
    //     const file = e.target?.files?.[0];
    //     if (!file) return;
    //     setImportBusy(true);
    //     setImportSummary(null);
    //     try {
    //         const res = await importProductsFromFile(file);
    //         setImportSummary(res);
    //         const failed = Number(res?.failed || 0);
    //         const created = Number(res?.created || 0);
    //         pushToast({
    //             type: failed > 0 ? "info" : "success",
    //             message: `Импорт завершён: создано ${created}, с ошибками ${failed}`,
    //         });
    //         await fetchProducts();
    //     } catch (err) {
    //         pushToast({ type: "error", message: err?.message || "Не удалось импортировать товары" });
    //     } finally {
    //         setImportBusy(false);
    //         if (e?.target) e.target.value = "";
    //     }
    // };

    const loadAllTargets = useCallback(async (excludeId) => {
        let allItems = [];
        let page = 1;
        const size = 100;
        let hasMore = true;
        while (hasMore) {
            const data = await getProductsMiniList({ page, size });
            const list = Array.isArray(data?.products) ? data.products : [];
            allItems = allItems.concat(list);
            if (list.length < size) {
                hasMore = false;
            } else {
                page++;
            }
        }
        return allItems.filter(item => item.id !== excludeId);
    }, []);

    const openDuplicateModal = async (product) => {
        setDuplicateSource(product);
        setDuplicateModalOpen(true);
        try {
            const allTargets = await loadAllTargets(product.id);
            setDuplicateTargets(
                allTargets.map((item) => ({
                    id: item.id,
                    label: item.name,
                    depth: 0,
                    /* Доп. поля — только для клиентских фильтров в модалке.
                    Сервер всё равно отдаёт полный список, второго запроса
                    при смене фильтра не будет. */
                    price: item.price,
                    category_id: item.category_id,
                    platform: item.platform,
                    delivery_type: item.delivery_type,
                    quantity: item.quantity,
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
                quantity: full.quantity ?? 0,
                category_id: full.category_id,
                main_category: full.main_category || "games",
                platform: full.platform || "pc",
                delivery_type: full.delivery_type || "code",
                is_auto_delivery: Boolean(full.is_auto_delivery),
                is_active: Boolean(full.is_active),
                popularity: full.popularity ?? 0,
                priority: full.priority ?? 0,
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
                quantity: product.quantity ?? 0,
                category_id: product.category_id,
                main_category: product.main_category || "games",
                platform: product.platform || "pc",
                delivery_type: product.delivery_type || "code",
                is_auto_delivery: Boolean(product.is_auto_delivery),
                is_active: Boolean(product.is_active),
                popularity: product.popularity ?? 0,
                priority: product.priority ?? 0,
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
            // Сбросить выбор типа при открытии
            setUploadImageType("main");
            setImageFile(null);
            setImagePreview("");
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
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={rounding}
                        aria-busy={rounding || undefined}
                        onClick={handleRoundPrices}
                        title="Цены товаров ≥ 10 ₽ — вверх до числа, оканчивающегося на 9"
                    >
                        {rounding ? "Округляем…" : "Округлить цены до 9"}
                    </Button>
                    <input
                        ref={importFileRef}
                        type="file"
                        accept=".json,.xlsx,application/json"
                        multiple
                        style={{ display: "none" }}
                        onChange={handleImportProductsFile}
                    />
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={importBusy}
                        onClick={() => importFileRef.current?.click()}
                    >
                        {importBusy ? "Импорт…" : "Импорт из файлов"}
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
                        borderRadius: "var(--astra-r-sm)",
                        border: "1px solid var(--astra-line-strong)",
                        background: "var(--astra-card)",
                        color: "var(--astra-ink)",
                        fontSize: 14,
                    }}
                >
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Результат импорта</div>
                    <div>Создано: {importSummary.created ?? 0}, обновлено: {importSummary.updated ?? 0} ошибок: {importSummary.failed ?? 0}</div>
                    {Array.isArray(importSummary.items) && importSummary.failed > 0 && (
                        <ul style={{ margin: "8px 0 0", paddingLeft: 18, maxHeight: 180, overflow: "auto" }}>
                            {importSummary.items
                                .filter((it) => !it?.ok)
                                .slice(0, 30)
                                .map((it) => (
                                    <li key={`${it.file_name || ""}-${it.index}-${it.sheet_row ?? "r"}`}>
                                        {it.file_name ? `${it.file_name}: ` : ""}
                                        {it.sheet_row != null ? `строка ${it.sheet_row}` : `#${it.index + 1}`}
                                        {" — "}
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
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                    <select
                        className={styles.formSelect}
                        value={filterCategoryId}
                        onChange={(e) => setFilterCategoryId(e.target.value)}
                        style={{ maxWidth: 240 }}
                        title="Точная категория товара (не «раздел»)"
                    >
                        <option value="">Все категории</option>
                        {filterCategoryOptions.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                        ))}
                    </select>

                    <input
                        type="number"
                        min={0}
                        className={styles.formInput}
                        placeholder="Цена от"
                        value={filterPriceMin}
                        onChange={(e) => setFilterPriceMin(e.target.value)}
                        style={{ maxWidth: 120 }}
                    />
                    <input
                        type="number"
                        min={0}
                        className={styles.formInput}
                        placeholder="Цена до"
                        value={filterPriceMax}
                        onChange={(e) => setFilterPriceMax(e.target.value)}
                        style={{ maxWidth: 120 }}
                    />

                    <select
                        className={styles.formSelect}
                        value={filterQuantity}
                        onChange={(e) => setFilterQuantity(e.target.value)}
                        style={{ maxWidth: 180 }}
                    >
                        <option value="all">Любой остаток</option>
                        <option value="in_stock">В наличии</option>
                        <option value="out_of_stock">Нет в наличии</option>
                    </select>

                    <select
                        className={styles.formSelect}
                        value={filterPlatform}
                        onChange={(e) => setFilterPlatform(e.target.value)}
                        style={{ maxWidth: 160 }}
                    >
                        <option value="all">Любая платформа</option>
                        <option value="pc">pc</option>
                        <option value="mobile">mobile</option>
                        <option value="service">service</option>
                    </select>

                    <select
                        className={styles.formSelect}
                        value={filterDeliveryType}
                        onChange={(e) => setFilterDeliveryType(e.target.value)}
                        style={{ maxWidth: 200 }}
                    >
                        <option value="all">Любая выдача</option>
                        <option value="code">code</option>
                        <option value="login_password">login_password</option>
                        <option value="email_password">email_password</option>
                        <option value="email_code">email_code</option>
                        <option value="game_id">game_id</option>
                        <option value="activation_link">activation_link</option>
                        <option value="qr_login">qr_login</option>
                    </select>

                    <select
                        className={styles.formSelect}
                        value={filterActive}
                        onChange={(e) => setFilterActive(e.target.value)}
                        style={{ maxWidth: 160 }}
                        title="Фильтр по статусу активности товара"
                    >
                        <option value="all">Все статусы</option>
                        <option value="active">Активен</option>
                        <option value="inactive">Неактивен</option>
                    </select>

                    <label
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 13,
                            color: "var(--astra-ink, inherit)",
                            whiteSpace: "nowrap",
                        }}
                        title="Сортировать товары по полю priority (иначе — по popularity)"
                    >
                        <input
                            type="checkbox"
                            checked={filterByPriority}
                            onChange={(e) => setFilterByPriority(e.target.checked)}
                        />
                        По приоритету
                    </label>

                    <button
                        type="button"
                        className={styles.adminButtonSecondary}
                        onClick={resetFilters}
                        disabled={loading}
                    >
                        Сбросить фильтры
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
                            <th>Количество</th>
                            <th>Популярность</th>
                            <th>Приоритет</th>
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
                                        {product.image_main && (
                                            <img
                                                src={normalizeMediaUrl(product.image_main)}
                                                alt={product.name}
                                                className={styles.productImage}
                                            />
                                        )}
                                        {!product.image_main && (
                                            <div className={styles.productImagePlaceholder}>
                                                📦
                                            </div>
                                        )}
                                    </td>
                                    <td className="text-none">{product.name}</td>
                                    <td>{product.price} ₽</td>
                                    <td>{product.quantity ?? 0}</td>
                                    <td>{product.popularity ?? 0}</td>
                                    <td>{product.priority ?? 0}</td>
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
                                <td colSpan="10" style={{ textAlign: 'center', padding: '40px' }}>
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
                title={
                    <div>
                        {editingProduct ? 'Редактировать товар' : 'Добавить товар'}
                        <button
                            type="button"
                            className={styles.modalCloseBtn}
                            onClick={() => setModalOpen(false)}
                            aria-label="Закрыть"
                        >
                            <span aria-hidden="true">✕</span>
                        </button>
                    </div>
                }
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
                        <label className={styles.formLabel}>Количество</label>
                        <input
                            type="number"
                            min={0}
                            step={1}
                            className={styles.formInput}
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                            required
                        />
                        <span style={{ display: "block", marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                            Остаток товара на складе
                        </span>
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
                            Чем выше значение, тем выше товар на главной странице
                        </span>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Приоритет</label>
                        <input
                            type="number"
                            min={0}
                            step={1}
                            className={styles.formInput}
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        />
                        <span style={{ display: "block", marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                            Чем выше значение, тем выше товар в каталоге
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
                            onChange={(e) => setFormData(e.target.value === "rabbitboost"
                                ? { ...withRabbitService(formData, "discord_boosts"), fulfillment_provider: "rabbitboost" }
                                : { ...formData, fulfillment_provider: e.target.value })}
                        >
                            <option value="none">none</option>
                            <option value="desslyhub">desslyhub</option>
                            <option value="rabbitboost">RabbitBoost — Discord</option>
                        </select>
                    </div>

                    {formData.fulfillment_provider === "rabbitboost" && <RabbitBoostSettings form={formData} onChange={setFormData} />}
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
                onClose={() => {
                    setImageModalOpen(false);
                    setImageFile(null);
                    setImagePreview("");
                    setUploadImageType("main");
                }}
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

                        {/* НОВОЕ: выбор типа загружаемого изображения */}
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Тип изображения</label>
                            <select
                                className={styles.formSelect}
                                value={uploadImageType}
                                onChange={(e) => setUploadImageType(e.target.value)}
                                disabled={!imageFile}
                            >
                                <option value="main">Главное</option>
                                <option value="desktop">Для ПК</option>
                                <option value="mobile">Для мобильных</option>
                            </select>
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                                Для каждого типа можно загрузить только одно изображение.
                            </span>
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
                            <div key={image.id} className={styles.imageItem}>
                                <img
                                    src={normalizeMediaUrl(image.url)}
                                    alt="product"
                                    className={styles.productImage}
                                />
                                <div>
                                    <span>Тип: {image.image_type}</span>
                                    <div className={styles.actionButtons}>
                                        <select
                                            value={image.image_type}
                                            className={styles.imageItemSelect}
                                            onChange={(e) => {
                                                changeProductImageType(image.id, String(e.target.value))
                                                    .then(() => getProductImages(selectedProduct.id))
                                                    .then((images) => setProductImages(images || []))
                                                    .catch((err) => pushToast({ type: "error", message: err.message }));
                                            }}
                                        >
                                            <option value="main">Главное</option>
                                            <option value="desktop">Для ПК</option>
                                            <option value="mobile">Для мобильных</option>
                                        </select>
                                        <button
                                            type="button"
                                            className={styles.adminButtonSecondary}
                                            onClick={() => handleDeleteImage(selectedProduct.id, image.id)}
                                        >
                                            Удалить
                                        </button>
                                    </div>
                                </div>
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
                categoryOptions={filterCategoryOptions}
                onSubmit={onDuplicateProductSettings}
                busy={duplicateBusy}
            />
        </div>
    );
};
