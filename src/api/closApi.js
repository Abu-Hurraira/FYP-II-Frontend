import request, { API_BASE_URL } from "./apiClient";
import { appendFormFile } from "../utils/appendFormFile";

export const getCLOsByProgramCourse = async (programCourseId, { includeArchived = false } = {}) => {
  const query = includeArchived ? "?includeArchived=true" : "";
  return await request(`/CLOs/by-program-course/${programCourseId}${query}`);
};

export const createCLO = async (clo) => {
  return await request("/CLOs", {
    method: "POST",
    body: JSON.stringify(clo),
  });
};

export const updateCLO = async (cloId, clo, { archiveId } = {}) => {
  const path = archiveId != null ? `/CLOs/archive/${archiveId}` : `/CLOs/${cloId}`;
  return await request(path, {
    method: "PUT",
    body: JSON.stringify(clo),
  });
};

export const deleteCLO = async (cloId, { archiveId } = {}) => {
  const path = archiveId != null ? `/CLOs/archive/${archiveId}` : `/CLOs/${cloId}`;
  return await request(path, {
    method: "DELETE",
  });
};

export const restoreCLOsByProgramCourse = async (programCourseId) => {
  return await request(`/CLOs/restore-by-program-course/${programCourseId}`, {
    method: "POST",
  });
};

export const importCLOs = async (programCourseId, file) => {
  const formData = new FormData();
  appendFormFile(formData, "file", file, "clos.xlsx");

  const response = await fetch(`${API_BASE_URL}/CLOs/import/${programCourseId}`, {
    method: "POST",
    body: formData,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || "Failed to import CLOs.");
  }

  return data;
};
