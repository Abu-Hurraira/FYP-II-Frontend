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
