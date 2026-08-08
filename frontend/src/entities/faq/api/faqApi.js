import { apiRequest } from "../../../shared/commonApi";

// Returns combined payload: { faq: CategoryFaqOutDto | null, additional_info: CategoryAdditionalInfoOutDto | null }
export const getCategoryFaqByCategoryId = (categoryId) => {
  return apiRequest({
    url: `/category-faq/by-category/${categoryId}`,
    authorized: false,
  });
};

export const getAllCategoryFaq = () => {
  return apiRequest({
    url: "/category-faq/",
  });
};

export const createCategoryFaq = ({ category_id, faq }) => {
  return apiRequest({
    url: "/category-faq/",
    method: "POST",
    body: { category_id, faq },
  });
};

export const updateCategoryFaq = ({ id, faq }) => {
  return apiRequest({
    url: `/category-faq/${id}`,
    method: "PATCH",
    body: { faq },
  });
};

export const deleteCategoryFaq = (id) => {
  return apiRequest({
    url: `/category-faq/${id}`,
    method: "DELETE",
  });
};

