import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AuthContext } from "../../context/AuthContext.jsx";
import { loginUser } from "../../api/authApi";
import theme from "../../styles/theme";
import { showAlert } from "../../utils/dialogs";
import logoUrl from "../../../assets/BIITLogo.png";

const LoginScreen = () => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const [email, setEmail] = useState("admin@biit.edu.pk");
  const [password, setPassword] = useState("Admin@BIIT#2026");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert("Missing Information", "Email and password are required.");
      return;
    }

    try {
      setLoading(true);
      const response = await loginUser(email.trim(), password);

      if (response?.success) {
        await login(response.user);
        navigate("/", { replace: true });
      } else {
        showAlert("Login Failed", response?.message || "Invalid login.");
      }
    } catch (error) {
      showAlert("Login Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-white px-7 py-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center">
          <img src={logoUrl} alt="" className="mb-3 h-14 w-14 rounded-full bg-white object-cover" />
          <p className="text-sm font-semibold text-gray-600">Folder Management System</p>
        </div>

        <label className="mb-1 block text-xs font-semibold text-gray-600">Email</label>
        <input
          className="mb-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand"
          placeholder="e.g. admin@biit.edu.pk"
          type="text"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {/* <p className="mb-4 text-[11px] leading-snug text-gray-500">
          Enter your email exactly as registered. If it is stored in lowercase in the database, use lowercase here too.
        </p> */}

        <label className="mb-1 block text-xs font-semibold text-gray-600">Password</label>
        <input
          className="mb-5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand"
          placeholder="Enter your password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="button"
          disabled={loading}
          onClick={handleLogin}
          className="flex w-full items-center justify-center rounded-md py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: theme.colors.primary }}
        >
          {loading ? (
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            "Login"
          )}
        </button>
      </div>
    </div>
  );
};

export default LoginScreen;
