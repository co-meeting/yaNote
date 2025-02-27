# yaNote

**yaNote** は、ブラウザ上で動作するジグザグ型ノートアプリです。  
ノード（メモ）を作成し、それらを自由に接続することで、情報を視覚的に整理できます。

📌 **[デモページ（GitHub Pages）](https://co-meeting.github.io/yaNote/)**  
👉 **ブラウザで今すぐ試せます！**  

📖 **[ヘルプページ](help.md)**  
👉 **使い方の詳細はこちら！**  

---

## 🚀 アップデート情報 (v1.2.5)

### 主な変更点
- **太字機能の追加**
  - コントロールパネルに「B」ボタンを追加
  - 選択中のノードのテキストを太字にできるようになりました
  - 複数ノード選択時に一括して太字設定が可能
- **視覚的フィードバックの強化**
  - ノード種類と線種の現在の設定状態を視覚的に確認可能に
  - 各ボタンにツールチップを追加
  - 選択中の要素に応じてボタンの表示が動的に変わるように改善
- **UI/UXの改善**
  - コントロールパネルのボタンデザインを統一
  - 線種変更ボタンが現在の線種を示すアイコン（→, —, ←, ↔）に変化
  - 選択がなくても線種やノード種類を変更できるように

### 詳細な更新内容
- **太字機能**
  - 選択中のノードだけに適用される機能
  - 複数ノード選択時は一括適用
  - 「B」ボタンのアクティブ状態で現在の設定が確認可能

- **視覚的フィードバック**
  - ボタンにマウスを合わせると現在の設定を説明するツールチップが表示
  - 標準ノードが選択されている場合はボタンが青色にハイライト
  - 選択状態がなくてもデフォルト設定を変更可能に

---

## 📌 機能比較

| 機能 | v1.2.4 | v1.2.5 |
|------|------|------|
| テキスト書式 | 標準のみ | **太字機能を追加** 🆕 |
| UI フィードバック | 限定的 | **ツールチップと状態表示** 🆕 |
| 線種表示 | テキスト | **視覚的なアイコン表示** 🆕 |
| デフォルト設定変更 | 選択必須 | **選択なしでも変更可能** 🆕 |
| ボタンデザイン | 不統一 | **統一されたデザイン** 🆕 |

---

## 📌 主な機能

### 📝 ノードの作成・編集
- **ダブルクリックでノードを作成**
- **Enterキー2回押下で編集完了**
- **ドラッグでノードを移動可能**
- **ノードの種類を切り替え可能（標準 / テキストのみ）**
- **太字機能で重要ポイントを強調** 🆕

### 📍 ノードの接続
- **ドラッグ＆ドロップでノード同士を接続**
- **未接続の線を自由に移動可能**
- **接続線の端点をドラッグして再接続可能**
- **線種を切り替え可能（4種類から選択）**
- **視覚的なアイコンで現在の線種を確認** 🆕

### 🎯 選択と削除
- **クリックで選択**
- **Shift + クリックで複数選択**
- **Delete / Backspace で削除**
- **ラバーバンド選択対応（ドラッグで範囲選択）**
- **複数選択したノードに一括書式設定** 🆕

### 🔄 Undo / Redo
- **Ctrl + Z / Cmd + Z** → 元に戻す
- **Ctrl + Y / Cmd + Y** → やり直し

### 🔀 エクスポート・インポート機能
- **ノードと接続情報を JSON 形式でエクスポート**
- **ノードの種類、線種、太字設定もエクスポート時に保存** 🆕
- **エクスポート時にファイル名に日付を含める**
- **エクスポートしたデータをインポート可能**
- **古いバージョンのデータを自動マイグレーション**
- **ローカルストレージにも自動保存**
- **複数タブ間のデータ同期対応**

### 🛠 コントロールパネル
- **「太字」ボタン** 🆕
- **「ノード種類変更」ボタン（デザイン改善）** 🆕
- **「線種変更」ボタン（動的アイコン表示）** 🆕
- **「初期状態に戻す」ボタン**
- **「エクスポート」ボタン**
- **「インポート」ボタン**

📖 **詳しい使い方は [ヘルプページ](help.md) をご覧ください！**

---

## 🛠 技術詳細

- **言語**: HTML, CSS, JavaScript
- **レンダリング最適化**:
  - **ノード座標を `transform` で管理**
  - **未接続線のドラッグ移動をサポート**
  - **ノードの選択・移動処理の負荷軽減**
  - **矢印の位置を自動最適化**
- **データ管理**
  - **ローカルストレージ保存**
  - **JSON形式でのエクスポート・インポート**
  - **バージョン管理とマイグレーション機能**
  - **複数タブ間のデータ同期**
- **UI/UX**
  - **ツールチップによる視覚的フィードバック** 🆕
  - **ボタン状態による設定表示** 🆕
  - **一貫したデザイン言語** 🆕

---

## 🔧 クラス構成

| クラス名        | 説明 |
|---------------|----------------|
| `YaNoteApp`   | アプリ全体の管理 |
| `NoteNode`    | ノードオブジェクト（標準/テキストのみノード対応、太字機能対応） 🆕 |
| `Connection`  | 接続線オブジェクト（未接続線のドラッグ対応、線種切り替え対応） |
| `Logger`      | デバッグ用ログ出力 |
| `Utils`       | 幾何計算・座標処理・バージョン管理・ツールチップ管理 🆕 |

---

## 🚀 今後のロードマップ

- 🎨 **ノードの色変更機能**
- 📂 **エクスポート形式の拡張（PNG / SVG）**
- 📱 **モバイル対応の強化**
- 🔀 **ノードのグループ化**
- 🖼 **ミニマップの実装**

---

## 📜 ライセンス

MIT License