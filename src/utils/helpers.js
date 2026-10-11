/** Unwrap API list payloads (`[]`, `{ items }`, `{ $values }`, etc.). */
export function asList(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data.$values)) return data.$values;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.Items)) return data.Items;
  if (Array.isArray(data.value)) return data.value;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

/** Normalize user object from API / localStorage (camelCase + PascalCase). */
export function normalizeAuthUser(user) {
  if (!user) return null;
  const userId = user.userId ?? user.UserId ?? user.id ?? user.Id ?? null;
  const roleId = user.roleId ?? user.RoleId ?? user.role?.roleId ?? user.role?.RoleId ?? null;
  return {
    ...user,
    userId: userId != null ? Number(userId) : null,
    roleId: roleId != null ? Number(roleId) : null,
    fullName: user.fullName ?? user.FullName ?? user.name ?? user.Name ?? "",
    email: user.email ?? user.Email ?? "",
    roleName: user.roleName ?? user.RoleName ?? user.role ?? "",
    rank: user.rank ?? user.Rank ?? null,
    aridNo: user.aridNo ?? user.AridNo ?? null,
  };
}

export function getAuthUserId(user) {
  const id = user?.userId ?? user?.UserId ?? user?.id ?? user?.Id;
  return id != null && id !== "" ? Number(id) : null;
}

export function getAuthRoleId(user) {
  const id = user?.roleId ?? user?.RoleId ?? user?.role?.roleId ?? user?.role?.RoleId;
  return id != null && id !== "" ? Number(id) : null;
}

export function getAuthDisplayName(user, fallback = "User") {
  if (!user) return fallback;
  const name = String(
    user.fullName ?? user.FullName ?? user.name ?? user.Name ?? ""
  ).trim();
  return name || fallback;
}

export function getAuthRoleLabel(user, fallback = "User") {
  if (!user) return fallback;
  const role = String(user.roleName ?? user.RoleName ?? user.role ?? user.Role ?? "").trim();
  return role || fallback;
}

/** Display teacher · course · section with spacing (avoids HamzaAppliedPhysicsBAI5A). */
export function formatSubmittedFolderLabel(overview) {
  const teacher = String(overview?.teacherName ?? overview?.TeacherName ?? "").trim();
  const course = String(overview?.courseTitle ?? overview?.CourseTitle ?? "").trim();
  const section = String(overview?.sectionName ?? overview?.SectionName ?? "").trim();
  const parts = [teacher, course, section].filter(Boolean);
  if (parts.length >= 2) return parts.join(" · ");

  const root = String(overview?.rootFolderName ?? overview?.RootFolderName ?? "").trim();
  if (root) {
    return root
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
      .trim();
  }

  return parts[0] || "";
}

/** Folders like "a-Course Objectives" / "b-Lesson Plans". */
export function isTemplateFolderDirectory(directoryName) {
  return /^[a-z]-\s*/i.test(String(directoryName || "").trim());
}

/** Quiz / assignment / exam submit folder (locks only after course folder is submitted). */
export function isSubmissionUploadFolder(folder) {
  if (!folder) return false;
  if (isTemplateFolderDirectory(folder.directoryName ?? folder.DirectoryName)) {
    return false;
  }
  const categories = folder.allowedFileCategories ?? folder.AllowedFileCategories ?? [];
  if (!categories.length) return true;
  return categories.some((category) => {
    const value = String(category).toLowerCase();
    return (
      value.includes("assignment") ||
      value.includes("quiz") ||
      value.includes("mid exam") ||
      value.includes("final exam")
    );
  });
}

export function getTemplateAllocationType(directoryName) {
  const name = String(directoryName || "")
    .replace(/^[a-z]-\s*/i, "")
    .trim()
    .toLowerCase();
  if (name.includes("clo") || name.includes("course objective")) return "clos";
  if (name.includes("mid")) return "mid";
  if (name.includes("final")) return "final";
  return "folderTemplate";
}

/** Remove template prefix like "a-" from "a-Course Objectives". */
export function stripFolderTemplatePrefix(name) {
  return String(name || "")
    .replace(/^[a-z]-\s*/i, "")
    .trim();
}

export function folderDisplayName(folder) {
  const named = folder?.folderItemName ?? folder?.FolderItemName;
  if (named) {
    return String(named).trim();
  }

  return stripFolderTemplatePrefix(folder?.directoryName ?? folder?.DirectoryName);
}
