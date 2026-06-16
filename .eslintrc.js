/** Browser + Vite + React (no React Native). */
module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  globals: { React: "readonly" },
};
