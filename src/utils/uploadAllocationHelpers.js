import {
  asList,
  getTemplateAllocationType,
  isSubmissionUploadFolder,
  isTemplateFolderDirectory,
} from "./helpers";
import {
  canTeacherUpload,
  getAllocationForOfferedCourse,
} from "./hodUploadAllocationStorage";

export { canTeacherUpload, getAllocationForOfferedCourse };

function canAccessTemplateFolder(offeredCourseId, directoryName, config) {
  const type = getTemplateAllocationType(directoryName);
  return canTeacherUpload(offeredCourseId, type, config);
}

/** Whether this teacher can open/upload in this folder section. */
export function canAccessFolderSection(offeredCourseId, folder, config) {
  if (isSubmissionUploadFolder(folder)) {
    return true;
  }
  const directoryName = folder?.directoryName ?? folder?.DirectoryName ?? "";
  if (isTemplateFolderDirectory(directoryName)) {
    return canAccessTemplateFolder(offeredCourseId, directoryName, config);
  }
  return true;
}

export function canAccessWeeklyContent(offeredCourseId, config) {
  return canTeacherUpload(offeredCourseId, "clos", config);
}

function flagValue(permissions, keys) {
  if (!permissions) return false;
  if (!(permissions.configured ?? permissions.Configured)) {
    return false;
  }
  for (const key of keys) {
    if (permissions[key] != null) return Boolean(permissions[key]);
  }
  return false;
}

/** Whether this teacher may add/upload weekly content (CLO allocation). */
export function canUploadWeeklyContentFromPermissions(permissions) {
  return flagValue(permissions, ["clos", "Clos", "folderTemplate", "FolderTemplate"]);
}

/** Whether this teacher may add/upload CLOs (HOD Clos allocation). */
export function canManageClosFromPermissions(permissions) {
  return flagValue(permissions, ["clos", "Clos"]);
}

export function canManageCloPloFromPermissions(permissions) {
  return flagValue(permissions, ["cloPloMapping", "CloPloMapping", "clos", "Clos"]);
}

export function canManageCloTaskFromPermissions(permissions) {
  return flagValue(permissions, ["cloTaskMapping", "CloTaskMapping", "clos", "Clos"]);
}

export function canManageMidFromPermissions(permissions) {
  return flagValue(permissions, ["mid", "Mid"]);
}

export function canManageFinalFromPermissions(permissions) {
  return flagValue(permissions, ["final", "Final"]);
}

/** Normalize API ContentStatus / ApprovalStatus for teacher CLO UI. */
export function getCloApprovalStatus(item) {
  const raw = String(
    item?.approvalStatus ??
      item?.ApprovalStatus ??
      item?.contentStatus ??
      item?.ContentStatus ??
      "Draft"
  ).toLowerCase();
  if (raw === "pendingreview" || raw === "pending") return "pending";
  if (raw === "approved") return "approved";
  if (raw === "rejected") return "rejected";
  return "draft";
}

/** Other teachers may only see HOD-approved CLOs unless they are the allocated teacher. */
export function isApprovedClo(item) {
  return getCloApprovalStatus(item) === "approved";
}

export function filterClosForViewer(items, canManage, isAllocatedTeacher = false) {
  const list = asList(items);
  if (canManage || isAllocatedTeacher) return list;
  return list.filter(isApprovedClo);
}

export function pickContentTypeStatusRow(statuses, contentTypeCode) {
  const list = Array.isArray(statuses)
    ? statuses
    : Array.isArray(statuses?.$values)
      ? statuses.$values
      : [];
  return (
    list.find(
      (item) => String(item?.contentTypeCode ?? item?.ContentTypeCode ?? "") === contentTypeCode
    ) || null
  );
}

export function pickContentTypeStatus(statuses, contentTypeCode, fallback = "Draft") {
  const row = pickContentTypeStatusRow(statuses, contentTypeCode);
  return row?.contentStatus ?? row?.ContentStatus ?? fallback;
}

export function pickHodFeedback(statuses, contentTypeCode) {
  const row = pickContentTypeStatusRow(statuses, contentTypeCode);
  return String(row?.hodFeedback ?? row?.HodFeedback ?? "").trim();
}
