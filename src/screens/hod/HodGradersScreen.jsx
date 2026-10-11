import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { getGraderAllocations, deleteGraderAllocation } from "../../api/graderAllocationsApi";
import { getAuthUserId } from "../../utils/helpers";
import theme from "../../styles/theme";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function PersonCell({ name, sub, tone = "green" }) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${toneClass}`}
      >
        {initials(name)}
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold text-gray-900 dark:text-white">{name || "—"}</p>
        {sub ? (
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">{sub}</p>
        ) : null}
      </div>
    </div>
  );
}

export default function HodGradersScreen() {
  const { user } = useContext(AuthContext);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listSearch, setListSearch] = useState("");

  const userId = getAuthUserId(user);

  const loadAllocations = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await getGraderAllocations();
      const mine = (data || []).filter(
        (item) => Number(item.teacherUserId ?? item.TeacherUserId) === Number(userId)
      );
      setAllocations(mine);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllocations();
  }, [userId]);

  const removeAllocation = async (item) => {
    if (!(await showConfirm("Remove Allocation", "Remove this grader allocation?"))) return;
    try {
      await deleteGraderAllocation(item.graderAllocationId);
      await loadAllocations();
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const filteredAllocations = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return allocations;
    return allocations.filter(
      (item) =>
        String(item.teacherName ?? "").toLowerCase().includes(q) ||
        String(item.teacherEmail ?? "").toLowerCase().includes(q) ||
        String(item.graderName ?? "").toLowerCase().includes(q) ||
        String(item.graderAridNo ?? "").toLowerCase().includes(q) ||
        String(item.graderEmail ?? "").toLowerCase().includes(q)
    );
  }, [allocations, listSearch]);

  return (
    <div className="min-h-full bg-page">
      <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6 lg:px-8 dark:border-[#1b2c2e] dark:bg-[#0c181a]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <PageBackButton />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">All Graders</h1>
                {!loading ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    {filteredAllocations.length}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Graders assigned to you
              </p>
            </div>
          </div>
          <div className="flex w-full max-w-xs items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 sm:w-72 dark:border-[#1b2c2e] dark:bg-[#091517]">
            <svg
              className="h-4 w-4 shrink-0 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
            <input
              className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
              placeholder="Search graders..."
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="w-full px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : filteredAllocations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center shadow-card dark:border-[#1b2c2e] dark:bg-[#0c181a]">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {listSearch ? "No graders match your search." : "No graders assigned yet."}
            </p>
            {!listSearch ? (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                When section admin assigns graders to you, they will appear here.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card dark:border-[#1b2c2e] dark:bg-[#0c181a]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-[#091517] dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3.5">Teacher</th>
                    <th className="px-4 py-3.5">Email</th>
                    <th className="px-4 py-3.5">Grader</th>
                    <th className="px-4 py-3.5">ARID</th>
                    <th className="px-4 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#1b2c2e]">
                  {filteredAllocations.map((item) => {
                    const teacherName = item.teacherName || user?.fullName || "Teacher";
                    const teacherEmail = item.teacherEmail || user?.email || "—";
                    return (
                      <tr
                        key={item.graderAllocationId}
                        className="transition-colors hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20"
                      >
                        <td className="px-4 py-3.5">
                          <PersonCell name={teacherName} tone="slate" />
                        </td>
                        <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">
                          {teacherEmail}
                        </td>
                        <td className="px-4 py-3.5">
                          <PersonCell name={item.graderName || "—"} sub={item.graderEmail} />
                        </td>
                        <td className="px-4 py-3.5">
                          {item.graderAridNo ? (
                            <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-slate-800 dark:text-slate-200">
                              {item.graderAridNo}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => removeAllocation(item)}
                            className="rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
