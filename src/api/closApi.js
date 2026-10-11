import request from "./apiClient";
import { appendFormFile } from "../utils/appendFormFile";

function withQuery(path, params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== "");
  if (!entries.length) return path;
  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return `${path}${path.includes("?") ? "&" : "?"}${qs}`;
}

export const getCLOsByProgramCourse = async (
  programCourseId,
  { includeArchived = false, offeredCourseId, teacherUserId, sessionId } = {}
) => {
  if (teacherUserId == null || teacherUserId === "") {
    throw new Error("teacherUserId is required to load CLOs.");
  }
  return await request(
    withQuery(`/CLOs/program-course/${programCourseId}`, {
      offeredCourseId,
      teacherUserId,
      sessionId,
    })
  );
};

export const createCLO = async (clo) => {
  const programCourseId = clo.programCourseId;
  return await request(`/CLOs/program-course/${programCourseId}`, {
    method: "POST",
    body: JSON.stringify({
      teacherUserId: clo.teacherUserId,
      offeredCourseId: clo.offeredCourseId,
      sessionId: clo.sessionId,
      cloCode: clo.cloCode,
      cloDescription: clo.cloDescription,
    }),
  });
};

export const updateCLO = async (cloId, clo, { archiveId, offeredCourseId, teacherUserId } = {}) => {
  // Archive catalog edits use OutcomeCatalogVersions; live CLO rows use /CLOs/{id}.
  const base = `/CLOs/${cloId}`;
  return await request(
    withQuery(base, {
      offeredCourseId,
      teacherUserId: teacherUserId ?? clo?.teacherUserId,
    }),
    {
      method: "PUT",
      body: JSON.stringify({
        teacherUserId: teacherUserId ?? clo?.teacherUserId,
        cloCode: clo?.cloCode,
        cloDescription: clo?.cloDescription,
        offeredCourseId,
      }),
    }
  );
};

export const deleteCLO = async (cloId, { archiveId, offeredCourseId, teacherUserId } = {}) => {
  const base = `/CLOs/${cloId}`;
  return await request(withQuery(base, { offeredCourseId, teacherUserId }), {
    method: "DELETE",
  });
};

export const submitCLOsForApproval = async (
  programCourseId,
  { offeredCourseId, submittedByUserId } = {}
) => {
  return await request(
    withQuery(`/CLOs/submit-by-program-course/${programCourseId}`, {
      offeredCourseId,
      submittedByUserId,
    }),
    { method: "POST" }
  );
};

export const importCLOs = async (programCourseId, file, { offeredCourseId, teacherUserId, sessionId } = {}) => {
  const formData = new FormData();
  appendFormFile(formData, "file", file, "clos.xlsx");
  if (teacherUserId) formData.append("teacherUserId", String(teacherUserId));
  if (offeredCourseId) formData.append("offeredCourseId", String(offeredCourseId));
  if (sessionId) formData.append("sessionId", String(sessionId));

  return await request(`/CLOs/program-course/${programCourseId}/import`, {
    method: "POST",
    body: formData,
    timeoutMs: 120000,
  });
};
