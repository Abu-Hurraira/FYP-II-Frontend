import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getPrograms } from "../api/programsApi";

const STORAGE_KEY = "hodSelectedProgramId";
export const COURSES_CACHE_KEY = "hodWelcomeCoursesCache.v5";

function readStoredProgramId() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeStoredProgramId(id) {
  try {
    if (id == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // ignore
  }
}

function clearWelcomeCoursesCache() {
  try {
    sessionStorage.removeItem(COURSES_CACHE_KEY);
    sessionStorage.removeItem("hodWelcomeCoursesCache.v4");
  } catch {
    // ignore
  }
}

function normalizeProgram(raw) {
  if (!raw) return null;
  return {
    programId: Number(raw.programId ?? raw.ProgramId),
    programName: raw.programName ?? raw.ProgramName ?? "",
    programCode: raw.programCode ?? raw.ProgramCode ?? "",
  };
}

const HodProgramContext = createContext({
  programs: [],
  selectedProgramId: null,
  selectedProgram: null,
  loading: true,
  setSelectedProgramId: () => {},
  refreshPrograms: async () => {},
});

export function HodProgramProvider({ children }) {
  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramIdState] = useState(readStoredProgramId);
  const [loading, setLoading] = useState(true);

  const refreshPrograms = useCallback(async () => {
    const data = await getPrograms();
    const list = (Array.isArray(data) ? data : [])
      .map(normalizeProgram)
      .filter((p) => p && Number.isFinite(p.programId) && p.programId > 0)
      .sort((a, b) => String(a.programName).localeCompare(String(b.programName)));
    setPrograms(list);
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await refreshPrograms();
        if (cancelled) return;
        setSelectedProgramIdState((prev) => {
          if (prev && list.some((p) => p.programId === prev)) return prev;
          const first = list[0]?.programId ?? null;
          writeStoredProgramId(first);
          return first;
        });
      } catch {
        if (!cancelled) setPrograms([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshPrograms]);

  const setSelectedProgramId = useCallback((nextId) => {
    const id = Number(nextId);
    const valid = Number.isFinite(id) && id > 0 ? id : null;
    setSelectedProgramIdState((prev) => {
      if (prev === valid) return prev;
      clearWelcomeCoursesCache();
      writeStoredProgramId(valid);
      return valid;
    });
  }, []);

  const selectedProgram = useMemo(
    () => programs.find((p) => p.programId === selectedProgramId) ?? null,
    [programs, selectedProgramId]
  );

  const value = useMemo(
    () => ({
      programs,
      selectedProgramId,
      selectedProgram,
      loading,
      setSelectedProgramId,
      refreshPrograms,
    }),
    [programs, selectedProgramId, selectedProgram, loading, setSelectedProgramId, refreshPrograms]
  );

  return <HodProgramContext.Provider value={value}>{children}</HodProgramContext.Provider>;
}

export function useHodProgram() {
  return useContext(HodProgramContext);
}

export default HodProgramContext;
