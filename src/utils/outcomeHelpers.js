/** Last number in codes like PLO1, PLO-12, PLO12 → ascending sort order. */
export function extractOutcomeNumber(code) {
  const matches = String(code || "").match(/\d+/g);
  if (!matches?.length) return null;
  return parseInt(matches[matches.length - 1], 10);
}

export function sortByOutcomeCode(items, codeField) {
  return [...(items || [])].sort((a, b) => {
    const na = extractOutcomeNumber(a[codeField]);
    const nb = extractOutcomeNumber(b[codeField]);
    const aHas = na != null;
    const bHas = nb != null;

    if (aHas && bHas && na !== nb) return na - nb;
    if (aHas !== bHas) return aHas ? -1 : 1;

    const idA = Number(a.ploId ?? a.peoId ?? a.cloId ?? 0);
    const idB = Number(b.ploId ?? b.peoId ?? b.cloId ?? 0);
    return idA - idB;
  });
}

export function sortPlos(plos) {
  return sortByOutcomeCode(plos, "ploCode");
}

export function sortPeos(peos) {
  return sortByOutcomeCode(peos, "peoCode");
}

export function sortClos(clos) {
  return sortByOutcomeCode(clos, "cloCode");
}

export function ploDisplayLabel(plo, fallbackIndex = 0) {
  const n = extractOutcomeNumber(plo?.ploCode);
  if (n != null) return `PLO${n}`;
  if (plo?.ploCode) return plo.ploCode;
  return `PLO${fallbackIndex + 1}`;
}
