import {
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

/** Whether this teacher may add/upload weekly content (CLO allocation). */
export function canUploadWeeklyContentFromPermissions(permissions) {
  if (!permissions) return false;
  return Boolean(permissions.clos ?? permissions.Clos);
}

/** Whether this teacher may add/upload CLOs (HOD Clos allocation). */
export function canManageClosFromPermissions(permissions) {
  if (!permissions) return false;
  const clos = Boolean(permissions.clos ?? permissions.Clos);
  // When HOD allocation is configured, only the Clos-flagged teacher manages drafts.
  if (permissions.configured ?? permissions.Configured) {
    return clos;
  }
  // Allocation not set up yet — allow CLO authoring during early setup.
  return clos;
}

/** Other teachers may only see HOD-approved CLOs. */
export function isApprovedClo(item) {
  return String(item?.approvalStatus ?? item?.ApprovalStatus ?? "").toLowerCase() === "approved";
}

export function filterClosForViewer(items, canManage) {
  const list = items || [];
  if (canManage) return list;
  return list.filter(isApprovedClo);
}
