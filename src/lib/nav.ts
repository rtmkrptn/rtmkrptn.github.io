import type { IconName } from "./icons";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

/*
  The nav shows the site's structure, including sections that are still being
  built. /cv and /gallery currently land on the 404, which recognises them as
  planned routes and says "coming soon" rather than "not found" — an honest
  destination, not a dead end.
*/
export const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/cv", label: "CV", icon: "cv" },
  { href: "/gallery", label: "Gallery", icon: "gallery" },
];
