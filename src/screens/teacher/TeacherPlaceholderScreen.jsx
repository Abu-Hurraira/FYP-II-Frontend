import React from "react";
import { useSearchParams } from "react-router-dom";
import PageBackButton from "../../components/PageBackButton.jsx";

export default function TeacherPlaceholderScreen() {
  const [searchParams] = useSearchParams();
  const title = searchParams.get("title") || "Screen";
  const courseTitle = searchParams.get("courseTitle");

  return (
    <div className="flex min-h-full flex-col bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8 dark:border-[#1b2c2e] dark:bg-[#071113]">
        <PageBackButton className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {title}
          </h1>
          {courseTitle && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {decodeURIComponent(courseTitle)}
            </p>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-card shadow-sm dark:border-[#1b2c2e] dark:bg-[#0c181a]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">
            {title} Folder
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            This module folder has been set up. Full management and file upload functionality will be added here soon.
          </p>
        </div>
      </div>
    </div>
  );
}
