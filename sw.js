const CACHE_NAME = 'bek-nonlari-v2';
const DATA_CACHE_NAME = 'bek-nonlari-api-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/api.js',
  './js/views.js',
  './js/app.js',
  './js/pwa.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

// O'rnatish bosqichi - statik fayllarni keshga yuklash
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Ba\'zi fayllar keshlanmadi:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Faollashish bosqichi - eski keshlarni tozalash
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// So'rovlarni tutib olish (Fetch)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Faqat GET so'rovlarini keshlaymiz
  if (req.method !== 'GET') {
    return;
  }

  // API so'rovlari (backend server yoki lokal API so'rovlari)
  const isApiRequest = url.pathname.startsWith('/api') || 
                       url.origin.includes('onrender.com') || 
                       url.port === '8000' || 
                       url.searchParams.has('api');

  if (isApiRequest) {
    // Network-First with Cache Fallback for API data
    event.respondWith(
      fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(DATA_CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache);
          });
        }
        return networkResponse;
      }).catch(async () => {
        // Tarmoq uzilgan: Service Worker keshidan oxirgi javobni qaytarish
        const cache = await caches.open(DATA_CACHE_NAME);
        const cachedResponse = await cache.match(req);
        if (cachedResponse) {
          return cachedResponse;
        }
        return new Response(JSON.stringify({ 
          error: 'Oflayn rejim: internet bilan aloqa yo\'q',
          offline: true 
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Shriftlar va CDN fayllar (Google Fonts, FontAwesome) - Stale-While-Revalidate
  if (url.origin.includes('googleapis.com') || url.origin.includes('gstatic.com') || url.origin.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(req);
        const fetchPromise = fetch(req).then((networkResponse) => {
          if (networkResponse.status === 200) {
            cache.put(req, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Mahalliy statik fayllar (HTML, CSS, JS, Rasmlar) - Cache First, fallback to Network
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Yangilanishni orqa fonda tekshirish (revalidate)
        fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, networkResponse);
            });
          }
        }).catch(() => {/* Oflayn bo'lsa tinch o'tadi */});

        return cachedResponse;
      }

      return fetch(req).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Agar HTML so'ralgan bo'lsa va tarmoq yo'q bo'lsa
        if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
