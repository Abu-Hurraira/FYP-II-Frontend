import { showAlert } from "./dialogs";

/**
 * Checks whether the teacher has completed the required setup for a given task.
 * @param {object} task - Task progress object (taskCode, progressText, done, total)
 * @param {Array} assessments - Optional list of assessments for this offered course
 * @returns {{ isIncomplete: boolean, reason: string }}
 */
export function checkTeacherTaskCompleteness(task, assessments = []) {
  if (!task) return { isIncomplete: false, reason: "" };

  const code = task.taskCode;
  const progress = String(task.progressText || "").trim().toLowerCase();

  // 1. Attendance: requires attendance dates recorded by teacher
  if (code === "Attendance") {
    if (progress.includes("no dates") || (task.total === 0 && task.done === 0)) {
      return {
        isIncomplete: true,
        reason: "Attendance dates have not been recorded by the teacher yet.",
      };
    }
  }

  // 2. Component Marks: requires teacher to configure and save component/homework/lab scheme
  if (code === "ComponentMarks") {
    if (progress.includes("not saved") || (task.done === 0 && task.total <= 1 && !progress.includes("saved"))) {
      return {
        isIncomplete: true,
        reason: "Component marks scheme has not been saved by the teacher yet.",
      };
    }
  }

  // 3. Assignment Marks
  if (code === "AssignmentMarks") {
    if (progress.includes("no assessment") || task.total === 0) {
      return {
        isIncomplete: true,
        reason: "No assignments have been created by the teacher yet.",
      };
    }
    if (assessments && assessments.length > 0) {
      const typeAssessments = assessments.filter(
        (a) => String(a.assessmentTypeName || a.AssessmentTypeName || "").toLowerCase() === "assignment"
      );
      if (
        typeAssessments.length > 0 &&
        typeAssessments.every((a) => !Boolean(a.isSetupComplete ?? a.IsSetupComplete))
      ) {
        return {
          isIncomplete: true,
          reason: "Assignment question and CLO setup is incomplete.",
        };
      }
    } else if (progress.startsWith("0/")) {
      return {
        isIncomplete: true,
        reason: "Assignment setup is incomplete.",
      };
    }
  }

  // 4. Quiz Marks
  if (code === "QuizMarks") {
    if (progress.includes("no assessment") || task.total === 0) {
      return {
        isIncomplete: true,
        reason: "No quizzes have been created by the teacher yet.",
      };
    }
    if (assessments && assessments.length > 0) {
      const typeAssessments = assessments.filter(
        (a) => String(a.assessmentTypeName || a.AssessmentTypeName || "").toLowerCase() === "quiz"
      );
      if (
        typeAssessments.length > 0 &&
        typeAssessments.every((a) => !Boolean(a.isSetupComplete ?? a.IsSetupComplete))
      ) {
        return {
          isIncomplete: true,
          reason: "Quiz question and CLO setup is incomplete.",
        };
      }
    } else if (progress.startsWith("0/")) {
      return {
        isIncomplete: true,
        reason: "Quiz setup is incomplete.",
      };
    }
  }

  // 5. Exam Marks
  if (code === "ExamMarks") {
    if (progress.includes("no assessment") || task.total === 0) {
      return {
        isIncomplete: true,
        reason: "No exams have been created by the teacher yet.",
      };
    }
    if (assessments && assessments.length > 0) {
      const typeAssessments = assessments.filter((a) => {
        const t = String(a.assessmentTypeName || a.AssessmentTypeName || "").toLowerCase();
        return t.includes("mid") || t.includes("final");
      });
      if (
        typeAssessments.length > 0 &&
        typeAssessments.every((a) => !Boolean(a.isSetupComplete ?? a.IsSetupComplete))
      ) {
        return {
          isIncomplete: true,
          reason: "Exam question setup is incomplete.",
        };
      }
    } else if (progress.startsWith("0/")) {
      return {
        isIncomplete: true,
        reason: "Exam setup is incomplete.",
      };
    }
  }

  // 6. Sample upload tasks (Assignment, Quiz, ExamSamples)
  if (code === "Assignment" || code === "Quiz" || code === "ExamSamples") {
    if (progress.includes("no papers") || task.total === 0) {
      return {
        isIncomplete: true,
        reason: "No assessment papers have been created by the teacher yet.",
      };
    }
  }

  return { isIncomplete: false, reason: "" };
}

/**
 * Displays a short English alert when the grader tries to open an incomplete task.
 */
export function showIncompleteTaskAlert(taskName, reason) {
  const message = reason
    ? `${reason}\nMarks/data can only be added once the teacher finishes setup.`
    : "The teacher has not completed the setup for this task yet.";
  showAlert("Setup Incomplete", message);
}
