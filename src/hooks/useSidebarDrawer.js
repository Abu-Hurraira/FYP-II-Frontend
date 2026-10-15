import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Hook to manage responsive sidebar drawer state, backdrop,
 * keyboard accessibility (Escape), route-change auto-closing,
 * and body scroll locking across viewport breakpoints.
 */
export function useSidebarDrawer() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close drawer whenever route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close drawer on Escape key press
  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);

  // Prevent background scroll on mobile while drawer is open,
  // and auto-close when resizing window to desktop (>= 1024px)
  useEffect(() => {
    if (!sidebarOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const mql = window.matchMedia("(min-width: 1024px)");
    const handleMediaChange = (e) => {
      if (e.matches) {
        setSidebarOpen(false);
      }
    };

    if (mql.addEventListener) {
      mql.addEventListener("change", handleMediaChange);
    } else {
      mql.addListener(handleMediaChange);
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      if (mql.removeEventListener) {
        mql.removeEventListener("change", handleMediaChange);
      } else {
        mql.removeListener(handleMediaChange);
      }
    };
  }, [sidebarOpen]);

  return {
    sidebarOpen,
    setSidebarOpen,
    openSidebar: () => setSidebarOpen(true),
    closeSidebar: () => setSidebarOpen(false),
  };
}
