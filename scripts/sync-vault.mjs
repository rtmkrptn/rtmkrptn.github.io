#!/usr/bin/env node
/*
  Pull publishable notes out of the vault's Articles/ folder into
  src/content/posts/.

  Two independent gates, both of which a note must pass:

    1. It lives inside <vault>/Articles/. This is a hard boundary — the rest of
       the vault is never read, never scanned, and cannot reach the site by any
       route, including a symlink pointing out of the folder.
    2. Its frontmatter says `publish: true`. The default for every note is
       therefore "private", even inside Articles/.

  The vault stays entirely local — nothing private is ever committed or pushed.

  Usage:
    npm run sync            # copy publishable notes in, report stale ones
    npm run sync -- --prune # additionally delete outputs that are no longer published
    VAULT_PATH=~/Other npm run sync

  Deliberately does NOT delete anything unless --prune is passed, and even then
  only touches files it generated itself (identified by the vaultSource key it
  writes). Hand-written posts are never at risk.
*/

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import YAML from "yaml";

const SITE_ROOT = path.resolve(import.meta.dirname, "..");
/*
  The one folder the site is allowed to read. Hard-coded on purpose: making it
  configurable would turn a privacy boundary into a setting that can be widened
  by accident.
*/
const ARTICLES_DIRNAME = "Articles";
const OUT_DIR = path.join(SITE_ROOT, "src/content/posts");
const ATTACH_DIR = path.join(SITE_ROOT, "public/vault");
const PRUNE = process.argv.includes("--prune");

/* Vault location: env var, then a gitignored dotfile, then the default. */
function resolveVault() {
  if (process.env.VAULT_PATH) return expand(process.env.VAULT_PATH);
  const cfg = path.join(SITE_ROOT, ".vault-path");
  if (fs.existsSync(cfg)) {
    const p = fs.readFileSync(cfg, "utf8").trim();
    if (p) return expand(p);
  }
  return path.join(os.homedir(), "Brain");
}
const expand = (p) => (p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : path.resolve(p));
const VAULT = resolveVault();
const SOURCE = path.join(VAULT, ARTICLES_DIRNAME);

/* ---------- helpers ---------- */

/*
  Resolving each entry and re-checking it against the root is what makes the
  Articles/ boundary real rather than nominal: a symlink inside the folder that
  points at the rest of the vault (or anywhere else on disk) is refused here,
  so there is no path by which an unpublished note becomes readable.
*/
function contains(root, target) {
  const rel = path.relative(root, target);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue; // .obsidian, .trash, .git
    const p = path.join(dir, e.name);
    let real;
    try {
      real = fs.realpathSync(p);
    } catch {
      continue; // broken symlink
    }
    if (!contains(SOURCE_REAL, real)) {
      escaped.push(path.relative(SOURCE, p));
      continue;
    }
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/* Files refused by the boundary check, reported at the end so it is visible. */
const escaped = [];

function splitFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  try {
    return { data: YAML.parse(m[1]) ?? {}, body: m[2] };
  } catch {
    // Malformed YAML shouldn't take the whole sync down.
    return { data: {}, body: m[2] };
  }
}

/*
  Slugs keep unicode (the vault has Cyrillic titles) but lose anything that is
  awkward in a URL. Astro derives the route from the filename, so this is the
  published path.
*/
function slugify(name) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

/*
  The schema requires title, description and date. Vault frontmatter is
  heterogeneous and mostly lacks them, so each falls back rather than throwing —
  a missing field must never be able to break the site build.
*/
function firstHeading(body) {
  return body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
}

