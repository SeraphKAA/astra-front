// queries
export {
    useCategories,
    useFirstCategory,
    useCategoryTree,
} from "./model/useCategories";

// mutations
export {
    useCreateCategory,
    useDeleteCategory,
} from "./model/useCategoryMutations";

// api (если нужно)
export {
    getAllCategories,
    getFirstCategory,
    getCategoryTree,
    createCategory,
    deleteCategory,
} from "./api/categoryApi";
