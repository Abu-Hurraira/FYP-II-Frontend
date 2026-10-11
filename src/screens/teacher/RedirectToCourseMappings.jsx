import React from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";

export default function RedirectToCourseMappings({ section }) {
  const { offeredCourseId } = useParams();
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  next.set("section", section);
  return <Navigate to={`/teacher/course/${offeredCourseId}/mappings?${next.toString()}`} replace />;
}
