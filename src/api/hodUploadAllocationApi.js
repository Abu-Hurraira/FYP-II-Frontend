import request from "./apiClient";
import { normalizeAllocationConfig } from "../utils/hodUploadAllocationStorage";

export async function getHodUploadAllocation() {
  const data = await request("/HodUploadAllocation");
  return normalizeAllocationConfig(data);
}

/** Per-section upload flags for teacher UI. */
export function normalizeOfferedCourseUploadPermissions(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      clos: false,
      cloPloMapping: false,
      cloTaskMapping: false,
      mid: false,
      final: false,
      folderTemplate: false,
      configured: false,
      isAllocatedTeacher: false,
    };
  }
  return {
    offeredCourseId: raw.offeredCourseId ?? raw.OfferedCourseId,
    configured: Boolean(raw.configured ?? raw.Configured),
    clos: Boolean(raw.clos ?? raw.Clos),
    cloPloMapping: Boolean(raw.cloPloMapping ?? raw.CloPloMapping),
    cloTaskMapping: Boolean(raw.cloTaskMapping ?? raw.CloTaskMapping),
    mid: Boolean(raw.mid ?? raw.Mid),
    final: Boolean(raw.final ?? raw.Final),
    folderTemplate: Boolean(raw.folderTemplate ?? raw.FolderTemplate),
    isAllocatedTeacher: Boolean(raw.isAllocatedTeacher ?? raw.IsAllocatedTeacher),
  };
}

export async function getOfferedCourseUploadPermissions(offeredCourseId, teacherUserId) {
  const qs =
    teacherUserId != null && teacherUserId !== ""
      ? `?teacherUserId=${encodeURIComponent(teacherUserId)}`
      : "";
  const data = await request(`/HodUploadAllocation/offered-course/${offeredCourseId}${qs}`);
  return normalizeOfferedCourseUploadPermissions(data);
}

export async function saveHodUploadAllocation(config, hodUserId) {
  const allocations = config?.allocations ?? {};
  const payload = {
    hodUserId: Number(hodUserId) || 0,
    configured: Boolean(config?.configured),
    allocations,
    items: Object.entries(allocations).map(([id, row]) => ({
      offeredCourseId: Number(id),
      clos: Boolean(row?.clos),
      cloPloMapping: Boolean(row?.cloPloMapping),
      cloTaskMapping: Boolean(row?.cloTaskMapping),
      mid: Boolean(row?.mid),
      final: Boolean(row?.final),
      folderTemplate: Boolean(row?.folderTemplate),
    })),
    updatedAt: new Date().toISOString(),
  };

  const data = await request("/HodUploadAllocation", {
    method: "PUT",
    body: JSON.stringify(payload),
    timeoutMs: 120000,
  });
  return normalizeAllocationConfig(data ?? payload);
}

export async function clearHodUploadAllocation() {
  const data = await request("/HodUploadAllocation", {
    method: "DELETE",
    timeoutMs: 60000,
  });
  return normalizeAllocationConfig(data);
}
