import request from "./apiClient";

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj?.[key] != null) return obj[key];
  }
  return undefined;
}

/** Convert API PeoPloMatrixDto → { [peoId]: { [ploId]: true } } */
export function matrixFromPeoPloApi(data) {
  const matrix = {};
  const peos = pick(data, "peos", "Peos") || [];
  for (const peo of peos) {
    const peoId = String(pick(peo, "peoId", "PeoId"));
    const cells = pick(peo, "cells", "Cells") || [];
    for (const cell of cells) {
      if (pick(cell, "isMapped", "IsMapped")) {
        const ploId = String(pick(cell, "ploId", "PloId"));
        if (!matrix[peoId]) matrix[peoId] = {};
        matrix[peoId][ploId] = true;
      }
    }
  }
  return matrix;
}

export async function getPeoPloMatrix(programId) {
  return await request(`/PEOPLEMappings/programs/${programId}/matrix`);
}

export async function savePeoPloMatrix(programId, { mappedByUserId, cells }) {
  return await request(`/PEOPLEMappings/programs/${programId}/matrix`, {
    method: "PUT",
    body: JSON.stringify({
      mappedByUserId,
      cells,
    }),
  });
}

/** Build save payload from checkbox matrix. */
export function peoPloMatrixToCells(matrix) {
  const cells = [];
  for (const [peoId, row] of Object.entries(matrix || {})) {
    for (const [ploId, mapped] of Object.entries(row || {})) {
      if (mapped) {
        cells.push({
          peoId: Number(peoId),
          ploId: Number(ploId),
          isMapped: true,
        });
      }
    }
  }
  return cells;
}
