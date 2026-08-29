import type { BrandIconName } from "../lib/brand-icons";

interface SocialBase {
  label: string;
  icon: BrandIconName;
}

/* Ordinary profile links: the icon navigates. */
export interface SocialHrefLink extends SocialBase {
  href: string;
  copy?: never;
}

/*
  Discord is the odd one out. It has no username-based profile URL — only
  discord.com/users/<numeric id> resolves — and the handle's whole purpose is
  being pasted into Add Friend. So this icon copies the handle instead of
  navigating, rather than pointing at a URL that would 404.
*/
export interface SocialCopyLink extends SocialBase {
  copy: string;
  href?: never;
}

export type SocialLink = SocialHrefLink | SocialCopyLink;

export const socialLinks: SocialLink[] = [
  { href: "https://github.com/rtmkrptn", label: "GitHub", icon: "github" },
  { href: "https://x.com/rtmkrptn_", label: "X", icon: "x" },
  { href: "https://youtube.com/@rtmkrptn", label: "YouTube", icon: "youtube" },
  { copy: "wizared", label: "Discord", icon: "discord" },
  { href: "https://www.instagram.com/i.love.being.abused", label: "Instagram", icon: "instagram" },
];
