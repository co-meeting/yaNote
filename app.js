    document.addEventListener("DOMContentLoaded", function () {

      //Service Worker の登録を含むメインスクリプト
      if ("serviceWorker" in navigator && location.protocol !== 'file:') {
        navigator.serviceWorker.register("sw.js")
          .then((registration) => {
            console.log("Service Worker registered");
            
            // 更新チェックを追加
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('新しいサービスワーカーがインストールされました');
                }
              });
            });
            
            // 定期的な更新チェック（例: 10分ごと）
            setInterval(() => {
              registration.update();
              console.log('Service Worker update check');
            }, 10 * 60 * 1000);
          })
          .catch((err) => console.error("Service Worker registration failed", err));
      }

      "use strict";

      /* ===== 1. 定数・グローバル設定 ===== */
      const VERSION = "v1.5";
      
      // バージョン更新検知と通知機能
      function checkForAppUpdates() {
        // 現在の状態を保存
        const currentAppVersionKey = 'yaNote-currentVersion';
        const storedVersion = localStorage.getItem(currentAppVersionKey);
        
        if (!storedVersion) {
          // 初回利用時
          localStorage.setItem(currentAppVersionKey, VERSION);
          return;
        }
        
        // バージョンが変わった場合
        if (storedVersion !== VERSION) {
          console.log(`yaNote updated: ${storedVersion} → ${VERSION}`);
          localStorage.setItem(currentAppVersionKey, VERSION);
          
          // 更新通知を表示
          const notification = document.createElement('div');
          notification.style.position = 'fixed';
          notification.style.bottom = '50px';
          notification.style.left = '50%';
          notification.style.transform = 'translateX(-50%)';
          notification.style.background = 'rgba(0,123,255,0.9)';
          notification.style.color = 'white';
          notification.style.padding = '10px 20px';
          notification.style.borderRadius = '4px';
          notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
          notification.style.zIndex = '30000';
          notification.style.fontWeight = 'bold';
          notification.textContent = `yaNote が ${VERSION} に更新されました`;
          
          // X（閉じる）ボタン
          const closeBtn = document.createElement('span');
          closeBtn.textContent = '×';
          closeBtn.style.marginLeft = '10px';
          closeBtn.style.cursor = 'pointer';
          closeBtn.style.fontWeight = 'bold';
          closeBtn.onclick = () => {
            document.body.removeChild(notification);
          };
          notification.appendChild(closeBtn);
          
          // 5秒後に自動的に消える
          setTimeout(() => {
            if (document.body.contains(notification)) {
              notification.style.opacity = '0';
              notification.style.transition = 'opacity 0.5s ease';
              setTimeout(() => {
                if (document.body.contains(notification)) {
                  document.body.removeChild(notification);
                }
              }, 500);
            }
          }, 5000);
          
          document.body.appendChild(notification);
        }
      }
      
      // VERSION定義後に関数を呼び出し
      checkForAppUpdates();
      const DEBUG = true;
      const Logger = {
        log: (...args) => { if (DEBUG) console.log("[yaNote]", ...args); }
      };

      // ズーム倍率の範囲（25%〜200%）
      const ZOOM_MIN = 0.25;
      const ZOOM_MAX = 2;

      // AI用エクスポート設定（Markdown変換の空間解析しきい値と、エクスポートに埋め込む凡例）
      const AI_EXPORT = {
        NODE_W: 250,          // 仮定ノード幅（サイズは未保存のため）
        NODE_H: 60,           // 仮定ノード高
        ISLAND_GAP: 400,      // px: bbox間距離がこれ未満なら同一トピックに併合
        COL_X_TOL: 40,        // px: 列検出のx揃え許容差
        COL_MAX_DY: 1200,     // px: カラム見出しの効力が及ぶ下方向範囲
        COL_MIN_MEMBERS: 2,   // 列と認定する最小ノード数
        TITLE_BAND: 300,      // px: 島タイトル候補を探す最上部の帯
        TITLE_MAX: 30,        // トピック見出しに使う先頭行の最大文字数
        LEGEND: `このノートは yaNote（ジグザグ型ノートアプリ）で書かれたものです。書き手の使い分けの傾向：

【ノード種別】
- text-only（枠なし）: 通常の記述。カラム見出しや図中のラベルにも使われる
- standard（白枠）: 強調。grey ノードのサブ項目（配下の項目）として使われることが多い
- grey（グレー）: 強めの強調。複数ノードの集約・グルーピングの起点に使われることが多い
- red（赤枠）: 強い問題意識・未達・注意点に使われることが多い。太字ならセクション見出しのことも多い
- dotted（点線枠）: 補足・つぶやき・注釈的なメモ

【接続線】
- 実線・矢印あり: 論理の展開・流れ（親→子）
- 破線・矢印なし: 近くのノードへの注釈・補足の紐付け

【空間配置】
- 思考の展開方向は矢印が示す（配置方向に固定の意味はない）
- x座標が揃ったノード群は同じカラム。text-only太字のラベルがカラム見出しになっていることがある
- 座標的に大きく離れたまとまりは別トピック`
      };

      let titleAutoUpdated = false;

      /* ===== 2. ユーティリティ関数 ===== */
      const Utils = {
        orientation: (a, b, c) => {
          const val = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
          if (Math.abs(val) < 1e-10) return 0;
          return (val > 0) ? 1 : 2;
        },
        segmentsIntersect: (p1, p2, p3, p4) => {
          const o1 = Utils.orientation(p1, p2, p3);
          const o2 = Utils.orientation(p1, p2, p4);
          const o3 = Utils.orientation(p3, p4, p1);
          const o4 = Utils.orientation(p3, p4, p2);
          return (o1 !== o2 && o3 !== o4);
        },
        rectIntersectsLine: (rect, p1, p2) => {
          if (p1.x >= rect.left && p1.x <= rect.right && p1.y >= rect.top && p1.y <= rect.bottom) return true;
          if (p2.x >= rect.left && p2.x <= rect.right && p2.y >= rect.top && p2.y <= rect.bottom) return true;
          const edges = [
            [{ x: rect.left, y: rect.top }, { x: rect.right, y: rect.top }],
            [{ x: rect.left, y: rect.bottom }, { x: rect.right, y: rect.bottom }],
            [{ x: rect.left, y: rect.top }, { x: rect.left, y: rect.bottom }],
            [{ x: rect.right, y: rect.top }, { x: rect.right, y: rect.bottom }]
          ];
          return edges.some(edge => Utils.segmentsIntersect(p1, p2, edge[0], edge[1]));
        },
        computeEndpoint: (tcx, tcy, fx, fy, toRect) => {
          const dx = fx - tcx, dy = fy - tcy;
          let t = 1;
          const hw = toRect.width / 2, hh = toRect.height / 2;
          if (dx === 0 && dy === 0) t = 1;
          else if (dx === 0) t = hh / Math.abs(dy);
          else if (dy === 0) t = hw / Math.abs(dx);
          else t = Math.min(hw / Math.abs(dx), hh / Math.abs(dy));
          return { arrowX: tcx + t * dx, arrowY: t * dy + tcy };
        },
        compareVersions: (v1, v2) => {
          const parts1 = v1.replace(/^v/, "").split('.').map(Number);
          const parts2 = v2.replace(/^v/, "").split('.').map(Number);
          for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const a = parts1[i] || 0;
            const b = parts2[i] || 0;
            if (a > b) return 1;
            if (a < b) return -1;
          }
          return 0;
        },
        showTooltip: (el, text) => {
          Utils.hideAllTooltips();
          const tip = document.createElement("div");
          tip.className = "tooltip";
          tip.textContent = text;
          document.body.appendChild(tip);
          const rect = el.getBoundingClientRect();
          tip.style.left = (rect.left + rect.width / 2 - tip.offsetWidth / 2) + "px";
          tip.style.top = (rect.bottom) + "px";
          setTimeout(() => { if (tip.parentNode) tip.parentNode.removeChild(tip); }, 2000);
        },
        hideAllTooltips: () => {
          document.querySelectorAll(".tooltip").forEach(t => t.parentNode && t.parentNode.removeChild(t));
        },
        // ズーム率を右下に一時表示する（1.5秒後にフェードアウト）
        zoomDisplayTimeout: null,
        updateZoomDisplay: (zoom) => {
          const zoomDisplay = document.getElementById("zoomDisplay");
          if (!zoomDisplay) return;
          zoomDisplay.textContent = `${Math.round(zoom * 100)}%`;
          zoomDisplay.classList.add("visible");
          clearTimeout(Utils.zoomDisplayTimeout);
          Utils.zoomDisplayTimeout = setTimeout(() => {
            zoomDisplay.classList.remove("visible");
          }, 1500);
        }
      };

      /* ===== AI用エクスポート ===== */
      // ノート状態（captureState 形式）を、AIが書き手の意図を読み取りやすい
      // Markdownアウトラインに変換する。座標レイアウトが暗黙に担う意味
      // （トピックの島・カラム対応）と接続トポロジーを明示化する。
      {
        const aiFirstLine = (node) => ((node.text || "").split("\n")[0].trim()) || "（空）";
        const aiByPosition = (a, b) => (a.y - b.y) || (a.x - b.x) || (a.id - b.id);

        // 接続を分類する。戻り値:
        //   childrenOf: 親id → [{ node, dashed }]（実線/逆矢印のツリーエッジ）
        //   hasTreeEdge: ツリーエッジに参加するノードidの Set
        //   notesOf: ホストid → [注釈ノード]、consumedNotes: 注釈として吸収されたid
        //   crossRefsOf / mutualOf: ノードid → [相手ノード]
        //   skippedFree: ノードに接続していない自由線の本数
        function aiClassifyEdges(state, nodeById) {
          const nodeConns = [];
          let skippedFree = 0;
          for (const c of (state.connections || [])) {
            const from = nodeById.get(c.fromId);
            const to = nodeById.get(c.toId);
            if (!from || !to || from === to) { skippedFree++; continue; }
            nodeConns.push({ from, to, lineType: c.lineType, dashType: c.dashType });
          }

          const childrenOf = new Map();
          const hasTreeEdge = new Set();
          for (const c of nodeConns) {
            if (c.lineType !== "standard" && c.lineType !== "reverse-arrow") continue;
            const parent = c.lineType === "standard" ? c.from : c.to;
            const child = c.lineType === "standard" ? c.to : c.from;
            if (!childrenOf.has(parent.id)) childrenOf.set(parent.id, []);
            childrenOf.get(parent.id).push({ node: child, dashed: c.dashType === "dashed" });
            hasTreeEdge.add(parent.id);
            hasTreeEdge.add(child.id);
          }

          const notesOf = new Map();
          const crossRefsOf = new Map();
          const mutualOf = new Map();
          const consumedNotes = new Set();
          const addTo = (map, id, value) => {
            if (!map.has(id)) map.set(id, []);
            map.get(id).push(value);
          };
          for (const c of nodeConns) {
            if (c.lineType === "both-arrow") {
              addTo(mutualOf, c.from.id, c.to);
              addTo(mutualOf, c.to.id, c.from);
            } else if (c.lineType === "no-arrow") {
              const fromFree = !hasTreeEdge.has(c.from.id);
              const toFree = !hasTreeEdge.has(c.to.id);
              if (fromFree === toFree) {
                // 両方ツリー参加（または両方フリー）: 位置が後ろの方を注釈とみなすが、
                // 両方ツリー参加なら消費せず相互参照にとどめる
                const [a, b] = [c.from, c.to].sort(aiByPosition);
                if (fromFree) { addTo(notesOf, a.id, b); consumedNotes.add(b.id); }
                else { addTo(crossRefsOf, a.id, b); }
              } else {
                const note = fromFree ? c.from : c.to;
                const host = fromFree ? c.to : c.from;
                addTo(notesOf, host.id, note);
                consumedNotes.add(note.id);
              }
            }
          }
          // 決定的な出力順に整列
          for (const list of [...notesOf.values(), ...crossRefsOf.values(), ...mutualOf.values()]) {
            list.sort(aiByPosition);
          }
          return { childrenOf, hasTreeEdge, notesOf, crossRefsOf, mutualOf, consumedNotes, skippedFree };
        }

        // トピックの島を検出する。接続で結ばれたノード同士（明示的なリンクは距離より優先）と、
        // ノード矩形間の距離が ISLAND_GAP 未満のノード同士を同じ島に併合する。
        function aiDetectIslands(nodes, state, nodeById) {
          const parent = new Map(nodes.map(n => [n.id, n.id]));
          const find = (id) => {
            while (parent.get(id) !== id) {
              parent.set(id, parent.get(parent.get(id)));
              id = parent.get(id);
            }
            return id;
          };
          const union = (a, b) => { parent.set(find(a), find(b)); };
          for (const c of (state.connections || [])) {
            if (nodeById.has(c.fromId) && nodeById.has(c.toId)) union(c.fromId, c.toId);
          }
          // ノード矩形（仮定サイズ）同士のギャップが ISLAND_GAP 未満なら同じ島
          for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
              const a = nodes[i], b = nodes[j];
              const gapX = Math.max(0, a.x - (b.x + AI_EXPORT.NODE_W), b.x - (a.x + AI_EXPORT.NODE_W));
              const gapY = Math.max(0, a.y - (b.y + AI_EXPORT.NODE_H), b.y - (a.y + AI_EXPORT.NODE_H));
              if (Math.hypot(gapX, gapY) < AI_EXPORT.ISLAND_GAP) union(a.id, b.id);
            }
          }

          const byRoot = new Map();
          for (const n of nodes) {
            const root = find(n.id);
            if (!byRoot.has(root)) byRoot.set(root, []);
            byRoot.get(root).push(n);
          }
          const bboxOf = (members) => ({
            minX: Math.min(...members.map(n => n.x)),
            minY: Math.min(...members.map(n => n.y)),
            maxX: Math.max(...members.map(n => n.x)) + AI_EXPORT.NODE_W,
            maxY: Math.max(...members.map(n => n.y)) + AI_EXPORT.NODE_H
          });
          const islands = [...byRoot.values()].map(members => ({
            members: members.sort(aiByPosition),
            bbox: bboxOf(members)
          }));
          islands.sort((a, b) => (a.bbox.minY - b.bbox.minY) || (a.bbox.minX - b.bbox.minX));
          return islands;
        }

        // 島タイトル: 最上部の帯にある太字ノード（なければredノード）を優先し、その先頭行を使う
        function aiIslandTitle(island) {
          const band = island.members.filter(n => n.y <= island.bbox.minY + AI_EXPORT.TITLE_BAND);
          const candidates = band.filter(n => n.boldText).length ? band.filter(n => n.boldText)
            : band.filter(n => n.nodeType === "red").length ? band.filter(n => n.nodeType === "red")
            : band;
          const titleNode = candidates.sort(aiByPosition)[0];
          const line = aiFirstLine(titleNode)
            .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")   // リンク記法はテキストだけ残す
            .replace(/^[-#*・\s]+/, "");
          return line.length > AI_EXPORT.TITLE_MAX ? line.slice(0, AI_EXPORT.TITLE_MAX) + "…" : line;
        }

        // カラム見出し検出: 接続を持たない text-only 太字ノードの直下に
        // x座標の揃ったノードが並んでいれば、カラム見出しとみなす。
        // 戻り値: columnOf（ノードid → 見出しラベル）と consumedHeaders（見出しノードidの Set）
        function aiDetectColumns(islandNodes, hasAnyEdge) {
          const columnOf = new Map();
          const consumedHeaders = new Set();
          const candidates = islandNodes
            .filter(n => n.nodeType === "text-only" && n.boldText && !hasAnyEdge.has(n.id))
            .sort(aiByPosition);
          const headerAbove = new Map(); // メンバーid → 直上で最も近い見出し
          for (const h of candidates) {
            const members = islandNodes.filter(n =>
              n !== h && !candidates.includes(n) &&
              Math.abs(n.x - h.x) <= AI_EXPORT.COL_X_TOL &&
              n.y > h.y && n.y <= h.y + AI_EXPORT.COL_MAX_DY
            );
            if (members.length < AI_EXPORT.COL_MIN_MEMBERS) continue;
            consumedHeaders.add(h.id);
            for (const m of members) {
              const prev = headerAbove.get(m.id);
              if (!prev || h.y > prev.y) headerAbove.set(m.id, h);
            }
          }
          for (const [id, h] of headerAbove) columnOf.set(id, aiFirstLine(h));
          return { columnOf, consumedHeaders };
        }

        // 1ノードを Markdown 行として出力（先頭行＋継続行＋注釈・相互リンク等のサブ項目）
        function aiRenderNodeLines(node, ctx, depth, marks, lines) {
          const indent = "  ".repeat(depth);
          const textLines = (node.text || "").split("\n");
          const col = ctx.columnOf.get(node.id);
          let head = (col ? `【${col}】` : "") + (textLines[0].trim() || "（空）");
          if (node.boldText) head = `**${head}**`;
          if (node.nodeType !== "text-only") head += ` [${node.nodeType}]`;
          if (marks.prefix) head = `${marks.prefix}${head}`;
          if (marks.suffix) head += ` ${marks.suffix}`;
          lines.push(`${indent}- ${head}`);
          for (const cont of textLines.slice(1)) {
            lines.push(`${indent}  ${cont}`);
          }
          for (const note of (ctx.notesOf.get(node.id) || [])) {
            if (ctx.rendered.has(note.id)) continue;
            ctx.rendered.add(note.id);
            aiRenderNodeLines(note, ctx, depth + 1, { prefix: "（注釈）" }, lines);
          }
          for (const other of (ctx.crossRefsOf.get(node.id) || [])) {
            lines.push(`${indent}  - （関連: ${aiFirstLine(other)}）`);
          }
          for (const other of (ctx.mutualOf.get(node.id) || [])) {
            lines.push(`${indent}  - （相互リンク: ${aiFirstLine(other)}）`);
          }
        }

        // ツリーエッジに沿った DFS。再訪ノードは1行参照にとどめ、循環でも停止する
        function aiRenderTree(node, ctx, depth, dashed, lines) {
          if (ctx.rendered.has(node.id)) {
            lines.push(`${"  ".repeat(depth)}- →（既出）${aiFirstLine(node)}`);
            return;
          }
          ctx.rendered.add(node.id);
          aiRenderNodeLines(node, ctx, depth, dashed ? { suffix: "(点線接続)" } : {}, lines);
          const children = (ctx.childrenOf.get(node.id) || [])
            .filter(c => !ctx.excluded.has(c.node.id))
            .sort((a, b) => aiByPosition(a.node, b.node));
          for (const c of children) aiRenderTree(c.node, ctx, depth + 1, c.dashed, lines);
        }

        function aiRenderIsland(island, edges, lines) {
          const { columnOf, consumedHeaders } = aiDetectColumns(island.members, edges.hasAnyEdge);
          const excluded = new Set([...consumedHeaders, ...edges.consumedNotes]);
          const renderable = island.members.filter(n => !excluded.has(n.id));
          const ctx = { ...edges, columnOf, excluded, rendered: edges.rendered };

          // ルート = 島内の描画対象から入ってくるツリーエッジを持たないノード
          const hasIncoming = new Set();
          for (const n of renderable) {
            for (const c of (edges.childrenOf.get(n.id) || [])) hasIncoming.add(c.node.id);
          }
          const roots = renderable.filter(n => !hasIncoming.has(n.id));
          // ルートのない循環が残った場合は、未出力ノードを順に追加ルートとして拾う
          for (const n of [...roots, ...renderable]) {
            if (!ctx.rendered.has(n.id)) aiRenderTree(n, ctx, 0, false, lines);
          }
        }

        Utils.toAIMarkdown = (state, opts = {}) => {
          const nodes = (state.nodes || []).slice();
          const lines = [];
          lines.push(`# ${(state.title || "").trim() || "無題"}`);
          lines.push("");
          if (opts.date) {
            lines.push(`エクスポート日時: ${opts.date}`);
            lines.push("");
          }
          lines.push("## 凡例");
          lines.push("");
          lines.push(AI_EXPORT.LEGEND);
          lines.push("");
          if (!nodes.length) {
            lines.push("（ノートは空です）");
            return lines.join("\n") + "\n";
          }

          const nodeById = new Map(nodes.map(n => [n.id, n]));
          const edges = aiClassifyEdges(state, nodeById);
          // カラム見出し候補の判定用: なんらかの接続に参加しているノードid
          edges.hasAnyEdge = new Set();
          for (const c of (state.connections || [])) {
            if (nodeById.has(c.fromId) && nodeById.has(c.toId)) {
              edges.hasAnyEdge.add(c.fromId);
              edges.hasAnyEdge.add(c.toId);
            }
          }
          edges.rendered = new Set();

          const islands = aiDetectIslands(nodes, state, nodeById);
          islands.forEach((island, i) => {
            lines.push(`## トピック ${i + 1}: ${aiIslandTitle(island)}`);
            lines.push("");
            aiRenderIsland(island, edges, lines);
            lines.push("");
          });
          if (edges.skippedFree > 0) {
            lines.push("---");
            lines.push(`（注）どのノードにも接続していない自由線 ${edges.skippedFree} 本は省略しました。`);
            lines.push("");
          }
          return lines.join("\n");
        };
      }

      /* ===== URL共有のためのユーティリティ ===== */
      function generateShareUrl(jsonUrl) {
        const baseUrl = window.location.href.split('?')[0];
        return `${baseUrl}?json=${encodeURIComponent(jsonUrl)}`;
      }

      /* ===== 3. タイトルフィールド設定 ===== */
      const titleField = document.getElementById("titleField");
      titleField.addEventListener("click", function (e) {
        titleField.readOnly = false;
        titleField.style.borderBottom = "1px dashed #000";
        titleField.style.width = "150px";
        titleField.style.textAlign = "left";
        titleField.focus();
      });
      titleField.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.isComposing) {
          e.preventDefault();
          titleField.blur();
        }
      });
      titleField.addEventListener("blur", function (e) {
        titleField.readOnly = true;
        titleField.style.borderBottom = "none";
        if (titleField.value.trim() === "") {
          titleField.value = "無題";
        }
        adjustTitleFieldWidth();
        titleField.style.textAlign = "right";
      });
      function adjustTitleFieldWidth() {
        let tempSpan = document.createElement("span");
        const style = window.getComputedStyle(titleField);
        tempSpan.style.font = style.font;
        tempSpan.style.visibility = "hidden";
        tempSpan.style.whiteSpace = "nowrap";
        tempSpan.textContent = titleField.value;
        document.body.appendChild(tempSpan);
        const width = tempSpan.offsetWidth + 10;
        document.body.removeChild(tempSpan);
        titleField.style.width = width + "px";
      }

      /* ===== 4. ノードクラス ===== */
      class NoteNode {
        constructor(text, x, y, app, id) {
          this.app = app;
          this.element = document.createElement("div");
          this.element.className = "node";
          this.setText(text);
          this.app.canvas.appendChild(this.element);
          this.x = x;
          this.y = y;
          this.setPosition(x, y);
          this.nodeType = "standard"; // 初期値
          this.boldText = false;
          this.addEventListeners();
          if (id !== undefined) {
            this.id = id;
            if (id >= NoteNode.nextId) NoteNode.nextId = id + 1;
          } else {
            this.id = NoteNode.nextId++;
          }
          Logger.log("NoteNode created:", this.id, text, x, y);
        }
        setPosition(x, y) {
          this.x = x;
          this.y = y;
          this.element.style.transform = `translate(${x}px, ${y}px)`;
        }
        addEventListeners() {
          this.element.addEventListener("mousedown", e => {
            // ノード上ならイベントの伝搬を停止する
            e.stopPropagation();

            // 右クリックの場合、編集中の場合のみデフォルト動作を許可する
            if (e.button === 2) {
              // 編集中でない場合は右クリックによるコンテキストメニュー表示を防止し、
              // パン操作に渡すために stopPropagation を無効化
              if (!this.element.isContentEditable && !this.element.classList.contains("editing")) {
                e.preventDefault();
                // stopPropagation をオーバーライドしてイベント伝播を許可
                const originalStopPropagation = e.stopPropagation;
                e.stopPropagation = function () { };

                // パン処理を行うためにキャンバスのmousedownイベントを明示的に発火
                const canvasEvent = new MouseEvent('mousedown', {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  button: 2,
                  buttons: 2,
                  clientX: e.clientX,
                  clientY: e.clientY
                });
                this.app.canvas.dispatchEvent(canvasEvent);
              }
              return;
            }

            // 以下は既存のコード
            if (e.shiftKey) {
              if (!this.app.selectedNodes.includes(this)) {
                this.app.selectedNodes.push(this);
                this.element.classList.add("selected");
              } else {
                this.app.selectedNodes = this.app.selectedNodes.filter(n => n !== this);
                this.element.classList.remove("selected");
              }
              this.app.updateControlButtonsState();
              return;
            }
            // 編集中の場合は処理を行わない
            if (this.element.isContentEditable || this.element.classList.contains("editing")) return;
            if (e.button === 0) {
              e.preventDefault();
              this.app.handleNodeMouseDown(e, this);
            }
          });

          // タッチイベント（ダブルタップ＋ドラッグで線を引く対応含む）
          this.element.addEventListener("touchstart", e => {
            if (e.touches.length >= 2) return;
            e.preventDefault();
            // ダブルタップ 2 回目かどうか（前回のタップから 300ms 以内）
            const now = Date.now();
            if (this._lastTapTime && (now - this._lastTapTime < 300)) {
              this._lastTapTime = 0;
              this._doubleTapPending = true;
              this._pendingTouchId = e.touches[0].identifier;
              this._pendingTouchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
              const node = this;
              const onDocTouchMove = (e) => {
                const t = Array.from(e.touches).find(touch => touch.identifier === node._pendingTouchId);
                if (!t) return;
                const dx = t.clientX - node._pendingTouchStartPos.x;
                const dy = t.clientY - node._pendingTouchStartPos.y;
                if (Math.sqrt(dx * dx + dy * dy) > 10) {
                  node._doubleTapPending = false;
                  document.removeEventListener("touchmove", onDocTouchMove, { capture: true });
                  document.removeEventListener("touchend", onDocTouchEnd, { capture: true });
                  document.removeEventListener("touchcancel", onDocTouchEnd, { capture: true });
                  node._pendingTouchId = null;
                  node.app.startBranchCreationTouch(node, e);
                }
              };
              const onDocTouchEnd = (e) => {
                const t = Array.from(e.changedTouches).find(touch => touch.identifier === node._pendingTouchId);
                if (!t) return;
                document.removeEventListener("touchmove", onDocTouchMove, { capture: true });
                document.removeEventListener("touchend", onDocTouchEnd, { capture: true });
                document.removeEventListener("touchcancel", onDocTouchEnd, { capture: true });
                node._pendingTouchId = null;
                if (node._doubleTapPending) {
                  node._doubleTapPending = false;
                  node.app.startEditingNode(node);
                }
              };
              document.addEventListener("touchmove", onDocTouchMove, { capture: true });
              document.addEventListener("touchend", onDocTouchEnd, { capture: true });
              document.addEventListener("touchcancel", onDocTouchEnd, { capture: true });
              return;
            }
            this._touchStartTime = Date.now();
            this._touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            this._isTouching = true;
            this._hasMoved = false;
            this._isLongPress = false;
            if (this.element.isContentEditable || this.element.classList.contains("editing")) {
              e.stopPropagation();
              return;
            }
            this._longPressTimer = setTimeout(() => {
              if (this._isTouching && !this._hasMoved) {
                this._isLongPress = true;
                this.element.style.transform = `translate(${this.x}px, ${this.y}px) scale(1.05)`;
                this.app.startNodeTouchMove(e, this);
              }
            }, 300);
            if (e.target.tagName.toLowerCase() === 'a') {
              this._touchedLink = e.target.href;
              e.stopPropagation();
            } else {
              this._touchedLink = null;
            }
          });
          this.element.addEventListener("touchmove", e => {
            if (e.touches.length >= 2) return;
            if (this._isTouching) {
              const dx = e.touches[0].clientX - this._touchStartPos.x;
              const dy = e.touches[0].clientY - this._touchStartPos.y;
              if (Math.sqrt(dx * dx + dy * dy) > 10) {
                this._hasMoved = true;
                if (!this._isLongPress) clearTimeout(this._longPressTimer);
              }
            }
          });
          this.element.addEventListener("touchend", e => {
            const wasTouching = this._isTouching;
            const hasMoved = this._hasMoved;
            const wasLongPress = this._isLongPress;
            this._isTouching = false;
            clearTimeout(this._longPressTimer);
            if (wasLongPress) {
              this.element.style.transform = `translate(${this.x}px, ${this.y}px)`;
            }
            if (this._touchedLink && e.target.tagName.toLowerCase() === 'a') {
              e.preventDefault();
              e.stopPropagation();
              window.open(this._touchedLink, '_blank');
              this._touchedLink = null;
              return false;
            }
            if (wasTouching && !hasMoved && !wasLongPress && (Date.now() - this._touchStartTime < 200)) {
              this._lastTapTime = Date.now();
              this.app.clearSelection();
              this.app.selectNode(this);
              this.app.updateControlButtonsState();
            }
          });

          // 新規追加: コンテキストメニューイベントの処理
          this.element.addEventListener("contextmenu", e => {
            // 編集中でない場合はコンテキストメニューを抑制
            if (!this.element.isContentEditable && !this.element.classList.contains("editing")) {
              e.preventDefault();
            }
          });
        }
        setText(text) {
          this.rawText = text; // 生のMarkdownテキストを保持
          this.element.innerHTML = this.convertMarkdownLinks(text);
        }
        convertMarkdownLinks(text) {
          const isInternalLink = (url) => {
            try {
              const urlObj = new URL(url, window.location.href);
              return urlObj.host === window.location.host;
            } catch (e) {
              return !url.startsWith('http');
            }
          };
          const escapeHtml = (value) => value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
          const escapeAttr = (value) => value.replace(/"/g, "&quot;");
          const buildAnchor = (url, displayText) => {
            const target = isInternalLink(url) ? "_top" : "_blank";
            const rel = target === "_blank" ? ' rel="noopener noreferrer"' : "";
            const safeHref = escapeAttr(encodeURI(url));
            return `<a href="${safeHref}" target="${target}"${rel}>${escapeHtml(displayText)}</a>`;
          };
          const linkifyPlainText = (rawSegment) => {
            const urlRegex = /https?:\/\/[^\s<]+/g;
            let out = "";
            let last = 0;
            rawSegment.replace(urlRegex, (url, index) => {
              out += escapeHtml(rawSegment.slice(last, index));
              const display = url.length > 30 ? `${url.substring(0, 30)}...` : url;
              out += buildAnchor(url, display);
              last = index + url.length;
              return url;
            });
            out += escapeHtml(rawSegment.slice(last));
            return out;
          };

          const normalized = (text || "").replace(/\n+/g, "\n");
          const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
          let htmlText = "";
          let lastIndex = 0;
          let match;
          while ((match = mdLinkRegex.exec(normalized)) !== null) {
            htmlText += linkifyPlainText(normalized.slice(lastIndex, match.index));
            htmlText += buildAnchor(match[2], match[1]);
            lastIndex = mdLinkRegex.lastIndex;
          }
          htmlText += linkifyPlainText(normalized.slice(lastIndex));
          htmlText = htmlText.replace(/\n/g, "<br>");
          htmlText = htmlText.replace(/(<\/a>)<br>/g, "$1");
          return htmlText;
        }


        startEditing() {
          this.app.startEditingNode(this);
        }
        setType(newType) {
          this.nodeType = newType;
          this.element.classList.remove("standard", "text-only", "grey", "red", "dotted");
          this.element.classList.add(newType);
          this.app.connections.forEach(conn => {
            if (conn.fromNode === this) conn.update();
          });
        }
        setBold(isBold) {
          this.boldText = isBold;
          if (isBold) this.element.classList.add("bold-text");
          else this.element.classList.remove("bold-text");
        }
      }
      NoteNode.nextId = 1;

      /* ===== 5. 接続線クラス ===== */
      class Connection {
        constructor(fromNode, toNode, app) {
          this.app = app;
          this.fromNode = fromNode;
          this.toNode = toNode;
          this.fromCoord = null;
          this.toCoord = null;
          this.lineType = "standard";
          this.dashType = "solid";
          this.startHandle = null;
          this.endHandle = null;
          this.line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          this.line.setAttribute("stroke", "#404040");
          this.line.setAttribute("stroke-width", "2");
          this.setLineType(this.app.defaultLineType || "standard");
          this.setDashType(this.app.defaultDashType || "solid");
          this.line.style.pointerEvents = "auto";
          this.line.addEventListener("click", e => { e.stopPropagation(); this.app.selectConnection(this); });
          if (this.fromNode === null && this.toNode === null) {
            this.line.addEventListener("mousedown", e => {
              if (e.button === 0) {
                e.stopPropagation();
                e.preventDefault();
                if (this.app.selectedConnections.includes(this)) this.app.startGroupMove(e);
                else this.startDrag(e);
              }
            });
          }
          this.app.svg.appendChild(this.line);
          this.update();
          Logger.log("Connection created:", this.fromNode?.id, "->", this.toNode?.id);
        }
        update() {
          // SVG はズームされるキャンバス内にあるため、画面座標（getBoundingClientRect）は
          // globalZoom で割って論理座標に統一してから SVG に書く
          const zoom = this.app.globalZoom;
          const canvasRect = this.app.canvas.getBoundingClientRect();
          const toLocalRect = (rect) => ({
            left: (rect.left - canvasRect.left) / zoom,
            top: (rect.top - canvasRect.top) / zoom,
            right: (rect.right - canvasRect.left) / zoom,
            bottom: (rect.bottom - canvasRect.top) / zoom,
            width: rect.width / zoom,
            height: rect.height / zoom
          });
          let fromPoint, toPoint;
          if (this.fromNode && document.body.contains(this.fromNode.element)) {
            const rect = toLocalRect(this.fromNode.element.getBoundingClientRect());
            fromPoint = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          } else if (this.fromCoord && typeof this.fromCoord.x === "number") {
            fromPoint = this.fromCoord;
          } else return;
          if (this.toNode && document.body.contains(this.toNode.element)) {
            const rect = toLocalRect(this.toNode.element.getBoundingClientRect());
            toPoint = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          } else if (this.toCoord && typeof this.toCoord.x === "number") {
            toPoint = this.toCoord;
          } else return;
          const origFrom = Object.assign({}, fromPoint);
          const origTo = Object.assign({}, toPoint);
          if (this.toNode && document.body.contains(this.toNode.element)) {
            const endpoint = Utils.computeEndpoint(origTo.x, origTo.y, origFrom.x, origFrom.y, toLocalRect(this.toNode.element.getBoundingClientRect()));
            toPoint.x = endpoint.arrowX;
            toPoint.y = endpoint.arrowY;
          }
          if ((this.lineType === "reverse-arrow" || this.lineType === "both-arrow") &&
            this.fromNode && document.body.contains(this.fromNode.element)) {
            const startpoint = Utils.computeEndpoint(origFrom.x, origFrom.y, origTo.x, origTo.y, toLocalRect(this.fromNode.element.getBoundingClientRect()));
            fromPoint.x = startpoint.arrowX;
            fromPoint.y = startpoint.arrowY;
          }
          if (this.fromNode && this.fromNode.nodeType === "text-only") {
            const localRect = toLocalRect(this.fromNode.element.getBoundingClientRect());
            const cx = (localRect.left + localRect.right) / 2;
            const cy = (localRect.top + localRect.bottom) / 2;
            const dirX = toPoint.x - fromPoint.x;
            const dirY = toPoint.y - fromPoint.y;
            const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
            const ndx = dirX / len;
            const ndy = dirY / len;
            let tCandidates = [];
            if (ndx > 0) tCandidates.push((localRect.right - cx) / ndx);
            else if (ndx < 0) tCandidates.push((localRect.left - cx) / ndx);
            if (ndy > 0) tCandidates.push((localRect.bottom - cy) / ndy);
            else if (ndy < 0) tCandidates.push((localRect.top - cy) / ndy);
            const t = Math.min(...tCandidates.filter(v => v > 0));
            const offset = 2 + (localRect.width / 50);
            fromPoint.x = cx + ndx * (t + offset);
            fromPoint.y = cy + ndy * (t + offset);
          }
          if (this.toNode && this.toNode.nodeType === "text-only") {
            const localRect = toLocalRect(this.toNode.element.getBoundingClientRect());
            const cx = (localRect.left + localRect.right) / 2;
            const cy = (localRect.top + localRect.bottom) / 2;
            const dirX = fromPoint.x - toPoint.x;
            const dirY = fromPoint.y - toPoint.y;
            const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
            const ndx = dirX / len;
            const ndy = dirY / len;
            let tCandidates = [];
            if (ndx > 0) tCandidates.push((localRect.right - cx) / ndx);
            else if (ndx < 0) tCandidates.push((localRect.left - cx) / ndx);
            if (ndy > 0) tCandidates.push((localRect.bottom - cy) / ndy);
            else if (ndy < 0) tCandidates.push((localRect.top - cy) / ndy);
            const t = Math.min(...tCandidates.filter(v => v > 0));
            const offset = 2 + (localRect.width / 50);
            toPoint.x = cx + ndx * (t + offset);
            toPoint.y = cy + ndy * (t + offset);
          }
          this.line.setAttribute("x1", fromPoint.x);
          this.line.setAttribute("y1", fromPoint.y);
          this.line.setAttribute("x2", toPoint.x);
          this.line.setAttribute("y2", toPoint.y);
          if (this.startHandle) {
            this.startHandle.style.left = (fromPoint.x - 4) + "px";
            this.startHandle.style.top = (fromPoint.y - 4) + "px";
          }
          if (this.endHandle) {
            this.endHandle.style.left = (toPoint.x - 4) + "px";
            this.endHandle.style.top = (toPoint.y - 4) + "px";
          }
        }
        showHandles() {
          this.hideHandles();
          this.startHandle = this.app.createHtmlHandle();
          this.endHandle = this.app.createHtmlHandle();
          const x1 = parseFloat(this.line.getAttribute("x1"));
          const y1 = parseFloat(this.line.getAttribute("y1"));
          const x2 = parseFloat(this.line.getAttribute("x2"));
          const y2 = parseFloat(this.line.getAttribute("y2"));
          this.startHandle.style.left = (x1 - 4) + "px";
          this.startHandle.style.top = (y1 - 4) + "px";
          this.endHandle.style.left = (x2 - 4) + "px";
          this.endHandle.style.top = (y2 - 4) + "px";
          this.app.addHandleDrag(this.startHandle, this, "from");
          this.app.addHandleDrag(this.endHandle, this, "to");
        }
        hideHandles() {
          if (this.startHandle && this.startHandle.parentNode) this.startHandle.parentNode.removeChild(this.startHandle);
          if (this.endHandle && this.endHandle.parentNode) this.endHandle.parentNode.removeChild(this.endHandle);
          this.startHandle = this.endHandle = null;
        }
        startDrag(e) {
          const startX = e.clientX, startY = e.clientY;
          const initFrom = Object.assign({}, this.fromCoord);
          const initTo = Object.assign({}, this.toCoord);
          const onMove = e => {
            // fromCoord/toCoord は論理座標のため、画面上の移動量をズームで換算する
            const dx = (e.clientX - startX) / this.app.globalZoom;
            const dy = (e.clientY - startY) / this.app.globalZoom;
            this.fromCoord = { x: initFrom.x + dx, y: initFrom.y + dy };
            this.toCoord = { x: initTo.x + dx, y: initTo.y + dy };
            this.update();
          };
          const onUp = e => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            this.app.saveState();
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }
        setLineType(type) {
          this.lineType = type;
          this.line.removeAttribute("marker-start");
          this.line.removeAttribute("marker-end");
          switch (type) {
            case "standard":
              this.line.setAttribute("marker-end", "url(#arrowhead)");
              break;
            case "no-arrow":
              break;
            case "reverse-arrow":
              this.line.setAttribute("marker-start", "url(#start-arrow)");
              break;
            case "both-arrow":
              this.line.setAttribute("marker-start", "url(#both-start-arrow)");
              this.line.setAttribute("marker-end", "url(#both-end-arrow)");
              break;
            default:
              this.line.setAttribute("marker-end", "url(#arrowhead)");
          }
          this.update();
        }
        setDashType(type) {
          this.dashType = type;
          this.line.removeAttribute("stroke-dasharray");
          if (type === "dashed") {
            this.line.setAttribute("stroke-dasharray", "4,4");
          }
          this.update();
        }
      }

      /* ===== 6. 共有モーダルクラス ===== */
      class ShareModal {
        constructor() {
          this.modal = document.getElementById('shareModal');
          this.overlay = document.getElementById('shareModalOverlay');
          this.jsonUrlInput = document.getElementById('jsonUrlInput');
          this.generatedUrlContainer = document.getElementById('generatedUrlContainer');
          this.generatedUrlInput = document.getElementById('generatedUrlInput');
          this.cancelBtn = document.getElementById('cancelShareBtn');
          this.generateBtn = document.getElementById('generateUrlBtn');
          this.copyBtn = document.getElementById('copyUrlBtn');
          this.copyMessage = document.querySelector('#shareModal .copy-message');

          this.addEventListeners();
        }

        addEventListeners() {
          // キャンセルボタン
          this.cancelBtn.addEventListener('click', () => this.close());
          this.overlay.addEventListener('click', () => this.close());

          // URL生成ボタン
          this.generateBtn.addEventListener('click', () => this.generateUrl());

          // コピーボタン
          this.copyBtn.addEventListener('click', () => this.copyToClipboard());

          // Enterキーの処理
          this.jsonUrlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              this.generateUrl();
            }
          });
        }

        show() {
          this.overlay.style.display = 'block';
          this.modal.style.display = 'block';
          this.jsonUrlInput.focus();

          // 表示状態をリセット
          this.generatedUrlContainer.style.display = 'none';
          this.generateBtn.style.display = 'inline-block';
          this.copyBtn.style.display = 'none';
          this.jsonUrlInput.value = '';
          this.generatedUrlInput.value = '';
          if (this.copyMessage) this.copyMessage.style.display = 'none';
        }

        close() {
          this.overlay.style.display = 'none';
          this.modal.style.display = 'none';
        }

        generateUrl() {
          const jsonUrl = this.jsonUrlInput.value.trim();
          if (!jsonUrl) {
            alert('JSONファイルのURLを入力してください');
            return;
          }

          // URLの形式を簡易チェック
          if (!jsonUrl.startsWith('http') || !jsonUrl.endsWith('.json')) {
            const continueAnyway = confirm('入力されたURLが正しいJSONファイルのURLではない可能性があります。続行しますか？');
            if (!continueAnyway) return;
          }

          try {
            const shareUrl = `${window.location.origin}${window.location.pathname}?json=${encodeURIComponent(jsonUrl)}`;
            this.generatedUrlInput.value = shareUrl;
            this.generatedUrlContainer.style.display = 'block';
            this.generateBtn.style.display = 'none';
            this.copyBtn.style.display = 'inline-block';
          } catch (error) {
            alert('URL生成中にエラーが発生しました: ' + error.message);
          }
        }

        copyToClipboard() {
          this.generatedUrlInput.select();
          document.execCommand('copy');

          // コピー成功メッセージを表示
          if (this.copyMessage) {
            this.copyMessage.style.display = 'block';
            setTimeout(() => {
              this.copyMessage.style.display = 'none';
            }, 2000);
          }
        }
      }

      /* ===== 6. アプリ全体管理クラス ===== */
      class YaNoteApp {
        constructor() {
          this.canvas = document.getElementById("canvas");
          this.svg = document.getElementById("svg");
          this.nodes = [];
          this.connections = [];
          this.selectedNode = null;
          this.selectedNodes = [];
          this.selectedConnection = null;
          this.selectedConnections = [];
          this.branchCreationJustHappened = false;
          this.moveTimer = null;
          this.undoStack = [];
          this.redoStack = [];
          this.globalPan = { x: 0, y: 0 };
          this.globalZoom = 1;
          this.firstNodeType = "standard";
          this.defaultNodeType = "dotted";
          this.defaultLineType = "standard";
          this.defaultDashType = "solid";
          this.alignBtn = null;
          this.alignMenu = null;
          this.clipboardSelection = null;
          this.clipboardPasteCount = 0;
          this.restored = false;
          // 編集中ノードの管理
          this.editingNode = null;
          this.updateGlobalTransform();
          this.initEventListeners();

          // iOSでのスクロール防止とダブルタップズーム防止
          document.addEventListener('touchmove', function (e) {
            if (e.touches.length >= 2) return;
            if (!e.target.closest('#canvas')) {
              e.preventDefault();
            }
          }, { passive: false });

          document.addEventListener('touchstart', function (e) {
            if (e.touches.length >= 2) return;
            if (e.target.closest('.node')) {
              const tappedNode = e.target.closest('.node');
              if (!tappedNode.classList.contains('editing')) {
                e.preventDefault();
              }
              return;
            }
            const editingNode = document.querySelector('.node.editing');
            if (editingNode && editingNode.contains(e.target)) return;
            if (e.target.closest('#canvas') && e.touches.length === 1) {
              e.preventDefault();
            }
          }, { passive: false });

          let lastTouchEnd = 0;
          document.addEventListener('touchend', function (e) {
            if (e.changedTouches.length >= 2) return;
            const now = Date.now();
            const DOUBLE_TAP_DELAY = 300;
            const editingNode = document.querySelector('.node.editing');
            if ((!editingNode || !editingNode.contains(e.target)) && now - lastTouchEnd < DOUBLE_TAP_DELAY) {
              e.preventDefault();
            }
            lastTouchEnd = now;
          }, { passive: false });

          this.titleField = titleField;

          // 新規ボタンからのリロードかどうかをチェック
          const stored = localStorage.getItem("yaNoteData");
          const skipGuide = localStorage.getItem("skipGuideLoad");

          if (stored) {
            // ローカルストレージにデータがある場合はそれを読み込む
            this.loadFromLocalStorage();
            this.restored = true;
          } else if (skipGuide === "true") {
            // 新規ボタンからのリロードの場合
            localStorage.removeItem("skipGuideLoad"); // フラグをリセット

            // 通常の新規初期化処理（中心ノードのみ作成）
            const cx = 5000, cy = 5000;
            let node = this.createNode("中心ノード", cx, cy);
            node.setType(this.firstNodeType);
            this.centerNode = node;
            this.saveState();
            this.restored = true;
          } else {
            // 通常の初回読み込み時（データもなく、新規ボタンからでもない場合）
            // index.jsonからガイドを読み込む
            this.loadGuideFromIndexJson().then(success => {
              if (!success) {
                // ガイド読み込みに失敗した場合は通常の初期化
                const cx = 5000, cy = 5000;
                let node = this.createNode("中心ノード", cx, cy);
                node.setType(this.firstNodeType);
                this.centerNode = node;
                this.saveState();
              }
              this.restored = true;
            });
          }

          if (!this.restored) {
            window.addEventListener("resize", () => this.recalcCenter());
            window.addEventListener("load", () => this.recalcCenter());
          }
          this.updateControlButtonsState();
          // コピーライト要素のバージョン情報を更新
          const copyright = document.getElementById("copyright");
          if (copyright) {
            copyright.textContent = copyright.textContent.replace(/yaNote v[0-9.]+/, `yaNote ${VERSION}`);
          }
          Logger.log("YaNoteApp initialized");
        }
        updateGlobalTransform() {
          this.canvas.style.transform = `translate(-5000px, -5000px) translate(${this.globalPan.x}px, ${this.globalPan.y}px) scale(${this.globalZoom})`;
        }
        // アンカー（画面座標）直下の点を固定したままズーム倍率を変更する
        setZoom(newZoom, anchorClientX, anchorClientY) {
          newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newZoom));
          if (newZoom === this.globalZoom) {
            Utils.updateZoomDisplay(this.globalZoom);
            return;
          }
          const rect = this.canvas.getBoundingClientRect();
          // transform-origin 0 0 のため rect.left/top はズーム非依存（基準位置＋パン）
          const px = (anchorClientX - rect.left) / this.globalZoom;
          const py = (anchorClientY - rect.top) / this.globalZoom;
          this.globalPan.x += px * (this.globalZoom - newZoom);
          this.globalPan.y += py * (this.globalZoom - newZoom);
          this.globalZoom = newZoom;
          this.updateGlobalTransform();
          this.updateAllConnections();
          Utils.updateZoomDisplay(this.globalZoom);
        }
        recalcCenter() {
          let center = this.nodes.find(n => n.element.textContent.trim() === "中心ノード") || this.nodes[0];
          if (center) {
            const rect = center.element.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            this.globalPan.x = (window.innerWidth / 2) - cx;
            this.globalPan.y = (window.innerHeight / 2) - cy;
            this.updateGlobalTransform();
            this.updateAllConnections();
          }
        }
        eventToLogical(e) {
          const rect = this.canvas.getBoundingClientRect();
          return { x: (e.clientX - rect.left) / this.globalZoom, y: (e.clientY - rect.top) / this.globalZoom };
        }
        initEventListeners() {
          this.canvas.addEventListener("mousedown", e => { if (e.button === 2) this.startPan(e); });
          this.canvas.addEventListener("contextmenu", e => { if (this.canvas.style.cursor === "grabbing") e.preventDefault(); });

          // キャンバス全体に対する contextmenu イベントの処理
          this.canvas.addEventListener("contextmenu", e => {
            // 編集中のノード上でない場合はすべての右クリックメニューを抑制
            const editingNode = e.target.closest(".node");
            if (!editingNode || !(editingNode.isContentEditable || editingNode.classList.contains("editing"))) {
              e.preventDefault();
            }
          });

          this.canvas.addEventListener("mousedown", e => { if (e.button === 0) this.onCanvasMouseDown(e); });
          window.addEventListener("resize", () => {
            this.closeAlignMenu();
            this.updateAllConnections();
          });
          document.addEventListener("mousedown", e => {
            if (this.alignMenu && this.alignMenu.style.display !== "none") {
              const clickedInsideMenu = this.alignMenu.contains(e.target);
              const clickedAlignBtn = this.alignBtn && this.alignBtn.contains(e.target);
              if (!clickedInsideMenu && !clickedAlignBtn) this.closeAlignMenu();
            }
            if (!e.target.closest(".node") && !e.target.closest(".html-handle") && e.target.tagName.toLowerCase() !== "line") {
              this.hideAllHandles();
            }
          });
          document.addEventListener("touchstart", e => {
            if (this.alignMenu && this.alignMenu.style.display !== "none") {
              const touchedInsideMenu = this.alignMenu.contains(e.target);
              const touchedAlignBtn = this.alignBtn && this.alignBtn.contains(e.target);
              if (!touchedInsideMenu && !touchedAlignBtn) this.closeAlignMenu();
            }
          });
          document.addEventListener("keydown", e => {
            if (e.key === "Escape") {
              this.closeAlignMenu();
            }

            // タイトルフィールド編集中はキーイベントを処理しない
            if (document.activeElement === titleField) {
              return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
              // フォーカスされている要素が contentEditable なら、デフォルトの全選択を行う
              if (document.activeElement && document.activeElement.isContentEditable) {
                return;
              }
              e.preventDefault();
              this.selectAll();
              return;
            }
            // cmd+Enter のショートカット：編集中のノードがあれば終了してから新規作成
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") {
              e.preventDefault();
              if (this.editingNode) {
                this.finishEditingNode(this.editingNode);
              }
              // 既存の処理：現在選択中のノードの直下に新規ノードを追加する
              let currentNode = this.selectedNode || this.nodes.find(n => n.element === document.activeElement);
              const offset = currentNode.element.offsetHeight + 10;
              if (currentNode) {
                const baseX = currentNode.x;
                const baseY = currentNode.y + offset;
                const newNode = this.createNode("", baseX, baseY);
                newNode.setType(currentNode.nodeType);
                this.startEditingNode(newNode);
                this.selectNode(newNode);
                this.updateControlButtonsState();
                this.saveState();
              }
            } else if (e.key === "e") {
              // eキーで、もし編集中でなければ選択中のノードを編集モードに移行
              if (this.selectedNode && !this.editingNode) {
                e.preventDefault();
                this.startEditingNode(this.selectedNode);
              }
            } else {
              if (document.activeElement && document.activeElement.isContentEditable) {
                return;
              }
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
                e.preventDefault();
                this.copySelectionToClipboard();
              } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
                e.preventDefault();
                this.cutSelectionToClipboard();
              } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
                e.preventDefault();
                this.pasteSelectionFromClipboard();
              } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
                e.preventDefault();
                this.undo();
              } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
                e.preventDefault();
                this.redo();
              } else if ((e.ctrlKey || e.metaKey) && e.key === "0") {
                // ブラウザのページズームリセットを抑止して yaNote のズームを100%に戻す
                e.preventDefault();
                this.setZoom(1, window.innerWidth / 2, window.innerHeight / 2);
              } else if (["Backspace", "Delete"].includes(e.key)) {
                e.preventDefault();
                this.deleteSelection();
                this.saveState();
              }
            }
          });
          window.addEventListener("storage", e => { if (e.key === "yaNoteData") location.reload(); });
          this.canvas.addEventListener("wheel", e => {
            if (e.ctrlKey || e.metaKey) {
              // Ctrl/⌘＋ホイール（トラックパッドのピンチ含む）でカーソル位置を中心にズーム
              e.preventDefault();
              // deltaMode=1（行単位、Firefox）はピクセル相当に換算して速度差を吸収
              const deltaY = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY;
              this.setZoom(this.globalZoom * Math.exp(-deltaY * 0.01), e.clientX, e.clientY);
              return;
            }
            e.preventDefault();
            if (e.shiftKey) {
              const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
              this.globalPan.x -= dx * 0.5;
            } else {
              if (e.deltaY !== 0) this.globalPan.y -= e.deltaY * 0.5;
              if (e.deltaX !== 0) this.globalPan.x -= e.deltaX * 0.5;
            }
            this.updateGlobalTransform();
            this.updateAllConnections();
          }, { passive: false });

          // macOS Safari のトラックパッドピンチは wheel ではなく gesture イベント（非標準）で届く
          if ("ongesturestart" in window) {
            let gestureStartZoom = 1;
            this.canvas.addEventListener("gesturestart", e => {
              e.preventDefault();
              gestureStartZoom = this.globalZoom;
            });
            this.canvas.addEventListener("gesturechange", e => {
              e.preventDefault();
              this.setZoom(gestureStartZoom * e.scale, e.clientX, e.clientY);
            });
            this.canvas.addEventListener("gestureend", e => e.preventDefault());
          }
          this.initControlPanel();

          // タッチ操作のサポート（ダブルタップ＋ドラッグで線を引く対応含む）
          let lastTapTime = 0;
          let tapPosition = { x: 0, y: 0 };
          this.canvas.addEventListener("touchstart", e => {
            if (e.touches.length >= 2) {
              // 2本指はピンチズーム（3本以上は無視）
              if (e.touches.length === 2) this.startPinchZoom(e);
              return;
            }
            if (e.target.closest(".node")) return;
            if (this.editingNode) this.finishEditingNode(this.editingNode);
            const touch = e.touches[0];
            const now = Date.now();
            const canvasRect = this.canvas.getBoundingClientRect();
            tapPosition = {
              x: touch.clientX - canvasRect.left,
              y: touch.clientY - canvasRect.top
            };
            if (lastTapTime && (now - lastTapTime < 300)) {
              e.preventDefault();
              lastTapTime = 0;
              this.startBlankDoubleTapPending({
                clientX: touch.clientX,
                clientY: touch.clientY,
                identifier: touch.identifier
              });
              return;
            }
            if (e.touches.length === 1) {
              e.preventDefault();
              lastTapTime = now;
              const startX = touch.clientX, startY = touch.clientY;
              this.canvas.style.cursor = "grabbing";
              let moved = false;
              // 増分方式のパン。途中でピンチ（2本指）を挟んでも、1本指に戻った時に
              // prev を再アンカーすることでパンがジャンプしない
              let prev = { x: touch.clientX, y: touch.clientY };

              const onTouchMove = e => {
                if (e.touches.length !== 1) { prev = null; return; }
                e.preventDefault();
                const touch = e.touches[0];
                if (!prev) { prev = { x: touch.clientX, y: touch.clientY }; return; }
                const totalDx = touch.clientX - startX, totalDy = touch.clientY - startY;
                if (!moved && Math.sqrt(totalDx * totalDx + totalDy * totalDy) > 5) moved = true;
                if (moved) {
                  this.globalPan.x += touch.clientX - prev.x;
                  this.globalPan.y += touch.clientY - prev.y;
                  requestAnimationFrame(() => {
                    this.updateGlobalTransform();
                    this.updateAllConnections();
                  });
                }
                prev = { x: touch.clientX, y: touch.clientY };
              };

              const onTouchEnd = e => {
                // ピンチの2本目の指が離れただけならパンを継続（全指が離れた時だけ解除）
                if (e.touches.length > 0) return;
                this.canvas.removeEventListener("touchmove", onTouchMove, { passive: false });
                this.canvas.removeEventListener("touchend", onTouchEnd);
                this.canvas.removeEventListener("touchcancel", onTouchEnd);
                if (moved) this.canvas.style.cursor = "default";
              };

              this.canvas.addEventListener("touchmove", onTouchMove, { passive: false });
              this.canvas.addEventListener("touchend", onTouchEnd);
              this.canvas.addEventListener("touchcancel", onTouchEnd);
            }
          }, { passive: false });
          this.canvas.addEventListener("touchend", e => {
            if (e.target.closest(".node")) return;
            if (!e.changedTouches || !e.changedTouches[0]) return;
            const touch = e.changedTouches[0];
            const canvasRect = this.canvas.getBoundingClientRect();
            const endPos = {
              x: touch.clientX - canvasRect.left,
              y: touch.clientY - canvasRect.top
            };
            const dx = endPos.x - tapPosition.x, dy = endPos.y - tapPosition.y;
            if (Math.sqrt(dx * dx + dy * dy) < 10) {
              if (this.editingNode) this.finishEditingNode(this.editingNode);
              this.clearSelection();
            }
          });

        }
        initControlPanel() {
          const changeTypeBtn = document.getElementById("changeTypeBtn");
          const changeLineTypeBtn = document.getElementById("changeLineTypeBtn");
          const changeDashTypeBtn = document.getElementById("changeDashTypeBtn");
          const boldTextBtn = document.getElementById("boldTextBtn");
          this.alignBtn = document.getElementById("alignBtn");
          this.alignMenu = document.getElementById("alignMenu");
          const nodeTypes = ["standard", "text-only", "grey", "red", "dotted"];
          const getNextType = (current) => {
            const index = nodeTypes.indexOf(current);
            return nodeTypes[(index + 1) % nodeTypes.length];
          };
          const getLabel = (type) => {
            switch (type) {
              case "standard": return "標準";
              case "text-only": return "テキスト専用";
              case "grey": return "グレー";
              case "red": return "赤";
              case "dotted": return "点線";
              default: return type;
            }
          };

          changeTypeBtn.addEventListener("click", () => {
            if (this.selectedNodes.length > 0) {
              const target = getNextType(this.selectedNodes[0].nodeType);
              this.selectedNodes.forEach(n => n.setType(target));
              this.defaultNodeType = target;
              this.saveState();
              this.updateControlButtonsState();
              Utils.showTooltip(changeTypeBtn, `ノード種類: ${getLabel(target)}`);
            } else if (this.selectedNode) {
              const target = getNextType(this.selectedNode.nodeType);
              this.selectedNode.setType(target);
              this.defaultNodeType = target;
              this.saveState();
              this.updateControlButtonsState();
              Utils.showTooltip(changeTypeBtn, `ノード種類: ${getLabel(target)}`);
            } else {
              const target = getNextType(this.defaultNodeType);
              this.defaultNodeType = target;
              this.saveState();
              this.updateControlButtonsState();
              Utils.showTooltip(changeTypeBtn, `デフォルトノード種類: ${getLabel(target)}`);
            }
          });
          changeTypeBtn.addEventListener("mouseenter", () => {
            let tip = "";
            if (this.selectedNodes.length > 0) {
              const firstType = this.selectedNodes[0].nodeType;
              const allSame = this.selectedNodes.every(n => n.nodeType === firstType);
              tip = allSame ? `選択中: ${getLabel(firstType)}` : "選択中: 混在";
            } else if (this.selectedNode) {
              tip = `選択中: ${getLabel(this.selectedNode.nodeType)}`;
            } else {
              tip = `現在のノード種類: ${getLabel(this.defaultNodeType)}`;
            }
            Utils.showTooltip(changeTypeBtn, tip);
          });

          changeLineTypeBtn.addEventListener("click", () => {
            let next;
            if (this.selectedConnections.length > 0) {
              const types = new Set(this.selectedConnections.map(c => c.lineType));
              if (types.size === 1) {
                const current = this.selectedConnections[0].lineType;
                next = current === "standard" ? "no-arrow" : current === "no-arrow" ? "reverse-arrow" : current === "reverse-arrow" ? "both-arrow" : "standard";
              } else {
                next = "standard";
              }
              this.selectedConnections.forEach(c => c.setLineType(next));
              this.defaultLineType = next;
              this.saveState();
              this.updateControlButtonsState();
              Utils.showTooltip(changeLineTypeBtn, `線種: ${this.getLineTypeName(next)}`);
            } else if (this.selectedConnection) {
              const current = this.selectedConnection.lineType;
              next = current === "standard" ? "no-arrow" : current === "no-arrow" ? "reverse-arrow" : current === "reverse-arrow" ? "both-arrow" : "standard";
              this.selectedConnection.setLineType(next);
              this.defaultLineType = next;
              this.saveState();
              this.updateControlButtonsState();
              Utils.showTooltip(changeLineTypeBtn, `線種: ${this.getLineTypeName(next)}`);
            } else {
              const current = this.defaultLineType;
              next = current === "standard" ? "no-arrow" : current === "no-arrow" ? "reverse-arrow" : current === "reverse-arrow" ? "both-arrow" : "standard";
              this.defaultLineType = next;
              this.saveState();
              this.updateControlButtonsState();
              Utils.showTooltip(changeLineTypeBtn, `デフォルト線種: ${this.getLineTypeName(next)}`);
            }
          });
          changeLineTypeBtn.addEventListener("mouseenter", () => {
            let tip = `現在の線種: ${this.getLineTypeName(this.defaultLineType)}`;
            if (this.selectedConnections.length > 0) {
              const types = new Set(this.selectedConnections.map(c => c.lineType));
              tip = types.size === 1 ? `選択中: ${this.getLineTypeName([...types][0])}` : "選択中: 混在";
            } else if (this.selectedConnection) {
              tip = `選択中: ${this.getLineTypeName(this.selectedConnection.lineType)}`;
            }
            Utils.showTooltip(changeLineTypeBtn, tip);
          });

          changeDashTypeBtn.addEventListener("click", () => {
            let next;
            if (this.selectedConnections.length > 0) {
              const types = new Set(this.selectedConnections.map(c => c.dashType));
              next = types.size === 1 ? (this.selectedConnections[0].dashType === "solid" ? "dashed" : "solid") : "solid";
              this.selectedConnections.forEach(c => c.setDashType(next));
              this.defaultDashType = next;
              this.saveState();
              this.updateControlButtonsState();
              Utils.showTooltip(changeDashTypeBtn, `線タイプ: ${this.getDashTypeName(next)}`);
            } else if (this.selectedConnection) {
              next = this.selectedConnection.dashType === "solid" ? "dashed" : "solid";
              this.selectedConnection.setDashType(next);
              this.defaultDashType = next;
              this.saveState();
              this.updateControlButtonsState();
              Utils.showTooltip(changeDashTypeBtn, `線タイプ: ${this.getDashTypeName(next)}`);
            } else {
              next = this.defaultDashType === "solid" ? "dashed" : "solid";
              this.defaultDashType = next;
              this.saveState();
              this.updateControlButtonsState();
              Utils.showTooltip(changeDashTypeBtn, `デフォルト線タイプ: ${this.getDashTypeName(next)}`);
            }
          });
          changeDashTypeBtn.addEventListener("mouseenter", () => {
            let tip = `現在の線タイプ: ${this.getDashTypeName(this.defaultDashType)}`;
            if (this.selectedConnections.length > 0) {
              const types = new Set(this.selectedConnections.map(c => c.dashType));
              tip = types.size === 1 ? `選択中: ${this.getDashTypeName([...types][0])}` : "選択中: 混在";
            } else if (this.selectedConnection) {
              tip = `選択中: ${this.getDashTypeName(this.selectedConnection.dashType)}`;
            }
            Utils.showTooltip(changeDashTypeBtn, tip);
          });

          boldTextBtn.addEventListener("click", () => {
            if (this.selectedNodes.length > 0) {
              const allBold = this.selectedNodes.every(n => n.boldText);
              const newState = !allBold;
              this.selectedNodes.forEach(n => n.setBold(newState));
              this.saveState();
              this.updateControlButtonsState();
              Utils.showTooltip(boldTextBtn, `太字: ${newState ? "オン" : "オフ"}`);
            } else if (this.selectedNode) {
              const newState = !this.selectedNode.boldText;
              this.selectedNode.setBold(newState);
              this.saveState();
              this.updateControlButtonsState();
              Utils.showTooltip(boldTextBtn, `太字: ${newState ? "オン" : "オフ"}`);
            }
          });
          boldTextBtn.addEventListener("mouseenter", () => {
            let tip = "太字";
            if (this.selectedNodes.length > 0) {
              const allBold = this.selectedNodes.every(n => n.boldText);
              const noneBold = this.selectedNodes.every(n => !n.boldText);
              tip = allBold ? "選択中: 太字" : noneBold ? "選択中: 通常" : "選択中: 混在";
            } else if (this.selectedNode) {
              tip = `選択中: ${this.selectedNode.boldText ? "太字" : "通常"}`;
            }
            Utils.showTooltip(boldTextBtn, tip);
          });

          if (this.alignBtn) {
            this.alignBtn.addEventListener("click", e => {
              e.stopPropagation();
              this.toggleAlignMenu();
            });
          }

          if (this.alignMenu) {
            this.alignMenu.addEventListener("click", e => {
              const target = e.target.closest("button[data-align-action]");
              if (!target) return;
              const action = target.dataset.alignAction;
              if (["left", "right", "top", "bottom", "center-x", "center-y"].includes(action)) {
                this.alignSelectedNodes(action);
              } else if (action === "horizontal" || action === "vertical") {
                this.distributeSelectedNodes(action);
              }
              this.closeAlignMenu();
            });
          }

          // 「？」ボタンのイベントリスナー追加
          document.getElementById("guideBtn").addEventListener("click", () => {
            const shouldProceed = confirm("利用ガイドを表示しますか？\n現在の作業内容は失われます。");
            if (shouldProceed) {
              this.loadGuideFromIndexJson().then(success => {
                if (!success) {
                  alert("ガイドの読み込みに失敗しました。");
                }
              });
            }
          });

          document.getElementById("resetViewBtn").addEventListener("click", () => {
            this.resetView();
            Utils.showTooltip(document.getElementById("resetViewBtn"), "表示位置をリセットしました");
          });

          // 追加のコントロールパネルボタンにツールチップを設定
          const additionalTooltips = {
            "resetBtn": "新規ノートを作成",
            "importBtn": "保存したノートを開く",
            "exportBtn": "現在のノートを保存",
            "aiExportBtn": "AI用Markdownで保存",
            "shareBtn": "URLで共有",
            "guideBtn": "ヘルプを表示",
            "alignBtn": "ノード整列メニュー",
            "resetViewBtn": "表示位置をリセット"
          };

          // 各ボタンにマウスエンターイベントを追加
          Object.keys(additionalTooltips).forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
              btn.addEventListener("mouseenter", () => {
                // 右端のボタンには特別な処理
                if (btnId === "guideBtn" || btnId === "shareBtn") {
                  // 特別なツールチップ表示（右端用）
                  showRightAlignedTooltip(btn, additionalTooltips[btnId]);
                } else {
                  Utils.showTooltip(btn, additionalTooltips[btnId]);
                }
              });
            }
          });

          // 右端のボタン用に位置調整したツールチップ表示関数
          function showRightAlignedTooltip(el, text) {
            Utils.hideAllTooltips();
            const tip = document.createElement("div");
            tip.className = "tooltip";
            tip.textContent = text;
            document.body.appendChild(tip);
            const rect = el.getBoundingClientRect();

            // 右端に近いボタンの場合、左寄りに表示（右端から20px離す）
            const rightEdge = window.innerWidth - 20;
            const idealLeft = rect.left + rect.width / 2 - tip.offsetWidth / 2;
            const adjustedLeft = Math.min(idealLeft, rightEdge - tip.offsetWidth);

            tip.style.left = adjustedLeft + "px";
            tip.style.top = (rect.bottom) + "px";
            setTimeout(() => { if (tip.parentNode) tip.parentNode.removeChild(tip); }, 2000);
          }

          changeTypeBtn.classList.remove("standard", "text-only", "grey", "red", "dotted");
          changeTypeBtn.classList.add(this.defaultNodeType);
          changeTypeBtn.textContent = getLabel(this.defaultNodeType);
        }
        getLineTypeName(type) {
          switch (type) {
            case "standard": return "標準矢印";
            case "no-arrow": return "矢印なし";
            case "reverse-arrow": return "逆矢印";
            case "both-arrow": return "両方向矢印";
            default: return "標準矢印";
          }
        }
        getDashTypeName(type) {
          return type === "solid" ? "実線" : "点線";
        }
        getLineTypeSymbol(type) {
          switch (type) {
            case "standard": return "→";
            case "no-arrow": return "—";
            case "reverse-arrow": return "←";
            case "both-arrow": return "↔";
            default: return "→";
          }
        }
        getDashTypeSymbol(type) {
          return type === "solid" ? "—" : "‥";
        }
        startPan(e) {
          if (e.button !== 2) return;

          // 編集中のノード上である場合は処理をスキップ
          const editingNode = e.target.closest(".node");
          if (editingNode && (editingNode.isContentEditable || editingNode.classList.contains("editing"))) {
            return;
          }

          e.preventDefault();
          const startX = e.clientX, startY = e.clientY;
          const initPan = Object.assign({}, this.globalPan);
          this.canvas.style.cursor = "grabbing";
          let moved = false;

          const onMove = e => {
            const dx = e.clientX - startX, dy = e.clientY - startY;
            if (!moved && Math.sqrt(dx * dx + dy * dy) > 5) moved = true;
            if (moved) {
              this.globalPan.x = initPan.x + dx;
              this.globalPan.y = initPan.y + dy;
              requestAnimationFrame(() => {
                this.updateGlobalTransform();
                this.updateAllConnections();
              });
            }
          };

          const onUp = e => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            if (moved) this.canvas.style.cursor = "default";
          };

          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }
        // 2本指ピンチでズーム（2点間距離の比）＋中点の移動でパン
        startPinchZoom(e) {
          e.preventDefault();
          // ノード側の長押しタイマー等が残っているとピンチ中にノード移動が発動するためキャンセル
          this.nodes.forEach(n => {
            if (n._longPressTimer) clearTimeout(n._longPressTimer);
            n._isTouching = false;
          });
          const getPinch = e => {
            const t0 = e.touches[0], t1 = e.touches[1];
            return {
              dist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
              cx: (t0.clientX + t1.clientX) / 2,
              cy: (t0.clientY + t1.clientY) / 2
            };
          };
          let prev = getPinch(e);
          const onTouchMove = e => {
            if (e.touches.length !== 2) return;
            e.preventDefault();
            const cur = getPinch(e);
            if (prev.dist > 0 && cur.dist > 0) {
              this.setZoom(this.globalZoom * (cur.dist / prev.dist), cur.cx, cur.cy);
            }
            // 中点の移動分はパン（ピンチしながらのスクロール）
            this.globalPan.x += cur.cx - prev.cx;
            this.globalPan.y += cur.cy - prev.cy;
            this.updateGlobalTransform();
            this.updateAllConnections();
            prev = cur;
          };
          const onTouchEnd = e => {
            if (e.touches.length >= 2) return;
            this.canvas.removeEventListener("touchmove", onTouchMove, { passive: false });
            this.canvas.removeEventListener("touchend", onTouchEnd);
            this.canvas.removeEventListener("touchcancel", onTouchEnd);
          };
          this.canvas.addEventListener("touchmove", onTouchMove, { passive: false });
          this.canvas.addEventListener("touchend", onTouchEnd);
          this.canvas.addEventListener("touchcancel", onTouchEnd);
        }
        // YaNoteApp クラス内にメソッドを追加
        resetView() {
          Logger.log("表示位置をリセットします");

          // 中心ノードを特定
          let centerNode = this.nodes.find(n => n.element.textContent.trim() === "中心ノード") ||
            this.nodes.find(n => n.id === 1) ||
            this.nodes[0];

          if (centerNode) {
            // 一度 rect を取得するために少し遅延させる
            setTimeout(() => {
              const rect = centerNode.element.getBoundingClientRect();
              const viewportCenterX = window.innerWidth / 2;
              const viewportCenterY = window.innerHeight / 2;
              const nodeCenterX = rect.left + rect.width / 2;
              const nodeCenterY = rect.top + rect.height / 2;

              // パン位置を調整
              this.globalPan.x += (viewportCenterX - nodeCenterX);
              this.globalPan.y += (viewportCenterY - nodeCenterY);

              // 変更を適用
              this.updateGlobalTransform();
              this.updateAllConnections();
              Logger.log("リセット完了:", this.globalPan);
            }, 50);
          } else {
            Logger.log("中心ノードが見つかりません");
          }
        }
        getAlignmentNodes() {
          if (this.editingNode) {
            this.finishEditingNode(this.editingNode);
          }
          const result = [];
          const seen = new Set();
          const addNode = (node) => {
            if (!node || seen.has(node.id)) return;
            if (!this.nodes.includes(node)) return;
            seen.add(node.id);
            result.push(node);
          };
          this.selectedNodes.forEach(addNode);
          addNode(this.selectedNode);
          return result;
        }
        toggleAlignMenu() {
          if (!this.alignBtn || !this.alignMenu) return;
          if (this.alignBtn.disabled) return;
          if (this.alignMenu.style.display !== "none") {
            this.closeAlignMenu();
            return;
          }
          this.alignMenu.style.display = "inline-block";
          this.alignMenu.setAttribute("aria-hidden", "false");
          const btnRect = this.alignBtn.getBoundingClientRect();
          const menuRect = this.alignMenu.getBoundingClientRect();
          const left = Math.min(Math.max(10, btnRect.right - menuRect.width), window.innerWidth - menuRect.width - 10);
          const top = Math.min(btnRect.bottom + 6, window.innerHeight - menuRect.height - 10);
          this.alignMenu.style.left = `${left}px`;
          this.alignMenu.style.top = `${Math.max(10, top)}px`;
        }
        closeAlignMenu() {
          if (!this.alignMenu) return;
          this.alignMenu.style.display = "none";
          this.alignMenu.setAttribute("aria-hidden", "true");
        }
        alignSelectedNodes(mode) {
          const nodes = this.getAlignmentNodes();
          if (nodes.length < 2) {
            if (this.alignBtn) Utils.showTooltip(this.alignBtn, "整列は2ノード以上を選択してください");
            return;
          }
          if (mode === "left") {
            const minX = Math.min(...nodes.map(n => n.x));
            nodes.forEach(n => n.setPosition(minX, n.y));
          } else if (mode === "right") {
            const maxRight = Math.max(...nodes.map(n => n.x + n.element.offsetWidth));
            nodes.forEach(n => n.setPosition(maxRight - n.element.offsetWidth, n.y));
          } else if (mode === "top") {
            const minY = Math.min(...nodes.map(n => n.y));
            nodes.forEach(n => n.setPosition(n.x, minY));
          } else if (mode === "bottom") {
            const maxBottom = Math.max(...nodes.map(n => n.y + n.element.offsetHeight));
            nodes.forEach(n => n.setPosition(n.x, maxBottom - n.element.offsetHeight));
          } else if (mode === "center-x") {
            const minX = Math.min(...nodes.map(n => n.x));
            const maxRight = Math.max(...nodes.map(n => n.x + n.element.offsetWidth));
            const centerX = (minX + maxRight) / 2;
            nodes.forEach(n => n.setPosition(centerX - n.element.offsetWidth / 2, n.y));
          } else if (mode === "center-y") {
            const minY = Math.min(...nodes.map(n => n.y));
            const maxBottom = Math.max(...nodes.map(n => n.y + n.element.offsetHeight));
            const centerY = (minY + maxBottom) / 2;
            nodes.forEach(n => n.setPosition(n.x, centerY - n.element.offsetHeight / 2));
          } else {
            return;
          }
          this.updateAllConnections();
          this.saveState();
          this.updateControlButtonsState();
          const labels = {
            left: "左寄せ",
            right: "右寄せ",
            top: "上寄せ",
            bottom: "下寄せ",
            "center-x": "左右中央揃え",
            "center-y": "上下中央揃え"
          };
          if (this.alignBtn) Utils.showTooltip(this.alignBtn, `${labels[mode]}（${nodes.length}ノード）`);
        }
        distributeSelectedNodes(axis) {
          const nodes = this.getAlignmentNodes();
          if (nodes.length < 3) {
            if (this.alignBtn) Utils.showTooltip(this.alignBtn, "等間隔は3ノード以上を選択してください");
            return;
          }
          const sorted = nodes.slice().sort((a, b) => {
            if (axis === "horizontal") {
              if (a.x !== b.x) return a.x - b.x;
            } else {
              if (a.y !== b.y) return a.y - b.y;
            }
            return a.id - b.id;
          });
          if (axis === "horizontal") {
            const first = sorted[0];
            const last = sorted[sorted.length - 1];
            const sumWidths = sorted.slice(0, -1).reduce((sum, n) => sum + n.element.offsetWidth, 0);
            const gap = (last.x - first.x - sumWidths) / (sorted.length - 1);
            let prevEnd = first.x + first.element.offsetWidth;
            for (let i = 1; i < sorted.length - 1; i++) {
              const node = sorted[i];
              const nextX = prevEnd + gap;
              node.setPosition(nextX, node.y);
              prevEnd = nextX + node.element.offsetWidth;
            }
          } else if (axis === "vertical") {
            const first = sorted[0];
            const last = sorted[sorted.length - 1];
            const sumHeights = sorted.slice(0, -1).reduce((sum, n) => sum + n.element.offsetHeight, 0);
            const gap = (last.y - first.y - sumHeights) / (sorted.length - 1);
            let prevEnd = first.y + first.element.offsetHeight;
            for (let i = 1; i < sorted.length - 1; i++) {
              const node = sorted[i];
              const nextY = prevEnd + gap;
              node.setPosition(node.x, nextY);
              prevEnd = nextY + node.element.offsetHeight;
            }
          } else {
            return;
          }
          this.updateAllConnections();
          this.saveState();
          this.updateControlButtonsState();
          if (this.alignBtn) Utils.showTooltip(this.alignBtn, `${axis === "horizontal" ? "横等間隔" : "縦等間隔"}（${nodes.length}ノード）`);
        }
        copySelectionToClipboard(showFeedback = true) {
          if (this.editingNode) {
            this.finishEditingNode(this.editingNode);
          }
          const nodes = this.getAlignmentNodes();
          if (nodes.length === 0) {
            if (showFeedback && this.alignBtn) Utils.showTooltip(this.alignBtn, "コピーするノードを選択してください");
            return false;
          }
          const nodeSet = new Set(nodes);
          const copiedNodes = nodes.map(n => ({
            id: n.id,
            text: n.rawText,
            x: n.x,
            y: n.y,
            nodeType: n.nodeType,
            boldText: n.boldText
          }));
          const copiedConnections = this.connections
            .filter(c => c.fromNode && c.toNode && nodeSet.has(c.fromNode) && nodeSet.has(c.toNode))
            .map(c => ({
              fromId: c.fromNode.id,
              toId: c.toNode.id,
              lineType: c.lineType,
              dashType: c.dashType
            }));
          this.clipboardSelection = {
            nodes: copiedNodes,
            connections: copiedConnections
          };
          this.clipboardPasteCount = 0;
          if (showFeedback && this.alignBtn) Utils.showTooltip(this.alignBtn, `コピー: ${copiedNodes.length}ノード`);
          return true;
        }
        cutSelectionToClipboard() {
          const copied = this.copySelectionToClipboard(false);
          if (!copied) {
            if (this.alignBtn) Utils.showTooltip(this.alignBtn, "カットするノードを選択してください");
            return false;
          }
          const cutCount = this.clipboardSelection?.nodes?.length || 0;
          this.deleteSelection();
          this.saveState();
          this.updateControlButtonsState();
          if (this.alignBtn) Utils.showTooltip(this.alignBtn, `カット: ${cutCount}ノード`);
          return true;
        }
        pasteSelectionFromClipboard() {
          if (!this.clipboardSelection || !this.clipboardSelection.nodes || this.clipboardSelection.nodes.length === 0) {
            if (this.alignBtn) Utils.showTooltip(this.alignBtn, "貼り付けるデータがありません");
            return;
          }
          if (this.editingNode) {
            this.finishEditingNode(this.editingNode);
          }
          this.clipboardPasteCount += 1;
          const offset = 40 * this.clipboardPasteCount;
          const createdNodes = [];
          const nodeMap = new Map();
          this.clipboardSelection.nodes.forEach(nd => {
            const newNode = this.createNode(nd.text, nd.x + offset, nd.y + offset);
            newNode.setType(nd.nodeType || "standard");
            newNode.setBold(!!nd.boldText);
            createdNodes.push(newNode);
            nodeMap.set(nd.id, newNode);
          });
          this.clipboardSelection.connections.forEach(cd => {
            const fromNode = nodeMap.get(cd.fromId);
            const toNode = nodeMap.get(cd.toId);
            if (!fromNode || !toNode) return;
            const conn = this.createConnection(fromNode, toNode);
            if (cd.lineType) conn.setLineType(cd.lineType);
            if (cd.dashType) conn.setDashType(cd.dashType);
          });
          this.clearSelection();
          this.selectedNode = createdNodes[0] || null;
          createdNodes.forEach(n => {
            this.selectedNodes.push(n);
            n.element.classList.add("selected");
          });
          this.updateAllConnections();
          this.saveState();
          this.updateControlButtonsState();
          if (this.alignBtn) Utils.showTooltip(this.alignBtn, `貼り付け: ${createdNodes.length}ノード`);
        }
        startNodeTouchMove(e, node) {
          if (!this.selectedNodes.includes(node)) {
            this.clearSelection();
            this.selectNode(node);
          }
          const touch = e.touches[0];
          const canvasRect = this.canvas.getBoundingClientRect();
          const startPos = {
            x: touch.clientX - canvasRect.left,
            y: touch.clientY - canvasRect.top
          };
          const initialNodePos = { x: node.x, y: node.y };
          const onTouchMove = (e) => {
            if (e.touches.length !== 1) return; // 2本指（ピンチ）中はノード移動しない
            e.preventDefault();
            const touch = e.touches[0];
            const currentPos = {
              x: touch.clientX - canvasRect.left,
              y: touch.clientY - canvasRect.top
            };
            const dx = (currentPos.x - startPos.x) / this.globalZoom;
            const dy = (currentPos.y - startPos.y) / this.globalZoom;
            node.setPosition(initialNodePos.x + dx, initialNodePos.y + dy);
            this.updateAllConnections();
          };
          const onTouchEnd = (e) => {
            document.removeEventListener("touchmove", onTouchMove);
            document.removeEventListener("touchend", onTouchEnd);
            document.removeEventListener("touchcancel", onTouchEnd);
            this.saveState();
          };
          document.addEventListener("touchmove", onTouchMove, { passive: false });
          document.addEventListener("touchend", onTouchEnd);
          document.addEventListener("touchcancel", onTouchEnd);
        }
        onCanvasMouseDown(e) {
          // クリックされた要素が編集中のノード内の場合、
          // かつクリックがシングル（e.detail === 1）なら何もしない
          if (this.editingNode && e.target.closest(".node") === this.editingNode.element && e.detail === 1) {
            return;
          }
          // それ以外で編集中なら、まず編集を終了する
          if (this.editingNode) {
            this.finishEditingNode(this.editingNode);
          }
          // ノード上でのシングルクリックの場合は何もしない（選択処理等はノード側で）
          if (e.target.closest(".node") && e.detail === 1) return;
          if (e.detail === 1) {
            this.clearSelection();
            const selRect = document.createElement("div");
            selRect.id = "selectionRect";
            selRect.style.left = e.clientX + "px";
            selRect.style.top = e.clientY + "px";
            document.body.appendChild(selRect);
            const startX = e.clientX, startY = e.clientY;
            const onMove = e => {
              const x = Math.min(startX, e.clientX);
              const y = Math.min(startY, e.clientY);
              selRect.style.left = x + "px";
              selRect.style.top = y + "px";
              selRect.style.width = Math.abs(e.clientX - startX) + "px";
              selRect.style.height = Math.abs(e.clientY - startY) + "px";
            };
            const onUp = e => {
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
              const selBox = selRect.getBoundingClientRect();
              this.nodes.forEach(n => {
                const nBox = n.element.getBoundingClientRect();
                if (!(nBox.right < selBox.left || nBox.left > selBox.right || nBox.bottom < selBox.top || nBox.top > selBox.bottom)) {
                  this.selectedNodes.push(n);
                  n.element.classList.add("selected");
                }
              });
              this.connections.forEach(c => {
                const lBox = c.line.getBoundingClientRect();
                if (!(lBox.right < selBox.left || lBox.left > selBox.right || lBox.bottom < selBox.top || lBox.top > selBox.bottom)) {
                  this.selectedConnections.push(c);
                  c.line.classList.add("selected-line");
                  c.showHandles();
                }
              });
              const hasSelection = this.selectedNodes.length > 0 || this.selectedConnections.length > 0;
              if (this.editingNode && hasSelection) {
                this.finishEditingNode(this.editingNode);
              }

              document.body.removeChild(selRect);
              this.updateControlButtonsState();
              this.saveState();
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          } else if (e.detail === 2) {
            this.startBlankDoubleClick(e);
          }
        }
        startMove(e, node) {
          if (!this.selectedNodes.includes(node)) {
            this.clearSelection();
            this.selectNode(node);
          }
          if (this.selectedNodes.length + this.selectedConnections.length > 1) { this.startGroupMove(e); return; }
          const group = [node];
          this.clearSelection();
          group.forEach(n => n.element.classList.add("selected"));
          this.selectedNodes = group;
          this.selectedNode = node;
          const start = this.eventToLogical(e);
          const initPos = new Map(group.map(n => [n, { x: n.x, y: n.y }]));
          let dragging = false;
          const onMove = e => {
            const cur = this.eventToLogical(e);
            const dx = cur.x - start.x, dy = cur.y - start.y;
            if (!dragging && Math.sqrt(dx * dx + dy * dy) > 5) dragging = true;
            if (dragging) {
              group.forEach(n => {
                const pos = initPos.get(n);
                n.setPosition(pos.x + dx, pos.y + dy);
              });
              this.updateAllConnections();
            }
          };
          const onUp = e => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            this.saveState();
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }
        startGroupMove(e) {
          const start = this.eventToLogical(e);
          const initPos = new Map(this.selectedNodes.map(n => [n, { x: n.x, y: n.y }]));
          const connInit = new Map();
          this.selectedConnections.forEach(c => {
            if (c.fromCoord && c.toCoord)
              connInit.set(c, { from: Object.assign({}, c.fromCoord), to: Object.assign({}, c.toCoord) });
          });
          const connected = new Set();
          this.connections.forEach(c => {
            if ((c.fromNode && this.selectedNodes.includes(c.fromNode)) || (c.toNode && this.selectedNodes.includes(c.toNode))) {
              if (!this.selectedConnections.includes(c)) connected.add(c);
            }
          });
          const onMove = e => {
            const cur = this.eventToLogical(e);
            const dx = cur.x - start.x, dy = cur.y - start.y;
            this.selectedNodes.forEach(n => {
              const pos = initPos.get(n);
              n.setPosition(pos.x + dx, pos.y + dy);
            });
            this.selectedConnections.forEach(c => {
              if (connInit.has(c)) {
                const pos = connInit.get(c);
                c.fromCoord = { x: pos.from.x + dx, y: pos.from.y + dy };
                c.toCoord = { x: pos.to.x + dx, y: pos.to.y + dy };
              }
              c.update();
            });
            connected.forEach(c => c.update());
          };
          const onUp = e => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            this.saveState();
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }
        handleNodeMouseDown(e, node) {
          // 他のノード選択時、もし編集中のノードがあれば強制終了
          if (this.editingNode && this.editingNode !== node) {
            this.finishEditingNode(this.editingNode);
          }
          if (this.selectedConnection) {
            this.selectedConnection.line.classList.remove("selected-line");
            this.selectedConnection.hideHandles();
            this.selectedConnection = null;
          }
          if (e.detail === 2) {
            if (this.moveTimer) { clearTimeout(this.moveTimer); this.moveTimer = null; }
            this.startDoubleClick(e, node);
            return;
          }
          const startTime = Date.now();
          this.moveTimer = setTimeout(() => { this.startMove(e, node); this.moveTimer = null; }, 250);
          const cancel = () => {
            if (Date.now() - startTime < 250) {
              clearTimeout(this.moveTimer);
              this.moveTimer = null;
              this.clearSelection();
              this.selectNode(node);
              this.hideAllHandles();
              this.updateControlButtonsState();
            }
            document.removeEventListener("mouseup", cancel);
          };
          document.addEventListener("mouseup", cancel);
        }
        startDoubleClick(e, node) {
          const start = { x: e.clientX, y: e.clientY };
          let branch = false;
          const onMove = e => {
            const dx = e.clientX - start.x, dy = e.clientY - start.y;
            if (!branch && Math.sqrt(dx * dx + dy * dy) > 10) {
              branch = true;
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
              this.startBranchCreation(e, node);
            }
          };
          const onUp = e => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            if (!branch) this.startEditingNode(node);
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }
        startBranchCreation(e, node) {
          // 仮線は SVG（論理座標）に描くため、画面座標はズームで換算する
          const zoom = this.globalZoom;
          const cRect = this.canvas.getBoundingClientRect();
          const nRect = node.element.getBoundingClientRect();
          const cx = (nRect.left + nRect.width / 2 - cRect.left) / zoom;
          const cy = (nRect.top + nRect.height / 2 - cRect.top) / zoom;
          const mx = (e.clientX - cRect.left) / zoom, my = (e.clientY - cRect.top) / zoom;
          const tempLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
          tempLine.setAttribute("stroke", "#007bff");
          tempLine.setAttribute("stroke-width", "2");
          tempLine.setAttribute("stroke-dasharray", "4");
          tempLine.setAttribute("x1", cx);
          tempLine.setAttribute("y1", cy);
          tempLine.setAttribute("x2", mx);
          tempLine.setAttribute("y2", my);
          this.svg.appendChild(tempLine);
          const onMove = e => {
            const nx = (e.clientX - cRect.left) / zoom, ny = (e.clientY - cRect.top) / zoom;
            tempLine.setAttribute("x2", nx);
            tempLine.setAttribute("y2", ny);
          };
          const onUp = e => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            this.svg.removeChild(tempLine);
            this.branchCreationJustHappened = true;
            setTimeout(() => { this.branchCreationJustHappened = false; }, 300);
            const dropEl = document.elementFromPoint(e.clientX, e.clientY);
            const dropNodeEl = dropEl ? dropEl.closest(".node") : null;
            let dropNode = this.nodes.find(n => n.element === dropNodeEl);
            if (dropNode && dropNode !== node) {
              const conn = this.createConnection(node, dropNode);
              if (node.nodeType === "dotted") {
                conn.setLineType("no-arrow");
                conn.setDashType("dashed");
              } else {
                conn.setLineType("standard");
                conn.setDashType("solid");
              }
              this.clearSelection();
              this.selectNode(dropNode);
            } else {
              const pos = this.eventToLogical(e);
              const newNode = this.createNode("", pos.x, pos.y);
              newNode.setType("text-only");
              this.startEditingNode(newNode);
              const conn = this.createConnection(node, newNode);
              if (node.nodeType === "dotted") {
                conn.setLineType("no-arrow");
                conn.setDashType("dashed");
              } else {
                conn.setLineType("standard");
                conn.setDashType("solid");
              }
              this.clearSelection();
              this.selectNode(newNode);
            }
            this.updateControlButtonsState();
            this.saveState();
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }
        startBranchCreationTouch(node, touchEvent) {
          // 仮線は SVG（論理座標）に描くため、画面座標はズームで換算する
          const zoom = this.globalZoom;
          const cRect = this.canvas.getBoundingClientRect();
          const nRect = node.element.getBoundingClientRect();
          const cx = (nRect.left + nRect.width / 2 - cRect.left) / zoom;
          const cy = (nRect.top + nRect.height / 2 - cRect.top) / zoom;
          const t0 = touchEvent.touches[0];
          const mx = (t0.clientX - cRect.left) / zoom, my = (t0.clientY - cRect.top) / zoom;
          const tempLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
          tempLine.setAttribute("stroke", "#007bff");
          tempLine.setAttribute("stroke-width", "2");
          tempLine.setAttribute("stroke-dasharray", "4");
          tempLine.setAttribute("x1", cx);
          tempLine.setAttribute("y1", cy);
          tempLine.setAttribute("x2", mx);
          tempLine.setAttribute("y2", my);
          this.svg.appendChild(tempLine);
          const touchId = t0.identifier;
          const onTouchMove = (e) => {
            const t = Array.from(e.touches).find(touch => touch.identifier === touchId);
            if (!t) return;
            const nx = (t.clientX - cRect.left) / zoom, ny = (t.clientY - cRect.top) / zoom;
            tempLine.setAttribute("x2", nx);
            tempLine.setAttribute("y2", ny);
          };
          const onTouchEnd = (e) => {
            const t = Array.from(e.changedTouches).find(touch => touch.identifier === touchId);
            if (!t) return;
            document.removeEventListener("touchmove", onTouchMove, { capture: true });
            document.removeEventListener("touchend", onTouchEnd, { capture: true });
            document.removeEventListener("touchcancel", onTouchEnd, { capture: true });
            this.svg.removeChild(tempLine);
            this.branchCreationJustHappened = true;
            setTimeout(() => { this.branchCreationJustHappened = false; }, 300);
            const dropEl = document.elementFromPoint(t.clientX, t.clientY);
            const dropNodeEl = dropEl ? dropEl.closest(".node") : null;
            let dropNode = this.nodes.find(n => n.element === dropNodeEl);
            if (dropNode && dropNode !== node) {
              const conn = this.createConnection(node, dropNode);
              if (node.nodeType === "dotted") {
                conn.setLineType("no-arrow");
                conn.setDashType("dashed");
              } else {
                conn.setLineType("standard");
                conn.setDashType("solid");
              }
              this.clearSelection();
              this.selectNode(dropNode);
            } else {
              const pos = this.eventToLogical({ clientX: t.clientX, clientY: t.clientY });
              const newNode = this.createNode("", pos.x, pos.y);
              newNode.setType("text-only");
              this.startEditingNode(newNode);
              const conn = this.createConnection(node, newNode);
              if (node.nodeType === "dotted") {
                conn.setLineType("no-arrow");
                conn.setDashType("dashed");
              } else {
                conn.setLineType("standard");
                conn.setDashType("solid");
              }
              this.clearSelection();
              this.selectNode(newNode);
            }
            this.updateControlButtonsState();
            this.saveState();
          };
          document.addEventListener("touchmove", onTouchMove, { capture: true });
          document.addEventListener("touchend", onTouchEnd, { capture: true });
          document.addEventListener("touchcancel", onTouchEnd, { capture: true });
        }
        startBlankDoubleTapPending(initialTouch) {
          const startX = initialTouch.clientX, startY = initialTouch.clientY;
          const touchId = initialTouch.identifier;
          let lineModeStarted = false;
          const onTouchMove = (e) => {
            const t = Array.from(e.touches).find(touch => touch.identifier === touchId);
            if (!t) return;
            const dx = t.clientX - startX, dy = t.clientY - startY;
            if (!lineModeStarted && Math.sqrt(dx * dx + dy * dy) > 10) {
              lineModeStarted = true;
              document.removeEventListener("touchmove", onTouchMove, { capture: true });
              document.removeEventListener("touchend", onTouchEnd, { capture: true });
              document.removeEventListener("touchcancel", onTouchEnd, { capture: true });
              this.startBlankLineTouch(initialTouch, e);
            }
          };
          const onTouchEnd = (e) => {
            const t = Array.from(e.changedTouches).find(touch => touch.identifier === touchId);
            if (!t) return;
            document.removeEventListener("touchmove", onTouchMove, { capture: true });
            document.removeEventListener("touchend", onTouchEnd, { capture: true });
            document.removeEventListener("touchcancel", onTouchEnd, { capture: true });
            if (!lineModeStarted) {
              const pos = this.eventToLogical({ clientX: startX, clientY: startY });
              const newNode = this.createNode("", pos.x, pos.y);
              newNode.setType(this.defaultNodeType);
              this.startEditingNode(newNode);
              this.selectNode(newNode);
              this.updateControlButtonsState();
              this.saveState();
            }
          };
          document.addEventListener("touchmove", onTouchMove, { capture: true });
          document.addEventListener("touchend", onTouchEnd, { capture: true });
          document.addEventListener("touchcancel", onTouchEnd, { capture: true });
        }
        startBlankLineTouch(initialTouch, touchMoveEvent) {
          // 仮線は SVG（論理座標）に描くため、画面座標はズームで換算する
          const zoom = this.globalZoom;
          const cRect = this.canvas.getBoundingClientRect();
          const sx = (initialTouch.clientX - cRect.left) / zoom, sy = (initialTouch.clientY - cRect.top) / zoom;
          const tempLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
          tempLine.setAttribute("stroke", "#007bff");
          tempLine.setAttribute("stroke-width", "2");
          tempLine.setAttribute("stroke-dasharray", "4");
          tempLine.setAttribute("x1", sx);
          tempLine.setAttribute("y1", sy);
          const t0 = Array.from(touchMoveEvent.touches).find(t => t.identifier === initialTouch.identifier) || touchMoveEvent.touches[0];
          tempLine.setAttribute("x2", (t0.clientX - cRect.left) / zoom);
          tempLine.setAttribute("y2", (t0.clientY - cRect.top) / zoom);
          this.svg.appendChild(tempLine);
          const touchId = initialTouch.identifier;
          const fromCoord = this.eventToLogical({ clientX: initialTouch.clientX, clientY: initialTouch.clientY });
          const onTouchMove = (e) => {
            const t = Array.from(e.touches).find(touch => touch.identifier === touchId);
            if (!t) return;
            const nx = (t.clientX - cRect.left) / zoom, ny = (t.clientY - cRect.top) / zoom;
            tempLine.setAttribute("x2", nx);
            tempLine.setAttribute("y2", ny);
          };
          const onTouchEnd = (e) => {
            const t = Array.from(e.changedTouches).find(touch => touch.identifier === touchId);
            if (!t) return;
            document.removeEventListener("touchmove", onTouchMove, { capture: true });
            document.removeEventListener("touchend", onTouchEnd, { capture: true });
            document.removeEventListener("touchcancel", onTouchEnd, { capture: true });
            this.svg.removeChild(tempLine);
            const dropEl = document.elementFromPoint(t.clientX, t.clientY);
            const dropNodeEl = dropEl ? dropEl.closest(".node") : null;
            if (dropNodeEl) {
              const target = this.nodes.find(n => n.element === dropNodeEl);
              const conn = this.createConnection(null, target);
              conn.setLineType(this.defaultLineType);
              conn.setDashType(this.defaultDashType);
              conn.fromCoord = fromCoord;
              conn.update();
            } else {
              const conn = this.createConnection(null, null);
              conn.setLineType(this.defaultLineType);
              conn.setDashType(this.defaultDashType);
              conn.fromCoord = fromCoord;
              conn.toCoord = this.eventToLogical({ clientX: t.clientX, clientY: t.clientY });
              conn.update();
            }
            this.saveState();
          };
          document.addEventListener("touchmove", onTouchMove, { capture: true });
          document.addEventListener("touchend", onTouchEnd, { capture: true });
          document.addEventListener("touchcancel", onTouchEnd, { capture: true });
        }
        startBlankDoubleClick(e) {
          // 仮線は SVG（論理座標）に描くため、画面座標はズームで換算する
          const zoom = this.globalZoom;
          const cRect = this.canvas.getBoundingClientRect();
          const sx = (e.clientX - cRect.left) / zoom, sy = (e.clientY - cRect.top) / zoom;
          const tempLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
          tempLine.setAttribute("stroke", "#007bff");
          tempLine.setAttribute("stroke-width", "2");
          tempLine.setAttribute("stroke-dasharray", "4");
          tempLine.setAttribute("x1", sx);
          tempLine.setAttribute("y1", sy);
          tempLine.setAttribute("x2", sx);
          tempLine.setAttribute("y2", sy);
          const initClient = { x: e.clientX, y: e.clientY };
          let lineMode = false;
          let fromCoord = null;
          const onMove = e => {
            const dx = e.clientX - initClient.x, dy = e.clientY - initClient.y;
            if (!lineMode && Math.sqrt(dx * dx + dy * dy) > 10) {
              lineMode = true;
              fromCoord = this.eventToLogical({ clientX: initClient.x, clientY: initClient.y });
              this.svg.appendChild(tempLine);
            }
            if (lineMode) {
              const nx = (e.clientX - cRect.left) / zoom, ny = (e.clientY - cRect.top) / zoom;
              tempLine.setAttribute("x2", nx);
              tempLine.setAttribute("y2", ny);
            }
          };
          const onUp = e => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            if (lineMode) {
              this.svg.removeChild(tempLine);
              const dropEl = document.elementFromPoint(e.clientX, e.clientY);
              const dropNodeEl = dropEl ? dropEl.closest(".node") : null;
              if (dropNodeEl) {
                const target = this.nodes.find(n => n.element === dropNodeEl);
                const conn = this.createConnection(null, target);
                conn.setLineType(this.defaultLineType);
                conn.setDashType(this.defaultDashType);
                conn.fromCoord = fromCoord;
                conn.update();
              } else {
                const conn = this.createConnection(null, null);
                conn.setLineType(this.defaultLineType);
                conn.setDashType(this.defaultDashType);
                conn.fromCoord = fromCoord;
                conn.toCoord = this.eventToLogical(e);
                conn.update();
              }
              this.saveState();
            } else {
              const pos = this.eventToLogical(e);
              const newNode = this.createNode("", pos.x, pos.y);
              newNode.setType(this.defaultNodeType);
              this.startEditingNode(newNode);
              this.selectNode(newNode);
              this.updateControlButtonsState();
              this.saveState();
            }
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }
        createHtmlHandle() {
          const handle = document.createElement("div");
          handle.className = "html-handle";
          this.canvas.appendChild(handle);
          return handle;
        }
        addHandleDrag(handle, conn, which) {
          handle.addEventListener("mousedown", e => {
            e.stopPropagation();
            e.preventDefault();
            const startX = e.clientX, startY = e.clientY;
            const initLeft = parseFloat(handle.style.left);
            const initTop = parseFloat(handle.style.top);
            const onMove = e => {
              // ハンドル位置と fromCoord/toCoord は論理座標のため、画面上の移動量をズームで換算する
              const dx = (e.clientX - startX) / this.globalZoom;
              const dy = (e.clientY - startY) / this.globalZoom;
              handle.style.left = (initLeft + dx) + "px";
              handle.style.top = (initTop + dy) + "px";
              if (which === "from") {
                conn.fromNode = null;
                conn.fromCoord = { x: initLeft + dx + 4, y: initTop + dy + 4 };
              } else {
                conn.toNode = null;
                conn.toCoord = { x: initLeft + dx + 4, y: initTop + dy + 4 };
              }
              conn.update();
            };
            const onUp = e => {
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
              handle.style.display = "none";
              const dropEl = document.elementFromPoint(e.clientX, e.clientY);
              handle.style.display = "";
              const dropNodeEl = dropEl ? dropEl.closest(".node") : null;
              const dropNode = this.nodes.find(n => n.element === dropNodeEl);
              if (dropNode) {
                if (which === "from") { conn.fromNode = dropNode; conn.fromCoord = null; }
                else { conn.toNode = dropNode; conn.toCoord = null; }
              }
              conn.update();
              this.saveState();
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          });
        }
        captureState() {
          return {
            title: this.titleField.value,
            nodes: this.nodes.map(n => ({
              id: n.id,
              text: n.rawText,
              x: n.x,
              y: n.y,
              nodeType: n.nodeType,
              boldText: n.boldText
            })),
            connections: this.connections.map(c => ({
              fromId: c.fromNode ? c.fromNode.id : null,
              toId: c.toNode ? c.toNode.id : null,
              fromCoord: c.fromCoord,
              toCoord: c.toCoord,
              lineType: c.lineType,
              dashType: c.dashType
            })),
            globalPan: Object.assign({}, this.globalPan),
            globalZoom: this.globalZoom,
            defaultNodeType: this.defaultNodeType,
            defaultLineType: this.defaultLineType,
            defaultDashType: this.defaultDashType
          };
        }
        saveState() {
          const snap = this.captureState();
          this.undoStack.push(snap);
          this.redoStack = [];
          this.saveToLocalStorage();
        }
        restoreState(state) {
          this.nodes.forEach(n => { if (n.element.parentNode) n.element.parentNode.removeChild(n.element); });
          this.connections.forEach(c => { if (c.line.parentNode) c.line.parentNode.removeChild(c.line); c.hideHandles(); });
          this.nodes = [];
          this.connections = [];
          const map = {};
          state.nodes.forEach(nd => {
            const node = new NoteNode(nd.text, nd.x, nd.y, this, nd.id);
            node.setType(nd.nodeType || "standard");
            if (nd.boldText) node.setBold(true);
            this.nodes.push(node);
            map[nd.id] = node;
          });
          state.connections.forEach(cd => {
            let from = cd.fromId in map ? map[cd.fromId] : null;
            let to = cd.toId in map ? map[cd.toId] : null;
            const conn = new Connection(from, to, this);
            if (cd.lineType) conn.setLineType(cd.lineType);
            if (cd.dashType) conn.setDashType(cd.dashType);
            conn.fromCoord = cd.fromCoord;
            conn.toCoord = cd.toCoord;
            conn.update();
            this.connections.push(conn);
          });
          if (state.defaultNodeType) this.defaultNodeType = state.defaultNodeType;
          if (state.defaultLineType) this.defaultLineType = state.defaultLineType;
          if (state.defaultDashType) this.defaultDashType = state.defaultDashType;
          // 旧形式データ（globalPan/globalZoom を持たない外部 JSON）でも transform が壊れないようフォールバック
          this.globalPan = state.globalPan || { x: 0, y: 0 };
          this.globalZoom = state.globalZoom || 1;
          if (state.title) {
            this.titleField.value = state.title;
            adjustTitleFieldWidth();
          }
          this.updateGlobalTransform();
          this.updateAllConnections();
          this.updateControlButtonsState();
        }
        saveToLocalStorage() {
          const state = { version: VERSION, data: this.captureState() };
          localStorage.setItem("yaNoteData", JSON.stringify(state));
        }
        loadFromLocalStorage() {
          const data = localStorage.getItem("yaNoteData");
          if (data) {
            try {
              const obj = JSON.parse(data);
              this.restoreState(obj.data);
              // ここで復元後の状態を undoStack に追加
              this.undoStack.push(this.captureState());
            } catch (e) { alert("データ読み込みエラー: " + e.message); }
          }
        }
        async loadGuideFromIndexJson() {
          try {
            const response = await fetch('index.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const imp = await response.json();
            this.restoreState(imp.data);
            this.saveState();

            // iOS/iPadOS Safariの場合は必ずリロード、それ以外は中心に戻る＋再描画を実施
            if (/iP(ad|hone|od)/.test(navigator.userAgent) &&
              /Safari/.test(navigator.userAgent) &&
              !/Chrome/.test(navigator.userAgent)) {
              location.reload();
            } else {
              requestAnimationFrame(() => {
                this.resetView();
              });
            }

            return true;
          } catch (err) {
            Logger.log("index.json読み込みエラー:", err.message);
            return false;
          }
        }


        undo() {
          if (this.undoStack.length > 1) {
            const cur = this.undoStack.pop();
            this.redoStack.push(cur);
            const prev = this.undoStack[this.undoStack.length - 1];
            this.restoreState(prev);
          }
        }
        redo() {
          if (this.redoStack.length > 0) {
            const nxt = this.redoStack.pop();
            this.undoStack.push(nxt);
            this.restoreState(nxt);
          }
        }
        createNode(text, x, y) {
          const n = new NoteNode(text, x, y, this);
          n.setType(this.defaultNodeType);
          this.nodes.push(n);
          return n;
        }
        createConnection(from, to) {
          const c = new Connection(from, to, this);
          c.setLineType(this.defaultLineType);
          c.setDashType(this.defaultDashType);
          this.connections.push(c);
          return c;
        }
        updateAllConnections() {
          this.connections.forEach(c => c.update());
        }
        clearSelection() {
          if (this.selectedNode) { this.selectedNode.element.classList.remove("selected"); this.selectedNode = null; }
          if (this.selectedConnection) { this.selectedConnection.line.classList.remove("selected-line"); this.selectedConnection.hideHandles(); this.selectedConnection = null; }
          this.selectedNodes.forEach(n => n.element.classList.remove("selected"));
          this.selectedNodes = [];
          this.selectedConnections.forEach(c => { c.line.classList.remove("selected-line"); c.hideHandles(); });
          this.selectedConnections = [];
          this.updateControlButtonsState();
        }
        selectAll() {
          // まず、既存の選択状態をクリア
          this.clearSelection();
          // 全ノードを選択
          this.nodes.forEach(n => {
            this.selectedNodes.push(n);
            n.element.classList.add("selected");
          });
          // 全接続線を選択（必要なら）
          this.connections.forEach(c => {
            this.selectedConnections.push(c);
            c.line.classList.add("selected-line");
            c.showHandles();
          });
          this.updateControlButtonsState();
        }


        hideAllHandles() {
          this.connections.forEach(c => c.hideHandles());
        }
        selectNode(n) {
          // 他のノードが選択された場合、もし編集中のノードがあれば終了させる（v1.2.13.1）
          if (this.editingNode && this.editingNode !== n) {
            this.finishEditingNode(this.editingNode);
          }
          this.clearSelection();
          this.selectedNode = n;
          this.selectedNodes = [n];
          n.element.classList.add("selected");
          this.updateControlButtonsState();
        }

        selectConnection(c) {
          this.clearSelection();
          this.selectedConnection = c;
          this.selectedConnections = [c];
          c.line.classList.add("selected-line");
          c.showHandles();
          this.updateControlButtonsState();
        }

        finishEditingNode(n) {
          // 以前登録したイベントリスナーを解除
          if (n._onKeyDown) {
            n.element.removeEventListener("keydown", n._onKeyDown);
            delete n._onKeyDown;
          }
          if (n._onInput) {
            n.element.removeEventListener("input", n._onInput);
            delete n._onInput;
          }

          n.element.contentEditable = "false";
          n.element.classList.remove("editing");

          // z-indexを元に戻す
          if (n._originalZIndex !== undefined) {
            n.element.style.zIndex = n._originalZIndex;
            delete n._originalZIndex;
          } else {
            // 明示的に設定したz-indexを削除して継承に戻す
            n.element.style.removeProperty("z-index");
          }

          // ユーザーが入力したテキストを取得（プレーンテキスト）
          let newRaw = n.element.innerText.trim();
          if (newRaw === "") {
            this.selectNode(n);
            this.deleteSelection();
            this.saveState();
            this.editingNode = null;
            return;
          }

          // ユーザー入力を新たな rawText として保持
          n.rawText = newRaw;
          // その rawText をもとにリンク変換を行い、HTML化する
          n.setText(n.rawText);

          this.selectNode(n);
          this.updateAllConnections();
          this.saveState();
          this.editingNode = null;

          // ③ タイトルフィールド更新：初回のみ反映する
          const currentTitle = this.titleField.value.trim();
          if (n === this.centerNode && (currentTitle === "" || currentTitle === "無題")) {
            this.titleField.value = newRaw;
            adjustTitleFieldWidth();
          }
        }



        startEditingNode(n) {
          // もし他のノードが編集中なら終了させる
          if (this.editingNode && this.editingNode !== n) {
            this.finishEditingNode(this.editingNode);
          }
          this.clearSelection();
          this.selectedNode = n;
          this.selectedNodes = [n];
          n.element.classList.add("selected");

          // 編集前のz-indexを保存
          n._originalZIndex = n.element.style.zIndex || "";

          // 編集開始時は元の Markdown テキストを表示
          n.element.textContent = n.rawText;
          n.element.contentEditable = "true";
          n.element.classList.add("editing");

          // 編集中ノードを最前面に表示するための明示的なz-index設定
          n.element.style.zIndex = "1000";

          // イベントリスナーを登録し、プロパティに保持する
          const onKeyDown = e => {
            if (e.key === "Enter") {
              // IME入力中のEnterキーは処理しない
              if (e.isComposing) {
                return; // IME変換中のEnterは無視
              }
              
              if (e.shiftKey) {
                e.stopPropagation();
                setTimeout(() => {
                  n.anchorOffset = n.element.scrollHeight;
                  n.setPosition(n.x, n.y);
                  this.updateAllConnections();
                }, 0);
              } else {
                e.preventDefault();
                // Enter キー1回で編集終了に変更
                this.finishEditingNode(n);
              }
            }
          };
          const onInput = e => {
            n.anchorOffset = n.element.scrollHeight;
            n.setPosition(n.x, n.y);
            this.updateAllConnections();
          };
          n.element.addEventListener("keydown", onKeyDown);
          n.element.addEventListener("input", onInput);
          n._onKeyDown = onKeyDown;
          n._onInput = onInput;

          n.element.focus();
          const range = document.createRange();
          range.selectNodeContents(n.element);
          range.collapse(false);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          // 編集中のノードとして管理
          this.editingNode = n;
        }

        deleteSelection() {
          if (this.selectedConnections.length > 0) {
            this.selectedConnections.forEach(c => {
              c.hideHandles();
              if (c.line.parentNode) c.line.parentNode.removeChild(c.line);
            });
            this.connections = this.connections.filter(c => !this.selectedConnections.includes(c));
            this.selectedConnections = [];
          }
          if (this.selectedNodes.length > 0) {
            this.selectedNodes.forEach(n => {
              this.connections = this.connections.filter(c => {
                if (c.fromNode === n || c.toNode === n) {
                  c.hideHandles();
                  if (c.line.parentNode) c.line.parentNode.removeChild(c.line);
                  return false;
                }
                return true;
              });
              if (n.element.parentNode) n.element.parentNode.removeChild(n.element);
            });
            this.nodes = this.nodes.filter(n => !this.selectedNodes.includes(n));
            this.selectedNodes = [];
          } else if (this.selectedNode) {
            if (this.selectedNode.element.parentNode) this.selectedNode.element.parentNode.removeChild(this.selectedNode.element);
            this.connections = this.connections.filter(c => {
              if (c.fromNode === this.selectedNode || c.toNode === this.selectedNode) {
                c.hideHandles();
                if (c.line.parentNode) c.line.parentNode.removeChild(c.line);
                return false;
              }
              return true;
            });
            this.selectedNode = null;
          }
          this.clearSelection();
        }
        exportState() {
          const state = this.undoStack[this.undoStack.length - 1];
          // semantics はAI読者向けの凡例。インポート時は data しか読まれない（write-only）
          return JSON.stringify({ version: VERSION, semantics: AI_EXPORT.LEGEND, data: state }, null, 2);
        }
        updateControlButtonsState() {
          const changeTypeBtn = document.getElementById("changeTypeBtn");
          const changeLineTypeBtn = document.getElementById("changeLineTypeBtn");
          const changeDashTypeBtn = document.getElementById("changeDashTypeBtn");
          const alignBtn = document.getElementById("alignBtn");
          changeTypeBtn.classList.remove("standard", "text-only", "grey", "red", "dotted");
          changeTypeBtn.classList.add(this.defaultNodeType);
          const getLabel = (type) => {
            switch (type) {
              case "standard": return "◻︎";
              case "text-only": return "T";
              case "grey": return "GL";
              case "red": return "R";
              case "dotted": return "d";
              default: return type;
            }
          };
          changeTypeBtn.textContent = getLabel(this.defaultNodeType);

          changeTypeBtn.classList.remove("active");
          if (this.selectedNodes.length > 0) {
            if (this.selectedNodes.every(n => n.nodeType === "standard")) changeTypeBtn.classList.add("active");
          } else if (this.selectedNode && this.selectedNode.nodeType === "standard") {
            changeTypeBtn.classList.add("active");
          } else if (this.defaultNodeType === "standard") {
            changeTypeBtn.classList.add("active");
          }
          changeLineTypeBtn.textContent = this.selectedConnections.length > 0 ?
            this.getLineTypeSymbol(this.selectedConnections[0].lineType) :
            (this.selectedConnection ? this.getLineTypeSymbol(this.selectedConnection.lineType) : this.getLineTypeSymbol(this.defaultLineType));
          changeDashTypeBtn.textContent = this.selectedConnections.length > 0 ?
            this.getDashTypeSymbol(this.selectedConnections[0].dashType) :
            (this.selectedConnection ? this.getDashTypeSymbol(this.selectedConnection.dashType) : this.getDashTypeSymbol(this.defaultDashType));

          const boldTextBtn = document.getElementById("boldTextBtn");
          boldTextBtn.classList.remove("active");
          boldTextBtn.disabled = !(this.selectedNodes.length > 0 || this.selectedNode);
          if (this.selectedNodes.length > 0) {
            if (this.selectedNodes.every(n => n.boldText)) boldTextBtn.classList.add("active");
          } else if (this.selectedNode && this.selectedNode.boldText) {
            boldTextBtn.classList.add("active");
          }

          if (alignBtn) {
            const selectedNodeSet = new Set();
            this.selectedNodes.forEach(n => selectedNodeSet.add(n));
            if (this.selectedNode) selectedNodeSet.add(this.selectedNode);
            alignBtn.disabled = selectedNodeSet.size === 0;
            if (alignBtn.disabled) this.closeAlignMenu();
          }
        }
      }

      /* ===== 7. インスタンス生成とコントロールパネル設定 ===== */
      window.app = new YaNoteApp();

      // 共有モーダルの初期化
      const shareModal = new ShareModal();

      // 共有ボタンの設定
      document.getElementById("shareBtn").addEventListener("click", () => {
        shareModal.show();
      });

      // URL共有パラメータのチェックと処理
      const urlParams = new URLSearchParams(window.location.search);
      const jsonParam = urlParams.get('json');
      const newParam = urlParams.get('new');

      // 共有リンクからのリロード後かを判定するフラグ
      const isAfterJsonReload = sessionStorage.getItem('yaNote-jsonReloaded');

      if (jsonParam) {
        fetch(jsonParam)
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            try {
              if (data.data) {
                app.restoreState(data.data);
              } else {
                app.restoreState(data);
              }
              app.saveState();

              // URLパラメータをクリア
              window.history.replaceState({}, document.title, window.location.pathname);

              // iOS/iPadOS Safariの場合はリロードフラグを立ててからリロード
              if (/iP(ad|hone|od)/.test(navigator.userAgent) &&
                /Safari/.test(navigator.userAgent) &&
                !/Chrome/.test(navigator.userAgent)) {
                // リロード後に識別できるようフラグを設定
                sessionStorage.setItem('yaNote-jsonReloaded', 'true');
                
                // 少し遅延させてリロード
                setTimeout(() => {
                  location.reload();
                }, 100);
              } else {
                // iOS以外の場合はそのままresetView
                requestAnimationFrame(() => {
                  app.resetView();
                });
              }
            } catch (err) {
              console.error("インポートエラー:", err);
              alert("インポートできませんでした: " + err.message);
              window.history.replaceState({}, document.title, window.location.pathname);
              sessionStorage.removeItem('yaNote-jsonReloaded');
            }
          })
          .catch(error => {
            console.error("ファイル読み込みエラー:", error);
            alert("ファイルを読み込めませんでした: " + error.message);
            window.history.replaceState({}, document.title, window.location.pathname);
            sessionStorage.removeItem('yaNote-jsonReloaded');
          });
      } 
      // リロード後の処理：iOSでリロード後にresetViewを実行
      else if (isAfterJsonReload === 'true') {
        // フラグをクリア
        sessionStorage.removeItem('yaNote-jsonReloaded');
        
        // リロード後にresetViewを実行
        setTimeout(() => {
          console.log("リロード後のresetViewを実行");
          app.resetView();
        }, 200);
      }
      else if (newParam === 'true') {
        // 新規パラメータ処理（既存のコード）
        localStorage.removeItem("yaNoteData");
        localStorage.setItem("skipGuideLoad", "true");

        // URLパラメータをクリア
        window.history.replaceState({}, document.title, window.location.pathname);

        // リロードして初期化
        location.reload();
      }

      document.getElementById("resetBtn").addEventListener("click", () => {
        const shouldProceed = confirm("本当に新規作成しますか？\n現在の作業内容は失われます。");
        if (shouldProceed) {
          localStorage.removeItem("yaNoteData");
          // ガイドを表示せず、通常の新規状態にするためのフラグを設定
          localStorage.setItem("skipGuideLoad", "true");
          location.reload();
        }
      });

      // エクスポート共通: タイトル＋日時のベースファイル名と、Blobダウンロードの実行
      const exportBaseName = (now) => {
        const pad = n => n.toString().padStart(2, "0");
        const title = app.titleField.value.trim() || "無題";
        return `${title}_yaNote_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      };
      const downloadFile = (content, mime, filename) => {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // 即時 revoke するとダウンロード開始前に無効化されることがあるため遅延させる
        setTimeout(() => URL.revokeObjectURL(url), 3000);
      };
      document.getElementById("exportBtn").addEventListener("click", () => {
        try {
          downloadFile(app.exportState(), "application/json", `${exportBaseName(new Date())}.json`);
        } catch (e) { alert("エクスポートエラー: " + e.message); }
      });
      document.getElementById("aiExportBtn").addEventListener("click", () => {
        try {
          const now = new Date();
          const pad = n => n.toString().padStart(2, "0");
          const dateLabel = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
          downloadFile(Utils.toAIMarkdown(app.captureState(), { date: dateLabel }), "text/markdown", `${exportBaseName(now)}.md`);
        } catch (e) { alert("エクスポートエラー: " + e.message); }
      });
      document.getElementById("importBtn").addEventListener("click", () => {
        const shouldProceed = confirm("本当に開きますか？\n現在の作業内容は失われます。");
        if (!shouldProceed) return;
        document.getElementById("importInput").click();
      });

      document.getElementById("importInput").addEventListener("change", e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = event => {
          try {
            const imp = JSON.parse(event.target.result);
            app.restoreState(imp.data);
            app.saveState();

            // iOS/iPadOS Safariの場合のみ追加でリロードを実行
            requestAnimationFrame(() => {
              if (/iP(ad|hone|od)/.test(navigator.userAgent) &&
                /Safari/.test(navigator.userAgent) &&
                !/Chrome/.test(navigator.userAgent)) {
                // 少し遅延させてURLの更新を確実にする
                setTimeout(() => {
                  location.reload();
                }, 50);
              }
            });

          } catch (err) {
            alert("インポートエラー: " + err.message);
          }
        };
        reader.readAsText(file);
        e.target.value = "";
      });


      Logger.log("DOM fully loaded and YaNoteApp initialized.");
    });
