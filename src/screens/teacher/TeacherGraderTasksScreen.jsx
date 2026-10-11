import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import { getTeacherGraderTasks, saveGraderTasks } from "../../api/graderTasksApi";
import { deleteGraderAllocation } from "../../api/graderAllocationsApi";
import { getAuthUserId } from "../../utils/helpers";
import { showAlert, showConfirm } from "../../utils/dialogs";

const SYSTEM_CODES = new Set(["Attendance", "AssignmentMarks", "QuizMarks", "ComponentMarks"]);

function draftFromCourse(course) {
  const tasks = course?.tasks || [];
  return {
    codes: new Set(tasks.filter((t) => t.assigned && SYSTEM_CODES.has(t.taskCode)).map((t) => t.taskCode)),
    custom: tasks
      .filter((t) => !SYSTEM_CODES.has(t.taskCode))
      .map((t) => ({ taskCode: t.taskCode, title: t.label, selected: Boolean(t.assigned) })),
  };
}

export default function TeacherGraderTasksScreen() {
  const { user } = useContext(AuthContext);
  const teacherUserId = getAuthUserId(user);
  const [page, setPage] = useState({ catalog: [], graders: [] });
  const [selectedAllocationIds, setSelectedAllocationIds] = useState(() => new Set());
  const [selectedCourseIds, setSelectedCourseIds] = useState(() => new Set());
  const [selectedCodes, setSelectedCodes] = useState(() => new Set());
  const [customTasks, setCustomTasks] = useState([]);
  const [newTask, setNewTask] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const lastSingleLoadedId = useRef(null);

  const load = useCallback(async () => {
    if (!teacherUserId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setPage(await getTeacherGraderTasks(teacherUserId));
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [teacherUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const graders = page.graders || [];

  // Maintain valid selected grader allocation IDs
  useEffect(() => {
    if (graders.length === 0) {
      setSelectedAllocationIds(new Set());
      return;
    }
    setSelectedAllocationIds((prev) => {
      const valid = new Set([...prev].filter((id) => graders.some((g) => String(g.graderAllocationId) === id)));
      if (valid.size > 0) return valid;
      return new Set([String(graders[0].graderAllocationId)]);
    });
  }, [graders]);

  const selectedGraders = useMemo(
    () => graders.filter((g) => selectedAllocationIds.has(String(g.graderAllocationId))),
    [graders, selectedAllocationIds]
  );

  const courses = useMemo(() => {
    return selectedGraders[0]?.courses || graders[0]?.courses || [];
  }, [selectedGraders, graders]);

  const selectedCourses = useMemo(() => {
    return courses.filter((c) => selectedCourseIds.has(String(c.offeredCourseId)));
  }, [courses, selectedCourseIds]);

  const taskSource = selectedCourses[0] || courses[0] || null;

  // When switching to a single grader, load their assigned course tasks draft
  useEffect(() => {
    if (selectedGraders.length !== 1) {
      if (selectedGraders.length === 0) {
        lastSingleLoadedId.current = null;
      }
      return;
    }
    const singleGrader = selectedGraders[0];
    const singleId = String(singleGrader.graderAllocationId);
    if (lastSingleLoadedId.current === singleId) return;
    lastSingleLoadedId.current = singleId;

    const list = singleGrader.courses || [];
    const already = list.filter((c) => (c.tasks || []).some((t) => t.assigned));
    const ids = (already.length ? already : list.slice(0, 1)).map((c) => String(c.offeredCourseId));
    setSelectedCourseIds(new Set(ids));
    const source = list.find((c) => String(c.offeredCourseId) === ids[0]) || list[0];
    const draft = draftFromCourse(source);
    setSelectedCodes(draft.codes);
    setCustomTasks(draft.custom);
  }, [selectedGraders]);

  const displaySystemTasks = useMemo(() => {
    const fromSource = (taskSource?.tasks || []).filter((t) => SYSTEM_CODES.has(t.taskCode));
    if (fromSource.length > 0) return fromSource;
    if (page.catalog?.length > 0) {
      return page.catalog
        .filter((c) => SYSTEM_CODES.has(c.taskCode))
        .map((c) => ({
          taskCode: c.taskCode,
          label: c.label,
          progressText: "Not allowed yet",
        }));
    }
    return [
      { taskCode: "Attendance", label: "Attendance", progressText: "Not allowed yet" },
      { taskCode: "AssignmentMarks", label: "Assignment marks", progressText: "Not allowed yet" },
      { taskCode: "QuizMarks", label: "Quiz marks", progressText: "Not allowed yet" },
      { taskCode: "ComponentMarks", label: "Component marks", progressText: "Not allowed yet" },
    ];
  }, [taskSource, page.catalog]);

  const toggleGrader = (id) => {
    const key = String(id);
    setSelectedAllocationIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllGraders = () => {
    setSelectedAllocationIds(new Set(graders.map((g) => String(g.graderAllocationId))));
  };

  const deselectAllGraders = () => {
    setSelectedAllocationIds(new Set());
  };

  const toggle = (code) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleCourse = (id) => {
    setSelectedCourseIds((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllCourses = () => {
    setSelectedCourseIds(new Set(courses.map((c) => String(c.offeredCourseId))));
  };

  const deselectAllCourses = () => {
    setSelectedCourseIds(new Set());
  };

  const addCustomTask = () => {
    const title = newTask.trim();
    if (!title) return;
    setCustomTasks((prev) => [...prev, { taskCode: "", title, selected: true }]);
    setNewTask("");
  };

  const handleRemoveAllocation = async () => {
    if (selectedGraders.length === 0) return;
    const isSingle = selectedGraders.length === 1;
    const title = isSingle ? `Remove ${selectedGraders[0].graderName}?` : `Remove ${selectedGraders.length} graders?`;
    const message = isSingle
      ? `${selectedGraders[0].graderName} will lose the tasks you assigned.`
      : `The selected graders (${selectedGraders.map((g) => g.graderName).join(", ")}) will lose the tasks you assigned.`;

    if (!(await showConfirm(title, message))) {
      return;
    }
    try {
      for (const grader of selectedGraders) {
        await deleteGraderAllocation(grader.graderAllocationId);
      }
      setSelectedAllocationIds(new Set());
      await load();
    } catch (error) {
      showAlert("Error", error.message);
    }
  };

  const handleSave = async () => {
    if (selectedGraders.length === 0) {
      showAlert("Missing", "Select at least one grader first.");
      return;
    }
    if (selectedCourses.length === 0) {
      showAlert("Missing", "Select one or more courses first.");
      return;
    }
    const system = displaySystemTasks
      .filter((t) => SYSTEM_CODES.has(t.taskCode) && selectedCodes.has(t.taskCode))
      .map((t) => ({ taskCode: t.taskCode, title: t.label }));
    const tasks = [...system, ...customTasks.filter((t) => t.selected && t.title.trim())];
    if (tasks.length === 0) {
      showAlert("Missing", "Select at least one task before saving.");
      return;
    }
    try {
      setSaving(true);
      let data = page;
      for (const grader of selectedGraders) {
        for (const course of selectedCourses) {
          data = await saveGraderTasks({
            teacherUserId,
            graderAllocationId: grader.graderAllocationId,
            offeredCourseId: course.offeredCourseId,
            tasks,
          });
        }
      }
      setPage(data);
      const graderMsg =
        selectedGraders.length === 1
          ? selectedGraders[0].graderName
          : `${selectedGraders.length} graders`;
      const courseMsg = `${selectedCourses.length} course${selectedCourses.length === 1 ? "" : "s"}`;
      showAlert("Saved", `Task list saved for ${graderMsg} across ${courseMsg}.`);
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8 dark:border-[#1b2c2e] dark:bg-[#071113]">
        <PageBackButton className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">My Graders</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            Only graders allocated to you are listed. Select one or more graders and courses, then save their allowed tasks.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
          </div>
        ) : graders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center shadow-card dark:border-[#1b2c2e] dark:bg-[#0c181a]">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">No grader is allocated to you.</p>
            <p className="mt-1 text-sm text-gray-500">Ask Admin or HOD to allocate a grader to your account.</p>
          </div>
        ) : (
          <>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-wide text-gray-500">
                  Allocated to you {selectedGraders.length > 0 && `(${selectedGraders.length}/${graders.length} selected)`}
                </p>
                {graders.length > 1 && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={selectAllGraders}
                      className="font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      Select all
                    </button>
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <button
                      type="button"
                      onClick={deselectAllGraders}
                      className="font-medium text-gray-500 hover:underline dark:text-gray-400"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {graders.map((g) => {
                  const active = selectedAllocationIds.has(String(g.graderAllocationId));
                  return (
                    <button
                      key={g.graderAllocationId}
                      type="button"
                      onClick={() => toggleGrader(g.graderAllocationId)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold transition-all ${
                        active
                          ? "bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-600/30"
                          : "border border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50 dark:border-[#1b2c2e] dark:bg-[#0c181a] dark:text-gray-100 dark:hover:bg-[#122225]"
                      }`}
                    >
                      <span
                        className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-xs font-black ${
                          active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-400 dark:bg-gray-800"
                        }`}
                      >
                        {active ? "✓" : "+"}
                      </span>
                      <span>{g.graderName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedGraders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-card dark:border-[#1b2c2e] dark:bg-[#0c181a]">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">No grader selected</p>
                <p className="mt-1 text-xs text-gray-500">
                  Select one or more graders above to view their courses and configure allowed tasks.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card dark:border-[#1b2c2e] dark:bg-[#0c181a]">
                {selectedGraders.length === 1 ? (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold text-gray-900 dark:text-white">{selectedGraders[0].graderName}</p>
                      <p className="text-xs text-gray-500">{selectedGraders[0].graderEmail}</p>
                    </div>
                    <button type="button" onClick={handleRemoveAllocation} className="text-xs font-bold text-red-600 hover:text-red-700">
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4 dark:border-[#1b2c2e]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {selectedGraders.length} Graders Selected
                        </span>
                        <span className="text-xs text-gray-500">Applying tasks in bulk</span>
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {selectedGraders.map((g) => (
                          <span
                            key={g.graderAllocationId}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-800 dark:border-gray-700 dark:bg-[#122225] dark:text-gray-200"
                          >
                            <span>{g.graderName}</span>
                            <span className="text-[11px] text-gray-400">({g.graderEmail})</span>
                            <button
                              type="button"
                              title={`Deselect ${g.graderName}`}
                              onClick={() => toggleGrader(g.graderAllocationId)}
                              className="ml-0.5 text-gray-400 hover:text-red-500"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveAllocation}
                      className="text-xs font-bold text-red-600 hover:text-red-700"
                    >
                      Remove selected ({selectedGraders.length})
                    </button>
                  </div>
                )}

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-extrabold text-gray-700 dark:text-gray-300">
                        Courses {selectedCourses.length > 0 && `(${selectedCourses.length} selected)`}
                      </p>
                      <p className="text-xs text-gray-500">Select every course this task list should apply to.</p>
                    </div>
                    {courses.length > 1 && (
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={selectAllCourses}
                          className="font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          Select all
                        </button>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <button
                          type="button"
                          onClick={deselectAllCourses}
                          className="font-medium text-gray-500 hover:underline dark:text-gray-400"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                  {courses.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No offered courses found.</p>
                  ) : (
                    <ul className="space-y-2">
                      {courses.map((course) => {
                        const id = String(course.offeredCourseId);
                        const checked = selectedCourseIds.has(id);
                        return (
                          <li key={id}>
                            <label
                              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 transition-colors ${
                                checked
                                  ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-800/60 dark:bg-emerald-950/20"
                                  : "border-gray-100 hover:bg-gray-50 dark:border-[#1b2c2e] dark:hover:bg-[#122225]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 accent-emerald-600"
                                checked={checked}
                                onChange={() => toggleCourse(course.offeredCourseId)}
                              />
                              <span>
                                <span className="block text-sm font-bold text-gray-900 dark:text-white">
                                  {course.courseTitle}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {course.courseCode} · {course.sectionName}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <p className="mt-5 text-sm font-extrabold text-gray-900 dark:text-white">Allowed tasks</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Tick built-in work, or add your own lines. Save applies this list to every selected course and grader.
                </p>

                <ul className="mt-3 space-y-3">
                  {displaySystemTasks.map((task) => (
                    <li key={task.taskCode}>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-emerald-600"
                          checked={selectedCodes.has(task.taskCode)}
                          onChange={() => toggle(task.taskCode)}
                        />
                        <span>
                          <span className="block text-sm font-bold text-gray-900 dark:text-white">{task.label}</span>
                          <span className="mt-0.5 block text-xs text-gray-500">
                            {selectedCodes.has(task.taskCode)
                              ? selectedGraders.length > 1 || selectedCourses.length > 1
                                ? "Allowed"
                                : task.progressText || "Allowed"
                              : "Not allowed yet"}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>

                <ul className="mt-3 space-y-2">
                  {customTasks.map((task, index) => (
                    <li
                      key={`${task.taskCode}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-[#122225]"
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-emerald-600"
                          checked={Boolean(task.selected)}
                          onChange={() =>
                            setCustomTasks((prev) =>
                              prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
                            )
                          }
                        />
                        <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{task.title}</span>
                      </label>
                      <button
                        type="button"
                        className="text-xs font-bold text-red-600"
                        onClick={() => setCustomTasks((prev) => prev.filter((_, i) => i !== index))}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex gap-2">
                  <input
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomTask();
                      }
                    }}
                    placeholder="Add your own task"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-[#1b2c2e] dark:bg-[#071113]"
                  />
                  <button
                    type="button"
                    onClick={addCustomTask}
                    className="shrink-0 rounded-xl border border-emerald-300 px-3 py-2 text-sm font-bold text-emerald-800 dark:border-emerald-700 dark:text-emerald-300"
                  >
                    Add
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || selectedGraders.length === 0 || selectedCourses.length === 0}
                  className="mt-5 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-50"
                >
                  {saving
                    ? "Saving…"
                    : selectedGraders.length > 1
                    ? `Save task list for ${selectedGraders.length} graders (${selectedCourses.length} course${selectedCourses.length === 1 ? "" : "s"})`
                    : `Save task list (${selectedCourses.length} course${selectedCourses.length === 1 ? "" : "s"})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
