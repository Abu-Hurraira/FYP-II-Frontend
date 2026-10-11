import request from "./apiClient";

export async function getCoursePermissionGroups(courseId) {
  return await request(`/TeacherPermissions/courses/${courseId}`);
}

export async function updateTeacherPermission(programId, courseId, teacherUserId, payload) {
  return await request(
    `/TeacherPermissions/programs/${programId}/courses/${courseId}/teachers/${teacherUserId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}
