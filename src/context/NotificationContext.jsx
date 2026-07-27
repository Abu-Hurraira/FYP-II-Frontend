import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { registerDialogAdapter } from "../utils/dialogs";

const NotificationContext = createContext(null);

function inferAlertVariant(title, message) {
  const a = String(title || "").trim().toLowerCase();
  const b = String(message || "").toLowerCase();
  const all = `${a} ${b}`;

  if (
    /error|failed|invalid|warning|missing|denied|forbidden|unauthorized|validation|login failed|delete error|upload error/.test(
      all
    )
  ) {
    return "error";
  }

  if (
    a === "success" ||
    a === "uploaded" ||
    a === "submitted" ||
    /successfully|import completed|submitted|completed|created|updated|deleted|added|saved|assigned|removed/.test(all)
  ) {
    return "success";
  }

  if (/success|completed|submitted/.test(a)) return "success";

  return "error";
}

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (variant, title, message) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const hasBody = message != null && String(message).trim() !== "";
      const headline = hasBody ? String(title || "").trim() : "";
      const body = hasBody ? String(message) : String(title || "");

      setToasts((prev) => [...prev, { id, variant, title: headline, message: body }]);
      window.setTimeout(() => removeToast(id), 5200);
    },
    [removeToast]
  );

  useEffect(() => {
    registerDialogAdapter({
      showAlert(title, message) {
        const variant = inferAlertVariant(title, message);
        pushToast(variant, title, message);
      },
      showConfirm(title, message) {
        return new Promise((resolve) => {
          setConfirmState({ title: title || "Confirm", message: message || "", resolve });
        });
      },
    });
  }, [pushToast]);

  const resolveConfirm = useCallback((value) => {
    setConfirmState((prev) => {
      if (prev) prev.resolve(Boolean(value));
      return null;
    });
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <NotificationContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 top-4 z-[300] flex flex-col items-end gap-2 px-4 sm:px-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-md rounded-xl border px-4 py-3 shadow-lg ${
              t.variant === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                : "border-red-200 bg-red-50 text-red-950"
            }`}
            data-toast={t.variant}
            role="status"
          >
            {t.title ? <p className="text-sm font-bold">{t.title}</p> : null}
            <p className={`whitespace-pre-wrap text-sm ${t.title ? "mt-1" : ""}`}>{t.message}</p>
          </div>
        ))}
      </div>

      {confirmState ? (
        <div
          className="fixed inset-0 z-[301] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onClick={() => resolveConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900">{confirmState.title}</h2>
            {confirmState.message ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{confirmState.message}</p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-brand-muted/40"
                onClick={() => resolveConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="app-btn-primary rounded-2xl px-4 py-2 text-sm"
                onClick={() => resolveConfirm(true)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) return null;
  return ctx;
}
