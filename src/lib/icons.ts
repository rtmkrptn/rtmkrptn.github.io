/**
 * Minimal line-icon set for generic UI (nav/tab bar), hand-drawn pictograms —
 * not brand marks. See brand-icons.ts for the social-row logos.
 * Every entry is inner SVG markup for a 24x24 viewBox, stroke = currentColor.
 */
export const icons = {
  home: `<path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />`,
  cv: `<rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4" />`,
  gallery: `<rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 17 5-5 3.5 3.5L17 11l3 3" />`,
} as const;

export type IconName = keyof typeof icons;
