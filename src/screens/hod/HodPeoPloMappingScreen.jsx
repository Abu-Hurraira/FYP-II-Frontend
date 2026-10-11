import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageBackButton from "../../components/PageBackButton.jsx";
import theme from "../../styles/theme";
import { showAlert } from "../../utils/dialogs";
import { extractOutcomeNumber, ploDisplayLabel, sortPeos, sortPlos } from "../../utils/outcomeHelpers";
import { getPEOsByProgram } from "../../api/peosApi";
import { getPLOsByProgram } from "../../api/plosApi";
import {
  getPeoPloMatrix,
  matrixFromPeoPloApi,
  peoPloMatrixToCells,
  savePeoPloMatrix,
} from "../../api/peoPloMappingApi";
import { getAuthUserId } from "../../utils/helpers";

function peoDisplayLabel(peo, fallbackIndex = 0) {
  const n = extractOutcomeNumber(peo?.peoCode);
  if (n != null) return `PEO${n}`;
  if (peo?.peoCode) return peo.peoCode;
  return `PEO${fallbackIndex + 1}`;
}

function MappingInfoBlocks({ peo, plo, ploIndex, peoIndex, compact = false }) {
  const blockClass = compact ? "rounded-md border border-gray-200 bg-gray-50 p-2" : "rounded-lg border border-gray-200 bg-gray-50 p-3";
  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <div className={blockClass}>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">PEO</p>
        <p className={`mt-1 font-semibold text-gray-900 ${compact ? "text-sm" : ""}`}>{peoDisplayLabel(peo, peoIndex)}</p>
        {peo?.peoDescription ? (
          <p className={`mt-1 text-gray-600 ${compact ? "text-xs" : "text-sm"}`}>{peo.peoDescription}</p>
        ) : null}
      </div>

      <div className={blockClass}>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">PLO</p>
        <p className={`mt-1 font-semibold text-gray-900 ${compact ? "text-sm" : ""}`}>{ploDisplayLabel(plo, ploIndex)}</p>
        {plo?.ploDescription ? (
          <p className={`mt-1 text-gray-600 ${compact ? "text-xs" : "text-sm"}`}>{plo.ploDescription}</p>
        ) : null}
      </div>
    </div>
  );
}

