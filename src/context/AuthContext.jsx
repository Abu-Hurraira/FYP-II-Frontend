import React, { createContext, useEffect, useState } from "react";
import { normalizeAuthUser } from "../utils/helpers";

const STORAGE_KEY = "user";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = async (userData) => {
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
      if (savedUser) {
        setUser(normalizeAuthUser(JSON.parse(savedUser)));
      }
    } catch (error) {
      console.log("Failed to load user:", error?.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateStoredUser }}>
      {children}
    </AuthContext.Provider>
  );
};
