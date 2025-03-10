# yaNote v1.3.4

**yaNote** は、ブラウザ上で直感的にアイデアを整理できるジグザグ型ノートアプリです。  
矢野専用に最適化された設計で、余計な機能は排除し、シンプルで高速な動作を実現。  
ノードの自由な配置と接続線による視覚的な情報整理で、思考の発散や選択肢の検討を効率的にサポートします。

* **[デモページ](https://co-meeting.github.io/yaNote/)** （ブラウザで今すぐ試せます！ PWA対応しているのでインストールも可）
* [yaNote Generative AI 開発ガイド](./ChatGPT_DevGuide.md)
* [yaNote ヘルプ](./help.md)
* [yaNote 操作仕様書](./yaNote-OperationSpec.md)
* [yaNote Manifesto](./yaNote-Manifesto.md)


---

## 新機能

- **表示位置のリセット機能**  
  コントロールパネルの「⊙」ボタンをクリックすると、中心ノードが画面中央に配置されるよう表示位置がリセットされます。  
  大きなノート上で中心ノードを見失った場合でも、このボタン一つで簡単に中心に戻ることができます。  
  ※ ガイド表示や共有URLからの読み込み時には自動的にリセットされますが、「開く」ボタンからのインポート時は元のパン位置が維持されます。

- **コントロールパネルのツールチップ機能**  
  各ボタンにマウスカーソルを合わせると、機能の説明がツールチップとして表示されます。  
  初めてご利用の方でも、各機能の役割が一目で理解できるようになりました。  
  画面端でもツールチップが適切に表示されるよう、表示位置は自動的に調整されます。

## 概要

yaNote は、以下の特徴と開発方針に基づいて作られています。

- **直感的な操作性**  
  - **ノード操作**:  
    空白部分のダブルクリックや Ctrl/Cmd+Enter により、瞬時にノードを生成。  
    ノードはダブルクリックまたは「e」キーで編集でき、確定すると自動リンク変換＆接続線再計算が行われます。
  - **接続線操作**:  
    ノード上でダブルクリック＋ドラッグすることで、既存ノードとの接続線（ブランチ）や自由接続線を生成。  
    接続線選択時に表示されるハンドルで、簡単に接続先を変更できます。
- **複数選択・全選択**:  
  Shift＋クリックやラバーバンド選択により、複数のノードや接続線を一括操作可能です。  
  さらに、Cmd/Ctrl+A キーの同時押しで、キャンバス上のすべてのオブジェクトを一括選択できます。
  - **キャンバス操作**:  
    右クリック＋ドラッグでキャンバス全体を移動できます。

- **堅牢な状態管理**  
  - 各操作は自動的にローカルストレージに保存され、JSON 形式でのエクスポート／インポートも可能。  
  - Undo／Redo（Ctrl/Cmd+Z / Ctrl/Cmd+Y）機能で誤操作の修正も簡単に行えます。

- **PWA 対応**  
  - Service Worker によるキャッシュ機能で、オフライン環境でも基本機能を利用できます。  
  - 新バージョンのリリース時も、迅速に更新が反映されます。

---

## yaNote の開発方針と特徴

### 基本方針
- **矢野にとって最強のノードツールを追求**  
  yaNote は、あくまで矢野自身の使い勝手に最適化されたツールです。他者向けの機能改善や要望対応は行わず、操作感覚は矢野の手癖に合わせています。  
  ※ 仕様書やソースコードは公開しますが、issue やディスカッションには一切応じません。

- **カスタマイズは各自で**  
  最新のコードをベースに、**生成AIを活用して改変・機能追加**することを推奨。  
  万人向けではなく、「使いたいなら矢野で適応せよ」というスタンスです。

### 用途
- **思考の整理・発散**  
  自由なノード配置でアイデアを書き出し、直感的に整理できるため、1人ブレストに最適です。
- **選択肢の整理・意思決定**  
  複数の選択肢や戦略を並べ、関係性を視覚的に比較・検討できます。
- **シンプルな情報管理**  
  複雑なフォーマットに縛られず、思いついたことをそのまま記録する場として利用可能です。
- **オフラインメモ・ログの記録**  
  ネット環境に左右されず、ローカルストレージに安全にデータを保存できます。

### 強み
- **高速起動 & オフライン動作**  
  ブラウザを開くだけで即編集可能。Service Worker による PWA 対応で、オフラインでも利用できるため、作業が途切れません。
- **軽量でシンプル**  
  不要な機能は排除し、シンプルな HTML+JS 構成で長期運用が可能。  
  将来、ブラウザ仕様が変わっても生成AI で容易に修正できる柔軟性を持っています。
- **自分専用に最適化**  
  他者向け機能は提供せず、あくまで矢野自身の使いやすさを追求。  
  必要なら、自分で生成AIを活用してカスタマイズしてください。

---

## 使い方

1. **ノードの作成と編集**  
   - 空白部分をダブルクリックまたは Ctrl/Cmd+Enter でノードを生成。  
   - ノードをダブルクリックまたは「e」キーで編集し、Enter キーを2回で確定。  
   ※ 編集確定時は自動的にリンク形式へ変換され、接続線も再計算されます。

2. **接続線の生成と編集**  
   - ノード上でダブルクリック後、マウスボタンを押し続けながら約10px以上ドラッグすると、接続線（ブランチ）が生成されます。  
     - ドラッグ先が既存ノードなら、そのノードとの接続が確定されます。  
     - 空白なら自由接続線として生成され、後から接続先を変更可能です。  
   - 接続線を選択すると、両端に表示されたハンドルを用い、ドラッグすることで接続先を調整できます。

3. **複数選択とキャンバス操作**  
- Shift＋クリックやラバーバンド選択で複数のノードや接続線を一括で選択・移動・削除できます。  
  さらに、Cmd/Ctrl+A キーの同時押しにより、キャンバス上の全オブジェクトを一括選択でき、同様の操作が可能です。  
   - 右クリック＋ドラッグでキャンバス全体をパンできます。

4. **状態の保存と復元**  
   - 各操作は自動的にローカルストレージに保存されます。  
   - JSON 形式でエクスポート／インポートすることで、データのバックアップや別デバイスでの利用が可能です。  
   - Undo／Redo ショートカット（Ctrl/Cmd+Z, Ctrl/Cmd+Y）で、操作の取り消しや再適用もできます。

5. **コントロールパネル**  
   - 画面右上のコントロールパネルから、新規、保存（エクスポート）、開く（インポート）、ノード種類変更、線種・線タイプ変更、太字切替などが簡単に操作できます。  
   - 新規および開くボタン押下時、未保存の状態がある場合は保存確認ダイアログが表示され、保存済みかの確認が求められます。

---

## その他

yaNote の詳細な使い方、操作方法については [help.md](./help.md) をご参照ください。

## ライセンス・開発情報

yaNote はオープンソースプロジェクトとして開発されています。  
最新のソースコードや仕様書、開発に関する情報は [GitHubリポジトリ](https://github.com/co-meeting/yaNote) でご確認いただけます。

© 2025 yaNote Project