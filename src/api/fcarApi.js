import request, { API_BASE_URL, getAuthToken } from "./apiClient";

export async function getFcarReport(offeredCourseId, teacherUserId) {
  return await request(
    `/FcarReport/offered-course/${offeredCourseId}?teacherUserId=${teacherUserId}`,
  );
}

export async function saveFcarInput(offeredCourseId, input) {
  return await request(`/FcarReport/offered-course/${offeredCourseId}/input`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function downloadFcarPdf(offeredCourseId, teacherUserId, preferredFileName) {
  const response = await fetch(
    `${API_BASE_URL}/FcarReport/offered-course/${offeredCourseId}/pdf?teacherUserId=${teacherUserId}`,
    {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    },
  );
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      message = JSON.parse(text)?.message || text;
    } catch {
      // Keep the plain-text server response.
    }
    throw new Error(message || "Could not generate the FCAR PDF.");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const basicName = disposition.match(/filename=\"?([^\";]+)\"?/i)?.[1];
  const responseFileName = encodedName
    ? decodeURIComponent(encodedName)
    : basicName || "FCAR.pdf";
  const fileName = (preferredFileName || responseFileName)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .trim();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
