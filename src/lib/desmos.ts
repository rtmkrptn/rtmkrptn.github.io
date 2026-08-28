/*
  Hydrates the figures emitted by remark-desmos.

  The calculator bundle is ~3.6MB, so it is never fetched on page load — only
  when a graph is actually about to be seen. A post with no graphs pays nothing,
  and a post with five loads the script once.

  Every failure path leaves the KaTeX fallback in place. A blocked CDN, an
  offline reader or a rate-limited key costs the reader nothing they had before.
*/

// The demo key published in the v1.10 docs. v1.13 is current but no longer
// publishes one, and inventing or committing a private key is out of the
// question — so this is the version whose public key is actually documented.
const API_SRC =
  "https://www.desmos.com/api/v1.10/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6";

interface Calculator {
  setExpression(state: { id?: string; latex: string }): void;
  destroy(): void;
}
declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator(el: HTMLElement, options?: Record<string, unknown>): Calculator;
    };
  }
}

let loading: Promise<void> | null = null;

function loadApi(): Promise<void> {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = API_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Desmos API failed to load"));
    document.head.appendChild(s);
  });
  return loading;
}

async function hydrate(figure: HTMLElement) {
  const mount = figure.querySelector<HTMLElement>(".desmos-mount");
  const raw = figure.dataset.desmos;
  if (!mount || !raw) return;

  let expressions: string[];
  try {
    expressions = JSON.parse(raw);
  } catch {
    return;
  }
  if (!Array.isArray(expressions) || !expressions.length) return;

  try {
    await loadApi();
  } catch {
    return; // fallback stays; nothing is lost
  }
  if (!window.Desmos) return;

  const calculator = window.Desmos.GraphingCalculator(mount, {
    // lockViewport false is the default and the point: the graph is draggable
    // and zoomable, which is the only reason to embed one rather than a picture.
    lockViewport: false,
    zoomButtons: true,
    // The expression list is what makes it explorable rather than decorative,
    // but collapsed so the graph itself leads.
    expressions: true,
    expressionsCollapsed: true,
    settingsMenu: false,
    border: false,
  });

  expressions.forEach((latex, i) => calculator.setExpression({ id: `e${i}`, latex }));
  figure.classList.add("is-live");
}

export function initDesmos() {
  const figures = document.querySelectorAll<HTMLElement>("figure.desmos");
  if (!figures.length) return;

  if (!("IntersectionObserver" in window)) {
    figures.forEach(hydrate);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        io.unobserve(entry.target);
        hydrate(entry.target as HTMLElement);
      }
    },
    // Start fetching just before it scrolls into view, so the graph is usually
    // already there by the time the reader arrives at it.
    { rootMargin: "300px" }
  );

  figures.forEach((f) => io.observe(f));
}
