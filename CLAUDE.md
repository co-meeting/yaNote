# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

yaNote は、ブラウザ上で動作するジグザグ型ノートアプリ（PWA）。ビルドツール・パッケージマネージャー・テストフレームワークは一切使わない、素の HTML + CSS + JavaScript 構成。アプリ本体は `index.html`（HTML骨格）・`style.css`（スタイル）・`app.js`（アプリロジック）の3ファイル構成（v1.5 で分離）。

開発者（矢野）専用に最適化されたツールであり、全成果物は生成AIとの対話で作成・管理されている（詳細は [docs/yaNote-Manifesto.md](docs/yaNote-Manifesto.md) と [docs/yaNote_DevGuide.md](docs/yaNote_DevGuide.md)）。外部からの issue や機能要望への対応は行わない方針。

## 開発・動作確認

- ビルド不要。ローカルで確認するには静的サーバーで配信する（Service Worker のため `file://` では不完全）:
  ```
  python3 -m http.server 8000
  ```
  で http://localhost:8000 を開く。
- 自動テストは存在しない。動作確認はブラウザでの手動テスト。確認すべき操作は [docs/yaNote-OperationSpec.md](docs/yaNote-OperationSpec.md)（マウス/キーボード）と [yaNote_TouchOperationSpec.md](yaNote_TouchOperationSpec.md)（タッチ）に定義されている。
- デモは GitHub Pages（https://co-meeting.github.io/yaNote/）で公開。main へのコミット＝リリース。

## リリース手順

リリースはスクリプト化されている。手順の正本は `.claude/skills/yaNote-release/SKILL.md`（人間向け解説は [RELEASE.md](RELEASE.md)）。ユーザーが「リリース開始」等を明示したときだけ実施し、通常の修正セッションではバージョン関連ファイルに触らない。

1. `node scripts/release.mjs X.Y` — 6 箇所のバージョン一括更新（`index.html` の title/copyright、`app.js` の `VERSION`、`sw.js` の `CACHE_NAME`、`index.json`、`README.md` 先頭見出し）＋ `release-notes/vX.Y.md` 下書き生成 ＋ README 変更履歴プレースホルダ挿入
2. 下書き 2 ファイルの TODO を編集。操作に影響する変更の場合は `help.md`、`docs/yaNote-OperationSpec.md` も更新
3. ユーザー承認後に `node scripts/release-publish.mjs X.Y` — TODO 残存検証 → commit（`vX.Y（YYYY-MM-DD）` 形式）→ tag → push → GitHub Release 作成

`sw.js` の `CACHE_NAME` を変えないと PWA キャッシュが更新されない点に注意（スクリプトが自動更新する）。

## アーキテクチャ

アプリ本体は3ファイル:

- `index.html` — HTML骨格（コントロールパネル、キャンバス、SVGマーカー定義、共有モーダル等）。`<!-- ===== セクション名 ===== -->` コメントで区切られている
- `style.css` — 全スタイル。`/* ===== 共通CSS ===== */` 等のセクションコメント付き
- `app.js` — アプリロジック全体（約2800行）。全体が `DOMContentLoaded` リスナーでラップされ、`/* ===== N. セクション名 ===== */` コメントで区切られている:

1. **定数・グローバル設定** — `VERSION`、`DEBUG` フラグ、`Logger`（`Logger.log` は DEBUG=true のときのみ出力）
2. **ユーティリティ関数** — `Utils` 名前空間オブジェクト（幾何計算、URL共有用の圧縮など）
3. **タイトルフィールド設定**
4. **ノードクラス** — `class NoteNode`。ノードの DOM 要素・座標・種別（standard / dotted / grey / red）・イベントリスナーを保持。`NoteNode.nextId` で ID を静的管理
5. **接続線クラス** — SVG（`#svg`）に描画される接続線
6. **共有モーダルクラス** / **アプリ全体管理クラス** — `class YaNoteApp` が中核。`nodes`・`connections` の配列、選択状態、Undo/Redo スタック、`globalPan`/`globalZoom` を一元管理
7. **インスタンス生成** — `window.app = new YaNoteApp()`

その他のファイル:
- `sw.js` — Service Worker。コアアセットはキャッシュ優先、それ以外はネットワーク
- `index.json` — 初回起動時に読み込まれるファーストガイドのノートデータ（バージョン更新時はここの `version` も更新）
- データ永続化は localStorage 自動保存 ＋ JSON エクスポート/インポート ＋ URL 共有（圧縮パラメータ）

## コーディング規約

- 機能・クラスを追加するときは `/* ===== セクション名 ===== */` 形式のセクションコメントを付け、既存のセクション構造に沿った位置に配置する（CSS・HTML・JS いずれも）
- グローバルを増やさない。既存の名前空間オブジェクト（`Utils` など）やクラスに寄せる。意図されたグローバルは `window.app` のみ
- 設定値・定数は散らさず、`VERSION`・`DEBUG` と同じくコード冒頭の「定数・グローバル設定」セクションで一元管理する
- デバッグ出力は `console.log` 直書きではなく、DEBUG フラグで制御された `Logger.log` を使う

セキュリティ上の注意: ノードテキストの表示は任意 HTML が実行されない安全な処理に統一されている（v1.4.1 で対応済み）。表示処理を変更する際は `innerHTML` への生テキスト代入を避けること。

## ドキュメント

ソースコード以外のドキュメントはすべて Markdown で、既存の文体・粒度に合わせて日本語で記述する。機能変更時は仕様書（`docs/yaNote-OperationSpec.md`）、`help.md`、`README.md` の整合性を保つこと。
