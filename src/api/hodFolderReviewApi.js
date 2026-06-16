import request from "./apiClient";

/**
 * HOD approves a submitted course folder.
 * Backend should set FolderSubmissions.SubmissionStatus = 'Approved' and notify teacher optionally.
 */
export async function approveSubmittedFolder(offeredCourseId, hodUserId) {
  return await request(`/HodFolderReview/offered-course/${offeredCourseId}/approve`, {
    method: "POST",
    body: JSON.stringify({ hodUserId }),
  });
}

/**
 * HOD rejects a submitted folder with a reason.
 * Backend should unlock the folder for the teacher, store the reason, and create a notification.
 */
export async function rejectSubmittedFolder(offeredCourseId, hodUserId, reason) {
  return await request(`/HodFolderReview/offered-course/${offeredCourseId}/reject`, {
    method: "POST",
    body: JSON.stringify({ hodUserId, reason }),
  });
}
