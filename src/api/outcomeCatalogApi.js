import request from "./apiClient";

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj?.[key] != null) return obj[key];
  }
  return undefined;
}

export async function listOutcomeCatalogVersions(outcomeType) {
  const type = String(outcomeType || "").toUpperCase();
  return await request(`/OutcomeCatalogVersions?outcomeType=${encodeURIComponent(type)}`);
}

export async function getOutcomeCatalogVersionDetail(versionId, targetProgramId) {
  return await request(
    `/OutcomeCatalogVersions/${versionId}?targetProgramId=${encodeURIComponent(targetProgramId)}`
  );
}

export async function applyOutcomeCatalogVersion(versionId, { targetProgramId, selectedItemIds }) {
  return await request(`/OutcomeCatalogVersions/${versionId}/apply`, {
    method: "POST",
    body: JSON.stringify({
      targetProgramId: Number(targetProgramId),
      selectedItemIds,
    }),
  });
}

/**
 * Apply a specific (or latest) outcome catalog version for a program (PEO or PLO).
 */
export async function applyOutcomeCatalog(outcomeType, programId, versionId = null) {
  const type = String(outcomeType || "").toUpperCase();
  if (type !== "PEO" && type !== "PLO") {
    return {
      restoredCount: 0,
      skippedCount: 0,
      errors: [`Unsupported outcome type: ${outcomeType}`],
      message: "Only PEO and PLO catalog restore is supported.",
    };
  }

  const versions = await listOutcomeCatalogVersions(type);
  const list = Array.isArray(versions) ? versions : [];
  const forProgram = list.filter(
    (v) => Number(pick(v, "sourceProgramId", "SourceProgramId")) === Number(programId)
  );
  const candidates = forProgram.length ? forProgram : list;

  let latest = candidates[0];
  if (versionId != null) {
    latest =
      candidates.find(
        (v) => Number(pick(v, "outcomeCatalogVersionId", "OutcomeCatalogVersionId")) === Number(versionId)
      ) || latest;
  }

  if (!latest) {
    return {
      restoredCount: 0,
      skippedCount: 0,
      errors: [],
      message: `No saved ${type} catalog version found. Import an Excel file once to create a version.`,
      versions: candidates,
    };
  }

  const resolvedVersionId = pick(latest, "outcomeCatalogVersionId", "OutcomeCatalogVersionId");
  const detail = await getOutcomeCatalogVersionDetail(resolvedVersionId, programId);
  const items = pick(detail, "items", "Items") || [];
  const selectedItemIds = items
    .map((item) => pick(item, "outcomeCatalogVersionItemId", "OutcomeCatalogVersionItemId"))
    .filter((id) => id != null);

  if (!selectedItemIds.length) {
    return {
      restoredCount: 0,
      skippedCount: 0,
      errors: [],
      message: `Catalog version "${pick(latest, "versionLabel", "VersionLabel") || resolvedVersionId}" has no items.`,
      versions: candidates,
    };
  }

  const result = await applyOutcomeCatalogVersion(resolvedVersionId, {
    targetProgramId: Number(programId),
    selectedItemIds,
  });

  return {
    restoredCount: Number(pick(result, "addedCount", "AddedCount") ?? 0),
    skippedCount:
      Number(pick(result, "alreadyLinkedCount", "AlreadyLinkedCount") ?? 0) +
      Number(pick(result, "skippedCount", "SkippedCount") ?? 0),
    errors: [],
    message: pick(result, "message", "Message") || `${type} catalog applied.`,
    versions: candidates,
    versionLabel: pick(latest, "versionLabel", "VersionLabel"),
  };
}

/** Apply the latest outcome catalog version for a program (PEO or PLO). */
export async function applyLatestOutcomeCatalog(outcomeType, programId) {
  return await applyOutcomeCatalog(outcomeType, programId, null);
}
