import React, { useCallback, useContext, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  calculateCloAttainment,
  getAssessmentFolderOverview,
  getCloAssessmentDesign,
  getCloAttainmentResults,
  getPloAttainmentResults,
  getSubjectAttainmentDashboard,
} from "../../api/cloAttainmentApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert } from "../../utils/dialogs";

function barColor(pct) {
  if (pct >= 70) return "bg-emerald-600";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export default function TeacherCloResultsScreen() {
  const { user } = useContext(AuthContext);
  const { offeredCourseId: ocParam } = useParams();
  const offeredCourseId = Number(ocParam);
  const [searchParams] = useSearchParams();
  const routeTeacher = searchParams.get("teacherUserId");
  const teacherUserId =
    routeTeacher != null && routeTeacher !== ""
      ? Number(routeTeacher) || user?.userId
      : user?.userId;
  const courseTitle = searchParams.get("courseTitle") || "";

  const [design, setDesign] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [folderOverview, setFolderOverview] = useState(null);
  const [cloResults, setCloResults] = useState(null);
  const [ploResults, setPloResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [designData, dash, folder, clo, plo] = await Promise.all([
        getCloAssessmentDesign(offeredCourseId, teacherUserId).catch(() => null),
        getSubjectAttainmentDashboard(offeredCourseId, teacherUserId),
        getAssessmentFolderOverview(offeredCourseId, teacherUserId).catch(() => null),
        getCloAttainmentResults(offeredCourseId, teacherUserId).catch(() => null),
        getPloAttainmentResults(offeredCourseId, teacherUserId).catch(() => null),
      ]);
      setDesign(designData);
      setDashboard(dash);
      setFolderOverview(folder);
      setCloResults(clo);
      setPloResults(plo);
    } catch (error) {
      showAlert("Attainment", error.message);
    } finally {
      setLoading(false);
    }
  }, [offeredCourseId, teacherUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCalculate = async () => {
    try {
      setCalculating(true);
      const bundle = await calculateCloAttainment(offeredCourseId, teacherUserId);
      await load();
      const warnings = [
        ...(bundle?.clo?.warnings ?? bundle?.Clo?.Warnings ?? []),
        ...(bundle?.plo?.warnings ?? bundle?.Plo?.Warnings ?? []),
      ];
      showAlert(warnings.length ? "Calculated with warnings" : "Calculated", warnings.length ? warnings.slice(0, 5).join("\n") : "CLO and PLO attainment updated.");
    } catch (error) {
      showAlert("Calculation failed", error.message);
    } finally {
      setCalculating(false);
    }
  };

  const clos = design?.clos ?? design?.Clos ?? [];
  const rows = design?.rows ?? design?.Rows ?? [];
  const cloProgress = dashboard?.cloProgress ?? dashboard?.CloProgress ?? [];
  const ploProgress = dashboard?.ploProgress ?? dashboard?.PloProgress ?? [];
  const warnings = dashboard?.warnings ?? dashboard?.Warnings ?? [];
  const assessmentCounts =
    folderOverview?.assessmentCounts ?? folderOverview?.AssessmentCounts ?? [];
  const cloDetailItems = cloResults?.results ?? cloResults?.Results ?? [];
  const ploDetailItems = ploResults?.results ?? ploResults?.Results ?? [];

  return (
    <div className="relative min-h-full bg-page pb-12">
      <div className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8 dark:border-[#1b2c2e] dark:bg-[#071113]">
        <div className="flex min-w-0 items-center gap-3">
          <PageBackButton className="mt-0.5 shrink-0" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">CLO/PLO attainment</h1>
            <p className="mt-0.5 text-xs text-gray-500">{courseTitle || "Class CLO and PLO attainment"}</p>
          </div>
        </div>
      </div>

      <div className="w-full space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
              <h2 className="text-lg font-black text-gray-900 dark:text-white">CLO-Task assessment map</h2>
              <p className="mt-1 text-xs font-medium text-gray-500">Approved mapping shares for Quiz, Assignment, Mid, and Final.</p>
              {!clos.length ? (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">No approved CLO-Task mapping yet.</p>
              ) : (
                <table className="mt-3 min-w-full text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-2 text-left">Type</th>
                      {clos.map((c) => (
                        <th key={c.cloId ?? c.CloId} className="px-2 py-2">{c.cloCode ?? c.CloCode}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.assessmentTypeId ?? row.AssessmentTypeId} className="border-t border-gray-100">
                        <td className="px-2 py-2 font-extrabold">{row.assessmentTypeName ?? row.AssessmentTypeName}</td>
                        {clos.map((c) => {
                          const map = row.percentagesByCloId ?? row.PercentagesByCloId ?? {};
                          const id = c.cloId ?? c.CloId;
                          const value = map[id] ?? map[String(id)];
                          return (
                            <td key={`${row.assessmentTypeId}-${id}`} className="px-2 py-2 text-center font-bold">
                              {value != null && Number(value) > 0 ? Math.round(Number(value)) : "–"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <button type="button" disabled={calculating} onClick={handleCalculate} className="w-full rounded-2xl bg-[#15803d] py-3 text-sm font-extrabold text-white disabled:opacity-50">
              {calculating ? "Calculating…" : "Calculate CLO / PLO attainment"}
            </button>

            {assessmentCounts.length > 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
                <h2 className="text-lg font-black">Assessment folder counts</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {assessmentCounts.map((c) => (
                    <div
                      key={c.assessmentTypeName ?? c.AssessmentTypeName}
                      className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-center"
                    >
                      <div className="text-[11px] font-bold text-gray-500">
                        {c.assessmentTypeName ?? c.AssessmentTypeName}
                      </div>
                      <div className="text-sm font-black">
                        {c.count ?? c.Count ?? c.completedCount ?? c.CompletedCount ?? 0}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {warnings.map((w) => (
              <p key={w} className="text-sm font-bold text-amber-700">{w}</p>
            ))}

            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
              <h2 className="text-lg font-black">CLO attainment</h2>
              <div className="mt-3 space-y-3">
                {cloProgress.length === 0 ? <p className="text-sm text-gray-500">Calculate to see CLO bars.</p> : null}
                {cloProgress.map((item) => {
                  const pct = Number(item.attainmentPercentage ?? item.AttainmentPercentage) || 0;
                  const detail = cloDetailItems.find(
                    (d) => Number(d.cloId ?? d.CloId) === Number(item.cloId ?? item.CloId)
                  );
                  const contributions =
                    detail?.contributions ?? detail?.Contributions ?? [];
                  return (
                    <div key={item.cloId ?? item.CloId}>
                      <div className="mb-1 flex justify-between text-xs font-extrabold">
                        <span>{item.cloCode ?? item.CloCode}</span>
                        <span>{pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                        <div className={`h-full ${barColor(pct)}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                      </div>
                      {contributions.length > 0 ? (
                        <ul className="mt-1 space-y-0.5 text-[11px] text-gray-500">
                          {contributions.map((c) => (
                            <li key={c.assessmentTypeName ?? c.AssessmentTypeName}>
                              {c.assessmentTypeName ?? c.AssessmentTypeName}: share{" "}
                              {Number(c.designSharePercent ?? c.DesignSharePercent ?? 0)}% · local{" "}
                              {c.localAttainmentPercent ?? c.LocalAttainmentPercent ?? "–"}%
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
              <h2 className="text-lg font-black">PLO attainment</h2>
              <div className="mt-3 space-y-3">
                {ploProgress.length === 0 ? <p className="text-sm text-gray-500">Calculate to see PLO bars.</p> : null}
                {ploProgress.map((item) => {
                  const pct = Number(item.attainmentPercentage ?? item.AttainmentPercentage) || 0;
                  const detail = ploDetailItems.find(
                    (d) => Number(d.ploId ?? d.PloId) === Number(item.ploId ?? item.PloId)
                  );
                  const contributions =
                    detail?.contributions ?? detail?.Contributions ?? [];
                  return (
                    <div key={item.ploId ?? item.PloId}>
                      <div className="mb-1 flex justify-between text-xs font-extrabold">
                        <span>{item.ploCode ?? item.PloCode}</span>
                        <span>{pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                        <div className={`h-full ${barColor(pct)}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                      </div>
                      {contributions.length > 0 ? (
                        <ul className="mt-1 space-y-0.5 text-[11px] text-gray-500">
                          {contributions.map((c) => (
                            <li key={c.cloId ?? c.CloId ?? c.cloCode}>
                              {c.cloCode ?? c.CloCode}: map{" "}
                              {Number(c.mappingPercent ?? c.MappingPercent ?? 0)}% · CLO{" "}
                              {c.cloAttainmentPercent ?? c.CloAttainmentPercent ?? "–"}% →{" "}
                              {Number(c.weightedContribution ?? c.WeightedContribution ?? 0).toFixed(1)}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
