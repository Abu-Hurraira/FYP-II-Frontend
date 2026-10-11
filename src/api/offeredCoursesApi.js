import request from "./apiClient";
import { appendFormFile } from "../utils/appendFormFile";
import { asList } from "../utils/helpers";

export const getOfferedCourses = async () => {
  return asList(await request("/OfferedCourses"));
};

export const getOfferedCoursesBySession = async (sessionId) => {
  return asList(await request(`/OfferedCourses/by-session/${sessionId}`));
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

  return await request(`/OfferedCourses/import-session/${sessionId}`, {
    method: "POST",
    body: formData,
    timeoutMs: 120000,
  });
};
