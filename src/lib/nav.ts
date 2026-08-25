import type { IconName } from "./icons";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

export const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/cv", label: "CV", icon: "cv" },
  { href: "/gallery", label: "Gallery", icon: "gallery" },
];
