import { apiRequest } from "../../../shared/commonApi";

export const listMyUserProfiles = () => {
  return apiRequest({
    url: "/user-profiles/me",
  });
};

export const listProfileTemplates = () => {
  return apiRequest({
    url: "/user-profiles/templates",
  });
};

export const upsertMyUserProfile = ({ provider, profile_type, data }) => {
  return apiRequest({
    url: "/user-profiles/me",
    method: "POST",
    body: { provider, profile_type, data },
  });
};

export const deleteMyUserProfile = (profileId) => {
  return apiRequest({
    url: `/user-profiles/me/${encodeURIComponent(profileId)}`,
    method: "DELETE",
  });
};

