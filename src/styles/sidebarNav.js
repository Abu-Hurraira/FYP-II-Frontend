/** Shared dark-sidebar nav classes for all role layouts. */
export const navItem = "app-nav-item";
export const navActive = "app-nav-active";

/** Use with React Router NavLink className callback. */
export function sidebarNavClass({ isActive }) {
  return isActive ? "app-nav-item app-nav-active" : "app-nav-item";
}

/** For HodLayout and any place that computes active manually. */
export function sidebarNavClassFromActive(isActive) {
  return sidebarNavClass({ isActive });
}
