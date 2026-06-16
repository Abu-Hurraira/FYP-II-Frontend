import React, { useContext } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthContext } from "./context/AuthContext.jsx";

import LoadingScreen from "./screens/common/LoadingScreen.jsx";
import LoginScreen from "./screens/auth/LoginScreen.jsx";

import TeacherLayout from "./layouts/TeacherLayout.jsx";
import AdminLayout from "./layouts/AdminLayout.jsx";
import HodLayout from "./layouts/HodLayout.jsx";
import SectionAdminLayout from "./layouts/SectionAdminLayout.jsx";

import TeacherHomeScreen from "./screens/teacher/TeacherHomeScreen.jsx";
import TeacherCourseMenuScreen from "./screens/teacher/TeacherCourseMenuScreen.jsx";
import WeeklyContentScreen from "./screens/teacher/WeeklyContentScreen.jsx";
import TeacherPlaceholderScreen from "./screens/teacher/TeacherPlaceholderScreen.jsx";
import TeacherSubmitFoldersScreen from "./screens/teacher/TeacherSubmitFoldersScreen.jsx";
import TeacherCourseFolderScreen from "./screens/teacher/TeacherCourseFolderScreen.jsx";
import TeacherFolderUploadScreen from "./screens/teacher/TeacherFolderUploadScreen.jsx";
import TeacherSynchronizationScreen from "./screens/teacher/TeacherSynchronizationScreen.jsx";
import TeacherProfileScreen from "./screens/teacher/TeacherProfileScreen.jsx";

import ProfileScreen from "./screens/common/ProfileScreen.jsx";

import AdminDashboardScreen from "./screens/admin/AdminDashboardScreen.jsx";
import FacultyScreen from "./screens/admin/FacultyScreen.jsx";
import PlaceholderScreen from "./screens/admin/PlaceholderScreen.jsx";
import SectionAdminStudentsScreen from "./screens/sectionAdmin/SectionAdminStudentsScreen.jsx";

import SectionAdminSectionsScreen from "./screens/sectionAdmin/SectionAdminSectionsScreen.jsx";
import SectionAdminPlaceholderScreen from "./screens/sectionAdmin/SectionAdminPlaceholderScreen.jsx";
import SectionAdminProgramsScreen from "./screens/sectionAdmin/SectionAdminProgramsScreen.jsx";
import SectionAdminProgramSessionsScreen from "./screens/sectionAdmin/SectionAdminProgramSessionsScreen.jsx";
import GraderAllocationsScreen from "./screens/sectionAdmin/GraderAllocationsScreen.jsx";
import HodWelcomeScreen from "./screens/hod/HodWelcomeScreen.jsx";
import HodProgramsScreen from "./screens/hod/HodProgramsScreen.jsx";
import HodProgramMenuScreen from "./screens/hod/HodProgramMenuScreen.jsx";
import HodPLOsScreen from "./screens/hod/PLOsScreen.jsx";
import HodPEOsScreen from "./screens/hod/PEOsScreen.jsx";
import HodGradersScreen from "./screens/hod/HodGradersScreen.jsx";
import HodSessionsScreen from "./screens/hod/HodSessionsScreen.jsx";
import HodSessionDetailsScreen from "./screens/hod/HodSessionDetailsScreen.jsx";
import HodOfferedCoursesScreen from "./screens/hod/HodOfferedCoursesScreen.jsx";
import HodMappingMenuScreen from "./screens/hod/HodMappingMenuScreen.jsx";
import HodPeoPloMappingScreen from "./screens/hod/HodPeoPloMappingScreen.jsx";
import HodPloCourseMappingScreen from "./screens/hod/HodPloCourseMappingScreen.jsx";
import HodCoursesScreen from "./screens/hod/HodCoursesScreen.jsx";
import HodCourseProgressScreen from "./screens/hod/HodCourseProgressScreen.jsx";
import HodWeeklyStatusScreen from "./screens/hod/HodWeeklyStatusScreen.jsx";

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
    // Backend commonly uses numeric role ids; keep this mapping centralized.
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
  if (role === "admin") return <Navigate to="/admin" replace />;
  if (role === "sectionadmin") return <Navigate to="/section-admin" replace />;
  if (role === "hod") return <Navigate to="/hod" replace />;
  if (role === "teacher" || role === "faculty")
    return <Navigate to="/teacher" replace />;
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
        <Route index element={<TeacherHomeScreen />} />
        <Route path="profile" element={<TeacherProfileScreen />} />
        <Route path="submit-folders" element={<TeacherSubmitFoldersScreen />} />
        <Route
          path="course/:offeredCourseId/menu"
          element={<TeacherCourseMenuScreen />}
        />
        <Route
          path="course/:offeredCourseId/weekly-content"
          element={<WeeklyContentScreen />}
        />
        <Route
          path="course/:offeredCourseId/folder"
          element={<TeacherCourseFolderScreen />}
        />
        <Route
          path="course/:offeredCourseId/sync"
          element={<TeacherSynchronizationScreen />}
        />
        <Route path="folder-upload" element={<TeacherFolderUploadScreen />} />
        <Route path="placeholder" element={<TeacherPlaceholderScreen />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireAuth roles={["admin"]}>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<AdminDashboardScreen />} />
        <Route path="faculty" element={<FacultyScreen />} />
        <Route path="students" element={<SectionAdminStudentsScreen />} />
        <Route path="profile" element={<ProfileScreen />} />
        <Route path="audit" element={<PlaceholderScreen />} />
      </Route>

      <Route
        path="/section-admin"
        element={
          <RequireAuth roles={["sectionadmin"]}>
            <SectionAdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<SectionAdminProgramsScreen />} />
        <Route path="program/:programId/sessions" element={<SectionAdminProgramSessionsScreen />} />
        <Route
          path="session/:sessionId/sections"
          element={<SectionAdminSectionsScreen />}
        />
        <Route path="students" element={<SectionAdminStudentsScreen />} />
        <Route path="grader-allocations" element={<GraderAllocationsScreen />} />
        <Route path="profile" element={<ProfileScreen />} />
        <Route path="audit" element={<SectionAdminPlaceholderScreen />} />
      </Route>

      <Route
        path="/hod"
        element={
          <RequireAuth roles={["hod"]}>
            <HodLayout />
          </RequireAuth>
        }
      >
        <Route index element={<HodWelcomeScreen />} />
        <Route path="offered-course/:offeredCourseId/progress" element={<HodCourseProgressScreen />} />
        <Route path="offered-course/:offeredCourseId/weekly" element={<HodWeeklyStatusScreen />} />
        <Route path="courses" element={<HodCoursesScreen />} />
        <Route path="programs" element={<HodProgramsScreen />} />
        <Route path="program/:programId/menu" element={<HodProgramMenuScreen />} />
        <Route path="program/:programId/sessions" element={<HodSessionsScreen />} />
        <Route path="program/:programId/session/:sessionId" element={<HodSessionDetailsScreen />} />
        <Route
          path="program/:programId/session/:sessionId/offered-courses"
          element={<HodOfferedCoursesScreen />}
        />
        <Route path="program/:programId/plos" element={<HodPLOsScreen />} />
        <Route path="program/:programId/peos" element={<HodPEOsScreen />} />
        <Route path="program/:programId/mapping" element={<HodMappingMenuScreen />} />
        <Route path="program/:programId/mapping/peo-plo" element={<HodPeoPloMappingScreen />} />
        <Route path="program/:programId/mapping/plo-course" element={<HodPloCourseMappingScreen />} />
        <Route path="graders" element={<HodGradersScreen />} />
        <Route path="profile" element={<ProfileScreen />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
