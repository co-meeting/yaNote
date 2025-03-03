# yaNote v1.2.12

**yaNote** は、ブラウザ上で動作するジグザグ型ノートアプリです。  
ノード（メモ）を作成し、自由に接続することで情報を視覚的に整理できます。

📌 **[デモページ](https://co-meeting.github.io/yaNote/)**  
👉 **ブラウザで今すぐ試せます！**

## 🚀 アップデート情報 (v1.2.12)

### 主な変更点

- **Markdown記法によるリンク変換機能の追加**  
  - ノード内のテキスト中に、正確な Markdown 記法（例: `[Google](https://www.google.com)`）があれば、自動的にリンクに変換されます。  
  - 改行は `<br>` タグに変換され、テキストレイアウトが保持されます。  
  - 記法に誤りがある場合は変換されず、入力されたままのテキストとして表示されます。

- **「e」キーによる編集モードへの切替**  
  - ノードを選択した状態でキーボードの「e」キーを押すと、即座にそのノードの編集モードに入るようになりました。  
  - 編集中のノードがある場合、他のノードが選択されると自動的に編集内容が確定されます。

- **ノードの表示レイアウトの改善**  
  - ノードの CSS を見直し、`flex-direction: column;` と `align-items: flex-start;` を追加することで、テキストの改行が正しく反映され、内容が左寄せで表示されるようになりました。

- **その他UI/UXの改善**  
  - ショートカット処理（Ctrl/Cmd+Enter、Undo/Redo、削除操作など）の動作は従来通りです。  
  - ノード選択時に、既に編集中のノードがあれば自動的に編集状態が終了するよう調整しました。

## 📌 主な機能

- **ノードの作成・編集**  
  - キャンバスの空白部分をダブルクリック、または Ctrl/Cmd+Enter のショートカットで新規ノードを作成。  
  - ノードの編集は、クリックまたは「e」キーで開始。  
  - 編集完了は Enter キーを 2 回押すか、他のノードが選択されると自動的に確定されます。  
  - Shift+Enter により、改行も入力可能。

- **Markdown記法によるリンク変換**  
  - ノード内のテキストに Markdown形式のリンク（`[リンクテキスト](URL)`）を記述すると、編集終了時に自動的にリンクへ変換され、クリック時には新しいタブで開きます。

- **ノードの接続と分岐作成**  
  - ドラッグ＆ドロップでノード同士を接続。  
  - 分岐作成時は、分岐元ノードの種類に応じた接続線が自動的に設定されます。

- **Undo/Redo、エクスポート／インポート**  
  - 操作履歴の管理により、Undo/Redo が利用可能。  
  - 現在の状態を JSON 形式で保存・復元でき、複数タブでの同期にも対応。

## 🛠 技術詳細

- **言語:** HTML, CSS, JavaScript  
- **描画:** ノードは HTML、接続線は SVG を使用。  
- **データ管理:** ローカルストレージによる自動保存、バージョン管理と自動マイグレーションに対応。  
- **イベント管理:** キーボードショートカット（Ctrl/Cmd+Enter、eキー、Undo/Redo、削除など）を統合管理。

---

この README.md は、v1.2.11 の仕様を維持しながら、v1.2.12 で追加された新機能と改善点を網羅しています。  
詳細な動作仕様や開発ガイドラインについては、各ファイル（help.md、yaNote-OperationSpec.md、ChatGPT_DevGuide.md など）もご参照ください。
