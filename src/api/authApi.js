import request from "./apiClient";

export const loginUser = async (email, password) => {
  return await request("/Auth/login", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({
      email,
      password,
    }),
  });
};

// export const registerUser = async (email, password) => {//