function firstParagraph(body) {
  const text = body
    .replace(/^#.*$/gm, "")
    .replace(/^>.*$/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[\[.*?\]\]/g, "")
    .split(/\n\s*\n/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .find((s) => s.length > 40);
  if (!text) return null;
  return text.length > 160 ? text.slice(0, 157).trimEnd() + "…" : text;
}

function pickDate(data, file) {
  for (const k of ["date", "published", "created", "digested"]) {
    const v = data[k];
    if (v) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return fs.statSync(file).mtime; // last resort, always valid
}

/* ---------- collect ---------- */

if (!fs.existsSync(VAULT)) {
  console.error(`Vault not found: ${VAULT}\nSet VAULT_PATH or write the path into .vault-path`);
  process.exit(1);
}
if (!fs.existsSync(SOURCE)) {
  console.error(
    `No ${ARTICLES_DIRNAME}/ folder in the vault: ${SOURCE}\n` +
      `Posts are only ever read from there. Create it and move the notes you want published into it.`
  );
  process.exit(1);
}

const SOURCE_REAL = fs.realpathSync(SOURCE);

/* Every file the site is allowed to see, resolved once. */
const sourceFiles = walk(SOURCE);
const notes = sourceFiles.filter((f) => f.endsWith(".md"));
const publishable = [];
for (const file of notes) {
  const raw = fs.readFileSync(file, "utf8");
  const { data, body } = splitFrontmatter(raw);
  if (data.publish !== true) continue;
  publishable.push({ file, data, body });
}

/* Map note name -> slug, so wikilinks between published notes become real links. */
const slugByName = new Map();
for (const n of publishable) {
  const base = path.basename(n.file, ".md");
  n.slug = slugify(String(n.data.slug ?? base));
  slugByName.set(base.toLowerCase(), n.slug);
}

/* ---------- transform ---------- */

fs.mkdirSync(OUT_DIR, { recursive: true });
const attachmentsUsed = new Set();
const missingEmbeds = new Set();

function transformBody(body) {
  // ![[image.png]] -> a real image, copied into public/vault/
  body = body.replace(/!\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]/g, (_match, target) => {
    const name = path.basename(target.trim());
    // Attachments are resolved inside Articles/ only, like everything else. An
    // image sitting in the vault's usual attachments folder will not be found —
    // that is the boundary working, so say so instead of failing quietly.
    const found = sourceFiles.find((f) => path.basename(f) === name);
    if (!found) {
      missingEmbeds.add(name);
      return "";
    }
    fs.mkdirSync(ATTACH_DIR, { recursive: true });
    const safe = slugify(path.parse(name).name) + path.extname(name).toLowerCase();
    fs.copyFileSync(found, path.join(ATTACH_DIR, safe));
    attachmentsUsed.add(safe);
    return `![${path.parse(name).name}](/vault/${safe})`;
  });

  // [[Note]] / [[Note|label]] -> a link if that note is also published, else plain text
  body = body.replace(/\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g, (_match, target, label) => {
    const text = (label ?? target).trim();
    const slug = slugByName.get(target.trim().toLowerCase());
    return slug ? `[${text}](/posts/${slug})` : text;
  });

  return body.trim();
}

const written = [];
for (const note of publishable) {
  const base = path.basename(note.file, ".md");
  const title = String(note.data.title ?? firstHeading(note.body) ?? base).trim();
  const description = String(
    note.data.description ?? note.data.summary ?? firstParagraph(note.body) ?? title
  ).trim();
  const date = pickDate(note.data, note.file);

  const frontmatter = {
    title,
    description,
    date: date.toISOString().slice(0, 10),
    draft: note.data.draft === true,
    // Marks this file as generated, and records where from. --prune only ever
    // removes files carrying this key.
    vaultSource: path.relative(SOURCE, note.file),
  };
  if (Array.isArray(note.data.tags)) frontmatter.tags = note.data.tags;

  const out = `---\n${YAML.stringify(frontmatter).trim()}\n---\n\n${transformBody(note.body)}\n`;
  const dest = path.join(OUT_DIR, `${note.slug}.md`);
  const prev = fs.existsSync(dest) ? fs.readFileSync(dest, "utf8") : null;
  if (prev !== out) fs.writeFileSync(dest, out);
  written.push({ dest, slug: note.slug, title, changed: prev !== out });
}

/* ---------- stale outputs ---------- */

const liveDests = new Set(written.map((w) => w.dest));
const stale = [];
for (const f of fs.readdirSync(OUT_DIR)) {
  const p = path.join(OUT_DIR, f);
  if (!p.endsWith(".md") && !p.endsWith(".mdx")) continue;
  if (liveDests.has(p)) continue;
  const { data } = splitFrontmatter(fs.readFileSync(p, "utf8"));
  if (data.vaultSource) stale.push(p); // generated by a previous sync, no longer published
}

/* ---------- report ---------- */

console.log(`source: ${SOURCE}`);
console.log(`notes:  ${notes.length} scanned, ${publishable.length} with publish: true\n`);
for (const w of written) console.log(`  ${w.changed ? "updated" : "  same "}  ${w.slug}  — ${w.title}`);
if (attachmentsUsed.size) console.log(`\nattachments copied to public/vault/: ${[...attachmentsUsed].join(", ")}`);

if (missingEmbeds.size) {
  console.log(`\n${missingEmbeds.size} embed(s) not found inside ${ARTICLES_DIRNAME}/ and dropped:`);
  for (const n of missingEmbeds) console.log(`  ${n}`);
  console.log(`move the file into ${ARTICLES_DIRNAME}/ — nothing outside it is readable`);
}

if (escaped.length) {
  console.log(`\n${escaped.length} path(s) refused for pointing outside ${ARTICLES_DIRNAME}/:`);
  for (const p of escaped) console.log(`  ${p}`);
}

if (stale.length) {
  console.log(`\n${stale.length} previously-published note(s) no longer marked publish: true:`);
  for (const p of stale) console.log(`  ${path.basename(p)}`);
  if (PRUNE) {
    for (const p of stale) fs.rmSync(p);
    console.log("removed (--prune)");
  } else {
    console.log("left in place — re-run with --prune to remove them");
  }
}
if (!publishable.length) {
  console.log("\nNothing published yet. Add `publish: true` to a note's frontmatter.");
}
