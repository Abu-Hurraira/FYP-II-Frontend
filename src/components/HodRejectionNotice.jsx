import React, { useEffect, useRef } from "react";
import { showAlert } from "../utils/dialogs";

export function HodRejectionBanner({ title = "CLOs", reason = "" }) {
  return (
    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 shadow-sm dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
      <p className="font-extrabold">HOD rejected your {title}. Please fix it and upload again.</p>
      {reason ? (
        <p className="mt-2">
          <span className="font-semibold">Reason: </span>
          {reason}
        </p>
      ) : (
        <p className="mt-1 text-red-800/80 dark:text-red-300/80">No extra comments were added.</p>
      )}
    </div>
  );
}

/** Popup once when the teacher opens a rejected page. */
export function useHodRejectionAlert(isRejected, title, reason, ready = true) {
  const shownRef = useRef(false);

  useEffect(() => {
    if (!isRejected) {
      shownRef.current = false;
      return;
    }
    if (!ready || shownRef.current) return;
    shownRef.current = true;
    const detail = reason ? `\n\nReason: ${reason}` : "";
    showAlert("Rejected by HOD", `Your ${title} was rejected. Please fix it and upload again.${detail}`);
  }, [isRejected, title, reason, ready]);
}
