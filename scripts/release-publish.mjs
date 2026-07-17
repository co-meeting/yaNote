#!/usr/bin/env node
// scripts/release-publish.mjs
//
// リリース作業の後半（commit / tag / push / GitHub Release 公開）を実行します。
// 前半は scripts/release.mjs を実行済みで、release-notes/vX.Y.md と README.md
// の TODO プレースホルダを編集し終えている必要があります。
//
// Usage:
//   node scripts/release-publish.mjs [new-version] [--remote origin] [--branch main] [--yes]
//
// 引数 new-version を省略した場合は app.js の const VERSION を採用します。
//
// 動作:
//   1. release-notes/vX.Y.md が存在し、TODO プレースホルダが残っていないことを確認
//   2. app.js の VERSION が vX.Y と一致することを確認
//   3. README.md の変更履歴に vX.Y エントリが入っており TODO が残っていないことを確認
//   4. git add -A && git commit -m "vX.Y（YYYY-MM-DD）" && git tag vX.Y
//   5. git push <remote> <branch> --follow-tags
//   6. gh release create vX.Y --title "vX.Y（YYYY-MM-DD）" -F release-notes/vX.Y.md
//
// コミットメッセージ・Release タイトルは既存の運用（例: v1.4.2（2026-03-13））に合わせて
// 「vX.Y（YYYY-MM-DD）」（全角括弧）で統一しています。

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

import { normalizeVersion } from "./bump-version.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

function fail(message) {
  console.error(`release-publish: ${message}`);
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
  const args = { version: null, remote: "origin", branch: null, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--remote") {
      args.remote = argv[++i];
    } else if (a === "--branch") {
      args.branch = argv[++i];
    } else if (a === "--yes" || a === "-y") {
      args.yes = true;
    } else if (a.startsWith("--")) {
      throw new Error(`Unknown option: ${a}`);
    } else if (!args.version) {
      args.version = a;
    } else {
      throw new Error(`Unexpected positional argument: ${a}`);
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

function getCurrentBranch() {
  const r = tryRun("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!r.ok) fail("could not detect current git branch");
  return r.stdout.trim();
}

function readAppVersion() {
  const content = fs.readFileSync(path.join(REPO_ROOT, "app.js"), "utf8");
  const m = content.match(/const\s+VERSION\s*=\s*"v([^"]+)"/);
  if (!m) fail("app.js に const VERSION = \"vX.Y\" が見つかりません");
  return m[1];
}

function checkReleaseNote(version) {
  const rel = `release-notes/v${version}.md`;
  const abs = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(abs)) {
    fail(`${rel} not found. Run 'node scripts/release.mjs ${version}' first.`);
  }
  const body = fs.readFileSync(abs, "utf8");
  if (/TODO/.test(body)) {
    fail(
      `${rel} still contains TODO placeholder(s). Edit the file and remove them before publishing.`
    );
  }
  if (/<!--[\s\S]*?\[下書き元\][\s\S]*?-->/.test(body)) {
    console.warn(
      `release-publish: warning - ${rel} still contains the '[下書き元]' comment block. It will be published as-is (HTML comments are normally hidden on GitHub).`
    );
  }
  return body;
}

function checkReadme(version) {
  const abs = path.join(REPO_ROOT, "README.md");
  const content = fs.readFileSync(abs, "utf8");
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const entryRe = new RegExp(`^## (改善|新機能) \\(v${escaped}[ )/]`, "m");
  if (!entryRe.test(content)) {
    fail(
      `README.md に '## 改善 (v${version} / YYYY-MM-DD)' 形式のエントリが見つかりません。`
    );
  }
  // エントリ本文の TODO 残存チェック（次の "## " 見出しまで）
  const startIdx = content.search(entryRe);
  const tail = content.slice(startIdx);
  const nextHeadingIdx = tail.slice(1).search(/^## /m);
  const section = nextHeadingIdx === -1 ? tail : tail.slice(0, nextHeadingIdx + 1);
  if (/TODO/.test(section)) {
    fail(`README.md の v${version} エントリに TODO が残っています。編集してから再実行してください。`);
  }
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    let answered = false;
    rl.question(question, (answer) => {
      answered = true;
      rl.close();
      resolve(answer);
    });
    // stdin が閉じられた（非対話実行等）場合は「N」扱いで中断する
    rl.on("close", () => {
      if (!answered) resolve("n");
    });
  });
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (e) {
    fail(e.message);
  }
  const appVersion = readAppVersion();
  if (!parsed.version) {
    parsed.version = appVersion;
    console.log(`release-publish: version not specified, using app.js VERSION "v${appVersion}"`);
  }
  const version = normalizeVersion(parsed.version);
  if (!version) {
    fail(`invalid version "${parsed.version}".`);
  }

  const tag = `v${version}`;
  const dateStr = todayISO();
  const branch = parsed.branch ?? getCurrentBranch();
  const remote = parsed.remote;

  if (appVersion !== version) {
    fail(
      `app.js VERSION is "v${appVersion}" but you asked to publish "v${version}". Run 'node scripts/release.mjs ${version}' first.`
    );
  }

  const tagExists = tryRun("git", ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`]).ok;
  if (tagExists) {
    fail(`tag ${tag} already exists locally`);
  }

  checkReleaseNote(version);
  checkReadme(version);

  // 既存の運用に合わせた「vX.Y（YYYY-MM-DD）」形式（全角括弧）
  const commitSubject = `${tag}（${dateStr}）`;
  const titleArg = commitSubject;
  const noteRel = `release-notes/v${version}.md`;

  console.log(`release-publish: branch=${branch} remote=${remote}`);
  console.log(`release-publish: tag=${tag}`);
  console.log(`release-publish: commit subject = "${commitSubject}"`);
  console.log(`release-publish: release title  = "${titleArg}"`);

  if (!parsed.yes) {
    const ans = await prompt("\nProceed with git commit / tag / push / gh release create? [y/N] ");
    if (!/^y(es)?$/i.test(ans.trim())) {
      console.log("release-publish: aborted by user");
      process.exit(1);
    }
  }

  console.log("\nrelease-publish: git add -A");
  runInherit("git", ["add", "-A"]);

  console.log(`release-publish: git commit -m "${commitSubject}"`);
  runInherit("git", ["commit", "-m", commitSubject]);

  console.log(`release-publish: git tag ${tag}`);
  runInherit("git", ["tag", tag]);

  console.log(`release-publish: git push ${remote} ${branch} --follow-tags`);
  runInherit("git", ["push", remote, branch, "--follow-tags"]);

  console.log(`release-publish: gh release create ${tag}`);
  runInherit("gh", [
    "release",
    "create",
    tag,
    "--title",
    titleArg,
    "-F",
    noteRel,
  ]);

  console.log("");
  console.log("==============================================");
  console.log(`release-publish: ${tag} published`);
  console.log("==============================================");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
