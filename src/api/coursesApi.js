import request, { API_BASE_URL } from "./apiClient";
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

  const response = await fetch(`${API_BASE_URL}/Courses/import`, {
    method: "POST",
    body: formData,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || "Failed to import courses.");
  }

  return data;
};
