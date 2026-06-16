import request from "./apiClient";

export const getPrograms = async () => {
  return await request("/AcademicPrograms");
};

export const getProgramsDropdown = async () => {
  return await request("/AcademicPrograms/dropdown");
};

export const createProgram = async (program) => {
  return await request("/AcademicPrograms", {
    method: "POST",
    body: JSON.stringify(program),
  });
};

export const updateProgram = async (programId, program) => {
  return await request(`/AcademicPrograms/${programId}`, {
    method: "PUT",
    body: JSON.stringify(program),
  });
};

export const deleteProgram = async (programId) => {
  return await request(`/AcademicPrograms/${programId}`, {
    method: "DELETE",
  });
};
