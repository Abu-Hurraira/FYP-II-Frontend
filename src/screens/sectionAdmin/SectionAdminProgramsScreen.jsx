import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPrograms } from "../../api/programsApi";
import { AuthContext } from "../../context/AuthContext.jsx";
import theme from "../../styles/theme";
import { showAlert } from "../../utils/dialogs";

export default function SectionAdminProgramsScreen() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await getPrograms();
        if (!mounted) return;
        setPrograms(data || []);
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
      <div className="border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold text-gray-900">Programs</h1>
        <p className="mt-0.5 text-xs text-gray-500">{user?.roleName || "SectionAdmin"}</p>
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : (
          <div className="space-y-2.5 pt-2">
            {programs.map((p) => (
              <button
                key={p.programId}
                type="button"
                onClick={() =>
                  navigate(`/section-admin/program/${p.programId}/sessions`, {
                    state: { program: p },
                  })
                }
                className="flex min-h-[48px] w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-gray-50"
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
  );
}

