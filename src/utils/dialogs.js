/**
 * Dialog adapter is registered by `NotificationProvider` (see context/NotificationContext.jsx).
 * Falls back to native dialogs only if the provider has not mounted yet.
 */
let adapter = {
  showAlert(title, message) {
    const text = message != null && message !== "" ? `${title}\n\n${message}` : String(title);
    window.alert(text);
  },
  showConfirm(title, message) {
    const text = message != null && message !== "" ? `${title}\n\n${message}` : String(title);
    return Promise.resolve(window.confirm(text));
  },
};

export function registerDialogAdapter(next) {
  adapter = { ...adapter, ...next };
}

export function showAlert(title, message) {
  return adapter.showAlert(title, message);
}

/** Returns a Promise<boolean> — use `await showConfirm(...)` inside async handlers. */
export function showConfirm(title, message) {
  return adapter.showConfirm(title, message);
}
