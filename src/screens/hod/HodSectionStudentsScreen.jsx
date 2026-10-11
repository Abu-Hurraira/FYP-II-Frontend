import React, { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import theme from "../../styles/theme";
import { AuthContext } from "../../context/AuthContext.jsx";
import { getStudentsBySection } from "../../api/studentsApi";
import { getGraderUsers } from "../../api/usersApi";
import { getGraderAllocations } from "../../api/graderAllocationsApi";
import {
  filterGradersLinkedToStudents,
  findGraderAllocationForStudent,
  getAssignedTeacherName,
} from "../../utils/graderHelpers";
import PageBackButton from "../../components/PageBackButton.jsx";
import GraderBadge from "../../components/GraderBadge.jsx";
import { showAlert } from "../../utils/dialogs";

function pickPositiveId(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

export default function HodSectionStudentsScreen() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const { section, program, session } = location.state || {};

  const [students, setStudents] = useState([]);
  const [graders, setGraders] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(false);

  const currentSectionId = pickPositiveId(section?.sectionId, section?.SectionId);
  const currentSectionName = section?.sectionName ?? section?.SectionName ?? "Section";

  const loadStudents = async () => {
    if (!currentSectionId) return;
    try {
      setLoading(true);
      const [data, graderData, allocationData] = await Promise.all([
        getStudentsBySection(currentSectionId),
        getGraderUsers(),
        getGraderAllocations(),
      ]);
      const sectionStudents = data || [];
      setStudents(sectionStudents);
      setGraders(filterGradersLinkedToStudents(graderData || [], sectionStudents));
      setAllocations(allocationData || []);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [currentSectionId]);

  if (!currentSectionId) {
    return (
      <div className="min-h-full bg-page">
        <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
          <PageBackButton className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-gray-900">Students</h1>
            <p className="mt-0.5 text-xs text-gray-500">Section not found. Open a section from the session list.</p>
            <button type="button" className="mt-4 font-bold text-brand" onClick={() => navigate("/hod/programs")}>
              Programs
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full bg-page">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-gray-900">{currentSectionName}</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            {user?.roleName || "HOD"}
            {session?.sessionTitle ? ` · ${session.sessionTitle}` : ""}
            {program?.programName ? ` · ${program.programName}` : ""}
            {" · View only"}
          </p>
        </div>
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : (
          <div className="space-y-2.5 pt-2">
            {students.map((item) => {
              const graderAllocation = findGraderAllocationForStudent(item, graders, allocations);
              const assignedTeacher = getAssignedTeacherName(graderAllocation);
              const isAssignedGrader = Boolean(assignedTeacher);
              return (
                <div
                  key={item.studentId ?? item.StudentId}
                  className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                  style={
                    isAssignedGrader
                      ? { backgroundColor: "var(--brand-muted)", borderColor: "var(--brand-soft)" }
                      : undefined
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-gray-900">{item.fullName ?? item.FullName}</p>
                    {isAssignedGrader ? <GraderBadge /> : null}
                  </div>
                  <p className="mt-0.5 text-xs font-semibold text-gray-700">{item.aridNo ?? item.AridNo}</p>
                  {(item.email ?? item.Email) ? (
                    <p className="mt-0.5 text-xs text-gray-500">{item.email ?? item.Email}</p>
                  ) : null}
                  {isAssignedGrader ? (
                    <p className="mt-1.5 text-xs font-bold" style={{ color: "var(--brand)" }}>
                      Assigned to teacher: {assignedTeacher}
                    </p>
                  ) : null}
                </div>
              );
            })}
            {students.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">No students in this section yet.</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
