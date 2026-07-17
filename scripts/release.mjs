#!/usr/bin/env node
// scripts/release.mjs
//
// リリース作業の前半（バージョン書き換え + 下書き生成）を実行します。
// 後半（commit / tag / push / GitHub Release 公開）は release-publish.mjs を使ってください。
//
// Usage:
//   node scripts/release.mjs <new-version> [--allow-dirty]
//
// 動作:
//   1. 作業ツリーがクリーンか確認（--allow-dirty で skip 可）
//   2. bump-version.mjs を呼んで 6 箇所を更新
//   3. 前回タグからのコミットログを収集
//   4. 前回 GitHub Release の本文を取得（gh CLI）
//   5. release-notes/vX.Y.md にリリースノート下書きを書き出す
//   6. README.md の変更履歴の先頭にプレースホルダのエントリを挿入

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeVersion } from "./bump-version.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function runInherit(cmd, args) {
  return execFileSync(cmd, args, {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
}

function tryRun(cmd, args) {
  try {
    return { ok: true, stdout: run(cmd, args) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function parseArgs(argv) {
  const args = { version: null, allowDirty: false };
  for (const arg of argv) {
    if (arg === "--allow-dirty") {
      args.allowDirty = true;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!args.version) {
      args.version = arg;
    } else {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }
  return args;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function checkWorkingTreeClean(allowDirty) {
  const r = tryRun("git", ["status", "--porcelain"]);
  if (!r.ok) {
    fail("git status failed. Are you inside a git repository?");
  }
  if (r.stdout.trim().length > 0 && !allowDirty) {
    console.error("release: working tree is not clean:\n" + r.stdout);
    fail("commit or stash changes first, or re-run with --allow-dirty");
  }
}

function getPrevTag() {
  const r = tryRun("git", ["describe", "--tags", "--abbrev=0"]);
  if (!r.ok) return null;
  return r.stdout.trim() || null;
}

function getCommitsSince(tag) {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const r = tryRun("git", ["log", range, "--pretty=- %s"]);
  if (!r.ok) return "";
  return r.stdout.trim();
}

function getPrevReleaseBody(tag) {
  if (!tag) return null;
  const r = tryRun("gh", ["release", "view", tag, "--json", "body", "--jq", ".body"]);
  if (!r.ok) return null;
  return r.stdout.trim() || null;
}

function buildDraft({ newVersion, dateStr, prevTag, commits, prevBody }) {
  const lines = [];
  lines.push(`# yaNote リリースノート v${newVersion}`);
  lines.push("");
  lines.push(`**リリース日**: ${dateStr}`);
  lines.push("");
  lines.push("<!-- TODO: 以下の各セクションを編集してください。完了したらこのコメントを削除してください。 -->");
  lines.push("");
  lines.push("## 概要");
  lines.push("");
  lines.push("TODO: 今回のリリースを一文で要約（例: v1.4.2 は、ノード整列機能の追加と…した機能拡張リリースです。）");
  lines.push("");
  lines.push("## 主な変更点");
  lines.push("");
  lines.push("### TODO: 変更点の見出し");
  lines.push("");
  lines.push("- TODO: 変更内容を箇条書きで記述");
  lines.push("");
  lines.push("## 互換性");
  lines.push("");
  lines.push("TODO: 破壊的変更の有無、既存ノートデータ（JSON）との互換性について記述");
  lines.push("");
  lines.push("## ドキュメント更新");
  lines.push("");
  lines.push("TODO: help.md / docs/yaNote-OperationSpec.md / README.md 等の更新内容（無ければこのセクションごと削除）");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("<!-- 以下は下書き元データです。最終リリースノートには残さないでください。");
  lines.push("");
  lines.push(`## [下書き元] 前回タグ ${prevTag ?? "(なし)"} 以降のコミット`);
  lines.push("");
  lines.push(commits || "(コミットが見つかりません)");
  lines.push("");
  if (prevBody) {
    lines.push(`## [下書き元] 前回 GitHub Release (${prevTag}) の本文`);
    lines.push("");
    lines.push(prevBody);
    lines.push("");
  } else {
    lines.push(`## [下書き元] 前回 GitHub Release の本文`);
    lines.push("");
    lines.push("(取得できませんでした。gh CLI が認証済みか、前回リリースが GitHub 上に存在するか確認してください)");
    lines.push("");
  }
  lines.push("-->");
  lines.push("");
  return lines.join("\n");
}

// README.md の変更履歴（"## 改善 (vX / DATE)" / "## 新機能 (vX)" 形式）の
// 先頭エントリの直前にプレースホルダを挿入する
function insertReadmeEntry(newVersion, dateStr) {
  const readmePath = path.join(REPO_ROOT, "README.md");
  const content = fs.readFileSync(readmePath, "utf8");
  const headingRe = /^## (改善|新機能) \(/m;
  const idx = content.search(headingRe);
  if (idx === -1) {
    fail("README.md に '## 改善 (…)' / '## 新機能 (…)' 形式の変更履歴エントリが見つかりません");
  }
  const entry = [
    `## 改善 (v${newVersion} / ${dateStr})`,
    "",
    "- TODO: 今回のリリースの変更内容を箇条書きで記述（新機能中心なら見出しを「## 新機能」に変えてよい）",
    "",
    "",
  ].join("\n");
  const updated = content.slice(0, idx) + entry + content.slice(idx);
  fs.writeFileSync(readmePath, updated, "utf8");
}

// README.md 末尾の「*最終更新: yaNote vX.Y (YYYY-MM-DD)*」を更新する
function updateReadmeFooter(newVersion, dateStr) {
  const readmePath = path.join(REPO_ROOT, "README.md");
  const content = fs.readFileSync(readmePath, "utf8");
  const footerRe = /\*最終更新: yaNote v[^ ]+ \(\d{4}-\d{2}-\d{2}\)\*/;
  if (!footerRe.test(content)) {
    console.warn("release: warning - README.md の '*最終更新: ...*' 行が見つかりません（スキップ）");
    return;
  }
  const updated = content.replace(footerRe, `*最終更新: yaNote v${newVersion} (${dateStr})*`);
  fs.writeFileSync(readmePath, updated, "utf8");
  console.log("release: updated README.md footer (最終更新)");
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (e) {
    fail(e.message);
  }
  if (!parsed.version) {
    fail("missing <new-version> argument\nUsage: node scripts/release.mjs <new-version> [--allow-dirty]");
  }
  const newVersion = normalizeVersion(parsed.version);
  if (!newVersion) {
    fail(`invalid version "${parsed.version}". Expected pattern like 1.5, 1.4.2 or 1.6-beta.1`);
  }

  const dateStr = todayISO();
  const noteRelPath = `release-notes/v${newVersion}.md`;
  const noteAbsPath = path.join(REPO_ROOT, noteRelPath);

  console.log(`release: starting release v${newVersion}`);

  checkWorkingTreeClean(parsed.allowDirty);

  const prevTag = getPrevTag();
  console.log(`release: previous tag = ${prevTag ?? "(none)"}`);

  const tagToCheck = `v${newVersion}`;
  const tagExists = tryRun("git", ["rev-parse", "--verify", "--quiet", `refs/tags/${tagToCheck}`]).ok;
  if (tagExists) {
    fail(`tag ${tagToCheck} already exists`);
  }
  if (fs.existsSync(noteAbsPath)) {
    fail(`${noteRelPath} already exists. Remove it first or pick a different version.`);
  }

  console.log("release: bumping version in 6 places...");
  runInherit("node", ["scripts/bump-version.mjs", newVersion]);

  const commits = getCommitsSince(prevTag);
  console.log(`release: collected ${commits.split("\n").filter(Boolean).length} commit(s)`);
  const prevBody = getPrevReleaseBody(prevTag);
  if (prevBody) {
    console.log(`release: fetched previous GitHub Release body (${prevBody.length} chars)`);
  } else {
    console.log("release: previous GitHub Release body not available");
  }

  const draft = buildDraft({ newVersion, dateStr, prevTag, commits, prevBody });
  fs.mkdirSync(path.dirname(noteAbsPath), { recursive: true });
  fs.writeFileSync(noteAbsPath, draft, "utf8");
  console.log(`release: wrote ${noteRelPath}`);

  insertReadmeEntry(newVersion, dateStr);
  console.log("release: inserted placeholder entry in README.md");

  updateReadmeFooter(newVersion, dateStr);

  console.log("");
  console.log("==============================================");
  console.log(`release: bump + draft generation complete for v${newVersion}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  1. Edit ${noteRelPath}: remove TODO placeholders and finalize the release note`);
  console.log("  2. Edit README.md: fill in the TODO entry in the changelog");
  console.log("  3. 操作に影響する変更なら help.md / docs/yaNote-OperationSpec.md も更新");
  console.log(`  4. Run: node scripts/release-publish.mjs ${newVersion}`);
  console.log("==============================================");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
