#!/usr/bin/env node
/*
  One command from Obsidian to the live site:

    vault Articles/  ->  npm run sync  ->  commit  ->  pull --rebase  ->  push

  GitHub Actions builds and deploys on every push to main, so the push is the
  publish. Nothing here talks to the site directly.

  Usage:
    npm run publish              # sync, commit, push
    npm run publish -- --prune   # also drop posts that lost `publish: true`
    npm run publish -- --dry-run # show what would happen, change nothing

  The one rule this script is built around: it stages ONLY files the sync
  generated (identified by the `vaultSource` key in their frontmatter). Whatever
  else is dirty in the working tree — half-finished CSS, a layout experiment —
  is never staged, never committed, and never pushed.
*/

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const SITE_ROOT = path.resolve(import.meta.dirname, "..");
const POSTS_DIR = "src/content/posts";
const BRANCH = "main";

const PRUNE = process.argv.includes("--prune");
const DRY = process.argv.includes("--dry-run");

/* ---------- tiny helpers ---------- */

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (COLOR ? `\u001b[${code}m${s}\u001b[0m` : s);
const bold = (s) => paint("1", s);
const dim = (s) => paint("2", s);
const green = (s) => paint("32", s);
const yellow = (s) => paint("33", s);
const red = (s) => paint("31", s);

function git(args) {
  return execFileSync("git", args, { cwd: SITE_ROOT, encoding: "utf8" }).trim();
}

/* Non-throwing variant, for the steps where failure is a normal outcome. */
function tryGit(args) {
  const r = spawnSync("git", args, { cwd: SITE_ROOT, encoding: "utf8" });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

function die(msg, detail) {
  console.error(`\n${red("x")} ${msg}`);
  if (detail) console.error(dim(detail));
  process.exit(1);
}

function frontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  try {
    return YAML.parse(m[1]) ?? {};
  } catch {
    return {};
  }
}

/* ---------- 0. sanity ---------- */

process.chdir(SITE_ROOT);

if (!tryGit(["rev-parse", "--git-dir"]).ok) die("Not a git repository.", SITE_ROOT);

const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
if (branch !== BRANCH) {
  die(
    `On branch ${bold(branch)}, not ${bold(BRANCH)}.`,
    `Only ${BRANCH} deploys. Switch with: git switch ${BRANCH}`
  );
}

if (!tryGit(["remote", "get-url", "origin"]).ok) die("No 'origin' remote to push to.");

/* Refuse to run on top of an unfinished merge or rebase. */
const GIT_DIR = git(["rev-parse", "--absolute-git-dir"]);
for (const marker of ["MERGE_HEAD", "REBASE_HEAD", "CHERRY_PICK_HEAD"]) {
  if (fs.existsSync(path.join(GIT_DIR, marker))) {
    die(
      `A ${marker.replace("_HEAD", "").toLowerCase()} is in progress.`,
      "Finish or abort it first."
    );
  }
}

/* Anything already staged would ride along in our commit. Make it stop. */
const preStaged = git(["diff", "--cached", "--name-only"]).split("\n").filter(Boolean);
if (preStaged.length) {
  die(
    `${preStaged.length} file(s) are already staged and would be swept into this commit.`,
    `Commit or unstage them first (git restore --staged .):\n  ${preStaged.join("\n  ")}`
  );
}

/* ---------- 1. pull the vault in ---------- */

console.log(bold("\n1. Syncing from the vault"));
const syncArgs = ["scripts/sync-vault.mjs"];
if (PRUNE) syncArgs.push("--prune");
const sync = spawnSync(process.execPath, syncArgs, { cwd: SITE_ROOT, encoding: "utf8" });
process.stdout.write(
  (sync.stdout ?? "")
    .split("\n")
    .map((l) => (l ? `   ${l}` : l))
    .join("\n")
);
if (sync.status !== 0) die("Sync failed, nothing was committed.", sync.stderr?.trim());

/* ---------- 2. work out what is ours to publish ---------- */

/*
  --porcelain -z so filenames with spaces or unicode survive intact. Each record
  is "XY <path>"; renames add a second NUL-separated path we do not need, since
  a renamed post shows up as its own add plus a delete of the old slug.
*/
const rawStatus = execFileSync("git", ["status", "--porcelain", "-z", "--", POSTS_DIR], {
  cwd: SITE_ROOT,
  encoding: "utf8",
});
const records = rawStatus.split("\0").filter(Boolean);

