/*
  Link-preview cards (Open Graph images), rendered at build time.

  satori lays the card out and turns every glyph into a path, so the SVG it
  hands back needs no fonts installed wherever it is rasterised — CI runs on a
  bare Ubuntu image. sharp (already here for Astro's images) turns it into PNG.

  The card is the site's own sheet in miniature: the cool page ground, a white
  raised panel, the title set thin. Inter stands in for Helvetica Neue, which
  cannot be shipped; it is already the site's own fallback for headings.
*/
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import satori from "satori";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const font = (weight: number) =>
  readFileSync(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`));

const fonts = [
  { name: "Inter", data: font(200), weight: 200 as const, style: "normal" as const },
  { name: "Inter", data: font(400), weight: 400 as const, style: "normal" as const },
];

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
/** Page ground left showing around the sheet. */
const FRAME = 48;

// Literal values from _tokens.scss — satori cannot read CSS custom properties.
const C = {
  page: "linear-gradient(180deg, #eef1f3 0%, #dfe3e6 40%, #d3d8db 100%)",
  surface: "linear-gradient(180deg, #ffffff 0%, #f6f7f8 100%)",
  text: "#1c1f22",
  secondary: "#6b7278",
  hairline: "rgba(0, 0, 0, 0.12)",
  accent: "linear-gradient(180deg, #4fb3f0 0%, #0a5aa8 100%)",
};

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: (Node | string)[]): Node => ({
  type,
  props: { style, children },
});

/** Long titles step down so they still fit in three lines. */
function titleSize(title: string) {
  if (title.length <= 40) return 76;
  if (title.length <= 70) return 64;
  return 54;
}

interface Card {
  title: string;
  /** Shown above the title — the post date, or nothing on the home card. */
  kicker?: string;
}

export async function renderOgImage({ title, kicker }: Card): Promise<Buffer> {
  const tree = h(
    "div",
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundImage: C.page,
      fontFamily: "Inter",
    },
    h(
      "div",
      {
        // satori defaults to content-box, which pushed the sheet off the canvas.
        boxSizing: "border-box",
        width: OG_WIDTH - 2 * FRAME,
        height: OG_HEIGHT - 2 * FRAME,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        borderRadius: 12,
        border: `1px solid ${C.hairline}`,
        backgroundImage: C.surface,
        boxShadow: "0 10px 24px rgba(20, 25, 30, 0.14)",
      },
      h(
        "div",
        { display: "flex", flexDirection: "column" },
        ...(kicker
          ? [h("div", { fontSize: 28, fontWeight: 400, color: C.secondary, marginBottom: 20 }, kicker)]
          : []),
        h(
          "div",
          {
            fontSize: titleSize(title),
            fontWeight: 200,
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            color: C.text,
          },
          title,
        ),
      ),
      h(
        "div",
        { display: "flex", alignItems: "center", fontSize: 28, fontWeight: 400, color: C.secondary },
        h("div", {
          width: 18,
          height: 18,
          borderRadius: 999,
          backgroundImage: C.accent,
          border: "1px solid rgba(6, 58, 110, 0.45)",
          marginRight: 16,
        }),
        h("div", { color: C.text }, "Artemii Karapetian"),
      ),
    ),
  );

  const svg = await satori(tree as Parameters<typeof satori>[0], { width: OG_WIDTH, height: OG_HEIGHT, fonts });
  return sharp(Buffer.from(svg)).png().toBuffer();
}
