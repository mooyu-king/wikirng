'use strict';

const prefix = 'wikirng-static-';
const cacheName = prefix + 'd609221799a2';
const resources = new Set(["/","/index.html","/about/","/privacy/","/contact/","/terms/","/articles.js","/edition.js","/pageviews.js","/draw-rules.js","/article-media-local.js","/article-media.js","/site.js","/share-card.js","/game.js","/styles.css","/manifest.webmanifest","/archive-cover.jpg","/article-images/shapinsay-1.jpg","/article-images/shapinsay-2.jpg","/article-images/shapinsay-3.jpg","/article-images/shapinsay-4.jpg","/article-images/sundial-1.jpg","/article-images/sundial-2.jpg","/article-images/sundial-3.jpg","/article-images/sundial-4.jpg","/article-images/volcano-1.jpg","/article-images/volcano-2.jpg","/article-images/volcano-3.png","/article-images/volcano-4.jpg","/guide-images/lava-lakes.webp","/guide-images/lingavi-geo.webp","/guide-images/moot-hall.webp","/guide-images/shapinsay-harbour.webp","/brand/bronze.svg","/brand/crown.svg","/brand/diamond.svg","/brand/gold.svg","/brand/icon-192.png","/brand/icon-32.png","/brand/icon-512.png","/brand/silver.svg"]);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll([...resources])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((key) => key.startsWith(prefix) && key !== cacheName).map((key) => caches.delete(key)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !resources.has(url.pathname)) return;
  event.respondWith(fetch(event.request).catch(async () => {
    const cache = await caches.open(cacheName);
    return (await cache.match(url.pathname)) ?? Response.error();
  }));
});
