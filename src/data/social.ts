import type { IconName } from "../lib/icons";

export interface SocialLink {
  href: string;
  label: string;
  icon: IconName;
}

// Placeholder handles — swap for real profile URLs.
export const socialLinks: SocialLink[] = [
  { href: "https://github.com/rtmkrptn", label: "GitHub", icon: "github" },
  { href: "https://x.com/rtmkrptn", label: "X", icon: "x" },
  { href: "https://youtube.com/@rtmkrptn", label: "YouTube", icon: "youtube" },
  { href: "https://discord.com/users/rtmkrptn", label: "Discord", icon: "discord" },
  { href: "https://instagram.com/rtmkrptn", label: "Instagram", icon: "instagram" },
];
