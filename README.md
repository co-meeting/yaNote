# yaNote

**yaNote** は、ブラウザ上で動作するジグザグ型ノートアプリです。  
ノード（メモ）を作成し、それらを自由に接続することで、情報を視覚的に整理できます。

📌 **[デモページ（GitHub Pages）](https://co-meeting.github.io/yaNote/)**  
👉 **ブラウザで今すぐ試せます！**  

📖 **[ヘルプページ](help.md)**  
👉 **使い方の詳細はこちら！**  

---

## 🚀 アップデート情報 (v1.2.4.1)

### 修正内容
- **線種切り替え時の表示問題を修正**
  - 線種を切り替えた瞬間に矢印位置が正しく調整されるようになりました
  - 接続線の始点側の矢印がノードに隠れる問題を解決しました
  - 「逆矢印」および「両方向矢印」の表示位置が最適化されました

---

## 📌 前バージョン (v1.2.4) の主な変更点

### 主な変更点
- **線種変更機能の追加**
  - 4種類の線種（標準矢印、矢印なし、逆矢印、両方向矢印）をサポート
  - 線種の切り替えボタンをコントロールパネルに追加
  - 最後に使用した線種を記憶する機能を実装
- **UI/UXの改善**
  - 直感的なシンボルベースのコントロールパネル
  - 矢印の表示最適化（ノードと重ならない位置に自動調整）
  - text-onlyノードとの接続点が最適化

### 詳細な更新内容
- **線種切り替え機能**
  - コントロールパネルの「線種変更」ボタン（`ー`）でワンクリック切り替え
  - 複数選択時は一括で変更可能
  - 選択していない場合は「線が選択されていません」とアラート表示

- **線種の種類**
  - 標準矢印（終点に矢印）
  - 矢印なし（単純な線）
  - 逆矢印（始点に矢印）
  - 両方向矢印（始点と終点の両方に矢印）

- **データ互換性の維持**
  - 旧バージョンデータの自動マイグレーション
  - エクスポート/インポート時の線種情報の保持

---

## 📌 機能比較

| 機能 | v1.2.3.1 | v1.2.4 | v1.2.4.1 |
|------|------|------|------|
| 線種の種類 | 1種類（標準矢印） | **4種類（標準/なし/逆/両方向）** 🆕 | 4種類（標準/なし/逆/両方向） |
| コントロールパネル | テキストボタン | **シンボルベースのボタン** 🆕 | シンボルベースのボタン |
| 矢印の表示 | 終点側のみ調整 | **始点・終点の両方で位置調整** 🆕 | **切り替え時も正しく位置調整** 🆕 |
| デフォルト設定 | ノード種類のみ記憶 | **ノード種類と線種を記憶** 🆕 | ノード種類と線種を記憶 |

---

## 📌 主な機能

### 📝 ノードの作成・編集
- **ダブルクリックでノードを作成**
- **Enterキー2回押下で編集完了**
- **ドラッグでノードを移動可能**
- **ノードの種類を切り替え可能（標準 / テキストのみ）**

### 📍 ノードの接続
- **ドラッグ＆ドロップでノード同士を接続**
- **未接続の線を自由に移動可能**
- **接続線の端点をドラッグして再接続可能**
- **線種を切り替え可能（4種類から選択）**
- **線種切り替え時の矢印表示を最適化** 🆕

### 🎯 選択と削除
- **クリックで選択**
- **Shift + クリックで複数選択**
- **Delete / Backspace で削除**
- **ラバーバンド選択対応（ドラッグで範囲選択）**

### 🔄 Undo / Redo
- **Ctrl + Z / Cmd + Z** → 元に戻す
- **Ctrl + Y / Cmd + Y** → やり直し

### 🔀 エクスポート・インポート機能
- **ノードと接続情報を JSON 形式でエクスポート**
- **ノードの種類と線種もエクスポート時に保存される**
- **エクスポート時にファイル名に日付を含める**
- **エクスポートしたデータをインポート可能**
- **古いバージョンのデータを自動マイグレーション**
- **ローカルストレージにも自動保存**
- **複数タブ間のデータ同期対応**

### 🛠 コントロールパネル
- **「初期状態に戻す」ボタン**
- **「エクスポート」ボタン**
- **「インポート」ボタン**
- **「ノード種類変更」ボタン**
- **「線種変更」ボタン**

📖 **詳しい使い方は [ヘルプページ](help.md) をご覧ください！**

---

## 🛠 技術詳細

- **言語**: HTML, CSS, JavaScript
- **レンダリング最適化**:
  - **ノード座標を `transform` で管理**
  - **未接続線のドラッグ移動をサポート**
  - **ノードの選択・移動処理の負荷軽減**
  - **矢印の位置を自動最適化**
  - **線種切り替え時の矢印位置も最適化** 🆕
- **データ管理**
  - **ローカルストレージ保存**
  - **JSON形式でのエクスポート・インポート**
  - **バージョン管理とマイグレーション機能**
  - **複数タブ間のデータ同期**

---

## 🔧 クラス構成

| クラス名        | 説明 |
|---------------|----------------|
| `YaNoteApp`   | アプリ全体の管理 |
| `NoteNode`    | ノードオブジェクト（標準 / テキストのみノード対応） |
| `Connection`  | 接続線オブジェクト（未接続線のドラッグ対応、線種切り替え対応、矢印位置最適化） 🆕 |
| `Logger`      | デバッグ用ログ出力 |
| `Utils`       | 幾何計算・座標処理・バージョン管理 |

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