import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getTeacherSynchronization } from "../../api/teacherApi";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert } from "../../utils/dialogs";
import theme from "../../styles/theme";

function rowCoverage(row) {
  const statuses = row.statuses ?? [];
  const done = statuses.filter((s) => s.isCompleted).length;
  const total = statuses.length;
  return { done, total };
}

/** Mirror TeacherSynchronizationController.BuildGapTopics (client-side). */
function deriveGapsFromMatrix(matrix, currentOfferedCourseId, teachers) {
  const currentTeacher = teachers.find((t) => t.offeredCourseId === currentOfferedCourseId);
  if (!currentTeacher) return [];

  const gaps = [];
  for (const row of matrix) {
    const statuses = row.statuses ?? [];
    const currentStatus = statuses.find((s) => s.offeredCourseId === currentOfferedCourseId);
    if (!currentStatus || currentStatus.isCompleted) continue;

    const coveredByOthers = statuses.filter(
      (s) => s.offeredCourseId !== currentOfferedCourseId && s.isCompleted
    );
    if (coveredByOthers.length === 0) continue;

    const totalOtherTeachers = Math.max(statuses.length - 1, 1);
    gaps.push({
      topicId: row.topicId,
      weekNo: row.weekNo,
      topicName: row.topicName,
      missingInTeacher: currentTeacher.teacherName,
      missingInSection: currentTeacher.sectionName,
      coveredByCount: coveredByOthers.length,
      gapLevel: coveredByOthers.length === totalOtherTeachers ? "HIGH GAP" : "GAP",
      coveredByTeachers: coveredByOthers.map((x) => `${x.teacherName} - ${x.sectionName}`),
    });
  }
  return gaps;
}

function StatusCell({ status }) {
  return (
    <td className="px-2 text-center">
      {status.isCompleted ? (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
          ✓
        </span>
      ) : (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white">
          ×
        </span>
      )}
    </td>
  );
}

/** Column header: teacher name + section (always visible). */
function TeacherColumnHeader({ teacher }) {
  const name = (teacher.teacherName || "?").trim();
  const section = (teacher.sectionName || "").trim();
  return (
    <th
      className="w-28 min-w-[5.5rem] max-w-[8rem] px-1 py-2 text-center align-bottom"
      title={section ? `${name} — ${section}` : name}
    >
      <span className="block text-[11px] font-extrabold leading-tight text-gray-800">{name}</span>
      {section ? (
        <span className="mt-1 block text-[10px] font-semibold leading-snug text-gray-500">{section}</span>
      ) : null}
    </th>
  );
}

export default function TeacherSynchronizationScreen() {
  const { offeredCourseId: oc } = useParams();
  const offeredCourseId = Number(oc);
  const [activeTab, setActiveTab] = useState("matrix");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const result = await getTeacherSynchronization(offeredCourseId);
      setData(result);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [offeredCourseId]);

  const currentOc = data?.currentOfferedCourseId ?? offeredCourseId;

  return (
    <div className="relative min-h-full bg-page pb-24">
      <div className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start gap-3">
          <PageBackButton className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-gray-900">Compare</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              {data?.courseTitle ? `${data.courseTitle} · ` : ""}
              {data?.currentTeacherName || "Teacher"}
              {data?.currentSectionName ? ` (${data.currentSectionName})` : ""}
              {data?.teachers?.length > 1
                ? ` · ${data.teachers.length} sections (all programs)`
                : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 px-4 pt-3 sm:px-6 lg:px-8">
        <TabButton title="All Matrix" active={activeTab === "matrix"} onPress={() => setActiveTab("matrix")} />
        <TabButton title="Common" active={activeTab === "common"} onPress={() => setActiveTab("common")} />
        <TabButton title="Gaps" active={activeTab === "gaps"} onPress={() => setActiveTab("gaps")} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div
            className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
            style={{ borderTopColor: theme.colors.primary }}
          />
        </div>
      ) : (
        <>
          {activeTab === "matrix" && <MatrixTab data={data} />}
          {activeTab === "common" && <CommonTab data={data} />}
          {activeTab === "gaps" && <GapsTab data={data} currentOfferedCourseId={currentOc} />}
        </>
      )}

    </div>
  );
}

function TabButton({ title, active, onPress }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={`flex-1 rounded-xl py-2 text-sm font-extrabold ${
        active ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-600"
      }`}
    >
      {title}
    </button>
  );
}

