import request from "./apiClient";
import { appendFormFile } from "../utils/appendFormFile";
import { applyLatestOutcomeCatalog } from "./outcomeCatalogApi";

function normalizePlo(raw) {
  if (!raw || typeof raw !== "object") return raw;
  return {
    ploId: raw.ploId ?? raw.PloId ?? raw.ploid,
    programId: raw.programId ?? raw.ProgramId,
    ploCode: raw.ploCode ?? raw.PloCode ?? raw.plocode ?? "",
    ploDescription: raw.ploDescription ?? raw.PloDescription ?? raw.plodescription ?? "",
    outcomeStatus: raw.outcomeStatus ?? raw.OutcomeStatus ?? "New",
  };
}

export const getPLOsByProgram = async (programId) => {
  const data = await request(`/PLOs/by-program/${programId}`);
  return (Array.isArray(data) ? data : []).map(normalizePlo);
};

export const createPLO = async (plo) => {
  return await request("/PLOs", {
    method: "POST",
    body: JSON.stringify({
      programId: plo.programId,
      ploCode: plo.ploCode,
      ploDescription: plo.ploDescription,
    }),
  });
};

export const updatePLO = async (ploId, plo) => {
  return await request(`/PLOs/${ploId}`, {
    method: "PUT",
    body: JSON.stringify({
      ploCode: plo.ploCode,
      ploDescription: plo.ploDescription,
    }),
  });
};

export const deletePLO = async (ploId) => {
  return await request(`/PLOs/${ploId}`, {
    method: "DELETE",
  });
};

export const restorePLOsByProgram = async (programId) => {
  return await applyLatestOutcomeCatalog("PLO", programId);
};

export const importPLOs = async (programId, file) => {
  const formData = new FormData();
  appendFormFile(formData, "file", file, "plos.xlsx");

  return await request(`/PLOs/import/${programId}`, {
    method: "POST",
    body: formData,
    timeoutMs: 120000,
  });
};
