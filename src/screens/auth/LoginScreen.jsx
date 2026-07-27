import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AuthContext } from "../../context/AuthContext.jsx";
import { loginUser } from "../../api/authApi";
import ThemeToggle from "../../components/ThemeToggle.jsx";
import { showAlert } from "../../utils/dialogs";
import logoUrl from "../../../assets/BIITLogo.png";
import heroUrl from "../../../assets/login-folder-hero.png";

const features = [
  {
    title: "Organized Folders",
    description: "Keep everything in its place",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor">
        <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
      </svg>
    ),
  },
  {
    title: "Secure & Private",
    description: "Your data is safe with us",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor">
        <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
      </svg>
    ),
  },
  {
    title: "Quick Access",
    description: "Find what you need, instantly",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor">
        <path d="M7 2v11h3v9l7-12h-4l4-8z" />
      </svg>
    ),
  },
];

const LoginScreen = () => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const [email, setEmail] = useState("admin@biit.edu.pk");
  const [password, setPassword] = useState("Admin@BIIT#2026");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  const handleLogin = async (event) => {
    event?.preventDefault?.();

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
    <div className="login-canvas fixed inset-0 h-[100dvh] w-screen overflow-hidden bg-[#f0f2f5] font-sans">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle variant="login" />
      </div>

      {/*
        Simple plain circle curves (like the reference):
        one large soft mint circle + one dark green circle on the left.
      */}
      <div className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden lg:block">
        {/* Light mint circle behind — creates the soft outer curve */}
        <div
          className="absolute rounded-full bg-[#c8e6d4]"
          style={{
            width: "78%",
            height: "130%",
            left: "-28%",
            top: "-15%",
          }}
        />
        {/* Main dark green circle — plain circular curve edge */}
        <div
          className="absolute rounded-full bg-[#1a6b45]"
          style={{
            width: "74%",
            height: "124%",
            left: "-30%",
            top: "-12%",
          }}
        />
        <div
          className="absolute rounded-full border border-white/20"
          style={{ width: "120px", height: "120px", left: "28%", top: "12%" }}
        />
        {/* Dot grid */}
        <div className="absolute left-[30%] top-[8%] grid grid-cols-6 gap-2.5 opacity-30">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className="h-1 w-1 rounded-full bg-keep-white bg-white" />
          ))}
        </div>
      </div>

      {/* Mobile green circle strip */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-44 overflow-hidden lg:hidden">
        <div className="absolute -left-1/4 -top-24 h-72 w-[150%] rounded-full bg-[#1a6b45]" />
      </div>

      {/* Soft gray circles on the white side */}
      <div className="login-orb pointer-events-none absolute -right-28 -top-28 z-0 h-80 w-80 rounded-full bg-[#e4e9e6]" />
      <div className="login-orb pointer-events-none absolute -bottom-32 right-[10%] z-0 h-96 w-96 rounded-full bg-[#e4e9e6]" />

      <div className="relative z-10 flex h-full w-full">
        <aside className="relative hidden h-full w-[42%] shrink-0 flex-col px-10 py-8 xl:px-14 xl:py-10 lg:flex">
          <img
            src={logoUrl}
            alt="BIIT"
            className="mb-8 h-12 w-12 rounded-full border-2 border-white/40 bg-keep-white bg-white object-cover shadow-md xl:mb-10 xl:h-14 xl:w-14"
          />

          <h1 className="max-w-[18rem] text-[2rem] font-extrabold leading-tight tracking-tight text-white xl:max-w-sm xl:text-[2.5rem]">
            Folder Management System
          </h1>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/85">
            Organize, manage and access your folders securely and efficiently.
          </p>

          <ul className="mt-8 space-y-4 xl:mt-10 xl:space-y-5">
            {features.map((feature) => (
              <li key={feature.title} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0f5132] text-white shadow-sm">
                  {feature.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{feature.title}</p>
                  <p className="text-xs text-white/75">{feature.description}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-auto flex justify-center pb-1 pt-2">
            <img
              src={heroUrl}
              alt=""
              className="h-72 w-auto max-w-[440px] object-contain drop-shadow-2xl xl:h-80 xl:max-w-[520px]"
            />
          </div>
        </aside>

        <main className="flex h-full min-w-0 flex-1 flex-col items-center justify-center px-4 sm:px-8">
          <div className="w-full max-w-[480px] rounded-2xl bg-white px-9 py-10 shadow-[0_18px_50px_rgba(15,23,42,0.10)] sm:px-10 sm:py-11">
            <div className="mb-8 flex flex-col items-center text-center">
              <img
                src={logoUrl}
                alt="BIIT"
                className="mb-4 h-16 w-16 rounded-full border border-gray-100 bg-keep-white bg-white object-cover shadow-sm"
              />
              <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-[1.75rem]">
                Welcome Back! <span aria-hidden="true">👋</span>
              </h2>
              <p className="mt-2 text-sm text-gray-500">Sign in to continue to your account</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700" htmlFor="login-email">
                  Email Address
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[#1a6b45]">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
                    </svg>
                  </span>
                  <input
                    id="login-email"
                    className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-3 text-sm text-gray-900 outline-none transition focus:border-[#1a6b45] focus:ring-2 focus:ring-[#1a6b45]/15"
                    placeholder="admin@biit.edu.pk"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700" htmlFor="login-password">
                  Password
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[#1a6b45]">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10z" />
                    </svg>
                  </span>
                  <input
                    id="login-password"
                    className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-11 text-sm text-gray-900 outline-none transition focus:border-[#1a6b45] focus:ring-2 focus:ring-[#1a6b45]/15"
                    placeholder="Enter your password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 transition hover:text-gray-600"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-[#1a6b45] focus:ring-[#1a6b45]"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  className="text-sm font-semibold text-[#1a6b45] hover:underline"
                  onClick={() =>
                    showAlert(
                      "Forgot Password",
                      "Please contact your system administrator to reset your password."
                    )
                  }
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="app-btn-primary app-btn-primary-block mt-2 rounded-xl py-3.5 text-sm font-bold shadow-md"
              >
                {loading ? (
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                    Login
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-5 shrink-0 text-center text-[11px] leading-relaxed text-gray-400">
            © 2025 Folder Management System. All rights reserved.
            <br />
            Version 1.0.0
          </p>
        </main>
      </div>
    </div>
  );
};

export default LoginScreen;
