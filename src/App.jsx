import React, { Suspense, lazy, useContext } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthContext } from "./context/AuthContext.jsx";
import LoadingScreen from "./screens/common/LoadingScreen.jsx";

/* Eager: auth shell + layouts (needed on every role navigation) */
import LoginScreen from "./screens/auth/LoginScreen.jsx";
import TeacherLayout from "./layouts/TeacherLayout.jsx";
import AdminLayout from "./layouts/AdminLayout.jsx";
import HodLayout from "./layouts/HodLayout.jsx";

/* Lazy: screens load only when the route is visited */
const TeacherHomeScreen = lazy(() => import("./screens/teacher/TeacherHomeScreen.jsx"));
const TeacherCourseMenuScreen = lazy(() => import("./screens/teacher/TeacherCourseMenuScreen.jsx"));
const TeacherClosScreen = lazy(() => import("./screens/teacher/TeacherClosScreen.jsx"));
const TeacherAssessmentScreen = lazy(() => import("./screens/teacher/TeacherAssessmentScreen.jsx"));
const TeacherAssignmentsScreen = lazy(() => import("./screens/teacher/TeacherAssignmentsScreen.jsx"));
const TeacherAssessmentMarksScreen = lazy(() => import("./screens/teacher/TeacherAssessmentMarksScreen.jsx"));
const TeacherCloResultsScreen = lazy(() => import("./screens/teacher/TeacherCloResultsScreen.jsx"));
const TeacherCourseResultsScreen = lazy(() => import("./screens/teacher/TeacherCourseResultsScreen.jsx"));
const TeacherComponentMarksScreen = lazy(() => import("./screens/teacher/TeacherComponentMarksScreen.jsx"));
const WeeklyContentScreen = lazy(() => import("./screens/teacher/WeeklyContentScreen.jsx"));
const TeacherPlaceholderScreen = lazy(() => import("./screens/teacher/TeacherPlaceholderScreen.jsx"));
const TeacherSubmitFoldersScreen = lazy(() => import("./screens/teacher/TeacherSubmitFoldersScreen.jsx"));
const TeacherCourseFolderScreen = lazy(() => import("./screens/teacher/TeacherCourseFolderScreen.jsx"));
const TeacherFolderUploadScreen = lazy(() => import("./screens/teacher/TeacherFolderUploadScreen.jsx"));
const TeacherSynchronizationScreen = lazy(() => import("./screens/teacher/TeacherSynchronizationScreen.jsx"));
const TeacherProfileScreen = lazy(() => import("./screens/teacher/TeacherProfileScreen.jsx"));
const TeacherNotificationsScreen = lazy(() => import("./screens/teacher/TeacherNotificationsScreen.jsx"));
const TeacherAttendanceScreen = lazy(() => import("./screens/teacher/TeacherAttendanceScreen.jsx"));
const TeacherFcarReportScreen = lazy(() => import("./screens/teacher/TeacherFcarReportScreen.jsx"));
const TeacherStudentPloResultsScreen = lazy(() => import("./screens/teacher/TeacherStudentPloResultsScreen.jsx"));
const TeacherMappingsScreen = lazy(() => import("./screens/teacher/TeacherMappingsScreen.jsx"));
const RedirectToCourseMappings = lazy(() => import("./screens/teacher/RedirectToCourseMappings.jsx"));

const ProfileScreen = lazy(() => import("./screens/common/ProfileScreen.jsx"));

const AdminDashboardScreen = lazy(() => import("./screens/admin/AdminDashboardScreen.jsx"));
const FacultyScreen = lazy(() => import("./screens/admin/FacultyScreen.jsx"));
const StudentEnrollmentScreen = lazy(() => import("./screens/admin/StudentEnrollmentScreen.jsx"));
const PlaceholderScreen = lazy(() => import("./screens/admin/PlaceholderScreen.jsx"));

const SectionAdminStudentsScreen = lazy(() => import("./screens/admin/SectionAdminStudentsScreen.jsx"));
const SectionAdminSectionsScreen = lazy(() => import("./screens/admin/SectionAdminSectionsScreen.jsx"));
const SectionAdminProgramsScreen = lazy(() => import("./screens/admin/SectionAdminProgramsScreen.jsx"));
const SectionAdminProgramSessionsScreen = lazy(() => import("./screens/admin/SectionAdminProgramSessionsScreen.jsx"));
const GraderAllocationsScreen = lazy(() => import("./screens/admin/GraderAllocationsScreen.jsx"));

