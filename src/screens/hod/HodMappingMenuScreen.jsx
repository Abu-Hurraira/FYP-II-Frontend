import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import HodMintHeader from "../../components/HodMintHeader.jsx";

export default function HodMappingMenuScreen() {
  const { programId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const program = location.state?.program;

  if (!program || String(program.programId ?? program.ProgramId) !== String(programId)) {
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

  const base = `/hod/program/${program.programId ?? program.ProgramId}/mapping`;
  const state = { program };

  return (
    <div className="min-h-full bg-page">
      <HodMintHeader
        title="Mapping"
        subtitle="Manage CLO-PLO and PEO mappings."
        back
      />
      <div className="w-full space-y-3 px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate(`${base}/peo-plo`, { state })}
          className="flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-4 text-left transition hover:border-emerald-100 hover:bg-emerald-50/30"
        >
          <span>
            <span className="block text-base font-bold text-gray-900">PEOs, PLOs Mapping</span>
            <span className="mt-0.5 block text-sm text-gray-500">Map program objectives to learning outcomes.</span>
          </span>
          <span className="text-xl text-gray-300">›</span>
        </button>
        <button
          type="button"
          onClick={() => navigate(`${base}/plo-course`, { state })}
          className="flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-4 text-left transition hover:border-emerald-100 hover:bg-emerald-50/30"
        >
          <span>
            <span className="block text-base font-bold text-gray-900">PLOs, Course Mapping</span>
            <span className="mt-0.5 block text-sm text-gray-500">Map learning outcomes to program courses.</span>
          </span>
          <span className="text-xl text-gray-300">›</span>
        </button>
      </div>
    </div>
  );
}
