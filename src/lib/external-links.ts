/*
  Every link that leaves the site opens in a new tab, wherever it comes from:
  page templates, Markdown in posts, or the HN comments rendered in the browser.
  One rule applied at runtime rather than `target` written by hand on each link,
  so a new page or a link pasted into a post cannot forget it.

  "Leaves the site" means another origin, or a path on this origin that is not
  one of this site's own sections. The demos (/discrete-layer-algebra/,
  /make-your-fractal/) are separate GitHub Pages projects that happen to share
  the domain, and count as leaving.
*/

// Top-level path segments this site's own pages live under ("" is the home page).
// Add to this when a new top-level page is added, or its links will open in a new tab.
const OWN_SECTIONS = new Set(["", "posts", "portfolio", "styleguide"]);

/* The live origin, so absolute links to the site still count as internal on localhost. */
function siteOrigins(): Set<string> {
  const origins = new Set([location.origin]);
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  if (canonical) origins.add(new URL(canonical).origin);
  return origins;
}

function isExternal(a: HTMLAnchorElement, own: Set<string>): boolean {
  if (a.protocol !== "http:" && a.protocol !== "https:") return false; // mailto:, tel:, javascript:
  if (!own.has(a.origin)) return true;
  return !OWN_SECTIONS.has(a.pathname.split("/")[1] ?? "");
}

export function markExternalLinks(root: ParentNode = document) {
  const own = siteOrigins();
  for (const a of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    if (!isExternal(a, own)) continue;
    a.target = "_blank";
    a.relList.add("noopener");
  }
}
