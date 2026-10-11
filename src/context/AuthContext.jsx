import React, { createContext, useEffect, useState } from "react";
import {
  clearAuthToken,
  getAuthToken,
  setAuthToken,
  setUnauthorizedHandler,
} from "../api/apiClient";
import { normalizeAuthUser } from "../utils/helpers";

const STORAGE_KEY = "user";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = async (userData, token) => {
    if (!token) {
      throw new Error("Login did not return an access token. Restart the API and try again.");
    }
    setAuthToken(token);
    const normalized = normalizeAuthUser(userData);
    setUser(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (e) {
      console.error("Failed to save user", e);
    }
  };

  const logout = async () => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error("Failed to clear user", e);
    }
    clearAuthToken();
  };

  const updateStoredUser = async (userData) => {
    const normalized = normalizeAuthUser(userData);
    setUser(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (e) {
      console.error("Failed to save user", e);
    }
  };

  const loadUser = async () => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY);
      const token = getAuthToken();
      if (savedUser && token) {
        setUser(normalizeAuthUser(JSON.parse(savedUser)));
      } else {
        localStorage.removeItem(STORAGE_KEY);
        clearAuthToken();
        setUser(null);
      }
    } catch (error) {
      console.log("Failed to load user:", error?.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
    loadUser();
    return () => setUnauthorizedHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateStoredUser }}>
      {children}
    </AuthContext.Provider>
  );
};
