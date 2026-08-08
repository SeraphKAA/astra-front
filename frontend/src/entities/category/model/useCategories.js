import { useQuery } from "@tanstack/react-query";
import {
    getAllCategories,
    getFirstCategory,
    getCategoryTree,
} from "../api/categoryApi";

/* ========================
   ALL
======================== */

export const useCategories = () => {
    return useQuery({
        queryKey: ["categories"],
        queryFn: getAllCategories,
    });
};

/* ========================
   FIRST (ALL root)
======================== */

export const useFirstCategory = () => {
    return useQuery({
        queryKey: ["categories", "first"],
        queryFn: getFirstCategory,
    });
};

/* ========================
   TREE
======================== */

export const useCategoryTree = (categoryId) => {
    return useQuery({
        queryKey: ["category-tree", categoryId],
        queryFn: () => getCategoryTree(categoryId),
        enabled: !!categoryId,
    });
};
