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
