import { apiRequest } from "../../../shared/commonApi";

// Admin/moderator-only endpoints for managing the small "additional info"
// block that is rendered above the product card on the product page.
// The public read happens via the FAQ "by-category" endpoint, which returns
// both `faq` and `additional_info` in one response.

export const getAllCategoryAdditionalInfo = () => {
  return apiRequest({
    url: "/category-additional-info/",
  });
};

export const createCategoryAdditionalInfo = ({ category_id, info }) => {
  return apiRequest({
    url: "/category-additional-info/",
    method: "POST",
    body: { category_id, info },
  });
};

export const updateCategoryAdditionalInfo = ({ id, info }) => {
  return apiRequest({
    url: `/category-additional-info/${id}`,
    method: "PATCH",
    body: { info },
  });
};

export const deleteCategoryAdditionalInfo = (id) => {
  return apiRequest({
    url: `/category-additional-info/${id}`,
    method: "DELETE",
  });
};
