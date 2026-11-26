// Кэш самого приложения, чтобы оно открывалось без интернета.
// Видео сюда не попадают: они лежат в отдельной памяти приложения.
const VERSION = "kinozal-v2";
const FONTS = "kinozal-fonts-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // страницы и файлы приложения: сначала кэш (быстро и без сети), в фоне обновляем
  if (url.origin === location.origin) {
    e.respondWith(
      caches.open(VERSION).then(async cache => {
        const hit = await cache.match(req, { ignoreSearch: true });
        const net = fetch(req).then(res => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => null);
        if (hit) { e.waitUntil(net); return hit; }
        return (await net) || (await cache.match("./index.html")) || Response.error();
      })
    );
    return;
  }

  // шрифты Google: запоминаем, чтобы без интернета вид не менялся
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(
      caches.open(FONTS).then(async cache => {
        const hit = await cache.match(req);
        const net = fetch(req).then(res => { if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); return res; }).catch(() => null);
        if (hit) { e.waitUntil(net); return hit; }
        return (await net) || Response.error();
      })
    );
  }
});
