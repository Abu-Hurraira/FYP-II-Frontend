import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import TeacherStudentPloResultsScreen from "../teacher/TeacherStudentPloResultsScreen.jsx";
import { getHodDashboardCoursesPage } from "../../api/hodApi";
import { getCourseResults } from "../../api/courseResultsApi";
import { getAuthUserId } from "../../utils/helpers";
import { showAlert } from "../../utils/dialogs";
import HodMintHeader from "../../components/HodMintHeader.jsx";

const NOT_COMPILED = "This course result has not been compiled yet.";

function courseLabel(course) {
  const code = course.courseCode || "";
  const title = course.courseTitle || "Course";
  const section = course.sectionName || "";
  const teacher = course.teacherName || "";
  return [code && title ? `${code} ${title}` : title, section, teacher].filter(Boolean).join(" · ");
}

async function loadAllCourses(hodUserId) {
  const all = [];
  let page = 1;
  let hasMore = true;
  while (hasMore && page <= 30) {
    const data = await getHodDashboardCoursesPage({
      page,
      pageSize: 48,
      lite: true,
      hodUserId,
    });
    all.push(...(data.items || []));
    hasMore = Boolean(data.hasMore);
    page += 1;
  }
  return all;
}

export default function HodPloResultsScreen() {
  const { user } = useContext(AuthContext);
  const hodUserId = getAuthUserId(user);
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [checking, setChecking] = useState(false);
  const [compiled, setCompiled] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!hodUserId) {
      setLoadingCourses(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingCourses(true);
    loadAllCourses(hodUserId)
      .then((items) => {
        if (!cancelled) setCourses(items);
      })
      .catch((error) => {
        if (!cancelled) showAlert("PLO Results", error.message || "Courses could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoadingCourses(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hodUserId]);

  const options = useMemo(() => {
    const sorted = [...courses].sort((a, b) =>
      courseLabel(a).localeCompare(courseLabel(b), undefined, { sensitivity: "base" })
    );
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((course) =>
      [course.courseCode, course.courseTitle, course.sectionName, course.teacherName, course.programCode, course.programName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [courses, query]);

  const selected = courses.find((course) => String(course.offeredCourseId) === String(selectedId));

  const onSelect = async (nextId) => {
    setSelectedId(nextId);
    setCompiled(false);
    setNotice("");
    if (!nextId) return;

    setChecking(true);
    try {
      const grid = await getCourseResults(nextId, hodUserId);
      const students = grid?.students ?? grid?.Students ?? [];
      if (!students.length) {
        setNotice(NOT_COMPILED);
        return;
      }
      setCompiled(true);
    } catch {
      setNotice(NOT_COMPILED);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-full bg-page pb-12">
      <HodMintHeader
        title="PLO Results"
        subtitle="Search a course, then open student PLO results after the result is compiled."
      />

      <div className="w-full space-y-4 px-4 pt-4 sm:px-6 lg:px-8">
        <section className="mx-auto w-full max-w-5xl rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-900 dark:text-white">Find a course</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by code, title, section, or teacher"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-900 outline-none ring-emerald-600/20 placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:ring-2 dark:border-[#1b2c2e] dark:bg-[#071113] dark:text-white"
            />
          </label>

          <div className="mt-3 max-h-[22rem] space-y-2 overflow-y-auto pr-1">
            {loadingCourses ? (
              <div className="flex min-h-28 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-emerald-600" />
              </div>
            ) : options.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-3 py-6 text-center text-sm font-medium text-gray-500 dark:bg-[#122225]">
                No course matches this search.
              </p>
            ) : (
              options.map((course) => {
                const id = String(course.offeredCourseId);
                const active = id === String(selectedId);
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={checking}
                    onClick={() => onSelect(id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      active
                        ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
                        : "border-gray-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-[#1b2c2e] dark:bg-[#071113] dark:hover:border-emerald-800"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        {course.courseCode ? (
                          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {course.courseCode}
                          </span>
                        ) : null}
                        <span className="truncate text-sm font-bold text-gray-900 dark:text-white">
                          {course.courseTitle || "Course"}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-medium text-gray-500">
                        {[course.sectionName, course.teacherName].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </span>
                    {active ? (
                      <span className="shrink-0 text-xs font-bold text-emerald-700">Selected</span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
          {!loadingCourses ? (
            <p className="mt-2 text-xs font-medium text-gray-400">
              Showing {options.length} of {courses.length}
            </p>
          ) : null}
        </section>

        {checking ? (
          <div className="flex min-h-[24vh] items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
          </div>
        ) : null}

        {!checking && notice ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {notice}
          </div>
        ) : null}

        {!checking && compiled && selected ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {courseLabel(selected)}
            </p>
            <TeacherStudentPloResultsScreen
              key={selected.offeredCourseId}
              offeredCourseId={selected.offeredCourseId}
              teacherUserId={hodUserId}
              embedded
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
