import React from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import HodMintHeader from "../../components/HodMintHeader.jsx";

function IconBook() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5c-1.6-1-3.5-1.5-6-1.5v13c2.5 0 4.4.5 6 1.5 1.6-1 3.5-1.5 6-1.5v-13c-2.5 0-4.4.5-6 1.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5v13" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H2v-2a4 4 0 014-4h3m0-4a4 4 0 11-8 0 4 4 0 018 0zm8 2a3 3 0 10-6 0 3 3 0 006 0z" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 115.656 5.656l-1.5 1.5" />
    </svg>
  );
}

const MENU = [
  {
    key: "courses",
    title: "Course Catalog",
    subtitle: "View and manage all courses for this program.",
    icon: IconBook,
    tinted: true,
    path: "courses",
  },
  {
    key: "sessions",
    title: "Sessions",
    subtitle: "Manage academic sessions and their details.",
    icon: IconCalendar,
    path: "sessions",
  },
  {
    key: "plos",
    title: "PLOs",
    subtitle: "View and manage program learning outcomes.",
    icon: IconTarget,
    path: "plos",
  },
  {
    key: "peos",
    title: "PEOs",
    subtitle: "View and manage program educational objectives.",
    icon: IconPeople,
    path: "peos",
  },
  {
    key: "mapping",
    title: "Mapping",
    subtitle: "Manage CLO-PLO and PEO mappings.",
    icon: IconLink,
    path: "mapping",
  },
];

export default function HodProgramMenuScreen() {
  const { programId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const program = location.state?.program;
  const programName = program?.programName || program?.ProgramName || "";
  const storedId = program?.programId ?? program?.ProgramId;

  if (!program || String(storedId) !== String(programId)) {
    return (
      <div className="min-h-full bg-page px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-gray-500">Program data missing. Open from Programs.</p>
        <button
          type="button"
          className="mt-4 font-bold text-brand"
          onClick={() => navigate("/hod/programs")}
        >
          Back to Programs
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-page">
      <HodMintHeader
        title={programName}
        subtitle="Manage program structure, learning outcomes, and course mappings."
        back
      />

      <div className="w-full space-y-3 px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        {MENU.map((item) => {
          const Icon = item.icon;
          return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    navigate(`/hod/program/${programId}/${item.path}`, { state: { program } })
                  }
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                    item.tinted
                      ? "border-emerald-100 bg-emerald-50/70 hover:bg-emerald-50"
                      : "border-gray-100 bg-white hover:border-emerald-100 hover:bg-emerald-50/30"
                  }`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Icon />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold text-gray-900">{item.title}</span>
                    <span className="mt-0.5 block text-sm text-gray-500">{item.subtitle}</span>
                  </span>
                  <span className="text-xl text-gray-300">›</span>
                </button>
              );
            })}
      </div>
    </div>
  );
}
