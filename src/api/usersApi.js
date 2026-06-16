import request, { API_BASE_URL } from "./apiClient";
import { appendFormFile } from "../utils/appendFormFile";
import { GRADER_ROLE_ID } from "../utils/constants";

function isGraderUser(user) {
  const roleId = Number(user?.roleId ?? user?.RoleId);
  const roleName = String(user?.roleName ?? user?.RoleName ?? "").toLowerCase();
  return roleId === GRADER_ROLE_ID || roleName.includes("grader");
}

export const getUsers = async () => {
  return await request("/Users");
};

export const getFaculty = async () => {
  return await request("/Users/faculty");
};

export const getUsersByRole = async (roleName) => {
  return await request(`/Users/by-role/${roleName}`);
};

export const getGraderUsers = async () => {
  try {
    const byRole = await getUsersByRole("Grader");
    if (Array.isArray(byRole) && byRole.length > 0) return byRole;
  } catch {
    // Fall back to full user list when by-role endpoint misses rows.
  }

  const all = await getUsers();
  return (all || []).filter(isGraderUser);
};

export const getUsersDropdownByRole = async (roleName) => {
  return await request(`/Users/dropdown/by-role/${roleName}`);
};

export const createUser = async (user) => {
  return await request("/Users", {
    method: "POST",
    body: JSON.stringify(user),
  });
};

export const getUserById = async (userId) => {
  return await request(`/Users/${userId}`);
};

export const updateUser = async (userId, user) => {
  return await request(`/Users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(user),
  });
};

/** Update the logged-in user's name and email in the Users table (role preserved). */
export const updateProfile = async (userId, { fullName, email, roleId, rank, aridNo }) => {
  const payload = {
    fullName: fullName.trim(),
    email: email.trim(),
    roleId: Number(roleId),
    rank: rank ?? null,
    aridNo: aridNo ?? null,
  };
  await updateUser(userId, payload);
  return await getUserById(userId);
};

export const deleteUser = async (userId) => {
  return await request(`/Users/${userId}`, {
    method: "DELETE",
  });
};

export const importFacultyFromExcel = async (file) => {
  const formData = new FormData();
  appendFormFile(formData, "file", file, "faculty.xlsx");

  const response = await fetch(`${API_BASE_URL}/Users/import-faculty`, {
    method: "POST",
    body: formData,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || "Failed to import faculty.");
  }

  return data;
};
