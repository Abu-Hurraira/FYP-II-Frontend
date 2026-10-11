import request from "./apiClient";

export async function getCourseResultReadiness(offeredCourseId, teacherUserId) {
  return await request(
    `/CourseResults/offered-course/${offeredCourseId}/readiness?teacherUserId=${encodeURIComponent(
      teacherUserId
    )}`
  );
}

export async function getCourseFixedScheme(offeredCourseId, teacherUserId) {
  return await request(
    `/CourseResults/offered-course/${offeredCourseId}/fixed-scheme?teacherUserId=${encodeURIComponent(
      teacherUserId
    )}`
  );
}

export async function saveCourseResultBestOf(offeredCourseId, payload) {
  return await request(`/CourseResults/offered-course/${offeredCourseId}/best-of`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getLabMarkScheme(offeredCourseId, teacherUserId) {
  return await request(
    `/CourseResults/offered-course/${offeredCourseId}/lab-scheme?teacherUserId=${encodeURIComponent(
      teacherUserId
    )}`
  );
}

export async function saveLabMarkScheme(offeredCourseId, payload) {
  return await request(`/CourseResults/offered-course/${offeredCourseId}/lab-scheme`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getHomeworkMarkScheme(offeredCourseId, teacherUserId) {
  return await request(
    `/CourseResults/offered-course/${offeredCourseId}/homework-scheme?teacherUserId=${encodeURIComponent(
      teacherUserId
    )}`
  );
}

export async function saveHomeworkMarkScheme(offeredCourseId, payload) {
  return await request(`/CourseResults/offered-course/${offeredCourseId}/homework-scheme`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function generateCourseResults(offeredCourseId, teacherUserId) {
  return await request(`/CourseResults/offered-course/${offeredCourseId}/generate`, {
    method: "POST",
    body: JSON.stringify({ teacherUserId }),
  });
}

export async function getCourseResults(offeredCourseId, teacherUserId) {
  return await request(
    `/CourseResults/offered-course/${offeredCourseId}/results?teacherUserId=${encodeURIComponent(
      teacherUserId
    )}`
  );
}

export async function getComponentMarks(offeredCourseId, teacherUserId) {
  return await request(
    `/CourseResults/offered-course/${offeredCourseId}/component-marks?teacherUserId=${encodeURIComponent(
      teacherUserId
    )}`
  );
}

export async function saveComponentMarks(offeredCourseId, payload) {
  return await request(`/CourseResults/offered-course/${offeredCourseId}/component-marks`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
