import request from "./apiClient";

export async function approveSubmittedFolder(offeredCourseId, hodUserId, feedback) {
  return await request(`/HodFolder/submitted/${offeredCourseId}/approve`, {
    method: "POST",
    body: JSON.stringify({ hodUserId, feedback: feedback || null }),
  });
}

export async function rejectSubmittedFolder(offeredCourseId, hodUserId, reason) {
  return await request(`/HodFolder/submitted/${offeredCourseId}/reject`, {
    method: "POST",
    body: JSON.stringify({ hodUserId, feedback: reason }),
  });
}

export async function unlockSubmittedFolder(offeredCourseId, hodUserId, feedback) {
  return await request(`/HodFolder/submitted/${offeredCourseId}/unlock`, {
    method: "POST",
    body: JSON.stringify({ hodUserId, feedback: feedback || null }),
  });
}

export async function getHodSubmittedFolderOverview(offeredCourseId) {
  return await request(`/HodFolder/submitted/${offeredCourseId}`);
}

export async function getHodSubmittedFolderFiles(offeredCourseId, directoryId) {
  return await request(`/HodFolder/submitted/${offeredCourseId}/folders/${directoryId}/files`);
}