const changed = [];
for (let i = 0; i < records.length; i++) {
  const rec = records[i];
  const code = rec.slice(0, 2);
  const file = rec.slice(3);
  if (code.startsWith("R")) i++; // skip the rename's source path
  if (!file.endsWith(".md") && !file.endsWith(".mdx")) continue;

  const deleted = code.includes("D");
  let data;
  if (deleted) {
    // Read the version still in HEAD to check it was ours before trusting the delete.
    const shown = tryGit(["show", `HEAD:${file}`]);
    data = shown.ok ? frontmatter(shown.out) : {};
  } else {
    data = frontmatter(fs.readFileSync(path.join(SITE_ROOT, file), "utf8"));
  }

  /*
    The gate. A post without vaultSource was hand-written into the repo, not
    generated from the vault, so this script has no business touching it.
  */
  if (!data.vaultSource) {
    console.log(`   ${yellow("skipped")}  ${file} ${dim("(not generated from the vault)")}`);
    continue;
  }

  changed.push({ file, deleted, title: data.title ?? path.basename(file, ".md"), data });
}

if (!changed.length) {
  console.log(green("\nAlready up to date - the site matches the vault.\n"));
  process.exit(0);
}

console.log(bold("\n2. Articles to publish"));
for (const c of changed) {
  console.log(`   ${c.deleted ? red("remove") : green("publish")}  ${c.title}`);
}

/* A description that is still the template ships as the post's subtitle. Say so. */
for (const c of changed) {
  const d = String(c.data.description ?? "");
  if (!c.deleted && (/^<.*>$/.test(d.trim()) || /one or two sentences/i.test(d))) {
    console.log(`   ${yellow("!")} ${c.title}: description is still placeholder text`);
  }
}

/*
  Attachments are copied to public/vault/, which .gitignore excludes — so an
  image that works locally is missing on the deployed site. Warn loudly rather
  than force-adding past a deliberate ignore rule.
*/
const embedded = changed
  .filter((c) => !c.deleted)
  .flatMap((c) => {
    const body = fs.readFileSync(path.join(SITE_ROOT, c.file), "utf8");
    return [...body.matchAll(/\]\((\/vault\/[^)]+)\)/g)].map((m) => m[1]);
  });
if (embedded.length) {
  console.log(
    `\n   ${yellow("!")} ${embedded.length} image(s) live under public/vault/, which .gitignore excludes.\n` +
      dim("     They render locally but will 404 on the live site. To ship them,\n") +
      dim("     remove the public/vault/ line from .gitignore and re-run.")
  );
}

if (DRY) {
  console.log(dim("\n--dry-run: stopping here, nothing staged.\n"));
  process.exit(0);
}

/* ---------- 3. commit ---------- */

console.log(bold("\n3. Committing"));
git(["add", "--", ...changed.map((c) => c.file)]);

/* Paranoia: confirm the index holds exactly what we intended and nothing else. */
const staged = git(["diff", "--cached", "--name-only"]).split("\n").filter(Boolean);
const unexpected = staged.filter((f) => !changed.some((c) => c.file === f));
if (unexpected.length) {
  tryGit(["restore", "--staged", "--", ...unexpected]);
  die("Something unexpected reached the index; it has been unstaged.", unexpected.join("\n"));
}

const published = changed.filter((c) => !c.deleted);
const subject =
  changed.length === 1
    ? `${changed[0].deleted ? "Unpublish" : "Publish"} ${changed[0].title}`
    : `Publish ${published.length} article${published.length === 1 ? "" : "s"} from the vault`;
const body =
  changed.length === 1 ? "" : changed.map((c) => `${c.deleted ? "- " : "+ "}${c.title}`).join("\n");

const commit = spawnSync("git", ["commit", "-F", "-"], {
  cwd: SITE_ROOT,
  encoding: "utf8",
  input: `${subject}${body ? `\n\n${body}` : ""}\n`,
});
if (commit.status !== 0) die("Commit failed.", `${commit.stdout ?? ""}${commit.stderr ?? ""}`);
console.log(`   ${green("ok")} ${git(["log", "--oneline", "-1"])}`);

/* ---------- 4. pull, then push ---------- */

console.log(bold("\n4. Pushing"));

/* --autostash keeps unrelated dirty files out of the way and puts them back. */
const pull = tryGit(["pull", "--rebase", "--autostash", "origin", BRANCH]);
if (!pull.ok) {
  die(
    "Pull failed, so nothing was pushed. Your commit is safe locally.",
    `${pull.out}\n\nResolve it, then run: git push origin ${BRANCH}`
  );
}

const push = tryGit(["push", "origin", BRANCH]);
if (!push.ok) die("Push failed. The commit is safe locally.", push.out);

const url = git(["remote", "get-url", "origin"]).replace(/\.git$/, "");
console.log(`   ${green("ok")} pushed to ${BRANCH}`);
console.log(
  green("\nPublished. GitHub Actions is building now.") +
    dim(`\n  Progress: ${url}/actions\n  Live in a minute or two.\n`)
);
