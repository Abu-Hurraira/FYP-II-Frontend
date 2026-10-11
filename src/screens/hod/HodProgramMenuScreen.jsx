import React, { useContext } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";

const HodProgramMenuScreen = () => {
  const { user } = useContext(AuthContext);
  const { programId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const program = location.state?.program;

  if (!program || String(program.programId) !== String(programId)) {
    return (
      <div className="min-h-full bg-page">
        <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
          <PageBackButton className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-gray-900">Program</h1>
            <p className="mt-0.5 text-xs text-gray-500">Program data missing. Open from Programs.</p>
            <button
              type="button"
              className="mt-4 font-bold text-brand"
              onClick={() => navigate("/hod/programs")}
            >
              Back to Programs
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-gray-900">{program.programName}</h1>
          <p className="mt-0.5 text-xs text-gray-500">{user?.roleName || "HOD"}</p>
        </div>
      </div>

      <div className="w-full px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <div className="w-full space-y-2.5">
          <button
            type="button"
            onClick={() =>
              navigate(`/hod/program/${program.programId}/courses`, { state: { program } })
            }
            className="flex min-h-[48px] w-full items-center justify-between rounded-2xl border border-gray-100 bg-white shadow-card px-4 py-3 text-left text-sm font-semibold text-gray-900 shadow-sm transition hover:border-gray-300 hover:bg-brand-muted/40"
          >
            <span>Course catalog</span>
            <span className="text-lg text-gray-300">›</span>
          </button>
          <button
            type="button"
            onClick={() =>
              navigate(`/hod/program/${program.programId}/sessions`, { state: { program } })
            }
            className="flex min-h-[48px] w-full items-center justify-between rounded-2xl border border-gray-100 bg-white shadow-card px-4 py-3 text-left text-sm font-semibold text-gray-900 shadow-sm transition hover:border-gray-300 hover:bg-brand-muted/40"
          >
            <span>Sessions</span>
            <span className="text-lg text-gray-300">›</span>
          </button>
          <button
            type="button"
            onClick={() =>
              navigate(`/hod/program/${program.programId}/plos`, { state: { program } })
            }
            className="flex min-h-[48px] w-full items-center justify-between rounded-2xl border border-gray-100 bg-white shadow-card px-4 py-3 text-left text-sm font-semibold text-gray-900 shadow-sm transition hover:border-gray-300 hover:bg-brand-muted/40"
          >
            <span>PLOs</span>
            <span className="text-lg text-gray-300">›</span>
          </button>
          <button
            type="button"
            onClick={() =>
              navigate(`/hod/program/${program.programId}/peos`, { state: { program } })
            }
            className="flex min-h-[48px] w-full items-center justify-between rounded-2xl border border-gray-100 bg-white shadow-card px-4 py-3 text-left text-sm font-semibold text-gray-900 shadow-sm transition hover:border-gray-300 hover:bg-brand-muted/40"
          >
            <span>PEOs</span>
            <span className="text-lg text-gray-300">›</span>
          </button>
          <button
            type="button"
            onClick={() =>
              navigate(`/hod/program/${program.programId}/mapping`, { state: { program } })
            }
            className="flex min-h-[48px] w-full items-center justify-between rounded-2xl border border-gray-100 bg-white shadow-card px-4 py-3 text-left text-sm font-semibold text-gray-900 shadow-sm transition hover:border-gray-300 hover:bg-brand-muted/40"
          >
            <span>Mapping</span>
            <span className="text-lg text-gray-300">›</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default HodProgramMenuScreen;