const HodWelcomeScreen = lazy(() => import("./screens/hod/HodWelcomeScreen.jsx"));
const HodProgramsScreen = lazy(() => import("./screens/hod/HodProgramsScreen.jsx"));
const HodProgramMenuScreen = lazy(() => import("./screens/hod/HodProgramMenuScreen.jsx"));
const HodPLOsScreen = lazy(() => import("./screens/hod/PLOsScreen.jsx"));
const HodPEOsScreen = lazy(() => import("./screens/hod/PEOsScreen.jsx"));
const HodGradersScreen = lazy(() => import("./screens/hod/HodGradersScreen.jsx"));
const HodSessionsScreen = lazy(() => import("./screens/hod/HodSessionsScreen.jsx"));
const HodSessionDetailsScreen = lazy(() => import("./screens/hod/HodSessionDetailsScreen.jsx"));
const HodSectionStudentsScreen = lazy(() => import("./screens/hod/HodSectionStudentsScreen.jsx"));
const HodOfferedCoursesScreen = lazy(() => import("./screens/hod/HodOfferedCoursesScreen.jsx"));
const HodMappingMenuScreen = lazy(() => import("./screens/hod/HodMappingMenuScreen.jsx"));
const HodPeoPloMappingScreen = lazy(() => import("./screens/hod/HodPeoPloMappingScreen.jsx"));
const HodPloCourseMappingScreen = lazy(() => import("./screens/hod/HodPloCourseMappingScreen.jsx"));
const HodProgramCoursesScreen = lazy(() => import("./screens/hod/HodProgramCoursesScreen.jsx"));
const HodCourseProgressScreen = lazy(() => import("./screens/hod/HodCourseProgressScreen.jsx"));
const HodWeeklyStatusScreen = lazy(() => import("./screens/hod/HodWeeklyStatusScreen.jsx"));
const HodSubmittedFoldersScreen = lazy(() => import("./screens/hod/HodSubmittedFoldersScreen.jsx"));
const HodCloApprovalsScreen = lazy(() => import("./screens/hod/HodCloApprovalsScreen.jsx"));
const HodNotificationsScreen = lazy(() => import("./screens/hod/HodNotificationsScreen.jsx"));
const HodAllocationScreen = lazy(() => import("./screens/hod/HodAllocationScreen.jsx"));
const HodSubmittedFolderDetailScreen = lazy(() => import("./screens/hod/HodSubmittedFolderDetailScreen.jsx"));
const HodSubmittedFolderFilesScreen = lazy(() => import("./screens/hod/HodSubmittedFolderFilesScreen.jsx"));
const GraderHomeScreen = lazy(() => import("./screens/grader/GraderHomeScreen.jsx"));

export const normalizeRole = (user) => {
  const rawRoleId =
    user?.roleId ||
    user?.RoleId ||
    user?.roleID ||
    user?.RoleID ||
    user?.role_id ||
    user?.role?.roleId ||
    user?.role?.RoleId ||
    null;

  const roleId = rawRoleId != null && rawRoleId !== "" ? Number(rawRoleId) : null;
  if (Number.isFinite(roleId)) {
    if (roleId === 1) return "admin";
    if (roleId === 2) return "sectionadmin";
    if (roleId === 3) return "teacher";
    if (roleId === 4) return "hod";
    if (roleId === 5) return "grader";
  }

  const rawRole =
    user?.roleName ||
    user?.RoleName ||
    user?.role ||
    user?.Role ||
    user?.role_name ||
    user?.role?.roleName ||
    user?.role?.name ||
    "";

  const normalized = String(rawRole).replace(/[\s_-]/g, "").toLowerCase();
  if (normalized.includes("section")) return "sectionadmin";
  if (normalized.includes("admin")) return "admin";
  if (normalized.includes("faculty")) return "faculty";
  if (normalized.includes("teacher")) return "teacher";
  if (normalized.includes("hod")) return "hod";
  if (normalized.includes("grader")) return "grader";
  return normalized;
};

function RoleHomeRedirect() {
  const { user, isLoading } = useContext(AuthContext);
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  const role = normalizeRole(user);
  if (role === "admin" || role === "sectionadmin") return <Navigate to="/admin" replace />;
  if (role === "hod") return <Navigate to="/hod" replace />;
  if (role === "teacher" || role === "faculty")
    return <Navigate to="/teacher" replace />;
  if (role === "grader") return <Navigate to="/grader" replace />;
  return <Navigate to="/login" replace />;
}

