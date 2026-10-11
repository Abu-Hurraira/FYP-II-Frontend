import React, { useState } from "react";
import { showAlert } from "../utils/dialogs";

const SUGGESTIONS = ["Practical", "Presentation", "Viva", "Report"];

export function parseMark(value) {
  const num = Number(String(value ?? "").trim() || 0);
  return Number.isFinite(num) ? num : 0;
}

export function capMarksInput(proposed, othersTotal, target, onExceed) {
  const cleaned = String(proposed ?? "").replace(/[^0-9.]/g, "");
  if (cleaned === "" || cleaned === ".") return cleaned;
  const parsed = parseMark(cleaned);
  const max = Math.max(0, Math.round((Number(target) - Number(othersTotal)) * 100) / 100);
  if (parsed <= max) return cleaned;
  onExceed?.(max);
  return max === 0 ? "" : String(max);
}

function slugName(name) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

export function extrasFromScheme(data) {
  const list = data?.extraItems ?? data?.ExtraItems ?? [];
  return (Array.isArray(list) ? list : []).map((x, i) => ({
    key: String(x.key ?? x.Key ?? `item-${i}`),
    name: String(x.name ?? x.Name ?? ""),
    marks: x.marks == null && x.Marks == null ? "" : String(x.marks ?? x.Marks),
  }));
}

export default function ExtraMappingFields({ extras, onChange, target, assigned }) {
  const [draftName, setDraftName] = useState("");
  const limit = Number(target) || 0;

  const warnLimit = () => {
    showAlert("Marks limit", `You cannot enter extra marks above ${limit}.`);
  };

  const add = (rawName) => {
    const name = String(rawName ?? draftName).trim();
    if (!name) {
      showAlert("Add item", "Enter a name such as Practical or Presentation.");
      return;
    }
    if (extras.some((e) => e.name.trim().toLowerCase() === name.toLowerCase())) {
      showAlert("Already added", `${name} is already in this mapping.`);
      return;
    }
    onChange([...extras, { key: slugName(name), name, marks: "" }]);
    setDraftName("");
  };

  const unusedSuggestions = SUGGESTIONS.filter(
    (s) => !extras.some((e) => e.name.trim().toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="mt-3 space-y-3">
      {extras.map((item, index) => (
        <label key={`${item.key}-${index}`} className="block text-xs font-extrabold text-gray-700">
          <span className="flex items-center justify-between gap-2">
            {item.name}
            <button
              type="button"
              className="text-[11px] font-bold text-red-600 hover:underline"
              onClick={() => onChange(extras.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </span>
          <input
            className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold placeholder:text-gray-400"
            placeholder="e.g. 2"
            value={item.marks}
            onChange={(e) => {
              const others = Number(assigned) - parseMark(item.marks);
              const marks = capMarksInput(e.target.value, others, limit, warnLimit);
              onChange(extras.map((row, i) => (i === index ? { ...row, marks } : row)));
            }}
          />
        </label>
      ))}

      <div className="rounded-xl border border-dashed border-gray-200 p-3">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-500">Add extra item</p>
        <div className="mt-2 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold placeholder:text-gray-400"
            placeholder="Practical, Presentation…"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <button
            type="button"
            onClick={() => add()}
            className="shrink-0 rounded-xl border border-[#15803d] bg-white px-3 py-2 text-sm font-extrabold text-[#15803d]"
          >
            Add item
          </button>
        </div>
        {unusedSuggestions.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unusedSuggestions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => add(name)}
                className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-200"
              >
                + {name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
