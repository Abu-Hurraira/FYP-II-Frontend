// Real Android phone connected by USB cable:
// 1) Keep HOST as 127.0.0.1
// 2) Run this after connecting the phone: adb reverse tcp:5161 tcp:5161
// 3) Run ASP.NET Core backend on http://localhost:5161

const API_PORT = "5161";
const HOST = "127.0.0.1";

export const API_BASE_URL = `http://${HOST}:${API_PORT}/api`;

const DEFAULT_TIMEOUT_MS = 20000;

export const request = async (endpoint, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const isFormData = options.body instanceof FormData;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
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

    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.title ||
          (typeof data === "string" ? data : null) ||
          `Request failed with status ${response.status}`
      );
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`API request timed out. Backend expected at ${API_BASE_URL}. Run: adb reverse tcp:5161 tcp:5161`);
    }

    throw new Error(error?.message || `Network request failed. Backend expected at ${API_BASE_URL}.`);
  } finally {
    clearTimeout(timeout);
  }
};

export default request;
