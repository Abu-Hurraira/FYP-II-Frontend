import request from "./apiClient";

export async function getPendingCloApprovals() {
  const data = await request("/HodCloReview/pending");
  return (data || []).map((item) => ({
    programCourseId: item.programCourseId ?? item.ProgramCourseId,
    courseId: item.courseId ?? item.CourseId,
    courseTitle: item.courseTitle ?? item.CourseTitle ?? "",
    courseCode: item.courseCode ?? item.CourseCode ?? "",
    programId: item.programId ?? item.ProgramId,
    programName: item.programName ?? item.ProgramName ?? "",
    submittedByUserId: item.submittedByUserId ?? item.SubmittedByUserId,
    submittedByName: item.submittedByName ?? item.SubmittedByName ?? "Teacher",
    submittedAt: item.submittedAt ?? item.SubmittedAt,
    pendingCount: item.pendingCount ?? item.PendingCount ?? 0,
    clos: (item.clos ?? item.Clos ?? []).map((c) => ({
      cloId: c.cloId ?? c.CloId,
      cloCode: c.cloCode ?? c.CloCode ?? "",
      cloDescription: c.cloDescription ?? c.CloDescription ?? "",
      approvalStatus: c.approvalStatus ?? c.ApprovalStatus ?? "Pending",
      submittedAt: c.submittedAt ?? c.SubmittedAt,
    })),
  }));
}

export async function approvePendingClos(programCourseId, hodUserId) {
  return await request(`/HodCloReview/program-course/${programCourseId}/approve?hodUserId=${hodUserId}`, {
    method: "POST",
  });
}

export async function rejectPendingClos(programCourseId, hodUserId, reason) {
  return await request(`/HodCloReview/program-course/${programCourseId}/reject?hodUserId=${hodUserId}`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
