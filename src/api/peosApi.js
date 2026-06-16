import request, { API_BASE_URL } from "./apiClient";
import { appendFormFile } from "../utils/appendFormFile";

export const getPEOsByProgram = async (programId) => {
  return await request(`/PEOs/by-program/${programId}`);
};

export const createPEO = async (peo) => {
  return await request("/PEOs", {
    method: "POST",
    body: JSON.stringify(peo),
  });
};

export const updatePEO = async (peoId, peo) => {
  return await request(`/PEOs/${peoId}`, {
    method: "PUT",
    body: JSON.stringify(peo),
  });
};

export const deletePEO = async (peoId) => {
  return await request(`/PEOs/${peoId}`, {
    method: "DELETE",
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