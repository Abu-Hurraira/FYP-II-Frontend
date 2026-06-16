import request from "./apiClient";

export const getRoles = async () => {
  return await request("/Roles");
};

export const getRolesDropdown = async () => {
  return await request("/Roles/dropdown");
};