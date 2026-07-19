# リリース運用ガイド

このドキュメントは yaNote の人間向けリリース手順書です。AI（Claude Code 等）による実行手順は [`.claude/skills/yaNote-release/SKILL.md`](.claude/skills/yaNote-release/SKILL.md) を参照してください。

yaNote は main へのコミット＝リリース（GitHub Pages で即公開）です。リリース作業は明示的に「リリース開始」と宣言してから、この手順で実施します。通常の修正作業ではバージョン番号やリリースノートに触らないでください。

## 前提

- `node` が使えること（スクリプト実行のためだけに使用。npm install は不要）
- `gh` CLI がインストール済みで `co-meeting/yaNote` に認証済み（`gh auth status` で確認）
- リリースに含めたい変更がローカルに揃っていること（コミット済みでも未コミットでもよい。未コミットの場合は手順1で `--allow-dirty` を付ける）

## 3 ステップ標準手順

### 1. 下書き生成（bump + 下書き）

```bash
node scripts/release.mjs 1.5
```

バージョンは `1.5` / `v1.5` / `1.4.2` / `1.6-beta.1` いずれの表記でも可。未コミットの変更をリリースに含める場合:

```bash
node scripts/release.mjs 1.5 --allow-dirty
```

このコマンドが自動で行うこと:

- 6 箇所のバージョンを一括書き換え
  - `index.html` の `<title>` と copyright 表示
  - `app.js` の `const VERSION`
  - `sw.js` の `CACHE_NAME`（これを変えないと PWA キャッシュが更新されない）
  - `index.json` の `"version"`
  - `README.md` の先頭見出し `# yaNote vX.Y`
- 前回タグから HEAD までのコミットログを収集
- 前回 GitHub Release 本文を取得（`gh release view`）
- `release-notes/vX.Y.md` に下書きを書き出す（前回本文とコミットログがコメントブロックで参考データとして同梱）
- `README.md` の変更履歴の先頭にプレースホルダ `## 改善 (vX.Y / YYYY-MM-DD)` を挿入

書き換え対象だけ確認したい場合:

```bash
node scripts/bump-version.mjs 1.5 --dry-run
```

### 2. 下書きを編集

以下 2 ファイルの `TODO` を埋めてください（`TODO` が残っていると手順3で止まります）。

- `release-notes/vX.Y.md`（公開リリースノート。構成は過去リリースに倣う: 概要 / 主な変更点 / 互換性 / ドキュメント更新）
- `README.md` の新しい `## 改善 (vX.Y / …)` エントリ（新機能中心なら見出しを `## 新機能` に変えてよい）

書き終えたら、`release-notes/vX.Y.md` 末尾の `<!-- 下書き元データ … -->` コメントブロックを削除します。

操作に影響する変更がある場合は `help.md`、`docs/yaNote-OperationSpec.md` もこの段階で更新します。

### 3. 公開

```bash
node scripts/release-publish.mjs 1.5
```

このコマンドが自動で行うこと:

1. `release-notes/vX.Y.md` と `README.md` の新エントリに `TODO` が残っていないか検証
2. `app.js` の `VERSION` が `vX.Y` と一致するか検証
3. `git add -A`
4. `git commit -m "vX.Y（YYYY-MM-DD）"`（既存のコミット形式に準拠、全角括弧）
5. `git tag vX.Y`
6. `git push origin <branch> --follow-tags`
7. `gh release create vX.Y --title "vX.Y（YYYY-MM-DD）" -F release-notes/vX.Y.md`

実行前に確認プロンプトが出ます。main への push と同時に GitHub Pages のデモも更新されます。

### 4. 公開後の反映確認

push 成功＝デモ公開ではありません。GitHub Pages のビルドが自動発火しないことがあるため（v1.6 で発生）、publish 後は必ずデモの反映を確認します:

```bash
curl -s https://co-meeting.github.io/yaNote/app.js | grep -o 'VERSION = "[^"]*"'
```

5分待っても古いバージョンのままの場合は、ビルド状況を確認して手動でビルドをリクエストします:

```bash
gh api repos/co-meeting/yaNote/pages/builds/latest --jq '{status, commit, error: .error.message}'
gh api -X POST repos/co-meeting/yaNote/pages/builds
```

## ロールバック

### publish 前

```bash
git checkout -- .          # コミット済み変更しかない場合のみ（未コミットの作業があるときは個別に戻す）
rm release-notes/vX.Y.md
```

未コミットの機能変更と混在している場合は `node scripts/bump-version.mjs <前のバージョン>` で番号だけ戻し、README のプレースホルダエントリを手で削除するのが安全です。

### push 後にタグ・Release を取り消したい

```bash
gh release delete vX.Y
git push --delete origin vX.Y
git tag -d vX.Y
```

ファイルのリバートは、リリースコミットに対する `git revert <SHA>` で戻してください。

## トラブルシュート

- **`gh release view` が失敗する**: タグ名がリモートに無い場合や `gh auth` 未認証時。`release.mjs` は前回 Release が無くても下書きは作成します（参考データが空になる）。
- **README.md に変更履歴エントリが見つからない**: `release.mjs` は `## 改善 (…)` / `## 新機能 (…)` 形式の見出しを目印に挿入します。形式を変えた場合はエラーで止まるので README を直すか `scripts/release.mjs` の `insertReadmeEntry` を更新してください。
- **置換数が想定と合わない**: `bump-version.mjs` は期待件数と実件数が異なれば即エラー終了します。バージョン表記をどこかに追加・削除した場合は `scripts/bump-version.mjs` の `buildReplacements` を更新してください。
