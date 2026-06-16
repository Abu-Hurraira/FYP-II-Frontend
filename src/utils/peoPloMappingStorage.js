const storageKey = (programId) => `hod-peo-plo-mapping-${programId}`;

/**
 * Matrix structure:
 * {
 *   [peoId]: { [ploId]: true }
 * }
 *
 * Checkbox-only mapping: existence of the row means "mapped".
 */
export function loadPeoPloMapping(programId) {
  try {
    const raw = localStorage.getItem(storageKey(programId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function savePeoPloMapping(programId, matrix) {
  localStorage.setItem(storageKey(programId), JSON.stringify(matrix || {}));
}

