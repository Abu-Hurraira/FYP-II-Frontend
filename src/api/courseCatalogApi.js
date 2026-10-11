import request from "./apiClient";

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj?.[key] != null) return obj[key];
  }
  return undefined;
}

export async function listCourseCatalogVersions() {
  return await request("/CourseCatalogVersions");
}

export async function getCourseCatalogVersionDetail(catalogVersionId, targetProgramId) {
  const qs =
    targetProgramId != null
      ? `?targetProgramId=${encodeURIComponent(targetProgramId)}`
      : "";
  return await request(`/CourseCatalogVersions/${catalogVersionId}${qs}`);
}

export async function applyCourseCatalogVersion(catalogVersionId, { targetProgramId, selectedItemIds }) {
  return await request(`/CourseCatalogVersions/${catalogVersionId}/apply`, {
    method: "POST",
    body: JSON.stringify({
      targetProgramId: Number(targetProgramId),
      selectedItemIds: selectedItemIds ?? null,
    }),
  });
}

/** Apply a specific (or latest) catalog version into a program. */
export async function applyCourseCatalog(targetProgramId, catalogVersionId = null) {
  const versions = await listCourseCatalogVersions();
  const list = Array.isArray(versions) ? versions : [];
  if (!list.length) {
    return {
      restoredCount: 0,
      skippedCount: 0,
      message: "No course catalog version found. Import courses once to create a version.",
      versions: [],
    };
  }

  const forProgram = list.filter(
    (v) => Number(pick(v, "sourceProgramId", "SourceProgramId")) === Number(targetProgramId)
  );
  const candidates = forProgram.length ? forProgram : list;
  let latest = candidates[0];
  if (catalogVersionId != null) {
    latest =
      candidates.find(
        (v) => Number(pick(v, "catalogVersionId", "CatalogVersionId")) === Number(catalogVersionId)
      ) || latest;
  }

  const versionId = pick(latest, "catalogVersionId", "CatalogVersionId");
  const detail = await getCourseCatalogVersionDetail(versionId, targetProgramId);
  const items = pick(detail, "items", "Items") || [];
  const selectedItemIds = items
    .map((item) => pick(item, "catalogVersionItemId", "CatalogVersionItemId"))
    .filter((id) => id != null);

  const result = await applyCourseCatalogVersion(versionId, {
    targetProgramId,
    selectedItemIds: selectedItemIds.length ? selectedItemIds : null,
  });

  return {
    restoredCount: Number(pick(result, "addedCount", "AddedCount") ?? 0),
    skippedCount:
      Number(pick(result, "alreadyLinkedCount", "AlreadyLinkedCount") ?? 0) +
      Number(pick(result, "skippedCount", "SkippedCount") ?? 0),
    message: pick(result, "message", "Message") || "Course catalog applied.",
    versions: candidates,
    versionLabel: pick(latest, "versionLabel", "VersionLabel"),
  };
}

/** Apply latest catalog version into a program (Load from database). */
export async function applyLatestCourseCatalog(targetProgramId) {
  return await applyCourseCatalog(targetProgramId, null);
}
