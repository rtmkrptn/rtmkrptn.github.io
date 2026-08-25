/**
 * Minimal line-icon set, hand-drawn generic glyphs (not brand logo assets).
 * Every entry is inner SVG markup for a 24x24 viewBox, stroke = currentColor.
 */
export const icons = {
  home: `<path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />`,
  cv: `<rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4" />`,
  gallery: `<rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 17 5-5 3.5 3.5L17 11l3 3" />`,

  github: `<path d="M12 3a9 9 0 0 0-2.85 17.54c.45.08.62-.2.62-.43v-1.68c-2.5.55-3.03-1.2-3.03-1.2-.41-1.04-1-1.32-1-1.32-.82-.56.06-.55.06-.55.9.06 1.38.93 1.38.93.8 1.38 2.1.98 2.62.75.08-.58.32-.98.57-1.2-2-.23-4.1-1-4.1-4.44 0-.98.35-1.78.92-2.4-.09-.23-.4-1.15.09-2.4 0 0 .75-.24 2.46.92a8.5 8.5 0 0 1 4.48 0c1.71-1.16 2.46-.92 2.46-.92.5 1.25.18 2.17.09 2.4.57.62.92 1.42.92 2.4 0 3.45-2.1 4.2-4.1 4.43.33.28.62.85.62 1.7v2.5c0 .24.16.52.62.43A9 9 0 0 0 12 3Z" />`,
  x: `<path d="m5 5 14 14M19 5 5 19" />`,
  youtube: `<rect x="3" y="6" width="18" height="12" rx="3" /><path d="M10.5 9.5v5l4.5-2.5-4.5-2.5Z" />`,
  discord: `<rect x="4" y="7" width="16" height="11" rx="4" /><path d="M8.5 4.5 9.5 7M15.5 4.5 14.5 7" /><circle cx="9.5" cy="12.5" r="1.2" /><circle cx="14.5" cy="12.5" r="1.2" />`,
  instagram: `<rect x="4" y="4" width="16" height="16" rx="4.5" /><circle cx="12" cy="12" r="3.5" /><circle cx="16.5" cy="7.5" r="0.8" fill="currentColor" stroke="none" />`,
} as const;

export type IconName = keyof typeof icons;
