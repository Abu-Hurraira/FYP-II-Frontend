/**
 * Append a file to FormData for browser (File/Blob) or throw for invalid RN-style objects.
 */
export function appendFormFile(formData, fieldName, file, fallbackName = "file") {
  if (!file) return;
  if (typeof File !== "undefined" && file instanceof File) {
    formData.append(fieldName, file, file.name || fallbackName);
    return;
  }
  if (typeof Blob !== "undefined" && file instanceof Blob) {
    formData.append(fieldName, file, fallbackName);
    return;
  }
  throw new Error("Expected a File from the file picker (web).");
}
