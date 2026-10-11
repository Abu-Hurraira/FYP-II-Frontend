import request from "./apiClient";

export async function getProgramPloMatrix(programId) {
  return await request(`/ProgramCoursePLOMappings/programs/${programId}/matrix`);
}

export async function saveProgramPloMatrix(programId, payload) {
  return await request(`/ProgramCoursePLOMappings/programs/${programId}/matrix`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getProgramCoursesForMapping(programId) {
  return await request(`/ProgramCoursePLOMappings/programs/${programId}/courses`);
}

export async function addProgramCourse(programId, courseId) {
  return await request(`/ProgramCoursePLOMappings/programs/${programId}/courses`, {
    method: "POST",
    body: JSON.stringify({ courseId }),
  });
}

export async function removeProgramCourse(programCourseId) {
  return await request(`/ProgramCoursePLOMappings/program-course/${programCourseId}`, {
    method: "DELETE",
  });
}
