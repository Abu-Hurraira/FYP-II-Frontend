import request from "./apiClient";

export async function getCloAttainmentStudents(offeredCourseId, teacherUserId) {
  return await request(
    `/CloAttainment/offered-course/${offeredCourseId}/students?teacherUserId=${encodeURIComponent(
      teacherUserId
    )}`
  );
}

export async function getAssessmentMarksSheet(assessmentId, offeredCourseId, teacherUserId) {
  return await request(
    `/CloAttainment/assessments/${assessmentId}/marks-sheet?offeredCourseId=${encodeURIComponent(
      offeredCourseId
    )}&teacherUserId=${encodeURIComponent(teacherUserId)}`
  );
}

export async function saveAssessmentMarksSheet(assessmentId, offeredCourseId, payload) {
  return await request(
    `/CloAttainment/assessments/${assessmentId}/marks-sheet?offeredCourseId=${encodeURIComponent(
      offeredCourseId
    )}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}

export async function getCloAssessmentDesign(offeredCourseId, teacherUserId) {
  return await request(
    `/CloAttainment/offered-course/${offeredCourseId}/design?teacherUserId=${encodeURIComponent(
      teacherUserId
    )}`
  );
}

export async function saveCloAssessmentDesignCell(offeredCourseId, payload) {
  return await request(`/CloAttainment/offered-course/${offeredCourseId}/design/cell`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function calculateCloAttainment(offeredCourseId, teacherUserId) {
  return await request(`/CloAttainment/offered-course/${offeredCourseId}/calculate`, {
    method: "POST",
    body: JSON.stringify({ teacherUserId }),
  });
}

export async function getCloAttainmentResults(offeredCourseId, teacherUserId) {
  return await request(
    `/CloAttainment/offered-course/${offeredCourseId}/results?teacherUserId=${encodeURIComponent(
      teacherUserId
    )}`
  );
}

export async function getPloAttainmentResults(offeredCourseId, teacherUserId) {
  return await request(
    `/CloAttainment/offered-course/${offeredCourseId}/plo-results?teacherUserId=${encodeURIComponent(
      teacherUserId
    )}`
  );
}

export async function getSubjectAttainmentDashboard(offeredCourseId, teacherUserId) {
  return await request(
    `/CloAttainment/offered-course/${offeredCourseId}/dashboard?teacherUserId=${encodeURIComponent(
      teacherUserId
    )}`
  );
}

export async function getAssessmentFolderOverview(offeredCourseId, teacherUserId) {
  return await request(
    `/CloAttainment/offered-course/${offeredCourseId}/assessment-folder-overview?teacherUserId=${encodeURIComponent(
      teacherUserId
    )}`
  );
}

export async function getStudentPloResults(offeredCourseId, teacherUserId) {
  return await request(
    `/CloAttainment/offered-course/${offeredCourseId}/student-plo-results?teacherUserId=${encodeURIComponent(
      teacherUserId
    )}`
  );
}
