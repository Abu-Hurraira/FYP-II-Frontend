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

/** Remove template prefix like "a-" from "a-Course Objectives". */
export function stripFolderTemplatePrefix(name) {
  return String(name || "")
    .replace(/^[a-z]-\s*/i, "")
    .trim();
}