export default function HodPeoPloMappingScreen() {
  const { user } = useContext(AuthContext);
  const { programId } = useParams();
  const location = useLocation();
  const program = location.state?.program;
  const targetProgramId = Number(programId || program?.programId);
  const valid = Boolean(targetProgramId && !Number.isNaN(targetProgramId));

  const [peos, setPeos] = useState([]);
  const [plos, setPlos] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [programName, setProgramName] = useState(program?.programName || "");

  const [hoverTip, setHoverTip] = useState(null);

  const sortedPeos = useMemo(() => sortPeos(peos), [peos]);
  const sortedPlos = useMemo(() => sortPlos(plos), [plos]);

  useEffect(() => {
    if (!valid) {
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [peoData, ploData, apiMatrix] = await Promise.all([
          getPEOsByProgram(targetProgramId),
          getPLOsByProgram(targetProgramId),
          getPeoPloMatrix(targetProgramId),
        ]);

        if (!mounted) return;
        setPeos(peoData || []);
        setPlos(ploData || []);
        setMatrix(matrixFromPeoPloApi(apiMatrix));
        setProgramName(
          apiMatrix?.programName ?? apiMatrix?.ProgramName ?? program?.programName ?? ""
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
  }, [valid, targetProgramId]);

  const updateCell = (peoId, ploId, mapped) => {
    setMatrix((prev) => {
      const next = { ...prev };
      const peoKey = String(peoId);
      const ploKey = String(ploId);
      const row = { ...(next[peoKey] || {}) };

      if (mapped) {
        row[ploKey] = true;
      } else {
        delete row[ploKey];
      }

      if (Object.keys(row).length === 0) {
        delete next[peoKey];
      } else {
        next[peoKey] = row;
      }

      return next;
    });
  };

  const mappedCount = useMemo(
    () =>
      Object.values(matrix || {}).reduce(
        (total, row) => total + Object.keys(row || {}).length,
        0
      ),
    [matrix]
  );

  const handleSave = async () => {
    if (!valid) return;

    const hodUserId = getAuthUserId(user);
    if (!hodUserId) {
      showAlert("Error", "HOD user not found. Please sign in again.");
      return;
    }

    if (mappedCount === 0) {
      showAlert(
        "Nothing to save",
        "Select at least one checkbox to map a PEO to a PLO before saving."
      );
      return;
    }

    try {
      setSaving(true);
      await savePeoPloMatrix(targetProgramId, {
        mappedByUserId: hodUserId,
        cells: peoPloMatrixToCells(matrix),
      });
      showAlert(
        "Saved",
        `PEO–PLO mapping saved to database (${mappedCount} mapping${mappedCount === 1 ? "" : "s"}).`
      );
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!valid) {
    return (
      <div className="min-h-full bg-page">
        <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
          <PageBackButton className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-gray-900">PEOs, PLOs Mapping</h1>
            <p className="mt-0.5 text-xs text-gray-500">Program data missing.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-gray-900">PEOs, PLOs Mapping</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            {programName || program?.programName || `Program #${targetProgramId}`} · {user?.roleName || "HOD"}
          </p>
        </div>
        <button
          type="button"
          disabled={saving || loading || sortedPeos.length === 0 || sortedPlos.length === 0}
          onClick={handleSave}
          className="app-btn-primary shrink-0 rounded-2xl px-4 py-2 text-sm shadow-sm disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        <p className="mb-3 text-xs text-gray-500">
          Checkbox means “this PEO maps to this PLO” for the selected program. Restored PLOs/PEOs from the PLO or PEO
          screens appear here automatically.
        </p>

        {loading ? (
          <div className="flex justify-center py-16">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : sortedPeos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-sm font-semibold text-gray-800">No PEOs added yet</p>
            <p className="mt-2 text-sm text-gray-500">Add PEOs under Program → PEOs first.</p>
          </div>
        ) : sortedPlos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-sm font-semibold text-gray-800">No PLOs added yet</p>
            <p className="mt-2 text-sm text-gray-500">Add PLOs under Program → PLOs first.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-card">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="sticky left-0 z-20 min-w-[180px] border-r border-gray-200 bg-gray-50 px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-600">
                    PLO
                  </th>
                  {sortedPeos.map((peo, peoIndex) => (
                    <th
                      key={peo.peoId}
                      className="min-w-[72px] max-w-[120px] px-2 py-3 text-center text-xs font-semibold text-gray-700"
                      title={peo.peoDescription || ""}
                    >
                      {peoDisplayLabel(peo, peoIndex)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {sortedPlos.map((plo, ploIndex) => {
                  return (
                    <tr key={plo.ploId} className="border-b border-gray-100 hover:bg-brand-muted/40/80">
                      <td className="sticky left-0 z-10 border-r border-gray-200 bg-white px-3 py-3">
                        <p className="font-semibold text-gray-900">{ploDisplayLabel(plo, ploIndex)}</p>
                        {plo.ploCode ? <p className="text-xs text-gray-500">{plo.ploCode}</p> : null}
                      </td>

                      {sortedPeos.map((peo, peoIndex) => {
                        const peoKey = String(peo.peoId);
                        const ploKey = String(plo.ploId);
                        const mapped = Boolean(matrix?.[peoKey]?.[ploKey]);

                        return (
                          <td key={peo.peoId} className="px-1 py-2 text-center align-middle">
                            <div className="flex flex-col items-center gap-1">
                              <input
                                type="checkbox"
                                checked={mapped}
                                onChange={(e) => updateCell(peo.peoId, plo.ploId, e.target.checked)}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoverTip({
                                    peo,
                                    plo,
                                    peoIndex,
                                    ploIndex,
                                    top: rect.top,
                                    left: rect.left + rect.width / 2,
                                  });
                                }}
                                onMouseLeave={() => setHoverTip(null)}
                                className="h-4 w-4 rounded border-gray-300"
                                aria-label={`Map ${peoDisplayLabel(peo, peoIndex)} to ${ploDisplayLabel(plo, ploIndex)}`}
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {hoverTip && (
        <div
          className="pointer-events-none fixed z-40 w-80 -translate-x-1/2 -translate-y-full rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
          style={{ top: hoverTip.top - 8, left: hoverTip.left }}
          role="tooltip"
        >
          <MappingInfoBlocks peo={hoverTip.peo} plo={hoverTip.plo} peoIndex={hoverTip.peoIndex} ploIndex={hoverTip.ploIndex} compact />
        </div>
      )}
    </div>
  );
}
