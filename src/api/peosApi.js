import request, { API_BASE_URL } from "./apiClient";
import { appendFormFile } from "../utils/appendFormFile";

export const getPEOsByProgram = async (programId, { includeArchived = false } = {}) => {
  const query = includeArchived ? "?includeArchived=true" : "";
  return await request(`/PEOs/by-program/${programId}${query}`);
};

export const createPEO = async (peo) => {
  return await request("/PEOs", {
    method: "POST",
    body: JSON.stringify(peo),
  });
};

export const updatePEO = async (peoId, peo, { archiveId } = {}) => {
  const path = archiveId != null ? `/PEOs/archive/${archiveId}` : `/PEOs/${peoId}`;
  return await request(path, {
    method: "PUT",
    body: JSON.stringify(peo),
  });
};

export const deletePEO = async (peoId, { archiveId } = {}) => {
  const path = archiveId != null ? `/PEOs/archive/${archiveId}` : `/PEOs/${peoId}`;
  return await request(path, {
    method: "DELETE",
  });
};

export const restorePEOsByProgram = async (programId) => {
  return await request(`/PEOs/restore-by-program/${programId}`, {
    method: "POST",
  });
};

export const importPEOs = async (programId, file) => {
  const formData = new FormData();
  appendFormFile(formData, "file", file, "peos.xlsx");

  const response = await fetch(`${API_BASE_URL}/PEOs/import/${programId}`, {
    method: "POST",
    body: formData,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || "Failed to import PEOs.");
  }

  return data;
};