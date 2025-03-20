# yaNote ベータ版運用ガイド

このガイドでは、yaNote ベータ環境の設定、運用、管理方法について説明します。

## 1. ベータ環境の目的

- 本番環境に影響を与えずに新機能や変更をテストする
- 開発中の機能を早期に試用できる環境を提供する
- リリース前の最終確認を行う

## 2. ベータ環境のセットアップ

### 2.1 ディレクトリ構造

リポジトリのルートに `beta` ディレクトリを作成し、以下のファイルを配置します：

```
beta/
├── index.html        (ベータ表示に変更済み)
├── manifest.json     (名前を変更)
├── sw.js             (キャッシュ名を変更)
├── icons/
│   ├── icon-192x192.png
│   └── icon-512x512.png
├── index.json        (ガイド表示用)
└── README.md         (ベータ版の説明)
```

### 2.2 ファイルの準備

1. 本番環境のファイルを `beta` ディレクトリにコピー
2. 以下の変更を加える

#### index.html の変更

- タイトルタグの変更:
  ```html
  <title>yaNote Beta - ブラウザ上で動作するジグザグ型ノートアプリ | vX.X.X-beta.X</title>
  ```

- meta タグの description 変更:
  ```html
  <meta name="description" content="yaNote ベータ版 - ブラウザ上で直感的にアイデアを整理できるジグザグ型ノートアプリです。">
  ```

- ベータ版バナーの追加 (body タグの直後に配置):
  ```html
  <div id="beta-banner">
    yaNote Beta版 - テスト版のため、データのバックアップを忘れずに行ってください
    <span class="close-button" onclick="this.parentNode.style.display='none'">×</span>
  </div>
  ```

- ベータバナー用のスタイル (head 内の style タグ内に追加):
  ```css
  #beta-banner {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    background-color: #ffcc00;
    color: #333;
    text-align: center;
    padding: 8px;
    font-size: 14px;
    z-index: 30001;
  }
  .close-button {
    margin-left: 10px;
    cursor: pointer;
    font-weight: bold;
  }
  ```

- コントロールパネルボタンの色変更 (head 内の style タグ内で該当部分を変更):
  ```css
  #controlPanel button {
    padding: 5px 10px;
    cursor: pointer;
    background: #ffe0b2; /* ベータ版は明るいオレンジ/ピーチ色 */
    border: none;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  ```

- バージョン定数の変更:
  ```javascript
  const VERSION = "vX.X.X-beta.X"; // 実際のベータバージョン番号に変更
  ```

- ローカルストレージのキー変更（すべて検索して変更）:
  - `yaNoteData` → `yaNoteData-beta`
  - `skipGuideLoad` → `skipGuideLoad-beta`
  - `yaNote-currentVersion` → `yaNote-beta-currentVersion`
  - `yaNote-jsonReloaded` → `yaNote-beta-jsonReloaded` (セッションストレージ)

- コピーライト表示の更新:
  ```html
  <div id="copyright">
    © 2025 Takaaki Yano | yaNote Beta vX.X.X-beta.X
  </div>
  ```

#### manifest.json の変更

```json
{
  "name": "yaNote Beta",
  "short_name": "yaNote Beta",
  "description": "ブラウザ上で動作するジグザグ型ノートアプリ（ベータ版）",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "icons": [
    {
      "src": "icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

#### sw.js の変更

```javascript
const CACHE_NAME = "yaNote-beta-cache-vX.X.X-beta.X"; // ベータ版のキャッシュ名
```

## 3. ベータ版の命名規則

### 3.1 バージョン番号

- 本番リリース予定のバージョンに `-beta.X` を付ける
  - 例: 次回本番リリースが `v1.3.6` の場合、ベータ版は `v1.3.6-beta.1` から開始
  - 大きな変更や修正があるたびに末尾の数字をインクリメント（`beta.2`, `beta.3`, ...）

### 3.2 コミットメッセージ

- ベータ版の変更を示すプレフィックスを付ける
  - 例: `[BETA] 新機能Aの実装` や `[beta] バグ修正`

## 4. ベータ版の更新サイクル

### 4.1 初期セットアップ（最初のみ）

1. 本番版のコードをベータディレクトリにコピー
2. 上記の変更を適用
3. GitHub Pagesでデプロイ確認

### 4.2 開発サイクル

1. 新機能や変更をベータ環境で実装
2. テストと修正を繰り返す
3. バージョン番号を更新（例: `beta.1` → `beta.2`）
4. 十分なテストが完了したら本番環境への反映準備

### 4.3 本番リリース後

1. 本番環境のコードを再度ベータディレクトリにコピー
2. ベータ版特有の設定を再適用
3. 次の開発サイクルのバージョン番号を設定（例: `v1.3.7-beta.1`）

## 5. ベータ版の視覚的な区別

ベータ版と本番環境は以下の視覚的要素で明確に区別されています：

### 5.1 ベータバナー

画面上部に表示される黄色いバナーにより、ユーザーに対して現在ベータ版を使用していることを明示します。

### 5.2 コントロールパネルの色

- **本番環境**: 薄いグレー色のボタン (`#ddd`)
- **ベータ版**: 明るいオレンジ/ピーチ色のボタン (`#ffe0b2`)

この色分けにより、開発者とテスターは一目で現在使用している環境を判別できます。

### 5.3 アプリ名とバージョン表示

- ブラウザタブ、PWAインストール時の名前に「Beta」が付与されます
- 画面左下のコピーライト表示にもベータバージョンが明記されます

## 6. テスト項目

ベータ版で必ず確認すべき項目：

- 基本機能の動作検証
  - ノードの作成・編集・削除
  - 接続線の作成・編集・削除
  - 保存とロード
  - その他の既存機能

- 新機能のテスト
  - 実装した新機能の動作確認
  - エッジケースの検証

- PWA関連
  - インストール動作
  - キャッシュの更新
  - オフライン動作

- デバイス互換性
  - PCブラウザ（Chrome, Firefox, Safari, Edge）
  - モバイルブラウザ（iOS Safari, Android Chrome）
  - タブレット

## 7. 注意事項

- ベータ版と本番版のデータは互いに影響しません（異なるストレージキーを使用）
- ベータ版は未完成の機能を含む可能性があるため、重要なデータの編集には使用しないことを推奨
- 本番リリース前に、ベータ版で発見した問題点をすべて修正すること

## 8. 開発フロー

1. 機能追加や改善のアイデアをリストアップ
2. 優先順位を決めて実装計画を立てる
3. ベータ環境で実装とテストを行う
4. フィードバックを収集し修正する
5. 本番環境にリリースする
6. 次の開発サイクルを開始

このガイドに従うことで、ベータ環境と本番環境を効率的に管理し、品質の高いリリースを実現できます。