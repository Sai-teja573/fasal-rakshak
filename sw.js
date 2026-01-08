const CACHE_NAME = 'fasal-rakshak-v6';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/manifest.json'
];

// External assets to cache with no-cors mode
const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdn-icons-png.flaticon.com/512/10609/10609658.png'
];

// ==========================================
// PERFORMANCE: STALE-WHILE-REVALIDATE STRATEGY
// ==========================================
const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then(networkResponse => {
    // Only cache successful responses to avoid MIME type errors (HTML fallbacks for CSS)
    if (networkResponse.ok && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);

  return cachedResponse || fetchPromise;
};

// ==========================================
// SERVICE WORKER INSTALL & ACTIVATE
// ==========================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache local assets normally
      await cache.addAll(STATIC_ASSETS);
      
      // Cache external assets with no-cors mode (opaque responses)
      for (const url of EXTERNAL_ASSETS) {
        try {
          const response = await fetch(url, { mode: 'no-cors' });
          if (response.type === 'opaque' || response.ok) {
            await cache.put(url, response);
          }
        } catch (e) {
          console.warn('[SW] Failed to cache external asset:', url, e);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      );
    })
  );
  self.clients.claim();
});

// ==========================================
// CONSOLIDATED FETCH HANDLER
// ==========================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // 1. API calls & Gov Data - network first with timeout
  if (url.pathname.startsWith('/api') || 
      url.hostname.includes('supabase') || 
      url.hostname.includes('data.gov.in') || 
      url.pathname.includes('/api/v2.0/')) {
    event.respondWith(
      Promise.race([
        fetch(request),
        new Promise((_, reject) => setTimeout(() => reject('timeout'), 5000))
      ]).then(response => {
          // Cache successful API responses too for offline fallback
          if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
          }
          return response;
      }).catch(() => caches.match(request))
    );
    return;
  }
  
  // 2. Static assets - stale-while-revalidate for fast loading
  if (request.destination === 'script' || 
      request.destination === 'style' || 
      request.destination === 'image' ||
      request.destination === 'font' ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.js')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  
  // 3. HTML pages & App logic - network first, fallback to cache
  if (request.destination === 'document' || url.pathname === '/') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }
});

// ==========================================
// PUSH NOTIFICATION HANDLER
// ==========================================

self.addEventListener('push', (event) => {
  let data = {
    title: 'Fasal Rakshak',
    body: 'You have a new notification',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'default',
    data: {}
  };
  
  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }
  
  const isIncomingCall = data.data?.type === 'incoming-call';
  
  const options = {
    body: data.body,
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    tag: data.tag || 'notification',
    vibrate: isIncomingCall ? [500, 200, 500, 200, 500, 200, 500] : [200, 100, 200],
    data: data.data,
    requireInteraction: isIncomingCall ? true : (data.requireInteraction || false),
    silent: isIncomingCall ? false : data.silent,
    renotify: true,
    actions: isIncomingCall 
      ? [
          { action: 'accept', title: '📞 Accept' },
          { action: 'reject', title: '❌ Decline' }
        ]
      : (data.actions || [
          { action: 'open', title: 'Open' },
          { action: 'dismiss', title: 'Dismiss' }
        ])
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ==========================================
// NOTIFICATION CLICK HANDLER
// ==========================================

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data || {};
  
  if (action === 'dismiss') return;
  
  if (data.type === 'incoming-call') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.postMessage({
              type: 'CALL_ACTION',
              action: action,
              data: data
            });
            return client.focus();
          }
        }
        if (clients.openWindow) {
          const callAction = action === 'accept' ? 'accept' : 'reject';
          return clients.openWindow(`/?callAction=${callAction}&callerId=${data.callerId}&roomId=${data.roomId}`);
        }
      })
    );
    return;
  }
  
  let urlToOpen = '/';
  if (data.type === 'message' && data.roomId) {
    urlToOpen = `/?chat=${data.roomId}`;
  } else if (data.actionUrl) {
    urlToOpen = data.actionUrl;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: data
          });
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, options);
  }
});
