import request from "./apiClient";

export const getGraderAllocations = async () => {
  return await request("/GraderAllocations");
};

export const createGraderAllocation = async (allocation) => {
  return await request("/GraderAllocations", {
    method: "POST",
    body: JSON.stringify(allocation),
  });
};

export const deleteGraderAllocation = async (allocationId) => {
  return await request(`/GraderAllocations/${allocationId}`, {
    method: "DELETE",
  });
};