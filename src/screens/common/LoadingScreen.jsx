import React from "react";
import theme from "../../styles/theme";

const LoadingScreen = () => {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-page">
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-transparent"
        style={{ borderTopColor: theme.colors.primary }}
      />
      <p className="mt-3 text-sm text-gray-500">Loading...</p>
    </div>
  );
};

export default LoadingScreen;
