import React from "react";
import PageBackButton from "./PageBackButton.jsx";

export default function HodMintHeader({ title, subtitle, action, back = false }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
      {back ? <PageBackButton /> : null}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
