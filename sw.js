const CACHE_NAME = "yaNote-cache-v1.3.5.5"; // バージョン番号を最新に更新
const APP_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192x192.png",
  "./icons/icon-512x512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS))
  );
  // 新しい Service Worker を即座に有効にする
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // すぐにコントロールを引き継ぐ
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    // ナビゲーションリクエスト（index.html等）の場合：
    // ネットワークファーストでアクセス、失敗したらキャッシュを使用
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // 取得に成功したら、キャッシュも更新
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          return response;
        })
        .catch(() => {
          // ネットワーク接続がない場合、キャッシュから返す
          return caches.match(event.request);
        })
    );
  } else if (APP_ASSETS.some(asset => 
      event.request.url.endsWith(asset) || 
      event.request.url.includes(asset.replace('./', '/')))) {
    // アプリのコアアセットの場合：
    // ネットワークファーストでアクセス、失敗したらキャッシュを使用
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // 取得に成功したら、キャッシュも更新
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          return response;
        })
        .catch(() => {
          // ネットワーク接続がない場合、キャッシュから返す
          return caches.match(event.request);
        })
    );
  } else {
    // その他のリソース（画像や追加スクリプトなど）：
    // キャッシュファーストでアクセス、なければネットワークから取得
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request).then(fetchResponse => {
            // 取得に成功したら、キャッシュに保存（オプション）
            return fetchResponse;
          });
        })
    );
  }
});
