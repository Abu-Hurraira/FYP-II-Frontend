import {
  canTeacherUpload,
  getAllocationForOfferedCourse,
} from "./hodUploadAllocationStorage";

export { canTeacherUpload, getAllocationForOfferedCourse };

export function mapCategoryToAllocationType(category) {
  const value = String(category || "").toLowerCase();
  if (value.includes("mid exam") || value === "mid") return "mid";
  if (value.includes("final exam") || value === "final") return "final";
  return "folderTemplate";
}

export function filterCategoriesByAllocation(categories, offeredCourseId, config) {
  const list = Array.isArray(categories) ? categories : [];
  return list.filter((category) => {
    const type = mapCategoryToAllocationType(category);
    return canTeacherUpload(offeredCourseId, type, config);
  });
}

export function hasAnyFolderUploadPermission(offeredCourseId, config) {
  const alloc = getAllocationForOfferedCourse(offeredCourseId, config);
  return Boolean(alloc.mid || alloc.final || alloc.folderTemplate);
}

export function canAccessWeeklyContent(offeredCourseId, config) {
  return canTeacherUpload(offeredCourseId, "clos", config);
}
