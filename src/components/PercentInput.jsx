import React from "react";

const DEFAULT_CLASS =
  "w-16 text-center py-1.5 px-1 rounded-lg border border-gray-200 bg-white dark:border-[#1b2c2e] dark:bg-[#122427] text-gray-900 dark:text-white font-extrabold text-xs sm:text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

export default function PercentInput({
  value,
  onChange,
  min = 0,
  max = 100,
  className = DEFAULT_CLASS,
  disabled = false,
  placeholder = "e.g. 25",
}) {
  const display = value === "" || value === null || value === undefined ? "" : String(value);

  const emit = (next) => {
    onChange?.(next);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={display}
      placeholder={placeholder}
      className={className}
      onFocus={(event) => event.target.select()}
      onChange={(event) => {
        const raw = event.target.value.trim();
        if (raw === "") {
          emit("");
          return;
        }
        if (!/^\d*\.?\d*$/.test(raw)) return;

        const num = Number(raw);
        if (Number.isNaN(num)) return;
        if (num > max) {
          emit(max);
          return;
        }
        if (num < min) {
          emit(min);
          return;
        }

        if (raw !== "0" && raw !== "0." && /^0\d/.test(raw)) {
          emit(num);
          return;
        }

        emit(raw.endsWith(".") ? raw : num);
      }}
      onBlur={() => {
        if (display === "") {
          emit(0);
          return;
        }
        const num = Number(display);
        emit(Number.isNaN(num) ? 0 : num);
      }}
    />
  );
}
