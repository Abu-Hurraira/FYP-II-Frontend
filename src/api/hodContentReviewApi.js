import request from "./apiClient";

export async function getHodContentReviewQueue(hodUserId) {
  return await request(`/HodContentReview/${hodUserId}/queue`);
}

export async function getHodSubmissionDetails(submissionId, hodUserId) {
  return await request(`/HodContentReview/${submissionId}/details?hodUserId=${hodUserId}`);
}

export async function approveHodSubmission(submissionId, hodUserId, feedback = "") {
  return await request(`/HodContentReview/${submissionId}/approve`, {
    method: "POST",
    body: JSON.stringify({
      hodUserId,
      hodFeedback: feedback,
    }),
  });
}

export async function rejectHodSubmission(submissionId, hodUserId, feedback = "") {
  return await request(`/HodContentReview/${submissionId}/reject`, {
    method: "POST",
    body: JSON.stringify({
      hodUserId,
      hodFeedback: feedback,
    }),
  });
}
