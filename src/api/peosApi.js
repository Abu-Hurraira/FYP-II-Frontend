import request from "./apiClient";
import { appendFormFile } from "../utils/appendFormFile";
import { applyLatestOutcomeCatalog } from "./outcomeCatalogApi";

function normalizePeo(raw) {
  if (!raw || typeof raw !== "object") return raw;
  return {
    peoId: raw.peoId ?? raw.PeoId ?? raw.peoid,
    programId: raw.programId ?? raw.ProgramId,
    peoCode: raw.peoCode ?? raw.PeoCode ?? raw.peocode ?? "",
    peoDescription: raw.peoDescription ?? raw.PeoDescription ?? raw.peodescription ?? "",
    outcomeStatus: raw.outcomeStatus ?? raw.OutcomeStatus ?? "New",
  };
}

export const getPEOsByProgram = async (programId) => {
  const data = await request(`/PEOs/by-program/${programId}`);
  return (Array.isArray(data) ? data : []).map(normalizePeo);
};

export const createPEO = async (peo) => {
  return await request("/PEOs", {
    method: "POST",
    body: JSON.stringify({
      programId: peo.programId,
      peoCode: peo.peoCode,
      peoDescription: peo.peoDescription,
    }),
  });
};

export const updatePEO = async (peoId, peo) => {
  return await request(`/PEOs/${peoId}`, {
    method: "PUT",
    body: JSON.stringify({
      peoCode: peo.peoCode,
      peoDescription: peo.peoDescription,
    }),
  });
};

export const deletePEO = async (peoId) => {
  return await request(`/PEOs/${peoId}`, {
    method: "DELETE",
  });
};

export const restorePEOsByProgram = async (programId) => {
  return await applyLatestOutcomeCatalog("PEO", programId);
};

export const importPEOs = async (programId, file) => {
  const formData = new FormData();
  appendFormFile(formData, "file", file, "peos.xlsx");

  return await request(`/PEOs/import/${programId}`, {
    method: "POST",
    body: formData,
    timeoutMs: 120000,
  });
};