function RequireAuth({ children, roles }) {
  const { user, isLoading } = useContext(AuthContext);
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  const role = normalizeRole(user);
  if (roles && !roles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function LazyPage({ children }) {
  return <Suspense fallback={<LoadingScreen />}>{children}</Suspense>;
}

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/" element={<RoleHomeRedirect />} />

      <Route
        path="/teacher"
        element={
          <RequireAuth roles={["teacher", "faculty"]}>
            <TeacherLayout />
          </RequireAuth>
        }
      >
        <Route index element={<LazyPage><TeacherHomeScreen /></LazyPage>} />
        <Route path="profile" element={<LazyPage><TeacherProfileScreen /></LazyPage>} />
        <Route path="notifications" element={<LazyPage><TeacherNotificationsScreen /></LazyPage>} />
        <Route path="submit-folders" element={<LazyPage><TeacherSubmitFoldersScreen /></LazyPage>} />
        <Route path="attendance" element={<LazyPage><TeacherAttendanceScreen /></LazyPage>} />
        <Route path="course/:offeredCourseId/menu" element={<LazyPage><TeacherCourseMenuScreen /></LazyPage>} />
        <Route path="course/:offeredCourseId/weekly-content" element={<LazyPage><WeeklyContentScreen /></LazyPage>} />
        <Route path="course/:offeredCourseId/clos" element={<LazyPage><TeacherClosScreen /></LazyPage>} />
        <Route path="course/:offeredCourseId/assessment" element={<LazyPage><TeacherAssessmentScreen /></LazyPage>} />
        <Route path="course/:offeredCourseId/assignments" element={<LazyPage><TeacherAssignmentsScreen key="assignments" /></LazyPage>} />
        <Route path="course/:offeredCourseId/quizzes" element={<LazyPage><TeacherAssignmentsScreen key="quizzes" variant="Quiz" /></LazyPage>} />
        <Route path="course/:offeredCourseId/mid-exams" element={<LazyPage><TeacherAssignmentsScreen key="mid-exams" variant="Mid" /></LazyPage>} />
        <Route path="course/:offeredCourseId/final-exams" element={<LazyPage><TeacherAssignmentsScreen key="final-exams" variant="Final" /></LazyPage>} />
        <Route path="course/:offeredCourseId/assessments/:assessmentId/marks" element={<LazyPage><TeacherAssessmentMarksScreen /></LazyPage>} />
        <Route path="course/:offeredCourseId/results" element={<LazyPage><TeacherCloResultsScreen /></LazyPage>} />
        <Route path="course/:offeredCourseId/course-result" element={<LazyPage><TeacherCourseResultsScreen /></LazyPage>} />
        <Route path="course/:offeredCourseId/mappings" element={<LazyPage><TeacherMappingsScreen /></LazyPage>} />
        <Route path="course/:offeredCourseId/homework-marks" element={<LazyPage><RedirectToCourseMappings section="homework" /></LazyPage>} />
        <Route path="course/:offeredCourseId/lab-marks" element={<LazyPage><RedirectToCourseMappings section="lab" /></LazyPage>} />
        <Route path="course/:offeredCourseId/component-marks" element={<LazyPage><TeacherComponentMarksScreen /></LazyPage>} />
        <Route path="course/:offeredCourseId/clo-plo" element={<LazyPage><RedirectToCourseMappings section="clo-plo" /></LazyPage>} />
        <Route path="course/:offeredCourseId/fcar-report" element={<LazyPage><TeacherFcarReportScreen /></LazyPage>} />
        <Route path="course/:offeredCourseId/plo-results" element={<LazyPage><TeacherStudentPloResultsScreen /></LazyPage>} />
        <Route path="course/:offeredCourseId/folder" element={<LazyPage><TeacherCourseFolderScreen /></LazyPage>} />
        <Route path="course/:offeredCourseId/sync" element={<LazyPage><TeacherSynchronizationScreen /></LazyPage>} />
        <Route path="folder-upload" element={<LazyPage><TeacherFolderUploadScreen /></LazyPage>} />
        <Route path="placeholder" element={<LazyPage><TeacherPlaceholderScreen /></LazyPage>} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireAuth roles={["admin", "sectionadmin"]}>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<LazyPage><AdminDashboardScreen /></LazyPage>} />
        <Route path="faculty" element={<LazyPage><FacultyScreen /></LazyPage>} />
        <Route path="programs" element={<LazyPage><SectionAdminProgramsScreen /></LazyPage>} />
        <Route path="program/:programId/sessions" element={<LazyPage><SectionAdminProgramSessionsScreen /></LazyPage>} />
        <Route path="session/:sessionId/sections" element={<LazyPage><SectionAdminSectionsScreen /></LazyPage>} />
        <Route path="students" element={<LazyPage><SectionAdminStudentsScreen /></LazyPage>} />
        <Route path="enrollment" element={<LazyPage><StudentEnrollmentScreen /></LazyPage>} />
        <Route path="grader-allocations" element={<LazyPage><GraderAllocationsScreen /></LazyPage>} />
        <Route path="profile" element={<LazyPage><ProfileScreen /></LazyPage>} />
        <Route path="audit" element={<LazyPage><PlaceholderScreen /></LazyPage>} />
      </Route>

      <Route
        path="/section-admin/*"
        element={<Navigate to="/admin/programs" replace />}
      />

      <Route
        path="/hod"
        element={
          <RequireAuth roles={["hod"]}>
            <HodLayout />
          </RequireAuth>
        }
      >
        <Route index element={<LazyPage><HodWelcomeScreen /></LazyPage>} />
        <Route path="offered-course/:offeredCourseId/progress" element={<LazyPage><HodCourseProgressScreen /></LazyPage>} />
        <Route path="offered-course/:offeredCourseId/weekly" element={<LazyPage><HodWeeklyStatusScreen /></LazyPage>} />
        <Route path="courses" element={<Navigate to="/hod/programs" replace />} />
        <Route path="programs" element={<LazyPage><HodProgramsScreen /></LazyPage>} />
        <Route path="program/:programId/menu" element={<LazyPage><HodProgramMenuScreen /></LazyPage>} />
        <Route path="program/:programId/courses" element={<LazyPage><HodProgramCoursesScreen /></LazyPage>} />
        <Route path="program/:programId/sessions" element={<LazyPage><HodSessionsScreen /></LazyPage>} />
        <Route path="program/:programId/session/:sessionId" element={<LazyPage><HodSessionDetailsScreen /></LazyPage>} />
        <Route path="program/:programId/session/:sessionId/section/:sectionId/students" element={<LazyPage><HodSectionStudentsScreen /></LazyPage>} />
        <Route path="program/:programId/session/:sessionId/offered-courses" element={<LazyPage><HodOfferedCoursesScreen /></LazyPage>} />
        <Route path="program/:programId/plos" element={<LazyPage><HodPLOsScreen /></LazyPage>} />
        <Route path="program/:programId/peos" element={<LazyPage><HodPEOsScreen /></LazyPage>} />
        <Route path="program/:programId/mapping" element={<LazyPage><HodMappingMenuScreen /></LazyPage>} />
        <Route path="program/:programId/mapping/peo-plo" element={<LazyPage><HodPeoPloMappingScreen /></LazyPage>} />
        <Route path="program/:programId/mapping/plo-course" element={<LazyPage><HodPloCourseMappingScreen /></LazyPage>} />
        <Route path="graders" element={<LazyPage><HodGradersScreen /></LazyPage>} />
        <Route path="allocation" element={<LazyPage><HodAllocationScreen /></LazyPage>} />
        <Route path="submitted-folders" element={<LazyPage><HodSubmittedFoldersScreen /></LazyPage>} />
        <Route path="clo-approvals" element={<LazyPage><HodCloApprovalsScreen /></LazyPage>} />
        <Route path="notifications" element={<LazyPage><HodNotificationsScreen /></LazyPage>} />
        <Route path="submitted-folders/:offeredCourseId" element={<LazyPage><HodSubmittedFolderDetailScreen /></LazyPage>} />
        <Route path="submitted-folders/:offeredCourseId/folder/:directoryId" element={<LazyPage><HodSubmittedFolderFilesScreen /></LazyPage>} />
        <Route path="profile" element={<LazyPage><ProfileScreen /></LazyPage>} />
      </Route>

      <Route
        path="/grader"
        element={
          <RequireAuth roles={["grader"]}>
            <LazyPage><GraderHomeScreen /></LazyPage>
          </RequireAuth>
        }
      />
      <Route
        path="/grader/profile"
        element={
          <RequireAuth roles={["grader"]}>
            <LazyPage><ProfileScreen /></LazyPage>
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
