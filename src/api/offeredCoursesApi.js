import request, { API_BASE_URL } from "./apiClient";
import { appendFormFile } from "../utils/appendFormFile";

export const getOfferedCourses = async () => {
  return await request("/OfferedCourses");
};

export const getOfferedCoursesBySession = async (sessionId) => {
  return await request(`/OfferedCourses/by-session/${sessionId}`);
};

export const createOfferedCourse = async (offeredCourse) => {
  return await request("/OfferedCourses", {
    method: "POST",
    body: JSON.stringify(offeredCourse),
  });
};

export const updateOfferedCourse = async (offeredCourseId, offeredCourse) => {
  return await request(`/OfferedCourses/${offeredCourseId}`, {
    method: "PUT",
    body: JSON.stringify(offeredCourse),
  });
};

export const deleteOfferedCourse = async (offeredCourseId) => {
  return await request(`/OfferedCourses/${offeredCourseId}`, {
    method: "DELETE",
  });
};

export const importCourseDetailsForSession = async (sessionId, file) => {
  const formData = new FormData();
  appendFormFile(formData, "file", file, "offered-courses.xlsx");

  const response = await fetch(
    `${API_BASE_URL}/OfferedCourses/import-session/${sessionId}`,
    {
      method: "POST",
      body: formData,
    }
  );

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || "Failed to import offered courses.");
  }

  return data;
};
