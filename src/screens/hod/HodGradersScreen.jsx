import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { getGraderAllocations, deleteGraderAllocation } from "../../api/graderAllocationsApi";
import { getAuthUserId } from "../../utils/helpers";
import theme from "../../styles/theme";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert, showConfirm } from "../../utils/dialogs";

function getInitials(name) {
  const parts = String(name || "").trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function HodGradersScreen() {
  const { user } = useContext(AuthContext);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listSearch, setListSearch] = useState("");

  const roleLabel = user?.roleName || "HOD";
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
    <div className="min-h-full w-full bg-page p-4 sm:p-6 lg:p-8">
      {/* ── Main Container Box (Full Width Across Page) ── */}
      <div
        className="w-full rounded-3xl border p-5 shadow-2xl sm:p-6"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        {/* Header Top Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3.5">
            <PageBackButton />
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
              style={{ backgroundColor: "var(--brand-dark)" }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
                All Graders
              </h1>
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                View and manage all registered graders assigned to you
              </p>
            </div>
          </div>

          {/* Right side Controls: Search bar + Filter icon */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center gap-2 rounded-xl border px-3.5 py-2"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--text-muted)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                className="w-48 bg-transparent text-sm outline-none sm:w-72"
                style={{ color: "var(--text)" }}
                placeholder="Search graders..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
              />
            </div>

            {/* Filter button */}
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm transition hover:opacity-90"
              style={{ backgroundColor: "var(--brand)" }}
              title="Clear search"
              onClick={() => setListSearch("")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M8 12h8M11 20h2" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Cards List ── */}
        <div className="mt-5">
          {loading ? (
            <div className="flex justify-center py-20">
              <div
                className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
                style={{ borderTopColor: theme.colors.primary }}
              />
            </div>
          ) : filteredAllocations.length === 0 ? (
            <div
              className="my-6 rounded-2xl border border-dashed px-6 py-14 text-center"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
            >
              <svg className="mx-auto mb-3 h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--text-muted)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2h5M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
              </svg>
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
                {listSearch ? "No graders match your search." : "No graders assigned yet."}
              </p>
              {!listSearch && (
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  When section admin assigns graders to you, they will appear here.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {filteredAllocations.map((item) => (
                <div
                  key={item.graderAllocationId}
                  className="flex items-center justify-between gap-6 rounded-2xl border p-4 shadow-lg transition-all hover:bg-emerald-500/5"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    borderColor: "var(--border)",
                    borderLeftColor: "var(--brand)",
                    borderLeftWidth: "4px",
                  }}
                >
                  {/* Avatar Icon */}
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                    style={{ backgroundColor: "var(--brand-dark)" }}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>

                  {/* Teacher name + role badge */}
                  <div className="w-40 shrink-0">
                    <p className="truncate text-sm font-bold" style={{ color: "var(--text)" }}>
                      {item.teacherName || user?.fullName || "Teacher"}
                    </p>
                    <span
                      className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                      style={{
                        backgroundColor: "var(--brand-muted)",
                        color: "var(--brand)",
                        border: "1px solid var(--brand-soft)",
                      }}
                    >
                      {roleLabel}
                    </span>
                  </div>

                  {/* Email Column */}
                  <div className="hidden min-w-0 flex-1 sm:flex sm:items-center sm:gap-2.5">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                      style={{ backgroundColor: "var(--brand-muted)", borderColor: "var(--brand-soft)", color: "var(--brand)" }}
                    >
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        EMAIL
                      </p>
                      <p className="truncate text-xs font-semibold" style={{ color: "var(--text)" }}>
                        {item.teacherEmail || user?.email || "—"}
                      </p>
                    </div>
                  </div>

                  {/* Grader Name Column */}
                  <div className="hidden min-w-0 flex-1 sm:flex sm:items-center sm:gap-2.5">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                      style={{ backgroundColor: "var(--brand-muted)", borderColor: "var(--brand-soft)", color: "var(--brand)" }}
                    >
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zm-4 7a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        GRADER
                      </p>
                      <p className="truncate text-xs font-semibold" style={{ color: "var(--text)" }}>
                        {item.graderName}
                      </p>
                    </div>
                  </div>

                  {/* ARID Number Column */}
                  {item.graderAridNo ? (
                    <div className="hidden min-w-0 flex-1 sm:flex sm:items-center sm:gap-2.5">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                        style={{ backgroundColor: "var(--brand-muted)", borderColor: "var(--brand-soft)", color: "var(--brand)" }}
                      >
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-5m-4 0V5a2 2 0 0 1 4 0v1m-4 0h4" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          ARID NUMBER
                        </p>
                        <p className="truncate text-xs font-semibold" style={{ color: "var(--text)" }}>
                          {item.graderAridNo}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="hidden flex-1 sm:block" />
                  )}

                  {/* Mobile Compact Details */}
                  <div className="min-w-0 flex-1 sm:hidden">
                    <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>{item.teacherEmail || user?.email}</p>
                    <p className="mt-1 truncate text-xs font-semibold" style={{ color: "var(--text)" }}>
                      Grader: {item.graderName}
                    </p>
                    {item.graderAridNo && (
                      <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>{item.graderAridNo}</p>
                    )}
                  </div>

                  {/* Trash Delete Action */}
                  <button
                    type="button"
                    onClick={() => removeAllocation(item)}
                    className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-red-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    title="Remove allocation"
                  >
                    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
