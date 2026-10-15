import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

function collectOptions(children) {
  const options = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child) || child.type !== "option") return;
    options.push({
      value: child.props.value ?? "",
      label: child.props.children,
      disabled: Boolean(child.props.disabled),
    });
  });
  return options;
}

function splitClassName(className) {
  const tokens = String(className || "")
    .split(/\s+/)
    .filter(Boolean);
  const layout = [];
  const rest = [];
  for (const token of tokens) {
    if (/^(w-|min-w-|max-w-|flex-|mb-|mt-|mx-|my-|m-|ml-|mr-)/.test(token)) {
      layout.push(token);
    } else {
      rest.push(token);
    }
  }
  return { layout: layout.join(" "), rest: rest.join(" ") };
}

export default function AppSelect({
  value,
  onChange,
  className = "",
  style,
  disabled = false,
  children,
  id,
  name,
  emptyLabel = "No options available",
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const options = useMemo(() => collectOptions(children), [children]);
  const { layout, rest } = splitClassName(className);
  const current = options.find((opt) => String(opt.value) === String(value ?? ""));

  const positionMenu = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    const maxHeight = 256;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < 120 && spaceAbove > spaceBelow;
    const available = openUp ? spaceAbove - 8 : spaceBelow - 8;
    const height = Math.max(80, Math.min(maxHeight, available));

    const menuWidth = Math.min(rect.width, window.innerWidth - 16);
    const leftPos = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));

    setMenuPos({
      top: openUp ? Math.max(8, rect.top - gap - height) : rect.bottom + gap,
      left: leftPos,
      width: menuWidth,
      maxHeight: height,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    positionMenu();
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return undefined;

    const onWin = () => positionMenu();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      const target = event.target;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selectValue = (nextValue) => {
    if (disabled) return;
    onChange?.({ target: { value: String(nextValue), name: name || "" } });
    setOpen(false);
  };

  const menu =
    open && menuPos
      ? createPortal(
          <ul
            ref={menuRef}
            className="app-select__menu app-select__menu--portal"
            role="listbox"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
            }}
          >
            {options.length === 0 ? (
              <li className="app-select__empty">{emptyLabel}</li>
            ) : (
              options.map((opt) => {
                const selected = String(opt.value) === String(value ?? "");
                return (
                  <li key={String(opt.value)}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={opt.disabled}
                      className={`app-select__option ${selected ? "is-selected" : ""}`}
                      onClick={() => selectValue(opt.value)}
                    >
                      {opt.label}
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={`app-select relative inline-flex ${layout}`.trim()}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`app-select__trigger ${rest}`.trim()}
        style={style}
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) setOpen((prev) => !prev);
        }}
      >
        <span className="app-select__value min-w-0 flex-1 truncate text-left">
          {current?.label ?? "Select"}
        </span>
        <svg
          className={`app-select__chevron h-3.5 w-3.5 shrink-0 transition ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {menu}
    </div>
  );
}
