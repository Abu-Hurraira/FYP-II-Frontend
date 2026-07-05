export function isOldOutcome(item) {
  return String(item?.outcomeStatus ?? item?.OutcomeStatus ?? "New").toLowerCase() === "old";
}

export function getArchiveId(item) {
  return item?.archiveId ?? item?.ArchiveId ?? null;
}

export function archivedViewStorageKey(outcomeType, programId) {
  return `outcomeShowArchived:${outcomeType}:${programId}`;
}

export function readShowArchivedPreference(outcomeType, programId) {
  if (!programId) return false;
  try {
    return sessionStorage.getItem(archivedViewStorageKey(outcomeType, programId)) === "true";
  } catch {
    return false;
  }
}

export function writeShowArchivedPreference(outcomeType, programId, includeArchived) {
  if (!programId) return;
  try {
    const key = archivedViewStorageKey(outcomeType, programId);
    if (includeArchived) sessionStorage.setItem(key, "true");
    else sessionStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

export function clearArchivedPreferencesForProgram(programId, outcomeTypes = ["PLO", "PEO", "CLO"]) {
  for (const outcomeType of outcomeTypes) {
    writeShowArchivedPreference(outcomeType, programId, false);
  }
}

export function formatRestoreSummary(result, outcomeLabel) {
  const restored = result?.restoredCount ?? 0;
  const skipped = result?.skippedCount ?? 0;
  const errors = result?.errors || [];
  let message = `Restored ${restored} archived ${outcomeLabel}(s) with Old status.`;
  if (skipped > 0) {
    message += `\nSkipped ${skipped}.`;
  }
  if (errors.length) {
    message += `\n\n${errors.slice(0, 5).join("\n")}`;
  }
  return message;
}
