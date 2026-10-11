import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPrograms } from "../../api/programsApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import DashboardWelcomeBanner from "../../components/DashboardWelcomeBanner.jsx";
import theme from "../../styles/theme";
import { showAlert } from "../../utils/dialogs";
import { getAuthDisplayName } from "../../utils/helpers";

export default function SectionAdminProgramsScreen() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const displayName = getAuthDisplayName(user, "Section Admin");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await getPrograms();
        if (!mounted) return;
        setPrograms(
          (data || []).map((p) => ({
            ...p,
            programId: p.programId ?? p.ProgramId,
            programName: p.programName ?? p.ProgramName ?? "",
            programCode: p.programCode ?? p.ProgramCode ?? "",
          }))
        );
      } catch (error) {
        showAlert("Error", error.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-full bg-page">
      <div className="w-full px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <DashboardWelcomeBanner name={displayName} />

        <div className="mt-4">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Programs</h2>
          {loading ? (
            <div className="flex justify-center py-16">
              <div
                className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
                style={{ borderTopColor: theme.colors.primary }}
              />
            </div>
          ) : (
            <div className="space-y-2.5">
              {programs.map((p) => (
                <button
                  key={p.programId}
                  type="button"
                  onClick={() =>
                    navigate(`/admin/program/${p.programId}/sessions`, {
                      state: { program: p },
                    })
                  }
                  className="flex min-h-[48px] w-full items-center justify-between rounded-2xl border border-gray-100 bg-white shadow-card px-4 py-3 text-left shadow-sm transition hover:bg-brand-muted/40"
                >
                  <span className="truncate text-sm font-semibold text-gray-900">{p.programName}</span>
                  <span className="shrink-0 text-xl text-gray-300">›</span>
                </button>
              ))}

              {programs.length === 0 && (
                <p className="mt-10 text-center font-bold text-gray-500">No programs found.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
