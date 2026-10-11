export const API_PORT = "5161";
export const HOST = "127.0.0.1";
export const API_BASE_URL = `http://${HOST}:${API_PORT}/api`;

const DEFAULT_TIMEOUT_MS = 20000;
const TOKEN_KEY = "authToken";

let memoryToken = null;
let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export function setAuthToken(token) {
  memoryToken = token || null;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getAuthToken() {
  if (memoryToken) return memoryToken;
  memoryToken = localStorage.getItem(TOKEN_KEY);
  return memoryToken;
}

export function clearAuthToken() {
  memoryToken = null;
  localStorage.removeItem(TOKEN_KEY);
}

function friendlyApiError(data, status) {
  const raw =
    data?.message ||
    data?.title ||
    (typeof data === "string" ? data : "") ||
    "";

  if (/Invalid object name/i.test(raw)) {
    return "A required database table is missing. Restart the API and try again.";
  }
  if (/Invalid column name/i.test(raw)) {
    return "The database is missing a required column. Restart the API and try again.";
  }
  if (/SqlException|at Microsoft\.|at System\./i.test(raw)) {
    return "The server could not complete this request. Try again.";
  }

  return raw || `Request failed with status ${status}`;
}

export const request = async (endpoint, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const isFormData = options.body instanceof FormData;
    const token = options.skipAuth ? null : getAuthToken();

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    const text = await response.text();

    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (response.status === 401 && !options.skipAuth) {
      if (token && typeof unauthorizedHandler === "function") {
        unauthorizedHandler();
      }
      throw new Error(data?.message || "Session expired. Please sign in again.");
    }

    if (!response.ok) {
      throw new Error(friendlyApiError(data, response.status));
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`API request timed out. Backend expected at ${API_BASE_URL}.`);
    }

    throw new Error(error?.message || `Network request failed. Backend expected at ${API_BASE_URL}.`);
  } finally {
    clearTimeout(timeout);
  }
};

export default request;
