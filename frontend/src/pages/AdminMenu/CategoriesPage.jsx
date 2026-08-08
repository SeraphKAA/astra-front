import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../shared/ui/Button/Button';
import { Modal } from '../../shared/ui/Modal/Modal';
import { Input } from '../../shared/ui/Input/Input';
import { getFirstCategory, createCategory, deleteCategory, getCategoryTree, getAllCategories, duplicateCategorySettings } from '../../entities/category/api/categoryApi';
import { createCategoryFaq, deleteCategoryFaq, getCategoryFaqByCategoryId, updateCategoryFaq } from '../../entities/faq/api/faqApi';
import {
    createCategoryAdditionalInfo,
    deleteCategoryAdditionalInfo,
    updateCategoryAdditionalInfo,
} from '../../entities/categoryAdditionalInfo/api/categoryAdditionalInfoApi';
import { getApiErrorMessage, normalizeMediaUrl } from '../../shared/commonApi';
import { useToast } from '../../shared/ui/Toast/ToastProvider';
import {
    deleteCategoryImage,
    uploadCategoryImage,
} from '../../entities/files/api/fileApi';
import {
    createCategoryCheckoutSchema,
    deleteCategoryCheckoutSchema,
    getCheckoutSchemaByCategoryId,
    updateCategoryCheckoutSchema,
} from '../../entities/checkoutSchema/api/checkoutSchemaApi';
import { CheckoutFieldsEditor, sanitizeCheckoutFields } from '../../shared/ui/CheckoutFieldsEditor/CheckoutFieldsEditor';
import {
    CameraIcon,
    ClipboardIcon,
    DuplicateIcon,
    ExpandIcon,
    FolderIcon,
    PencilIcon,
    QuestionIcon,
    TrashIcon,
} from '../../shared/svgIcons';
import styles from './admin.module.css';
import { DuplicateSettingsModal } from '../../shared/ui/DuplicateSettingsModal/DuplicateSettingsModal';
import { getCategoryDisplayName } from '../../entities/product/mainCategoryLabels';

const CATEGORY_DUPLICATE_FIELDS = [
    { key: 'image', label: 'Фото' },
    { key: 'faq', label: 'FAQ' },
    { key: 'additional_info', label: 'Доп. информация' },
    { key: 'checkout_schema', label: 'Данные для заказа' },
];

const findAllCategoryNode = (roots) => {
    if (!Array.isArray(roots) || roots.length === 0) return null;
    return roots.find((node) => String(node?.name || "").toLowerCase() === "all") || roots[0];
};

const flattenCategoryTree = (roots) => {
    const allNode = findAllCategoryNode(roots);
    const acc = [];
    const walk = (nodes, depth = 0) => {
        for (const node of nodes || []) {
            acc.push({
                id: node.id,
                label: getCategoryDisplayName(node.name),
                depth,
            });
            if (node.children?.length) walk(node.children, depth + 1);
        }
    };
    walk(allNode?.children || []);
    return acc;
};

const patchCategoryInTree = (nodes, categoryId, patch) =>
    (nodes || []).map((node) => {
        if (node.id === categoryId) {
            return { ...node, ...patch };
        }
        if (node.children?.length) {
            return { ...node, children: patchCategoryInTree(node.children, categoryId, patch) };
        }
        return node;
    });

const buildHasChildrenMap = (nodes, map = {}) => {
    for (const node of nodes || []) {
        map[node.id] = Array.isArray(node.children) && node.children.length > 0;
        if (node.children?.length) {
            buildHasChildrenMap(node.children, map);
        }
    }
    return map;
};

