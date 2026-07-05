import request from "./apiClient";
import {
  loadUploadAllocationConfig,
  normalizeAllocationConfig,
  saveUploadAllocationConfig,
} from "../utils/hodUploadAllocationStorage";

/**
 * Backend (when ready):
 * GET  /api/HodUploadAllocation
 * PUT  /api/HodUploadAllocation  body: { configured, allocations }
 */
export async function getHodUploadAllocation() {
  try {
    const data = await request("/HodUploadAllocation");
    return normalizeAllocationConfig(data);
  } catch (error) {
    if (error?.message?.includes("404") || error?.message?.toLowerCase?.().includes("not found")) {
      return loadUploadAllocationConfig();
    }
    return loadUploadAllocationConfig();
  }
}

/** Per-section upload flags for teacher UI (CLO weekly content uses `clos`). */
export function normalizeOfferedCourseUploadPermissions(raw) {
  if (!raw || typeof raw !== "object") {
    return { clos: true, mid: true, final: true, folderTemplate: true, configured: false };
  }
  return {
    offeredCourseId: raw.offeredCourseId ?? raw.OfferedCourseId,
    configured: Boolean(raw.configured ?? raw.Configured),
    clos: Boolean(raw.clos ?? raw.Clos),
    mid: Boolean(raw.mid ?? raw.Mid),
    final: Boolean(raw.final ?? raw.Final),
    folderTemplate: Boolean(raw.folderTemplate ?? raw.FolderTemplate),
  };
}

export async function getOfferedCourseUploadPermissions(offeredCourseId) {
  const data = await request(`/HodUploadAllocation/offered-course/${offeredCourseId}`);
  return normalizeOfferedCourseUploadPermissions(data);
}

export async function saveHodUploadAllocation(config) {
  const payload = {
    configured: Boolean(config?.configured),
    allocations: config?.allocations ?? {},
    updatedAt: new Date().toISOString(),
  };

  try {
    const data = await request("/HodUploadAllocation", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const normalized = normalizeAllocationConfig(data ?? payload);
    saveUploadAllocationConfig(normalized);
    return normalized;
  } catch {
    return saveUploadAllocationConfig(payload);
  }
}
