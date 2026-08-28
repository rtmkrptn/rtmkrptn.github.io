import type { IconName } from "./icons";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

/*
  Only routes that actually exist belong here — a nav entry pointing at a page
  that has not been built yet is a 404 on the live site.

  /cv and /gallery are still to come; add them back the moment those pages land:
    { href: "/cv", label: "CV", icon: "cv" },
    { href: "/gallery", label: "Gallery", icon: "gallery" },
*/
export const navItems: NavItem[] = [{ href: "/", label: "Home", icon: "home" }];
