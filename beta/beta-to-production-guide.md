# yaNote ベータ版から本番環境への反映ガイド

このガイドでは、yaNote ベータ環境で開発・テストした変更を本番環境に適用する詳細な手順を説明します。

## 1. 準備作業

### 1.1 前提条件の確認

- ベータ環境での機能が十分にテストされていること
- 既知の問題がすべて解決していること
- リポジトリの作業コピーが最新であること

### 1.2 バージョン番号の決定

- ベータ版の `vX.X.X-beta.X` から、本番リリース用の `vX.X.X` に変更
- 例: `v1.3.6-beta.2` → `v1.3.6`

### 1.3 バックアップの作成

- 念のため、現在の本番環境のファイルをバックアップしておく

## 2. 変更の適用

### 2.1 index.html の変更

1. **ベータバナーの削除**
   ```html
   <!-- 削除: ベータバナー -->
   <div id="beta-banner">
     yaNote Beta版 - テスト版のため、データのバックアップを忘れずに行ってください
     <span class="close-button" onclick="this.parentNode.style.display='none'">×</span>
   </div>
   ```

2. **ベータバナー用のスタイルを削除**
   ```css
   /* 削除: ベータバナー用スタイル */
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

3. **コントロールパネルボタンの色を本番環境用に戻す**
   ```css
   /* 変更前（ベータ版） */
   #controlPanel button {
     background: #ffe0b2; /* 明るいオレンジ/ピーチ色 */
   }
   
   /* 変更後（本番環境） */
   #controlPanel button {
     background: #ddd; /* 薄いグレー色 */
   }
   ```

4. **タイトルタグの変更**
   ```html
   <title>yaNote - ブラウザ上で動作するジグザグ型ノートアプリ | vX.X.X</title>
   ```

5. **meta description の変更**
   ```html
   <meta name="description" content="yaNoteはブラウザ上で直感的にアイデアを整理できるジグザグ型ノートアプリです。思考の整理や選択肢の検討に最適なシンプルで高速なUI、PWA対応でオフラインでも使用可能です。">
   ```

6. **バージョン定数の変更**
   ```javascript
   // 変更前
   const VERSION = "vX.X.X-beta.X";
   
   // 変更後
   const VERSION = "vX.X.X";
   ```

7. **ローカルストレージキーの変更**
   - すべて検索して置換する
   - `yaNoteData-beta` → `yaNoteData`
   - `skipGuideLoad-beta` → `skipGuideLoad`
   - `yaNote-beta-currentVersion` → `yaNote-currentVersion`
   - `yaNote-beta-jsonReloaded` → `yaNote-jsonReloaded` (セッションストレージ)

8. **コピーライト表示の更新**
   ```html
   <!-- 変更前 -->
   <div id="copyright">
     © 2025 Takaaki Yano | yaNote Beta vX.X.X-beta.X
   </div>
   
   <!-- 変更後 -->
   <div id="copyright">
     © 2025 Takaaki Yano | yaNote vX.X.X
   </div>
   ```

### 2.2 manifest.json の変更

```json
{
  "name": "yaNote",
  "short_name": "yaNote",
  "description": "ブラウザ上で動作するジグザグ型ノートアプリ",
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

### 2.3 sw.js の変更

```javascript
// 変更前
const CACHE_NAME = "yaNote-beta-cache-vX.X.X-beta.X";

// 変更後
const CACHE_NAME = "yaNote-cache-vX.X.X";
```

### 2.4 その他の変更

実装した機能に応じて、ベータ環境で追加・変更したコードを本番環境に反映します。新たなファイルを追加した場合は、それらも本番ディレクトリにコピーしてください。

## 3. ドキュメントの更新

### 3.1 README.md の更新

1. 新バージョンの機能追加・変更点を記載
2. 既知の問題点があれば記載
3. バージョン番号と更新日を更新

### 3.2 help.md の更新

1. 新機能に関する使い方の説明を追加
2. スクリーンショットなどがあれば更新

### 3.3 docs/yaNote-OperationSpec.md の更新

1. 新機能に関する仕様を追加
2. 変更された操作方法を更新
3. バージョン番号と更新日を更新

## 4. リリース作業

### 4.1 動作確認

変更を適用した後、以下の項目を必ず確認します：

1. 基本機能の動作確認
   - ノードの作成・編集・削除
   - 接続線の作成・編集・削除
   - 保存と読み込み
   - ショートカットキー

2. 新機能のテスト
   - 実装した新機能の動作確認
   - エッジケースの検証

3. 異なるブラウザでの確認
   - Chrome
   - Firefox
   - Safari
   - Edge
   - モバイルブラウザ

4. PWA関連
   - インストール動作
   - キャッシュの更新
   - オフライン動作

5. 視覚的要素の確認
   - コントロールパネルボタンの色が正しく本番環境用（#ddd）に変更されているか
   - ベータバナーが完全に削除されているか
   - アプリ名とバージョン表示がベータ表記なしになっているか

### 4.2 Git操作

1. 変更をコミット
   ```
   git add .
   git commit -m "Release vX.X.X: 機能追加と改善"
   ```

2. リポジトリにプッシュ
   ```
   git push origin main
   ```

### 4.3 リリースノートの作成

1. GitHub リポジトリの Releases ページで新しいリリースを作成
2. タグ名: `vX.X.X`
3. リリースタイトル: `yaNote vX.X.X リリース`
4. リリースノートに以下を記載:
   - 追加された機能
   - 改善された点
   - 修正されたバグ
   - 既知の問題点
   - クレジット・謝辞（必要に応じて）

## 5. リリース後の作業

### 5.1 モニタリング

リリース後、数日間は以下の項目を監視します：

1. 予期しないエラーや問題の発生
2. ユーザーからのフィードバック
3. PWAの更新状況

### 5.2 ベータ環境の更新

次の開発サイクルのために、ベータ環境を更新します：

1. 本番環境のコードをベータディレクトリにコピー
2. ベータ版特有の設定を再適用:
   - バージョン番号を次期バージョンのベータに更新（例: `v1.3.7-beta.1`）
   - ベータバナーの再追加
   - コントロールパネルボタンの色をベータ版用（#ffe0b2）に変更
   - ローカルストレージキーの -beta 接尾辞付与
   - その他ベータ版特有の設定の再適用

3. 次期開発計画の策定

## 6. トラブルシューティング

### 6.1 リリース後に問題が発見された場合

1. 問題の重大度を評価
2. 緊急修正が必要な場合:
   - 修正をベータ環境で確認
   - ホットフィックスとして本番環境に適用
   - マイナーバージョンアップ（例: `v1.3.6` → `v1.3.6.1`）

### 6.2 PWA更新の問題

PWAの更新が適用されない場合:

1. Service Workerのキャッシュ名が正しく更新されているか確認
2. ユーザーにブラウザのキャッシュクリアを依頼

## 7. チェックリスト

以下は、本番反映前の最終チェックリストです：

- [ ] ベータ環境で十分なテストが完了している
- [ ] バージョン番号の更新（ベータ接尾辞の削除）
- [ ] ベータ特有の要素（バナー、スタイル）の削除
- [ ] コントロールパネルボタンの色を本番環境用に変更
- [ ] ローカルストレージキーの変更
- [ ] manifest.json の更新
- [ ] sw.js のキャッシュ名更新
- [ ] ドキュメントの更新（README.md, help.md, OperationSpec.md）
- [ ] 本番環境での動作確認
- [ ] リリースノートの作成
- [ ] ベータ環境の次期バージョン準備

このガイドに従うことで、ベータ環境から本番環境への移行を安全かつ効率的に行うことができます。