export const CategoriesPage = () => {
    const { pushToast } = useToast();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [expandedCategories, setExpandedCategories] = useState(new Set());
    const [loadingChildren, setLoadingChildren] = useState({});
    const [newCategoryId, setNewCategoryId] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [faqModalOpen, setFaqModalOpen] = useState(false);
    const [faqLoading, setFaqLoading] = useState(false);
    const [faqError, setFaqError] = useState("");
    const [faqEditing, setFaqEditing] = useState(null); // { id, category_id, faq }
    const [faqPairs, setFaqPairs] = useState([{ q: "", a: "" }]);
    const [additionalInfoEditing, setAdditionalInfoEditing] = useState(null); // { id, category_id, info }
    const [additionalInfoText, setAdditionalInfoText] = useState("");
    const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [checkoutError, setCheckoutError] = useState("");
    const [checkoutEditing, setCheckoutEditing] = useState(null);
    const [checkoutForm, setCheckoutForm] = useState({
        profile_type: "",
        title: "",
        icon_url: "",
        fields: [],
        is_active: true,
    });
    const [editingCategory, setEditingCategory] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        parent_id: null
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [imageUploadBusy, setImageUploadBusy] = useState(false);
    const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
    const [duplicateSource, setDuplicateSource] = useState(null);
    const [duplicateTargets, setDuplicateTargets] = useState([]);
    const [duplicateBusy, setDuplicateBusy] = useState(false);

    const fetchCategoryChildren = async (categoryId, hasChildrenMap) => {
        try {
            const categoryTree = await getCategoryTree(categoryId);
            return (categoryTree.children || []).map((child) => ({
                ...child,
                children: [],
                has_children: Boolean(hasChildrenMap[child.id]),
            }));
        } catch {
            return [];
        }
    };

    const hydrateExpandedBranches = async (nodes, expandedIds, hasChildrenMap) => {
        for (const node of nodes) {
            if (!expandedIds.has(node.id)) continue;
            node.children = await fetchCategoryChildren(node.id, hasChildrenMap);
            if (node.children?.length) {
                await hydrateExpandedBranches(node.children, expandedIds, hasChildrenMap);
            }
        }
    };

    const fetchCategories = useCallback(async (expandedIdsToPreserve = null) => {
        const expandedIds = expandedIdsToPreserve ?? expandedCategories;
        try {
            const [firstData, allData] = await Promise.all([
                getFirstCategory(),
                getAllCategories(),
            ]);
            const allNode = findAllCategoryNode(allData);
            const hasChildrenMap = buildHasChildrenMap(allNode?.children || []);
            const categoriesList = (firstData.children || []).map((category) => ({
                ...category,
                children: [],
                has_children: Boolean(hasChildrenMap[category.id]),
            }));

            if (expandedIds.size > 0) {
                await hydrateExpandedBranches(categoriesList, expandedIds, hasChildrenMap);
            }

            setCategories(categoriesList);
        } catch {
            setCategories([]);
        } finally {
            setLoading(false);
        }
    }, [expandedCategories]);

    useEffect(() => {
        fetchCategories(new Set());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleCategory = async (categoryId) => {
        const newExpanded = new Set(expandedCategories);

        if (expandedCategories.has(categoryId)) {
            newExpanded.delete(categoryId);
        } else {
            newExpanded.add(categoryId);

            // Показываем индикатор загрузки
            setLoadingChildren(prev => ({ ...prev, [categoryId]: true }));

            // Находим категорию в дереве и загружаем ее детей
            const updateCategoryChildren = async (categoriesList) => {
                for (let i = 0; i < categoriesList.length; i++) {
                    if (categoriesList[i].id === categoryId) {
                        if (!categoriesList[i].children || categoriesList[i].children.length === 0) {
                            const allData = await getAllCategories();
                            const allNode = findAllCategoryNode(allData);
                            const hasChildrenMap = buildHasChildrenMap(allNode?.children || []);
                            const children = await fetchCategoryChildren(categoryId, hasChildrenMap);
                            categoriesList[i].children = children;
                        }
                        break;
                    }
                    if (categoriesList[i].children && categoriesList[i].children.length > 0) {
                        await updateCategoryChildren(categoriesList[i].children);
                    }
                }
            };

            const updatedCategories = [...categories];
            await updateCategoryChildren(updatedCategories);
            setCategories(updatedCategories);

            // Скрываем индикатор загрузки
            setLoadingChildren(prev => ({ ...prev, [categoryId]: false }));
        }

        setExpandedCategories(newExpanded);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingCategory) {
                // console.log("editing category");
            } else {
                const newCategory = await createCategory(formData);
                setNewCategoryId(newCategory.id);
                setTimeout(() => setNewCategoryId(null), 500);
            }
            await fetchCategories(expandedCategories);
            setModalOpen(false);
            resetForm();
        } catch (error) {
            // console.error('Error saving category:', error);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Вы уверены, что хотите удалить эту категорию? Все подкатегории также будут удалены.')) {
            try {
                await deleteCategory(id);
                const nextExpanded = new Set(expandedCategories);
                nextExpanded.delete(id);
                setExpandedCategories(nextExpanded);
                await fetchCategories(nextExpanded);
            } catch (error) {
                // console.error('Error deleting category:', error);
            }
        }
    };

    const applyCategoryImagePatch = (categoryId, patch) => {
        setCategories((prev) => patchCategoryInTree(prev, categoryId, patch));
        setSelectedCategory((prev) =>
            prev?.id === categoryId ? { ...prev, ...patch } : prev
        );
    };

    const handleImageUpload = async (e) => {
        e.preventDefault();
        if (!imageFile || !selectedCategory) return;

        setImageUploadBusy(true);
        try {
            const uploaded = await uploadCategoryImage(selectedCategory.id, imageFile, true);
            const patch = {
                image_id: uploaded?.id ?? selectedCategory.image_id,
                image_url: uploaded?.url ?? selectedCategory.image_url,
            };
            applyCategoryImagePatch(selectedCategory.id, patch);
            pushToast({ type: 'success', message: 'Изображение категории загружено' });
            setImageFile(null);
            setImagePreview('');
        } catch (err) {
            pushToast({
                type: 'error',
                message: getApiErrorMessage(err, 'Не удалось загрузить изображение'),
            });
        } finally {
            setImageUploadBusy(false);
        }
    };

    const handleDeleteImage = async (categoryId, imageId) => {
        if (!imageId) {
            pushToast({ type: 'error', message: 'У категории нет изображения для удаления' });
            return;
        }
        if (!window.confirm('Удалить изображение?')) return;

        try {
            await deleteCategoryImage(imageId);
            applyCategoryImagePatch(categoryId, { image_id: null, image_url: null });
            pushToast({ type: 'success', message: 'Изображение удалено' });
        } catch (err) {
            pushToast({
                type: 'error',
                message: getApiErrorMessage(err, 'Не удалось удалить изображение'),
            });
        }
    };

    const resetForm = () => {
        setEditingCategory(null);
        setFormData({ name: '', parent_id: null });
    };

    const openEditModal = (category) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            parent_id: category.parent_id
        });
        setModalOpen(true);
    };

    const openDuplicateModal = async (category) => {
        setDuplicateSource(category);
        setDuplicateModalOpen(true);
        try {
            const allData = await getAllCategories();
            const flat = flattenCategoryTree(allData).filter((item) => item.id !== category.id);
            setDuplicateTargets(flat);
        } catch {
            setDuplicateTargets([]);
            pushToast({ type: 'error', message: 'Не удалось загрузить список категорий' });
        }
    };

    const closeDuplicateModal = () => {
        if (duplicateBusy) return;
        setDuplicateModalOpen(false);
        setDuplicateSource(null);
        setDuplicateTargets([]);
    };

    const onDuplicateCategorySettings = async ({ targetIds, options }) => {
        if (!duplicateSource?.id) return null;
        setDuplicateBusy(true);
        try {
            const result = await duplicateCategorySettings(duplicateSource.id, {
                target_category_ids: targetIds,
                options,
            });
            const ok = result?.results?.filter((r) => r.ok).length || 0;
            const failed = (result?.results?.length || 0) - ok;
            if (result?.warnings?.length) {
                pushToast({
                    type: 'info',
                    message: result.warnings.join('. '),
                });
            }
            pushToast({
                type: failed > 0 ? 'info' : 'success',
                message: `Скопировано в ${ok} категорий${failed > 0 ? `, ошибок: ${failed}` : ''}`,
            });
            await fetchCategories(expandedCategories);
            return result;
        } catch (err) {
            pushToast({
                type: 'error',
                message: getApiErrorMessage(err, 'Не удалось скопировать настройки'),
            });
            return null;
        } finally {
            setDuplicateBusy(false);
        }
    };

    const openImageModal = (category) => {
        setSelectedCategory(category);
        setImageFile(null);
        setImagePreview('');
        setImageModalOpen(true);
    };

    const closeImageModal = () => {
        setImageModalOpen(false);
        setImageFile(null);
        if (imagePreview?.startsWith('blob:')) {
            URL.revokeObjectURL(imagePreview);
        }
        setImagePreview('');
        setSelectedCategory(null);
    };

    const openFaqModal = async (category) => {
        setSelectedCategory(category);
        setFaqError("");
        setFaqModalOpen(true);
        setFaqLoading(true);
        try {
            const data = await getCategoryFaqByCategoryId(category.id);
            const faqRecord = data?.faq || null;
            const infoRecord = data?.additional_info || null;
            setFaqEditing(faqRecord);
            const entries = Object.entries((faqRecord?.faq) || {});
            if (entries.length > 0) {
                setFaqPairs(entries.map(([q, a]) => ({ q, a })));
            } else {
                setFaqPairs([{ q: "", a: "" }]);
            }
            setAdditionalInfoEditing(infoRecord);
            setAdditionalInfoText(infoRecord?.info || "");
        } catch (e) {
            setFaqEditing(null);
            setFaqPairs([{ q: "", a: "" }]);
            setAdditionalInfoEditing(null);
            setAdditionalInfoText("");
        } finally {
            setFaqLoading(false);
        }
    };

    const closeFaqModal = () => {
        if (faqLoading) return;
        setFaqModalOpen(false);
        setFaqError("");
        setFaqEditing(null);
        setFaqPairs([{ q: "", a: "" }]);
        setAdditionalInfoEditing(null);
        setAdditionalInfoText("");
    };

    const faqPairsToDict = (pairs) => {
        const out = {};
        pairs.forEach(({ q, a }) => {
            const key = String(q || "").trim();
            if (!key) return;
            out[key] = String(a || "");
        });
        return out;
    };

    const persistFaq = async () => {
        const faq = faqPairsToDict(faqPairs);
        if (Object.keys(faq).length === 0) {
            if (faqEditing?.id) {
                await deleteCategoryFaq(faqEditing.id);
            }
            return null;
        }
        if (faqEditing?.id) {
            return await updateCategoryFaq({ id: faqEditing.id, faq });
        }
        return await createCategoryFaq({ category_id: selectedCategory.id, faq });
    };

    const persistAdditionalInfo = async () => {
        const text = String(additionalInfoText || "").trim();
        if (!text) {
            if (additionalInfoEditing?.id) {
                await deleteCategoryAdditionalInfo(additionalInfoEditing.id);
            }
            return null;
        }
        if (additionalInfoEditing?.id) {
            return await updateCategoryAdditionalInfo({ id: additionalInfoEditing.id, info: text });
        }
        return await createCategoryAdditionalInfo({ category_id: selectedCategory.id, info: text });
    };

    const openCheckoutModal = async (category) => {
        setSelectedCategory(category);
        setCheckoutError("");
        setCheckoutModalOpen(true);
        setCheckoutLoading(true);
        try {
            const schema = await getCheckoutSchemaByCategoryId(category.id);
            setCheckoutEditing(schema);
            if (schema) {
                setCheckoutForm({
                    profile_type: schema.profile_type || "",
                    title: schema.title || "",
                    icon_url: schema.icon_url || "",
                    fields: Array.isArray(schema.fields) ? schema.fields : [],
                    is_active: schema.is_active !== false,
                });
            } else {
                const slug = String(category.name || "game")
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "_")
                    .replace(/^_|_$/g, "")
                    .slice(0, 64);
                setCheckoutForm({
                    profile_type: slug || `cat_${category.id}`,
                    title: category.name || "",
                    icon_url: "",
                    fields: [],
                    is_active: true,
                });
            }
        } catch {
            setCheckoutEditing(null);
            setCheckoutForm({
                profile_type: `cat_${category.id}`,
                title: category.name || "",
                icon_url: "",
                fields: [],
                is_active: true,
            });
        } finally {
            setCheckoutLoading(false);
        }
    };

    const closeCheckoutModal = () => {
        if (checkoutLoading) return;
        setCheckoutModalOpen(false);
        setCheckoutError("");
        setCheckoutEditing(null);
    };

    const onSaveCheckout = async (e) => {
        e.preventDefault();
        if (!selectedCategory?.id) return;
        setCheckoutError("");
        setCheckoutLoading(true);
        try {
            const payload = {
                profile_type: checkoutForm.profile_type.trim(),
                title: checkoutForm.title.trim(),
                icon_url: checkoutForm.icon_url.trim() || null,
                fields: sanitizeCheckoutFields(checkoutForm.fields),
                is_active: checkoutForm.is_active,
            };
            if (!payload.profile_type || !payload.title) {
                throw new Error("Укажите ключ профиля и название");
            }
            if (checkoutEditing?.id) {
                await updateCategoryCheckoutSchema(checkoutEditing.id, payload);
            } else {
                await createCategoryCheckoutSchema({
                    category_id: selectedCategory.id,
                    ...payload,
                });
            }
            closeCheckoutModal();
        } catch (err) {
            setCheckoutError(err?.message || "Не удалось сохранить");
        } finally {
            setCheckoutLoading(false);
        }
    };

    const onDeleteCheckout = async () => {
        if (!checkoutEditing?.id) {
            closeCheckoutModal();
            return;
        }
        setCheckoutLoading(true);
        try {
            await deleteCategoryCheckoutSchema(checkoutEditing.id);
            closeCheckoutModal();
        } catch (err) {
            setCheckoutError(err?.message || "Не удалось удалить");
        } finally {
            setCheckoutLoading(false);
        }
    };

    const onSaveFaq = async (e) => {
        e.preventDefault();
        if (!selectedCategory?.id) return;
        setFaqError("");
        setFaqLoading(true);
        try {
            const nextFaq = await persistFaq();
            setFaqEditing(nextFaq);
            const nextInfo = await persistAdditionalInfo();
            setAdditionalInfoEditing(nextInfo);
            closeFaqModal();
        } catch (err) {
            setFaqError(err?.message || "Не удалось сохранить");
        } finally {
            setFaqLoading(false);
        }
    };

    const renderCategoryRow = (category, level = 0) => {
        const hasChildren = category.has_children === true;
        const isExpanded = expandedCategories.has(category.id);
        const isLoading = loadingChildren[category.id];
        const paddingLeft = level * 8;
        const isNew = newCategoryId === category.id;

        return (
            <React.Fragment key={category.id}>
                <tr className={`${styles.categoryRow} ${isNew ? styles.newRow : ''}`} data-level={level}>
                    <td style={{ paddingLeft: `${paddingLeft + 16}px` }}>
                        {hasChildren && (
                            <button
                                type="button"
                                className={`${styles.expandButton} ${isExpanded ? styles.expanded : ''}`}
                                onClick={() => toggleCategory(category.id)}
                                aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
                                aria-expanded={isExpanded}
                            >
                                <ExpandIcon expanded={isExpanded} />
                            </button>
                        )}
                        {!hasChildren && <span className={styles.expandPlaceholder} />}
                        <span className={styles.categoryIdCell}>{category.id}</span>
                    </td>
                    <td>
                        {category.image_url && (
                            <div className={styles.categoryImageWrapper}>
                                <img
                                    src={normalizeMediaUrl(category.image_url)}
                                    alt={category.name}
                                    className={styles.categoryImage}
                                    loading="lazy"
                                />
                                <button
                                    className={styles.deleteImageButton}
                                    onClick={() => handleDeleteImage(category.id, category.image_id)}
                                >
                                    ×
                                </button>
                            </div>
                        )}
                        {!category.image_url && (
                            <div className={styles.categoryImagePlaceholder}>
                                <FolderIcon className={styles.categoryPlaceholderIcon} />
                            </div>
                        )}
                    </td>
                    <td className={styles.categoryName}>{category.name}</td>
                    <td>{category.parent_id || 'Корневая'}</td>
                    <td>
                        <div className={styles.actionButtons}>
                            <button
                                type="button"
                                className={`${styles.iconButton} ${styles.iconButtonDuplicate}`}
                                onClick={() => openDuplicateModal(category)}
                                title="Копировать настройки в другие категории"
                                aria-label="Копировать настройки"
                            >
                                <DuplicateIcon className={styles.adminActionIcon} />
                            </button>
                            <button
                                type="button"
                                className={`${styles.iconButton} ${styles.iconButtonFaq}`}
                                onClick={() => openFaqModal(category)}
                                title="FAQ (вопросы и ответы)"
                                aria-label="FAQ"
                            >
                                <QuestionIcon className={styles.adminActionIcon} />
                            </button>
                            <button
                                type="button"
                                className={`${styles.iconButton} ${styles.iconButtonCheckout}`}
                                onClick={() => openCheckoutModal(category)}
                                title="Данные для заказа (UID, сервер и т.д.)"
                                aria-label="Данные для заказа"
                            >
                                <ClipboardIcon className={styles.adminActionIcon} />
                            </button>
                            <button
                                type="button"
                                className={`${styles.iconButton} ${styles.iconButtonImage}`}
                                onClick={() => openImageModal(category)}
                                title="Управление изображением"
                                aria-label="Изображение"
                            >
                                <CameraIcon className={styles.adminActionIcon} />
                            </button>
                            <button
                                type="button"
                                className={`${styles.iconButton} ${styles.iconButtonEdit}`}
                                onClick={() => openEditModal(category)}
                                title="Редактировать"
                                aria-label="Редактировать"
                            >
                                <PencilIcon className={styles.adminActionIcon} />
                            </button>
                            <button
                                type="button"
                                className={`${styles.iconButton} ${styles.iconButtonDelete}`}
                                onClick={() => handleDelete(category.id)}
                                title="Удалить"
                                aria-label="Удалить"
                            >
                                <TrashIcon className={styles.adminActionIcon} />
                            </button>
                        </div>
                    </td>
                </tr>
                {hasChildren && isExpanded && (
                    <React.Fragment>
                        {isLoading && (
                            <tr className={styles.categoryChildren}>
                                <td colSpan="5">
                                    <div className={styles.loadingChildren}>
                                        <div className={styles.loadingSpinner} />
                                        <span>Загрузка подкатегорий...</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {!isLoading && category.children && category.children.map(child =>
                            renderCategoryRow(child, level + 1)
                        )}
                    </React.Fragment>
                )}
            </React.Fragment>
        );
    };

    if (loading) {
        return <div className={styles.loading}>Загрузка...</div>;
    }

    const q = searchText.trim().toLowerCase();
    const matchesQuery = (cat) => {
        if (!q) return true;
        return String(cat?.name || "").toLowerCase().includes(q) || String(cat?.id || "").includes(q);
    };
    const filterTree = (nodes = []) => {
        if (!q) return nodes;
        return nodes
            .map((n) => {
                const children = Array.isArray(n.children) ? filterTree(n.children) : [];
                const selfMatch = matchesQuery(n);
                if (!selfMatch && children.length === 0) return null;
                return { ...n, children };
            })
            .filter(Boolean);
    };
    const visibleCategories = filterTree(categories);

    return (
        <div>
            <div className={styles.adminHeader}>
                <h1 className={styles.pageTitle}>Категории</h1>
                <Button onClick={() => setModalOpen(true)}>+ Добавить категорию</Button>
            </div>

            <div className={styles.formGroup} style={{ marginBottom: 12 }}>
                <Input
                    placeholder="Поиск категории (id или название)"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                />
            </div>

            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Изображение</th>
                            <th>Название</th>
                            <th>Родительская категория</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleCategories.length > 0 ? (
                            visibleCategories.map(category => renderCategoryRow(category, 0))
                        ) : (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>
                                    Категории не найдены
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Модалка для создания/редактирования категории */}
            <Modal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); resetForm(); }}
                title={editingCategory ? 'Редактировать категорию' : 'Добавить категорию'}
            >
                <form onSubmit={handleSubmit} className={styles.form}>
                    <Input
                        label="Название"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                    />
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Родительская категория</label>
                        <select
                            className={styles.formSelect}
                            value={formData.parent_id || ''}
                            onChange={(e) => setFormData({ ...formData, parent_id: e.target.value || null })}
                        >
                            <option value="">Нет (корневая категория)</option>
                            {categories
                                .filter(c => c.id !== editingCategory?.id)
                                .map((cat) => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                        </select>
                    </div>
                    <div className={styles.formActions}>
                        <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetForm(); }}>
                            Отмена
                        </Button>
                        <Button type="submit">Сохранить</Button>
                    </div>
                </form>
            </Modal>

            {/* Модалка для загрузки изображения */}
            <Modal
                isOpen={imageModalOpen}
                onClose={closeImageModal}
                title={`Изображение: ${selectedCategory?.name || ''}`}
            >
                <div className={styles.imageUpload}>
                    {selectedCategory?.image_url && !imagePreview && (
                        <div style={{ marginBottom: 12 }}>
                            <img
                                src={normalizeMediaUrl(selectedCategory.image_url)}
                                alt={selectedCategory.name}
                                className={styles.imagePreview}
                            />
                            <Button
                                type="button"
                                variant="secondary"
                                style={{ marginTop: 8 }}
                                onClick={() =>
                                    handleDeleteImage(
                                        selectedCategory.id,
                                        selectedCategory.image_id
                                    )
                                }
                            >
                                Удалить текущее
                            </Button>
                        </div>
                    )}
                    <form onSubmit={handleImageUpload} className={styles.form}>
                        <div
                            className={styles.uploadArea}
                            onClick={() => document.getElementById('categoryImageInput').click()}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    document.getElementById('categoryImageInput').click();
                                }
                            }}
                            role="button"
                            tabIndex={0}
                        >
                            <input
                                id="categoryImageInput"
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
                        <div className={styles.formActions}>
                            <Button type="button" variant="secondary" onClick={closeImageModal}>
                                Закрыть
                            </Button>
                            <Button type="submit" disabled={!imageFile || imageUploadBusy}>
                                {imageUploadBusy ? 'Загрузка…' : selectedCategory?.image_url ? 'Заменить' : 'Загрузить'}
                            </Button>
                        </div>
                    </form>
                </div>
            </Modal>

            <Modal
                isOpen={faqModalOpen}
                onClose={closeFaqModal}
                title={`FAQ категории ${selectedCategory?.name || ""}`}
            >
                {faqLoading ? (
                    <div className={styles.loading}>Загрузка...</div>
                ) : (
                    <form onSubmit={onSaveFaq} className={styles.form}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>
                                Доп информация (над карточкой товара)
                            </label>
                            <textarea
                                className={styles.formTextarea}
                                value={additionalInfoText}
                                onChange={(e) => setAdditionalInfoText(e.target.value)}
                                rows={3}
                                placeholder="Короткий текст, отображается над карточкой товара (меньшим шрифтом). Оставьте пустым, чтобы удалить."
                            />
                        </div>

                        {faqPairs.map((p, idx) => (
                            <div key={idx} style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                                <Input
                                    label={`Вопрос #${idx + 1}`}
                                    value={p.q}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setFaqPairs((prev) => prev.map((x, i) => (i === idx ? { ...x, q: v } : x)));
                                    }}
                                    placeholder="Введите вопрос"
                                />
                                <Input
                                    label="Ответ"
                                    value={p.a}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setFaqPairs((prev) => prev.map((x, i) => (i === idx ? { ...x, a: v } : x)));
                                    }}
                                    placeholder="Введите ответ"
                                />
                                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => setFaqPairs((prev) => prev.filter((_, i) => i !== idx).length ? prev.filter((_, i) => i !== idx) : [{ q: "", a: "" }])}
                                    >
                                        Удалить
                                    </Button>
                                </div>
                            </div>
                        ))}

                        {faqError ? (
                            <div style={{ color: "#ffb4b4", fontWeight: 700, marginBottom: 10 }}>
                                {faqError}
                            </div>
                        ) : null}

                        <div className={styles.formActions}>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setFaqPairs((prev) => [...prev, { q: "", a: "" }])}
                            >
                                + Вопрос
                            </Button>
                            <Button type="submit" disabled={faqLoading}>Сохранить</Button>
                        </div>
                    </form>
                )}
            </Modal>

            <Modal
                isOpen={checkoutModalOpen}
                onClose={closeCheckoutModal}
                title={`Данные для заказа — ${selectedCategory?.name || ""}`}
            >
                {checkoutLoading && !checkoutForm.title ? (
                    <div className={styles.loading}>Загрузка...</div>
                ) : (
                    <form onSubmit={onSaveCheckout} className={styles.form}>
                        <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>
                            Настраивайте на подкатегориях (2-й уровень), куда добавляются товары.
                        </p>
                        <Input
                            label="Ключ профиля (profile_type)"
                            value={checkoutForm.profile_type}
                            onChange={(e) =>
                                setCheckoutForm({ ...checkoutForm, profile_type: e.target.value })
                            }
                            placeholder="honkai_star_rail"
                        />
                        <Input
                            label="Название (игра / платформа)"
                            value={checkoutForm.title}
                            onChange={(e) =>
                                setCheckoutForm({ ...checkoutForm, title: e.target.value })
                            }
                        />
                        <Input
                            label="URL иконки (опционально)"
                            value={checkoutForm.icon_url}
                            onChange={(e) =>
                                setCheckoutForm({ ...checkoutForm, icon_url: e.target.value })
                            }
                            placeholder="https://..."
                        />
                        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                            <input
                                type="checkbox"
                                checked={checkoutForm.is_active}
                                onChange={(e) =>
                                    setCheckoutForm({ ...checkoutForm, is_active: e.target.checked })
                                }
                            />
                            Схема активна
                        </label>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Поля для покупателя</label>
                            <CheckoutFieldsEditor
                                fields={checkoutForm.fields}
                                onChange={(fields) => setCheckoutForm({ ...checkoutForm, fields })}
                            />
                        </div>
                        {checkoutError ? (
                            <div style={{ color: "#ffb4b4", fontWeight: 700, marginBottom: 10 }}>
                                {checkoutError}
                            </div>
                        ) : null}
                        <div className={styles.formActions}>
                            {checkoutEditing?.id ? (
                                <Button type="button" variant="secondary" onClick={onDeleteCheckout}>
                                    Удалить схему
                                </Button>
                            ) : null}
                            <Button type="submit" disabled={checkoutLoading}>
                                Сохранить
                            </Button>
                        </div>
                    </form>
                )}
            </Modal>

            <DuplicateSettingsModal
                isOpen={duplicateModalOpen}
                onClose={closeDuplicateModal}
                title="Копировать настройки категории"
                sourceLabel={duplicateSource ? `${getCategoryDisplayName(duplicateSource.name)} (#${duplicateSource.id})` : ''}
                fieldOptions={CATEGORY_DUPLICATE_FIELDS}
                targets={duplicateTargets}
                onSubmit={onDuplicateCategorySettings}
                busy={duplicateBusy}
            />
        </div>
    );
};