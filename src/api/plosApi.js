import request, { API_BASE_URL } from "./apiClient";
import { appendFormFile } from "../utils/appendFormFile";

export const getPLOsByProgram = async (programId, { includeArchived = false } = {}) => {
  const query = includeArchived ? "?includeArchived=true" : "";
  return await request(`/PLOs/by-program/${programId}${query}`);
};

export const createPLO = async (plo) => {
  return await request("/PLOs", {
    method: "POST",
    body: JSON.stringify(plo),
  });
};

export const updatePLO = async (ploId, plo, { archiveId } = {}) => {
  const path = archiveId != null ? `/PLOs/archive/${archiveId}` : `/PLOs/${ploId}`;
  return await request(path, {
    method: "PUT",
    body: JSON.stringify(plo),
  });
};

export const deletePLO = async (ploId, { archiveId } = {}) => {
  const path = archiveId != null ? `/PLOs/archive/${archiveId}` : `/PLOs/${ploId}`;
  return await request(path, {
    method: "DELETE",
  });
};

export const restorePLOsByProgram = async (programId) => {
  return await request(`/PLOs/restore-by-program/${programId}`, {
    method: "POST",
  });
};

export const importPLOs = async (programId, file) => {
  const formData = new FormData();
  appendFormFile(formData, "file", file, "plos.xlsx");

  const response = await fetch(`${API_BASE_URL}/PLOs/import/${programId}`, {
    method: "POST",
    body: formData,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || "Failed to import PLOs.");
  }

  return data;
};
