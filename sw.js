importScripts('./js/db.js');

const CACHE = 'recipe-box-v1';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/db.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(handleShareTarget(event.request));
    return;
  }
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return resp;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match(new URL('./index.html', self.registration.scope).href);
        }
        return Response.error();
      });
    })
  );
});

async function handleShareTarget(request) {
  const payload = { title: '', text: '', url: '', photos: [], at: Date.now() };
  try {
    const fd = await request.formData();
    payload.title = String(fd.get('title') || '');
    payload.text = String(fd.get('text') || '');
    payload.url = String(fd.get('url') || '');
    if (!payload.url) {
      const m = payload.text.match(/https?:\/\/[^\s]+/);
      if (m) payload.url = m[0];
    }
    for (const f of fd.getAll('media') || []) {
      if (f && f.size) payload.photos.push(f);
    }
  } catch (e) { /* store whatever we could read */ }
  await self.RecipeDB.metaSet('pendingShare', payload);
  return Response.redirect(new URL('./?share=1', self.registration.scope).href, 303);
}
