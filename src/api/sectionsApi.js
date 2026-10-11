import request from "./apiClient";
import { appendFormFile } from "../utils/appendFormFile";
import { asList } from "../utils/helpers";

export const getSectionsBySession = async (sessionId) => {
  return asList(await request(`/Sections/by-session/${sessionId}`));
};

export const createSection = async (section) => {
  return await request("/Sections", {
    method: "POST",
    body: JSON.stringify(section),
  });
};

export const updateSection = async (sectionId, section) => {
  return await request(`/Sections/${sectionId}`, {
    method: "PUT",
    body: JSON.stringify(section),
  });
};

export const deleteSection = async (sectionId) => {
  return await request(`/Sections/${sectionId}`, {
    method: "DELETE",
  });
};

export const uploadAttendanceSheet = async (sectionId, file) => {
  const formData = new FormData();
  appendFormFile(formData, "file", file, "attendance.xlsx");

  return await request(`/Sections/upload-attendance/${sectionId}`, {
    method: "POST",
    body: formData,
    timeoutMs: 120000,
  });
};