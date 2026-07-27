import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { updateProfile } from "../../api/usersApi";
import theme from "../../styles/theme";
import { showAlert } from "../../utils/dialogs";
import { getAuthRoleId, getAuthUserId } from "../../utils/helpers";

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function ProfileScreen() {
  const { user, updateStoredUser } = useContext(AuthContext);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const displayName = user?.fullName || user?.name || "";
  const roleLabel = user?.roleName || "User";
  const initials = useMemo(() => getInitials(displayName || email), [displayName, email]);

  useEffect(() => {
    setFullName(user?.fullName || user?.name || "");
    setEmail(user?.email || "");
  }, [user]);

  const handleSave = async () => {
    if (!fullName.trim()) {
      showAlert("Validation Error", "Name is required.");
      return;
    }
    if (!email.trim()) {
      showAlert("Validation Error", "Email is required.");
      return;
    }
    const userId = getAuthUserId(user);
    const roleId = getAuthRoleId(user);

    if (!userId) {
      showAlert("Error", "Unable to identify your account. Please log out and log in again.");
      return;
    }
    if (!roleId) {
      showAlert("Error", "Your account role is missing. Please log out and log in again.");
      return;
    }

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    try {
      setSaving(true);
      const savedUser = await updateProfile(userId, {
        fullName: trimmedName,
        email: trimmedEmail,
        roleId,
        rank: user.rank ?? user.Rank ?? null,
        aridNo: user.aridNo ?? user.AridNo ?? null,
      });

      await updateStoredUser({
        ...user,
        ...savedUser,
        fullName: savedUser.fullName ?? trimmedName,
        name: savedUser.fullName ?? trimmedName,
        email: savedUser.email ?? trimmedEmail,
      });

      showAlert("Success", "Your profile has been saved.");
    } catch (error) {
      showAlert("Update Failed", error.message);
    } finally {
      setSaving(false);
    }
  };

  const isDirty =
    fullName.trim() !== (user?.fullName || user?.name || "").trim() ||
    email.trim() !== (user?.email || "").trim();

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="mt-1" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Profile</h1>
          <p className="mt-0.5 text-xs text-gray-500">Manage your account information</p>
        </div>
      </div>

      <div className="w-full px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div
              className="px-5 py-4 text-center"
              style={{
                background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryDark} 100%)`,
              }}
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/30 bg-white/20 text-lg font-bold text-white shadow-md backdrop-blur-sm">
                {initials}
              </div>
              <h2 className="mt-2.5 text-base font-semibold text-white">{displayName || "Your profile"}</h2>
              <p className="mt-0.5 text-xs text-white/85">{user?.email || "—"}</p>
              <span className="mt-2 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                {roleLabel}
              </span>
            </div>

            <form
              className="space-y-5 p-6"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              <div>
                <label htmlFor="profile-name" className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Full name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>

              <div>
                <label htmlFor="profile-email" className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Email address
                </label>
                
                <input
                  id="profile-email"
                  type="email"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
                  placeholder="you@biit.edu.pk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Role</p>
                <p className="mt-1 text-sm font-semibold" style={{ color: theme.colors.primary }}>
                  {roleLabel}
                </p>
                <p className="mt-1 text-xs text-gray-500">Your role is assigned by an administrator and cannot be changed here.</p>
              </div>

              <button
                type="submit"
                disabled={saving || !isDirty}
                className="app-btn-primary app-btn-primary-block rounded-lg py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  "Save changes"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
