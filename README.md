# Folder Management System (Frontend)

Vite + React 18 web client for the BIIT folder management system.

## Prerequisites

- Node.js 18+

## Scripts

```bash
npm install
npm run dev      # development server
npm run build    # production build → dist/
npm run preview  # preview production build
```

The dev server expects the ASP.NET Core API (see `src/api/apiClient.js` for host/port).

## Structure

- `src/App.jsx` — routes and role-based layouts
- `src/screens/` — page components (`.jsx`)
- `src/api/` — API clients
- `assets/` — static images
