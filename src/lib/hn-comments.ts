/*
  Renders a post's Hacker News thread as its comment section.

  The page ships only a link to the thread; this fills in the comments from the
  HN Algolia API, which returns the whole tree in one request. It waits until
  the section is near the viewport, so readers who never scroll that far cost
  HN nothing. Any failure leaves the bare link, which is still a way to discuss.

  Algolia orders replies by time. HN's own ranking of the top-level comments
  comes from the official API's `kids`, fetched alongside; nested replies stay
  chronological, which reads fine at that depth.
*/

const ALGOLIA = "https://hn.algolia.com/api/v1/items/";
const FIREBASE = "https://hacker-news.firebaseio.com/v0/item/";
const HN = "https://news.ycombinator.com/";

// Past this depth replies stop indenting, so deep threads stay readable on a phone.
const MAX_INDENT = 5;

interface Item {
  id: number;
  author: string | null;
  created_at: string;
  text: string | null;
  children: Item[];
}

/*
  HN already restricts comment markup to these tags, but the text still goes
  into the page, so it is rebuilt from an allowlist rather than trusted. Parsing
  happens in a DOMParser document, which never runs scripts or loads images.
*/
const ALLOWED = new Set(["P", "I", "EM", "B", "STRONG", "A", "PRE", "CODE", "BR"]);

function sanitize(html: string): DocumentFragment {
  const src = new DOMParser().parseFromString(html, "text/html").body;
  const out = document.createDocumentFragment();
  const copy = (from: Node, to: Node) => {
    for (const node of Array.from(from.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        to.appendChild(document.createTextNode(node.textContent ?? ""));
      } else if (node instanceof Element) {
        if (!ALLOWED.has(node.tagName)) {
          copy(node, to); // keep the text, drop the tag
          continue;
        }
        const el = document.createElement(node.tagName.toLowerCase());
        if (node.tagName === "A") {
          const href = node.getAttribute("href") ?? "";
          if (/^https?:\/\//i.test(href)) {
            el.setAttribute("href", href);
            el.setAttribute("rel", "nofollow ugc noopener");
          }
        }
        copy(node, el);
        to.appendChild(el);
      }
    }
  };
  copy(src, out);
  return out;
}

const dateFormat = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" });

function link(href: string, text: string): HTMLAnchorElement {
  const a = document.createElement("a");
  a.href = href;
  a.textContent = text;
  return a;
}

/* A deleted comment with no surviving replies is dropped entirely. */
function visible(item: Item): boolean {
  return Boolean(item.text && item.author) || item.children.some(visible);
}

function renderThread(items: Item[], depth: number): HTMLOListElement {
  const ol = document.createElement("ol");
  ol.className = depth >= MAX_INDENT ? "hn-thread hn-thread-flat" : "hn-thread";
  for (const item of items) {
    if (!visible(item)) continue;
    const li = document.createElement("li");
    li.className = "hn-comment";

    const meta = document.createElement("p");
    meta.className = "hn-meta";
    if (item.text && item.author) {
      meta.append(link(`${HN}user?id=${encodeURIComponent(item.author)}`, item.author), " · ");
      const when = link(`${HN}item?id=${item.id}`, "");
      const time = document.createElement("time");
      time.dateTime = item.created_at;
      time.textContent = dateFormat.format(new Date(item.created_at));
      when.appendChild(time);
      meta.appendChild(when);
      li.appendChild(meta);

      const body = document.createElement("div");
      body.className = "hn-text";
      body.appendChild(sanitize(item.text));
      li.appendChild(body);
    } else {
      meta.textContent = "[deleted]";
      li.appendChild(meta);
    }

    if (item.children.some(visible)) li.appendChild(renderThread(item.children, depth + 1));
    ol.appendChild(li);
  }
  return ol;
}

function count(items: Item[]): number {
  return items.reduce((n, c) => n + (c.text && c.author ? 1 : 0) + count(c.children), 0);
}

async function load(section: HTMLElement) {
  const id = section.dataset.hnId;
  const [tree, ranking] = await Promise.all([
    fetch(ALGOLIA + id).then((r) => (r.ok ? (r.json() as Promise<Item>) : null)),
    fetch(`${FIREBASE}${id}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<{ kids?: number[] }>) : null))
      .catch(() => null), // ranking is a nicety; Algolia's order is the fallback
  ]);
  if (!tree) return;

  const rank = new Map((ranking?.kids ?? []).map((kid, i) => [kid, i]));
  const top = [...tree.children].sort(
    (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity)
  );

  const n = count(top);
  if (!n) return;
  const title = section.querySelector(".hn-title a");
  if (title) title.textContent = `${n} ${n === 1 ? "comment" : "comments"} on Hacker News`;
  section.appendChild(renderThread(top, 0));
}

export function initHnComments() {
  const section = document.querySelector<HTMLElement>(".hn-comments[data-hn-id]");
  if (!section) return;
  const start = () => load(section).catch(() => {});
  if (!("IntersectionObserver" in window)) return void start();
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        start();
      }
    },
    { rootMargin: "800px 0px" }
  );
  io.observe(section);
}
