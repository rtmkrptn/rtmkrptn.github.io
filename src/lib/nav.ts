import type { IconName } from "./icons";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /**
   * Kept in the list but not rendered. A flag rather than a deletion so the
   * route, label and icon survive intact — restoring one is deleting its line.
   */
  hidden?: boolean;
}

/*
  /cv and /gallery are built but have no pages behind them yet, so they are
  hidden for now. They still resolve to the 404, which recognises them as
  planned routes and says "coming soon" rather than "not found".
*/
export const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/cv", label: "CV", icon: "cv", hidden: true },
  { href: "/gallery", label: "Gallery", icon: "gallery", hidden: true },
];

/** What the nav actually draws. */
export const visibleNavItems = navItems.filter((item) => !item.hidden);
