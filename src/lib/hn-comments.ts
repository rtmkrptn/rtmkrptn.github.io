/*
  Renders a post's Hacker News thread as its comment section.

  The page ships only a link to the thread; this fills in the comments from the
  HN Algolia API, which returns the whole tree in one request. It waits until
  the section is near the viewport, so readers who never scroll that far cost
  HN nothing. If loading fails, a known thread keeps its bare link; a discovered one stays hidden.

  A post without an `hn` id finds its thread among the stories submitted from
  the site author's own HN account, matching on the post's exact URL, so a
  submission shows up here without touching the post and someone else's
  submission of the same link never does. If the author submitted it more than
  once, the busiest thread wins.

  HN archives a thread 14 days after submission: no new comments or votes. An
  archived thread with no comments has nothing to read and nowhere to write, so
  the section disappears rather than invite a comment that cannot be left.

  Algolia orders replies by time. HN's own ranking of the top-level comments
  comes from the official API's `kids`, fetched alongside; nested replies stay
  chronological, which reads fine at that depth.
*/

import { markExternalLinks } from "./external-links";

const ALGOLIA = "https://hn.algolia.com/api/v1/items/";
const SEARCH = "https://hn.algolia.com/api/v1/search_by_date";
const AUTHOR = "rtmkrptn"; // HN account the posts are submitted from
const FIREBASE = "https://hacker-news.firebaseio.com/v0/item/";
const HN = "https://news.ycombinator.com/";

// HN closes threads to new comments after two weeks (checked 2026-11-24: open at 14 days, closed at 15).
const ARCHIVE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

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

/* Scheme, www, query, fragment and a trailing slash do not make a different page. */
const normalize = (url: string) =>
  url
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .toLowerCase();

async function discover(url: string): Promise<string | null> {
  const q = new URLSearchParams({ tags: `story,author_${AUTHOR}`, hitsPerPage: "1000" });
  const res = await fetch(`${SEARCH}?${q}`);
  if (!res.ok) return null;
  const { hits } = (await res.json()) as {
    hits: { objectID: string; url: string | null; num_comments: number | null }[];
  };
  const target = normalize(url);
  const best = hits
    .filter((h) => h.url && normalize(h.url) === target)
    .sort((a, b) => (b.num_comments ?? 0) - (a.num_comments ?? 0))[0];
  return best?.objectID ?? null;
}

async function load(section: HTMLElement) {
  const id = section.dataset.hnId ?? (section.dataset.hnUrl && (await discover(section.dataset.hnUrl)));
  if (!id) return;
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
  const archived = Date.now() - Date.parse(tree.created_at) > ARCHIVE_AFTER_MS;
  if (!n && archived) {
    section.hidden = true;
    return;
  }

  if (section.hasAttribute("data-pending")) {
    section.querySelector<HTMLAnchorElement>(".hn-title a")!.href = `${HN}item?id=${id}`;
    section.querySelector<HTMLElement>(".hn-title")!.hidden = false;
    section.removeAttribute("data-pending");
  }
  if (n) {
    const title = section.querySelector(".hn-title a");
    if (title) title.textContent = `${n} ${n === 1 ? "comment" : "comments"} on Hacker News`;
    section.appendChild(renderThread(top, 0));
  }
  // These links were written after the page-wide pass ran, so they get their own.
  markExternalLinks(section);
}

export function initHnComments() {
  const section = document.querySelector<HTMLElement>(".hn-comments");
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
