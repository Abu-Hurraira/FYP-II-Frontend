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
  const restored =
    result?.restoredCount ?? result?.addedCount ?? result?.AddedCount ?? 0;
  const skipped =
    result?.skippedCount ??
    result?.SkippedCount ??
    (result?.alreadyLinkedCount ?? result?.AlreadyLinkedCount ?? 0);
  const errors = result?.errors || [];
  const custom = result?.message ?? result?.Message;
  let message =
    custom ||
    `Restored ${restored} ${outcomeLabel}(s) from the saved catalog.`;
  if (!custom && skipped > 0) {
    message += `\nSkipped ${skipped} (already present or invalid).`;
  }
  if (errors.length) {
    message += `\n\n${errors.slice(0, 5).join("\n")}`;
  }
  return message;
}
