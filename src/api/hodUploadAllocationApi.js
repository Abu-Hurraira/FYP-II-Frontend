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
