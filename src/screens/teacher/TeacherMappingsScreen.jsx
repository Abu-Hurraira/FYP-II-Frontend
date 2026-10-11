import React, { useContext, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getCourseFixedScheme } from "../../api/courseResultsApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import TeacherCloPloMappingScreen from "./TeacherCloPloMappingScreen.jsx";
import TeacherHomeworkMarksMappingScreen from "./TeacherHomeworkMarksMappingScreen.jsx";
import TeacherLabMarksMappingScreen from "./TeacherLabMarksMappingScreen.jsx";

export default function TeacherMappingsScreen() {
  const { user } = useContext(AuthContext);
  const { offeredCourseId: ocParam } = useParams();
  const offeredCourseId = Number(ocParam);
  const [searchParams, setSearchParams] = useSearchParams();
  const routeTeacher = searchParams.get("teacherUserId");
  const teacherUserId =
    routeTeacher != null && routeTeacher !== ""
      ? Number(routeTeacher) || user?.userId
      : user?.userId;
  const courseTitle = searchParams.get("courseTitle") || "";
  const [hasLab, setHasLab] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const scheme = await getCourseFixedScheme(offeredCourseId, teacherUserId);
        if (!cancelled) {
          setHasLab(Boolean(scheme?.hasLab ?? scheme?.HasLab ?? scheme?.fixed?.hasLab ?? scheme?.Fixed?.HasLab));
        }
      } catch {
        if (!cancelled) setHasLab(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [offeredCourseId, teacherUserId]);

  const sections = useMemo(
    () => [
      { id: "clo-plo", label: "CLO-PLO" },
      { id: "homework", label: "Homework marks" },
      ...(hasLab ? [{ id: "lab", label: "Lab marks" }] : []),
    ],
    [hasLab]
  );

  const requested = searchParams.get("section") || "clo-plo";
  const active = sections.some((s) => s.id === requested) ? requested : "clo-plo";

  const selectSection = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set("section", id);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="relative min-h-full bg-page pb-12">
      <div className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8 dark:border-[#1b2c2e] dark:bg-[#071113]">
        <div className="flex min-w-0 items-center gap-3">
          <PageBackButton className="mt-0.5 shrink-0" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Mappings</h1>
            <p className="mt-0.5 text-xs text-gray-500">{courseTitle || "CLO-PLO, homework, and lab marks"}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {sections.map((section) => {
            const selected = section.id === active;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => selectSection(section.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-extrabold transition ${
                  selected
                    ? "bg-emerald-700 text-white"
                    : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-[#1b2c2e] dark:bg-[#0c181a] dark:text-gray-200"
                }`}
              >
                {section.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-4 sm:px-6 lg:px-8">
        {active === "clo-plo" ? <TeacherCloPloMappingScreen embedded /> : null}
        {active === "homework" ? <TeacherHomeworkMarksMappingScreen embedded /> : null}
        {active === "lab" && hasLab ? <TeacherLabMarksMappingScreen embedded /> : null}
      </div>
    </div>
  );
}
