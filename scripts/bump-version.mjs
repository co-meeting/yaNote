#!/usr/bin/env node
// scripts/bump-version.mjs
//
// バージョン番号を yaNote 内 6 箇所で一括書き換えします。
// 詳細・運用ルールは RELEASE.md を参照。
//
// Usage:
//   node scripts/bump-version.mjs <new-version> [--dry-run]
//
// 例:
//   node scripts/bump-version.mjs 1.5
//   node scripts/bump-version.mjs 1.5.1 --dry-run
//   node scripts/bump-version.mjs 1.6-beta.1
//
// バージョンは "v" 付き（v1.5）でも無し（1.5）でも受け付けます。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

// 1.5 / 1.4.2 / 1.3.5.7 / 1.4-beta.5 のような表記を許容
export const VERSION_RE = /^\d+\.\d+(?:\.\d+)*(?:-[0-9A-Za-z][0-9A-Za-z.]*)?$/;
// 置換対象内でのバージョン部分のパターン（上と同じものの部分一致版）
const VER_PART = String.raw`\d+\.\d+(?:\.\d+)*(?:-[0-9A-Za-z][0-9A-Za-z.]*)?`;

export function normalizeVersion(input) {
  const v = input.startsWith("v") ? input.slice(1) : input;
  if (!VERSION_RE.test(v)) return null;
  return v;
}

function parseArgs(argv) {
  const args = { dryRun: false, version: null };
  for (const arg of argv) {
    if (arg === "--dry-run") {
      args.dryRun = true;
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

function fail(message) {
  console.error(`bump-version: ${message}`);
  process.exit(1);
}

/**
 * @typedef {Object} Replacement
 * @property {string} file
 * @property {RegExp} pattern  第2キャプチャが旧バージョン
 * @property {number} expectedCount
 * @property {string} label
 */

/** @type {(newVersion: string) => Replacement[]} */
const buildReplacements = () => [
  {
    file: "index.html",
    label: "index.html <title> の 'v...'",
    expectedCount: 1,
    pattern: new RegExp(String.raw`(<title>[^<]*\| v)(${VER_PART})(</title>)`),
  },
  {
    file: "index.html",
    label: "index.html copyright の 'yaNote v...'",
    expectedCount: 1,
    pattern: new RegExp(String.raw`(Takaaki Yano \| yaNote v)(${VER_PART})`),
  },
  {
    file: "app.js",
    label: 'app.js const VERSION',
    expectedCount: 1,
    pattern: new RegExp(String.raw`(const\s+VERSION\s*=\s*"v)(${VER_PART})(")`),
  },
  {
    file: "sw.js",
    label: "sw.js CACHE_NAME",
    expectedCount: 1,
    pattern: new RegExp(String.raw`(const\s+CACHE_NAME\s*=\s*"yaNote-cache-v)(${VER_PART})(")`),
  },
  {
    file: "index.json",
    label: 'index.json "version"',
    expectedCount: 1,
    pattern: new RegExp(String.raw`("version"\s*:\s*"v)(${VER_PART})(")`),
  },
  {
    file: "README.md",
    label: "README.md 先頭見出し '# yaNote v...'",
    expectedCount: 1,
    pattern: new RegExp(String.raw`(^# yaNote v)(${VER_PART})`, "m"),
  },
];

function applyReplacement(file, content, repl, newVersion) {
  const isGlobal = repl.pattern.flags.includes("g");
  const matches = [];

  const re = new RegExp(repl.pattern.source, repl.pattern.flags.includes("g") ? repl.pattern.flags : repl.pattern.flags + "g");
  let m;
  while ((m = re.exec(content)) !== null) {
    matches.push({ full: m[0], prev: m[2] });
    if (!isGlobal) break;
  }

  if (matches.length !== repl.expectedCount) {
    throw new Error(
      `[${repl.label}] expected ${repl.expectedCount} match(es) in ${file}, found ${matches.length}`
    );
  }

  // パターンによってキャプチャ数が 2 or 3 のため、p3 が offset（数値）の場合を除外する
  const updated = content.replace(
    repl.pattern,
    (_full, p1, _p2, p3) => `${p1}${newVersion}${typeof p3 === "string" ? p3 : ""}`
  );

  return { updated, matches };
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (e) {
    fail(e.message);
  }

  if (!parsed.version) {
    fail(
      "missing <new-version> argument\nUsage: node scripts/bump-version.mjs <new-version> [--dry-run]"
    );
  }
  const newVersion = normalizeVersion(parsed.version);
  if (!newVersion) {
    fail(
      `invalid version "${parsed.version}". Expected pattern like 1.5, 1.4.2 or 1.6-beta.1`
    );
  }

  const replacements = buildReplacements(newVersion);

  // ファイル単位にまとめる（同じファイルに複数 replacement があるため）
  const byFile = new Map();
  for (const repl of replacements) {
    const list = byFile.get(repl.file) ?? [];
    list.push(repl);
    byFile.set(repl.file, list);
  }

  const summary = [];

  for (const [relFile, repls] of byFile) {
    const absFile = path.join(REPO_ROOT, relFile);
    if (!fs.existsSync(absFile)) {
      fail(`file not found: ${relFile}`);
    }
    let content = fs.readFileSync(absFile, "utf8");
    const originalContent = content;
    const fileSummary = { file: relFile, items: [] };

    for (const repl of repls) {
      try {
        const { updated, matches } = applyReplacement(
          relFile,
          content,
          repl,
          newVersion
        );
        content = updated;
        fileSummary.items.push({
          label: repl.label,
          count: matches.length,
          previous: matches.map((m) => m.prev),
        });
      } catch (e) {
        fail(e.message);
      }
    }

    if (content !== originalContent) {
      if (!parsed.dryRun) {
        fs.writeFileSync(absFile, content, "utf8");
      }
      summary.push({ ...fileSummary, changed: true });
    } else {
      summary.push({ ...fileSummary, changed: false });
    }
  }

  const mode = parsed.dryRun ? "[dry-run]" : "[applied]";
  console.log(`${mode} bump to v${newVersion}\n`);
  for (const s of summary) {
    console.log(`- ${s.file}${s.changed ? "" : " (no change)"}`);
    for (const item of s.items) {
      const prevs = item.previous.join(", ");
      console.log(`    * ${item.label}: ${item.count} replacement(s) (was ${prevs})`);
    }
  }
  if (parsed.dryRun) {
    console.log("\nNo files were modified. Re-run without --dry-run to apply.");
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
