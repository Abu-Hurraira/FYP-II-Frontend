import React from "react";
import { useSearchParams } from "react-router-dom";
import PageBackButton from "../../components/PageBackButton.jsx";

export default function TeacherPlaceholderScreen() {
  const [searchParams] = useSearchParams();
  const title = searchParams.get("title") || "Screen";

  return (
    <div className="flex min-h-full flex-col bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          <p className="mt-0.5 text-xs text-gray-500">This screen will be implemented next.</p>
        </div>
      </div>
    </div>
  );
}
