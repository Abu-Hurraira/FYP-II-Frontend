import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  downloadFcarPdf,
  getFcarReport,
  saveFcarInput,
} from "../api/fcarApi";

const initialFields = {
  catalogDescription: "",
  courseModifications: "No modification",
  studentFeedbackText: "",
  reflectionText: "",
  proposedActionsText: "None",
};

export default function FcarGeneratorView({
  offeredCourseId,
  teacherUserId,
  className = "",
}) {
  const [report, setReport] = useState(null);
  const [fields, setFields] = useState(initialFields);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadReport = useCallback(async () => {
    if (!offeredCourseId || !teacherUserId) {
      setError("A valid course and signed-in teacher are required.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setNotice("");
      const data = await getFcarReport(offeredCourseId, teacherUserId);
      setReport(data);
      setFields({
        catalogDescription: data?.catalogDescription || "",
        courseModifications: data?.courseModifications || "No modification",
        studentFeedbackText: data?.studentFeedbackText || "",
        reflectionText: data?.reflectionText || "",
        proposedActionsText: data?.proposedActionsText || "None",
      });
    } catch (err) {
      setError(err.message || "Could not load the FCAR preview.");
    } finally {
      setLoading(false);
    }
  }, [offeredCourseId, teacherUserId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const preview = useMemo(() => {
    if (!report) return [];
    const grade = report.gradeDistribution || {};
    return [
      `Instructor: ${report.teacherName || "—"}`,
      `Term: ${report.sessionTitle || "—"}`,
      `Grades A/B/C/D: ${grade.gradeACount || 0}/${grade.gradeBCount || 0}/${grade.gradeCCount || 0}/${grade.gradeDCount || 0}`,
      `CLOs with instruments: ${(report.cloAssessments || []).filter((x) => (x.items || []).length > 0).length}`,
      ...(report.ploEpans || []).map(
        (item) =>
          `PLO ${item.ploCode}: EPAN ${Number(item.epanAverage || 0).toFixed(3)} ↑ ${item.status}`,
      ),
    ];
  }, [report]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setFields((current) => ({ ...current, [name]: value }));
    setNotice("");
  };

  const handleGenerate = async () => {
    if (!fields.catalogDescription.trim() || !fields.courseModifications.trim()) {
      setError("Catalog description and course modifications are required.");
      return;
    }

    try {
      setGenerating(true);
      setError("");
      setNotice("Saving report details…");
      const saved = await saveFcarInput(offeredCourseId, {
        teacherUserId,
        ...fields,
      });
      setReport(saved);
      setNotice("Generating PDF…");
      await downloadFcarPdf(
        offeredCourseId,
        teacherUserId,
        `FCAR- ${saved.courseTitle || "Course"}(${saved.sectionName || "Section"}).pdf`,
      );
      setNotice("FCAR PDF downloaded successfully.");
    } catch (err) {
      setError(err.message || "Could not generate the FCAR PDF.");
      setNotice("");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" />
      </div>
    );
  }

  return (
    <div className={`mx-auto w-full max-w-5xl space-y-5 ${className}`}>
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-[#1b2c2e]">
          <h2 className="text-xl font-black text-gray-900 dark:text-white">
            Generate FCAR
          </h2>
          <p className="mt-0.5 text-xs font-semibold text-gray-500">
            {report?.courseTitle || "Course"} · {report?.sectionName || ""}
          </p>
        </div>

        <div className="space-y-5 p-5">
          <p className="text-xs font-medium leading-5 text-gray-600 dark:text-gray-300">
            Enter the catalog description and course modifications, then generate
            the report. CLO grades: A ≥ 80%, B ≥ 65%, C ≥ 50%, D ≥ 40%. Below 40%
            is F and is excluded from EEMU and EPAN.
          </p>

          {preview.length > 0 && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-950">
              <h3 className="mb-1 font-black">Computed preview</h3>
              {preview.map((line) => (
                <p key={line} className="font-semibold leading-5">
                  {line}
                </p>
              ))}
            </div>
          )}

          {(report?.calculationWarnings || []).length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              <p className="font-black">Data checks</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {report.calculationWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <Field
            label="Current Catalog Description *"
            name="catalogDescription"
            value={fields.catalogDescription}
            onChange={updateField}
            rows={4}
            placeholder="Paste or type the catalog description for this course"
          />
          <Field
            label="Modifications Made to Course *"
            name="courseModifications"
            value={fields.courseModifications}
            onChange={updateField}
            rows={3}
          />
          <Field
            label="Student Feedback (optional)"
            name="studentFeedbackText"
            value={fields.studentFeedbackText}
            onChange={updateField}
            rows={3}
            placeholder="Optional narrative"
          />
          <Field
            label="Reflection (optional)"
            name="reflectionText"
            value={fields.reflectionText}
            onChange={updateField}
            rows={3}
            placeholder="Optional narrative"
          />
          <Field
            label="Proposed Actions (optional)"
            name="proposedActionsText"
            value={fields.proposedActionsText}
            onChange={updateField}
            rows={2}
          />

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
              {error}
            </div>
          )}
          {notice && !error && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
              {notice}
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-black text-gray-700 dark:text-gray-200">
              Export format
            </p>
            <div className="rounded-xl bg-emerald-700 px-4 py-2.5 text-center text-xs font-black text-white">
              PDF
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? "Generating…" : "Generate FCAR PDF"}
          </button>
          <button
            type="button"
            onClick={loadReport}
            disabled={generating}
            className="w-full text-xs font-black text-emerald-700 hover:text-emerald-900 disabled:opacity-60"
          >
            Refresh preview
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-black text-gray-700 dark:text-gray-200">
        {label}
      </span>
      <textarea
        {...props}
        className="w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-[#294044] dark:bg-[#102023] dark:text-white"
      />
    </label>
  );
}