function MatrixTab({ data }) {
  const matrix = data?.matrix ?? [];
  const teachers = data?.teachers ?? [];

  if (!data || matrix.length === 0) {
    return <EmptyMessage text="No weekly topics found for comparison." />;
  }

  return (
    <div className="overflow-x-auto px-4 py-4 sm:px-6 lg:px-8">
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className="w-48 px-4 py-2 text-left text-xs font-black uppercase text-gray-400">
              Topic Name
            </th>
            {teachers.map((teacher) => (
              <TeacherColumnHeader key={teacher.offeredCourseId} teacher={teacher} />
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => (
            <tr key={row.topicId} className="bg-white shadow-sm">
              <td className="max-w-xs px-4 py-4 text-base font-extrabold text-gray-900">
                {row.topicName}
              </td>
              {(row.statuses ?? []).map((status) => (
                <StatusCell key={status.offeredCourseId} status={status} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CommonTab({ data }) {
  const matrix = data?.matrix ?? [];
  const teachers = data?.teachers ?? [];

  /**
   * Common covered topics:
   * - show if at least 2 teachers/sections completed it (so it's truly "common"),
   * - also naturally includes "all teachers" (done === total).
   */
  const commonRows = useMemo(() => {
    const total = Math.max(teachers.length, 0);
    const minDone = total <= 1 ? 1 : 2;

    return [...matrix]
      .filter((row) => {
        const cov = rowCoverage(row);
        return cov.total > 0 && cov.done >= minDone;
      })
      .sort((a, b) => {
        const ca = rowCoverage(a);
        const cb = rowCoverage(b);
        const allA = ca.total > 0 && ca.done === ca.total;
        const allB = cb.total > 0 && cb.done === cb.total;
        if (allA !== allB) return allA ? -1 : 1;
        if (cb.done !== ca.done) return cb.done - ca.done;
        return (a.topicId ?? 0) - (b.topicId ?? 0);
      });
  }, [matrix, teachers.length]);

  if (!data || matrix.length === 0) {
    return <EmptyMessage text="No weekly topics found for comparison." />;
  }

  if (commonRows.length === 0) {
    return (
      <EmptyMessage text="No common covered topics yet — once 2+ teachers/sections mark the same topic complete, it will appear here." />
    );
  }

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      <p className="mb-4 text-sm text-gray-600">
        <span className="font-semibold text-gray-800">Common covered topics</span> are completed by{" "}
        <strong>2+ teachers/sections</strong>. Topics completed by <strong>all {teachers.length}</strong> show as “All”.
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="w-48 px-4 py-2 text-left text-xs font-black uppercase text-gray-400">
                Topic Name
              </th>
              <th className="w-28 px-2 py-2 text-center text-xs font-black uppercase text-gray-400">
                Coverage
              </th>
              {teachers.map((teacher) => (
                <TeacherColumnHeader key={teacher.offeredCourseId} teacher={teacher} />
              ))}
            </tr>
          </thead>
          <tbody>
            {commonRows.map((row) => {
              const { done, total } = rowCoverage(row);
              const allDone = total > 0 && done === total;
              return (
                <tr key={row.topicId} className="bg-white shadow-sm">
                  <td className="max-w-xs px-4 py-4 text-base font-extrabold text-gray-900">{row.topicName}</td>
                  <td className="px-2 py-4 text-center align-middle">
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-black ${
                        allDone ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-900"
                      }`}
                    >
                      {allDone ? "All" : `${done}/${total}`}
                    </span>
                  </td>
                  {(row.statuses ?? []).map((status) => (
                    <StatusCell key={status.offeredCourseId} status={status} />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GapsTab({ data, currentOfferedCourseId }) {
  const matrix = data?.matrix ?? [];
  const teachers = data?.teachers ?? [];

  const gaps = useMemo(() => {
    const fromApi = data?.gapTopics ?? [];
    const derived = deriveGapsFromMatrix(matrix, currentOfferedCourseId, teachers);
    if (derived.length > 0) return derived;
    return fromApi;
  }, [data?.gapTopics, matrix, currentOfferedCourseId, teachers]);

  if (!data || matrix.length === 0) {
    return <EmptyMessage text="No weekly topics found for comparison." />;
  }

  if (gaps.length === 0) {
    return (
      <EmptyMessage text="No gaps for your section: either every topic matches others’ progress, or no other section has marked topics ahead of you on topics you still have open." />
    );
  }

  return (
    <div className="space-y-4 px-6 py-6">
      <p className="text-xs font-black uppercase text-gray-400">Your section is behind on these topics</p>
      {gaps.map((gap) => (
        <div key={gap.topicId} className="rounded-xl border border-red-200 bg-white p-5 shadow">
          <div className="flex items-center gap-2">
            <p className="flex-1 text-lg font-black text-gray-900">{gap.topicName}</p>
            <span className="rounded bg-red-500 px-2 py-1 text-xs font-black text-white">{gap.gapLevel}</span>
          </div>
          <p className="mt-3 font-extrabold text-red-500">
            Missing in: {gap.missingInTeacher}
            {gap.missingInSection ? ` (${gap.missingInSection})` : ""}
          </p>
          <hr className="my-4 border-red-100" />
          <div className="flex items-center">
            <p className="flex-1 text-sm font-bold text-gray-500">Covered by {gap.coveredByCount} other section(s)</p>
            <button
              type="button"
              onClick={() =>
                showAlert("Covered by", (gap.coveredByTeachers ?? []).join("\n") || "No details")
              }
              className="font-black text-emerald-600"
            >
              View Details →
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyMessage({ text }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6">
      <p className="max-w-md text-center text-base font-bold text-gray-500">{text}</p>
    </div>
  );
}
