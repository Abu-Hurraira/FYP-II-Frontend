import request from "./apiClient";

function mapTask(t) {
  return {
    taskCode: t.taskCode ?? t.TaskCode ?? "",
    label: t.label ?? t.Label ?? "",
    assigned: Boolean(t.assigned ?? t.Assigned),
    progressText: t.progressText ?? t.ProgressText ?? "",
    done: t.done ?? t.Done ?? 0,
    total: t.total ?? t.Total ?? 0,
  };
}

function mapCourse(c) {
  return {
    graderAllocationId: c.graderAllocationId ?? c.GraderAllocationId,
    offeredCourseId: c.offeredCourseId ?? c.OfferedCourseId,
    courseTitle: c.courseTitle ?? c.CourseTitle ?? "",
    courseCode: c.courseCode ?? c.CourseCode ?? "",
    sectionName: c.sectionName ?? c.SectionName ?? "",
    teacherUserId: c.teacherUserId ?? c.TeacherUserId,
    teacherName: c.teacherName ?? c.TeacherName ?? "",
    teacherEmail: c.teacherEmail ?? c.TeacherEmail ?? "",
    tasks: (c.tasks ?? c.Tasks ?? []).map(mapTask),
  };
}

function mapWorkspace(g) {
  return {
    graderAllocationId: g.graderAllocationId ?? g.GraderAllocationId,
    graderUserId: g.graderUserId ?? g.GraderUserId,
    graderName: g.graderName ?? g.GraderName ?? "",
    graderEmail: g.graderEmail ?? g.GraderEmail ?? "",
    courses: (g.courses ?? g.Courses ?? []).map(mapCourse),
  };
}

export async function getGraderTasksMine() {
  const data = await request("/GraderTasks/mine");
  return (Array.isArray(data) ? data : []).map(mapCourse);
}

export async function getTeacherGraderTasks(teacherUserId) {
  const data = await request(`/GraderTasks/teacher/${teacherUserId}`);
  return {
    catalog: (data.catalog ?? data.Catalog ?? []).map((c) => ({
      taskCode: c.taskCode ?? c.TaskCode ?? "",
      label: c.label ?? c.Label ?? "",
    })),
    graders: (data.graders ?? data.Graders ?? []).map(mapWorkspace),
  };
}

export async function saveGraderTasks(payload) {
  const data = await request("/GraderTasks", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return {
    catalog: (data.catalog ?? data.Catalog ?? []).map((c) => ({
      taskCode: c.taskCode ?? c.TaskCode ?? "",
      label: c.label ?? c.Label ?? "",
    })),
    graders: (data.graders ?? data.Graders ?? []).map(mapWorkspace),
  };
}
