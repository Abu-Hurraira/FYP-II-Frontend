import request from "./apiClient";

export const getSessions = async () => {
  return await request("/AcademicSessions");
};

export const getSessionsByProgram = async (programId) => {
  return await request(`/AcademicSessions/by-program/${programId}`);
};

export const createSession = async (session) => {
  return await request("/AcademicSessions", {
    method: "POST",
    body: JSON.stringify(session),
  });
};

export const updateSession = async (sessionId, session) => {
  return await request(`/AcademicSessions/${sessionId}`, {
    method: "PUT",
    body: JSON.stringify(session),
  });
};

export const deleteSession = async (sessionId) => {
  return await request(`/AcademicSessions/${sessionId}`, {
    method: "DELETE",
  });
};
