import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getStudentPloResults } from "../../api/cloAttainmentApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert } from "../../utils/dialogs";

function pick(obj, ...keys) {
  if (!obj) return undefined;
  for (const key of keys) {
    if (obj[key] != null) return obj[key];
  }
  return undefined;
}

function formatPct(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(n % 1 === 0 ? 0 : 1)}%` : "—";
}

function formatMarks(obtained, maximum) {
  const got = Number(obtained) || 0;
  const max = Number(maximum) || 0;
  if (max <= 0 && got <= 0) return "—";
  return `${got}/${max}`;
}

const FAIL_ROW = "bg-red-100 dark:bg-red-950/45";
const FAIL_ROW_SELECTED = "bg-red-200 dark:bg-red-950/60";

function cloLines(items) {
  return (items || []).map((item) => {
    const code = pick(item, "cloCode", "CloCode") || pick(item, "label", "Label") || "CLO";
    const desc = pick(item, "cloDescription", "CloDescription") || "";
    const pct = formatPct(pick(item, "attainmentPercent", "AttainmentPercent") ?? pick(item, "percent", "Percent"));
    const marks = formatMarks(pick(item, "obtained", "Obtained"), pick(item, "maximum", "Maximum"));
    const mapPct = pick(item, "mappingPercent", "MappingPercent");
    const failed = Boolean(pick(item, "failed", "Failed"));
    const mapText = mapPct != null && mapPct !== "" ? ` · weight ${formatPct(mapPct)}` : "";
    return `${code}${desc ? ` — ${desc}` : ""} · ${pct} · ${marks}${mapText}${failed ? " · needs to pass" : ""}`;
  });
}

function HoverCard({ tip }) {
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none fixed z-50 w-80 max-h-80 overflow-y-auto -translate-x-1/2 -translate-y-full rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-[#1b2c2e] dark:bg-[#0c181a]"
      style={{ left: tip.x, top: tip.y - 10 }}
      role="tooltip"
    >
      <p className="text-xs font-black text-gray-900 dark:text-white">{tip.title}</p>
      {(tip.lines || []).map((line, index) => (
        <p key={`${index}-${line.slice(0, 24)}`} className="mt-1 text-xs font-medium leading-snug text-gray-600 dark:text-gray-300">
          {line}
        </p>
      ))}
    </div>
  );
}

export default function TeacherStudentPloResultsScreen({
  offeredCourseId: offeredCourseIdProp,
  teacherUserId: teacherUserIdProp,
  embedded = false,
}) {
  const { user } = useContext(AuthContext);
  const { offeredCourseId: ocParam } = useParams();
  const offeredCourseId = Number(offeredCourseIdProp ?? ocParam);
  const [searchParams] = useSearchParams();
  const routeTeacher = searchParams.get("teacherUserId");
  const teacherUserId =
    teacherUserIdProp != null && teacherUserIdProp !== ""
      ? Number(teacherUserIdProp) || user?.userId
      : routeTeacher != null && routeTeacher !== ""
        ? Number(routeTeacher) || user?.userId
        : user?.userId;
  const courseTitle = searchParams.get("courseTitle") || "";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [hoverTip, setHoverTip] = useState(null);

  const showTip = (event, title, lines) => {
    const clean = (lines || []).map((l) => String(l || "").trim()).filter(Boolean);
    if (!title && clean.length === 0) return;
    setHoverTip({ x: event.clientX, y: event.clientY, title, lines: clean });
  };
  const moveTip = (event) =>
    setHoverTip((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev));
  const hideTip = () => setHoverTip(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getStudentPloResults(offeredCourseId, teacherUserId);
      setData(result);
    } catch (error) {
      showAlert("PLO results", error.message);
    } finally {
      setLoading(false);
    }
  }, [offeredCourseId, teacherUserId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && selectedId) {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId]);

  const ploColumns = data?.ploColumns ?? data?.PloColumns ?? [];
  const students = data?.students ?? data?.Students ?? [];
  const warnings = data?.warnings ?? data?.Warnings ?? [];
  const threshold = Number(pick(data, "failThresholdPercent", "FailThresholdPercent") ?? 50);
  const selected = useMemo(
    () => students.find((s) => Number(pick(s, "studentId", "StudentId")) === Number(selectedId)) ?? null,
    [students, selectedId]
  );
  const tableWrapRef = useRef(null);
  const [panelTop, setPanelTop] = useState(0);

  const placePanel = useCallback(() => {
    const wrap = tableWrapRef.current;
    if (!wrap || selectedId == null) {
      setPanelTop(0);
      return;
    }
    const row = wrap.querySelector(`[data-student-id="${selectedId}"]`);
    if (!row) return;
    const top = row.getBoundingClientRect().top - wrap.getBoundingClientRect().top;
    setPanelTop(Math.max(0, top));
  }, [selectedId]);

  useLayoutEffect(() => {
    placePanel();
  }, [placePanel, students, loading, ploColumns.length]);

  useEffect(() => {
    window.addEventListener("resize", placePanel);
    return () => window.removeEventListener("resize", placePanel);
  }, [placePanel]);

  return (
    <div className={embedded ? "relative" : "relative min-h-full bg-page pb-12"}>
      {embedded ? null : (
        <div className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8 dark:border-[#1b2c2e] dark:bg-[#071113]">
          <div className="flex min-w-0 items-center gap-3">
            <PageBackButton className="mt-0.5 shrink-0" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">PLO Results</h1>
              <p className="mt-0.5 text-xs text-gray-500">
                {courseTitle || pick(data, "courseTitle", "CourseTitle") || "Student PLO attainment"}
                {" · "}Fail below {threshold}%
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={embedded ? "space-y-4" : "space-y-4 px-4 pt-4 sm:px-6 lg:px-8"}>
        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
          </div>
        ) : (
          <>
            {warnings.length > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                {warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </div>
            ) : null}

            <div className="flex items-start gap-4">
            <div ref={tableWrapRef} className="w-full max-w-full min-w-0 flex-1 overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
              <table className="min-w-max w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:bg-[#102023] dark:text-gray-400">
                  <tr>
                    <th className="sticky left-0 z-20 w-44 min-w-[10.5rem] bg-gray-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 shadow-[2px_0_4px_rgba(0,0,0,0.06)] dark:bg-[#102023] dark:text-gray-400 sm:w-56 sm:min-w-[14rem] sm:px-4">
                      Student
                    </th>
                    {ploColumns.map((plo) => (
                      <th
                        key={pick(plo, "ploId", "PloId")}
                        className="min-w-[4.75rem] px-3 py-3 text-center cursor-help sm:min-w-[5.5rem]"
                        onMouseEnter={(e) =>
                          showTip(e, pick(plo, "ploCode", "PloCode"), [
                            pick(plo, "ploDescription", "PloDescription"),
                            ...cloLines(plo.detail ?? plo.Detail),
                          ])
                        }
                        onMouseMove={moveTip}
                        onMouseLeave={hideTip}
                      >
                        {pick(plo, "ploCode", "PloCode")}
                      </th>
                    ))}
                    <th className="min-w-[6.5rem] px-3 py-3 sm:min-w-[8rem]">Failed PLOs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#1b2c2e]">
                  {students.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-sm text-gray-500" colSpan={ploColumns.length + 2}>
                        No enrolled students.
                      </td>
                    </tr>
                  ) : (
                    students.map((row) => {
                      const id = pick(row, "studentId", "StudentId");
                      const plos = row.plos ?? row.Plos ?? [];
                      const failed = row.failedPloCodes ?? row.FailedPloCodes ?? [];
                      const failedByPlo = Boolean(pick(row, "failedByPlo", "FailedByPlo"));
                      const isSelected = Number(selectedId) === Number(id);
                      const rowTone = failedByPlo
                        ? isSelected
                          ? FAIL_ROW_SELECTED
                          : FAIL_ROW
                        : isSelected
                          ? "bg-emerald-50 dark:bg-[#153e2e]"
                          : "bg-white dark:bg-[#0c181a] hover:bg-gray-50 dark:hover:bg-[#122225]";
                      return (
                        <tr
                          key={id}
                          data-student-id={id}
                          className={`cursor-pointer ${rowTone}`}
                          onClick={() => setSelectedId(id)}
                        >
                          <td className="sticky left-0 z-10 w-44 min-w-[10.5rem] bg-inherit px-3 py-3 shadow-[2px_0_4px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_4px_rgba(0,0,0,0.3)] sm:w-56 sm:min-w-[14rem] sm:px-4">
                            <p className="truncate font-semibold text-gray-900 dark:text-white" title={pick(row, "fullName", "FullName")}>
                              {pick(row, "fullName", "FullName")}
                            </p>
                            <p className="truncate text-xs font-mono text-gray-500">{pick(row, "aridNo", "AridNo")}</p>
                            {failedByPlo ? (
                              <p className="mt-1 text-[11px] font-bold text-red-700">Failed by PLO</p>
                            ) : null}
                          </td>
                          {ploColumns.map((col) => {
                            const score = plos.find(
                              (p) => Number(pick(p, "ploId", "PloId")) === Number(pick(col, "ploId", "PloId"))
                            ) || col;
                            const failedCell = Boolean(pick(score, "failed", "Failed"));
                            return (
                              <td
                                key={pick(col, "ploId", "PloId")}
                                className={`px-3 py-3 text-center font-semibold cursor-help ${
                                  failedCell || failedByPlo ? "text-red-700" : "text-gray-800 dark:text-gray-200"
                                }`}
                                onMouseEnter={(e) =>
                                  showTip(
                                    e,
                                    `${pick(score, "ploCode", "PloCode") || pick(col, "ploCode", "PloCode")} · ${formatPct(pick(score, "percent", "Percent"))}`,
                                    [
                                      pick(score, "ploDescription", "PloDescription") ||
                                        pick(col, "ploDescription", "PloDescription"),
                                    ]
                                  )
                                }
                                onMouseMove={moveTip}
                                onMouseLeave={hideTip}
                              >
                                {formatPct(pick(score, "percent", "Percent"))}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-sm font-semibold text-red-700">
                            {failed.length ? failed.join(", ") : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <aside className="relative hidden w-96 shrink-0 self-stretch lg:block">
              {selected ? (
                <section
                  className="absolute left-0 right-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-[#1b2c2e] dark:bg-[#0c181a]"
                  style={{ top: panelTop }}
                >
                  <header className="border-b border-gray-100 bg-gray-50 px-4 py-3 dark:border-[#1b2c2e] dark:bg-[#102023]">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Detail view</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-gray-900 dark:text-white">
                        {pick(selected, "fullName", "FullName")}
                      </h2>
                      {pick(selected, "failedByPlo", "FailedByPlo") ? (
                        <span className="rounded-full bg-red-200 px-2 py-0.5 text-[11px] font-bold text-red-800">
                          Failed by PLO
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                          Passed
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-gray-500">{pick(selected, "aridNo", "AridNo")}</p>
                  </header>
                  <div className="max-h-[28rem] space-y-3 overflow-y-auto p-4">
                    {pick(selected, "passAdvice", "PassAdvice") ? (
                      <p className="text-sm font-semibold leading-snug text-gray-700 dark:text-gray-300">
                        {pick(selected, "passAdvice", "PassAdvice")}
                      </p>
                    ) : null}
                    {(selected.plos ?? selected.Plos ?? []).map((plo) => {
                      const detail = plo.detail ?? plo.Detail ?? [];
                      const failedPlo = Boolean(pick(plo, "failed", "Failed"));
                      return (
                        <div
                          key={pick(plo, "ploId", "PloId")}
                          className={`rounded-xl border px-3 py-2.5 ${
                            failedPlo
                              ? "border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20"
                              : "border-gray-100 bg-gray-50 dark:border-[#1b2c2e] dark:bg-[#102023]"
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <h3 className="text-sm font-black text-gray-900 dark:text-white">
                              {pick(plo, "ploCode", "PloCode")}
                            </h3>
                            <p className={`text-sm font-bold ${failedPlo ? "text-red-600" : "text-emerald-700"}`}>
                              {formatPct(pick(plo, "percent", "Percent"))}
                              {failedPlo ? " · Fail" : pick(plo, "percent", "Percent") != null ? " · Pass" : ""}
                            </p>
                          </div>
                          <ul className="mt-2 space-y-1">
                            {detail.length === 0 ? (
                              <li className="text-xs text-gray-500">No CLO marks mapped to this PLO.</li>
                            ) : (
                              detail.map((item) => (
                                <li
                                  key={`${pick(item, "cloId", "CloId")}-${pick(item, "label", "Label")}`}
                                  className="flex items-center justify-between text-sm font-semibold text-gray-800 dark:text-gray-200"
                                >
                                  <span>{pick(item, "label", "Label") || pick(item, "cloCode", "CloCode")}</span>
                                  <span>
                                    {formatMarks(pick(item, "obtained", "Obtained"), pick(item, "maximum", "Maximum"))}
                                  </span>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <section className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-6 text-sm text-gray-500 dark:border-[#1b2c2e] dark:bg-[#0c181a]">
                  Select a student to open the detail view.
                </section>
              )}
            </aside>
            </div>

            {selected ? (
              <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
                <div
                  className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
                  onClick={() => setSelectedId(null)}
                  aria-hidden="true"
                />
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="student-detail-title"
                  className="relative z-10 max-h-[85vh] w-full overflow-hidden rounded-t-3xl border-t border-gray-200 bg-white shadow-2xl dark:border-[#1b2c2e] dark:bg-[#0c181a]"
                >
                  <header className="border-b border-gray-100 bg-gray-50 px-5 py-4 dark:border-[#1b2c2e] dark:bg-[#102023]">
                    <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Student Detail</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <h2 id="student-detail-title" className="text-lg font-black text-gray-900 dark:text-white">
                            {pick(selected, "fullName", "FullName")}
                          </h2>
                          {pick(selected, "failedByPlo", "FailedByPlo") ? (
                            <span className="rounded-full bg-red-200 px-2.5 py-0.5 text-xs font-bold text-red-800">
                              Failed by PLO
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                              Passed
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs font-mono font-medium text-gray-500">{pick(selected, "aridNo", "AridNo")}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedId(null)}
                        className="rounded-full p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                        aria-label="Close details"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </header>

                  <div className="max-h-[calc(85vh-90px)] space-y-3 overflow-y-auto p-5 pb-8">
                    {pick(selected, "passAdvice", "PassAdvice") ? (
                      <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                        {pick(selected, "passAdvice", "PassAdvice")}
                      </p>
                    ) : null}
                    {(selected.plos ?? selected.Plos ?? []).map((plo) => {
                      const detail = plo.detail ?? plo.Detail ?? [];
                      const failedPlo = Boolean(pick(plo, "failed", "Failed"));
                      return (
                        <div
                          key={pick(plo, "ploId", "PloId")}
                          className={`rounded-2xl border p-4 ${
                            failedPlo
                              ? "border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20"
                              : "border-gray-100 bg-gray-50 dark:border-[#1b2c2e] dark:bg-[#102023]"
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <h3 className="text-sm font-black text-gray-900 dark:text-white">
                              {pick(plo, "ploCode", "PloCode")}
                            </h3>
                            <p className={`text-sm font-bold ${failedPlo ? "text-red-600" : "text-emerald-700"}`}>
                              {formatPct(pick(plo, "percent", "Percent"))}
                              {failedPlo ? " · Fail" : pick(plo, "percent", "Percent") != null ? " · Pass" : ""}
                            </p>
                          </div>
                          <ul className="mt-3 space-y-1.5 border-t border-gray-200/60 pt-2.5 dark:border-gray-800">
                            {detail.length === 0 ? (
                              <li className="text-xs text-gray-500">No CLO marks mapped to this PLO.</li>
                            ) : (
                              detail.map((item) => (
                                <li
                                  key={`${pick(item, "cloId", "CloId")}-${pick(item, "label", "Label")}`}
                                  className="flex items-center justify-between text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200"
                                >
                                  <span>{pick(item, "label", "Label") || pick(item, "cloCode", "CloCode")}</span>
                                  <span className="font-mono">
                                    {formatMarks(pick(item, "obtained", "Obtained"), pick(item, "maximum", "Maximum"))}
                                  </span>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            ) : null}
            <HoverCard tip={hoverTip} />
          </>
        )}
      </div>
    </div>
  );
}
