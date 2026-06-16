import request, { API_BASE_URL } from "./apiClient";
import { appendFormFile } from "../utils/appendFormFile";

export const getSectionsBySession = async (sessionId) => {
  return await request(`/Sections/by-session/${sessionId}`);
};

export const createSection = async (section) => {
  return await request("/Sections", {
    method: "POST",
    body: JSON.stringify(section),
  });
};

export const uploadAttendanceSheet = async (sectionId, file) => {
  const formData = new FormData();
  appendFormFile(formData, "file", file, "attendance.xlsx");

  const response = await fetch(
    `${API_BASE_URL}/Sections/upload-attendance/${sectionId}`,
    {
      method: "POST",
      body: formData,
    }
  );

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || "Failed to upload attendance sheet.");
  }

  return data;
};