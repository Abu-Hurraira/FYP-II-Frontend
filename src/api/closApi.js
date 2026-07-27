import request, { API_BASE_URL } from "./apiClient";
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
  { includeArchived = false, offeredCourseId } = {}
) => {
  return await request(
    withQuery(`/CLOs/by-program-course/${programCourseId}`, {
      includeArchived: includeArchived ? "true" : undefined,
      offeredCourseId,
    })
  );
};

export const createCLO = async (clo) => {
  return await request("/CLOs", {
    method: "POST",
    body: JSON.stringify(clo),
  });
};

export const updateCLO = async (cloId, clo, { archiveId, offeredCourseId } = {}) => {
  const base = archiveId != null ? `/CLOs/archive/${archiveId}` : `/CLOs/${cloId}`;
  return await request(withQuery(base, { offeredCourseId }), {
    method: "PUT",
    body: JSON.stringify(clo),
  });
};

export const deleteCLO = async (cloId, { archiveId, offeredCourseId } = {}) => {
  const base = archiveId != null ? `/CLOs/archive/${archiveId}` : `/CLOs/${cloId}`;
  return await request(withQuery(base, { offeredCourseId }), {
    method: "DELETE",
  });
};

export const restoreCLOsByProgramCourse = async (programCourseId, { offeredCourseId } = {}) => {
  return await request(withQuery(`/CLOs/restore-by-program-course/${programCourseId}`, { offeredCourseId }), {
    method: "POST",
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

export const importCLOs = async (programCourseId, file, { offeredCourseId } = {}) => {
  const formData = new FormData();
  appendFormFile(formData, "file", file, "clos.xlsx");

  const response = await fetch(
    `${API_BASE_URL}${withQuery(`/CLOs/import/${programCourseId}`, { offeredCourseId })}`,
    {
      method: "POST",
      body: formData,
    }
  );

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || "Failed to import CLOs.");
  }

  return data;
};
