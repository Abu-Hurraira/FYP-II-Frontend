import request from "./apiClient";
import { appendFormFile } from "../utils/appendFormFile";

export const getCourses = async () => {
  return await request("/Courses");
};

export const getCoursesDropdown = async () => {
  return await request("/Courses/dropdown");
};

export const createCourse = async (course) => {
  return await request("/Courses", {
    method: "POST",
    body: JSON.stringify(course),
  });
};

export const updateCourse = async (courseId, course) => {
  return await request(`/Courses/${courseId}`, {
    method: "PUT",
    body: JSON.stringify(course),
  });
};

export const deleteCourse = async (courseId) => {
  return await request(`/Courses/${courseId}`, {
    method: "DELETE",
  });
};

export const importCoursesFromExcel = async (file) => {
  const formData = new FormData();
  appendFormFile(formData, "file", file, "courses.xlsx");

  return await request("/Courses/import", {
    method: "POST",
    body: formData,
    timeoutMs: 120000,
  });
};
