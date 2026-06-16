import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { getGraderAllocations } from "../../api/graderAllocationsApi";
import { getAuthUserId } from "../../utils/helpers";
import theme from "../../styles/theme";
import PageBackButton from "../../components/PageBackButton.jsx";
import { showAlert } from "../../utils/dialogs";

export default function HodGradersScreen() {
  const { user } = useContext(AuthContext);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const roleLabel = user?.roleName || "HOD";
  const userId = getAuthUserId(user);

  useEffect(() => {
    const loadAllocations = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await getGraderAllocations();
        const mine = (data || []).filter(
          (item) => Number(item.teacherUserId ?? item.TeacherUserId) === Number(userId)
        );
        setAllocations(mine);
      } catch (error) {
        showAlert("Error", error.message);
      } finally {
        setLoading(false);
      }
    };

    loadAllocations();
  }, [userId]);

  return (
    <div className="min-h-full bg-page">
      <div className="flex flex-wrap items-start gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <PageBackButton className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Graders</h1>
          <p className="mt-0.5 text-xs text-gray-500">{roleLabel}</p>
        </div>
      </div>

      <div className="w-full px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
              style={{ borderTopColor: theme.colors.primary }}
            />
          </div>
        ) : allocations.length > 0 ? (
          <>
            <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Assigned graders</p>
              <p className="mt-1 text-2xl font-bold text-brand">{allocations.length}</p>
              <p className="mt-0.5 text-sm text-gray-600">
                {allocations.length === 1 ? "Grader assigned to you" : "Graders assigned to you"}
              </p>
            </div>

            <ul className="space-y-2.5">
              {allocations.map((item) => (
                <li
                  key={item.graderAllocationId}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
                >
                  <p className="text-sm font-semibold text-gray-900">{item.graderName}</p>
                  <p className="mt-0.5 text-xs text-gray-600">{item.graderEmail}</p>
                  {item.graderAridNo ? (
                    <p className="mt-0.5 text-xs text-gray-500">ARID: {item.graderAridNo}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center shadow-sm">
            <p className="text-sm font-semibold text-gray-800">No graders assigned yet</p>
            <p className="mt-1 text-sm text-gray-500">
              When section admin assigns graders to you, they will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
