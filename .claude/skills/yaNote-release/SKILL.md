---
name: yaNote-release
description: >-
  yaNote の新バージョンをリリースする手順を実行します。
  使用タイミング: ユーザーが日本語で「yaNote リリース開始」「リリース v1.5」
  「リリースする」等の意図を明示したとき。バージョン X.Y は対話で確認してから進める。
  通常の修正セッションではこの Skill を起動しないこと。
metadata:
  short-description: yaNote のリリースを段階的に実行する正本手順
---

# yaNote Release

このスキルは yaNote の新バージョンをリリースする際の正本手順です。
人間向けの解説は RELEASE.md にあります。ユーザー承認なしに `release-publish.mjs` まで進めないこと。

yaNote は main へのコミット＝リリース（GitHub Pages で即公開）。ビルド・npm install は不要で、スクリプトは `node` で直接実行する。

## 0. 起動前チェック

1. ユーザーに「現在のセッションは修正ではなくリリースですか？」を確認する。
2. 新バージョン番号 `X.Y`（例: `1.5`、`1.4.2`、`1.6-beta.1`）をユーザーから取得する。
3. 現在のブランチを確認する（通常は `main`）。push 先が意図通りか確認する。
4. `git status` で作業ツリーの状態を確認する。未コミットの変更がある場合、それを今回のリリースに含めるかユーザーに確認する（publish 時の `git add -A` で全部リリースコミットに入る）。
5. `gh auth status` で `co-meeting/yaNote` に認証済みか確認する。

## 1. 前半: bump + 下書き生成

```
node scripts/release.mjs X.Y
```

未コミットの変更をリリースに含める場合は `--allow-dirty` を付ける。

これにより以下が自動で実行される:

- `index.html`（title / copyright）、`app.js`（VERSION）、`sw.js`（CACHE_NAME）、`index.json`、`README.md` 先頭見出しの 6 箇所のバージョン更新
- `release-notes/vX.Y.md` にリリースノート下書きを生成
  - 前回タグ以降のコミットログ
  - 前回 GitHub Release 本文（`gh release view` で取得）
- `README.md` の変更履歴の先頭にプレースホルダエントリ `## 改善 (vX.Y / YYYY-MM-DD)` を挿入

## 2. 下書きの編集（AI が下書きを補助）

`release-notes/vX.Y.md` の TODO プレースホルダを編集する。

- 末尾の `[下書き元]` セクション（HTML コメント）にある「前回タグ以降のコミット」と「前回 GitHub Release 本文」を参照しながら、本文を書き起こす
- 構成は前回リリース本文（例: v1.4.2）を雛形にする:
  - `## 概要`（一文で要約）
  - `## 主な変更点`（`### 見出し` ＋ 箇条書き）
  - `## 互換性`（破壊的変更の有無、既存ノートデータ JSON との互換性）
  - `## ドキュメント更新`（無ければセクションごと削除）
- 編集が終わったら冒頭の TODO コメント `<!-- TODO: ... -->` を**削除**する
- 末尾の `[下書き元]` HTML コメントも削除する（残しても publish では警告のみ）

次に `README.md` の TODO エントリを編集する:

- `- TODO: ...` を実際の箇条書きに置き換える（既存エントリの文体・粒度に合わせる）
- 新機能中心のリリースなら見出しを `## 新機能 (vX.Y / YYYY-MM-DD)` に変えてよい
- 「TODO」の文字列を**残さない**（publish 時に検出され失敗する）

操作に影響する変更がある場合は `help.md`、`docs/yaNote-OperationSpec.md` もここで更新する。

## 3. ユーザーへの最終確認

publish 前に必ずユーザーに次を確認する:

- `release-notes/vX.Y.md` の内容で問題ないか
- `README.md` の変更履歴エントリで問題ないか
- 今 push してリリースを公開してよいか（main への push ＝ GitHub Pages 即公開）

## 4. 後半: 公開

```
node scripts/release-publish.mjs X.Y
```

スクリプトが自動で以下を実行する:

1. `release-notes/vX.Y.md` と `README.md` の TODO 残存を再チェック
2. `app.js` の `VERSION` が `vX.Y` と一致するか確認
3. `git add -A` / `git commit -m "vX.Y（YYYY-MM-DD）"` / `git tag vX.Y`
4. `git push origin <branch> --follow-tags`
5. `gh release create vX.Y --title "vX.Y（YYYY-MM-DD）" -F release-notes/vX.Y.md`

コミットメッセージ・Release タイトルは既存の運用（例: `v1.4.2（2026-03-13）`、全角括弧）に自動で揃う。
途中で確認プロンプトが出るので、`y` を入力して進める（`--yes` で省略可能だが、Skill からは原則使わない）。

## 5. 公開後の反映確認（必須）

push 成功＝デモ公開ではない。GitHub Pages のビルドが自動発火しないことがある（v1.6 で実際に発生。丸一日 v1.5 のまま配信されていた）。publish 後は必ず以下でデモへの反映を確認する:

```
curl -s https://co-meeting.github.io/yaNote/app.js | grep -o 'VERSION = "[^"]*"'
```

`vX.Y` になるまで確認する（通常は push から1〜2分）。5分待っても古いバージョンのままの場合:

1. ビルド状況を確認: `gh api repos/co-meeting/yaNote/pages/builds/latest --jq '{status, commit, error: .error.message}'`
2. ビルド対象の commit がリリースコミットより古い場合、手動でビルドをリクエスト: `gh api -X POST repos/co-meeting/yaNote/pages/builds`
3. 再度 curl で `VERSION` が `vX.Y` になるまで確認し、ユーザーに反映完了を報告する

## ロールバック

- publish 前: `node scripts/bump-version.mjs <前のバージョン>` で番号を戻し、`rm release-notes/vX.Y.md`、README のプレースホルダエントリを手で削除
- publish 後（push 前にエラーで止まった場合）: `git reset --hard HEAD~1 && git tag -d vX.Y`（未コミット作業を含むリリースだった場合は reset --hard は使わず個別に戻す）
- push 済み: `git push --delete origin vX.Y` でタグ削除、`gh release delete vX.Y` で Release 削除、`git revert <commit>` で版を戻す

## 重要な禁止事項

- 通常の修正セッションでバージョン関連ファイル（6 箇所）やリリースノートを編集しない
- ユーザー承認なしに `node scripts/release-publish.mjs` を実行しない
- 公開デモ（GitHub Pages）が即時更新されることを忘れない
