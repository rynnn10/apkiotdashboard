importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
importScripts(
  "https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js",
);

// 1. KONFIGURASI FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCv9tyXQxRjToixJz33qa2ndxLbpBj5bvA",
  authDomain: "iotdasboard.firebaseapp.com",
  projectId: "iotdasboard",
  storageBucket: "iotdasboard.firebasestorage.app",
  messagingSenderId: "757867351059",
  appId: "1:757867351059:web:b71aeefbb52224ed8703e6",
  measurementId: "G-WGL8ZVPMVC",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// --- DATABASE (IndexedDB) ---
function saveNotifToDB(data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("IoTNotifDB", 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("notifications")) {
        db.createObjectStore("notifications", {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };
    request.onsuccess = (event) => {
      const db = event.target.result;
      const tx = db.transaction("notifications", "readwrite");
      const store = tx.objectStore("notifications");

      // [FIX ERROR] Gunakan Optional Chaining (?.) agar tidak crash
      const notifData = {
        title: data.notification?.title || data.data?.title || "Info IoT",
        body: data.notification?.body || data.data?.body || "Pesan Baru",
        time: new Date().toLocaleString(),
        read: false,
      };

      store.add(notifData);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
    request.onerror = () => reject("DB Error");
  });
}

// 2. HANDLER PESAN BACKGROUND
messaging.onBackgroundMessage((payload) => {
  console.log("[sw.js] Notifikasi Background Masuk:", payload);

  // 1. Simpan ke Database (IndexedDB)
  // Kita tunggu proses simpan selesai dulu agar data siap saat UI update
  const savePromise = saveNotifToDB(payload).then(() => {
    // 2. [FIX BADGE] Kirim sinyal ke semua Client (Tab/Aplikasi) yang aktif
    return self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            action: "BACKGROUND_NOTIF_RECEIVED", // <--- Sinyal Baru
            payload: payload,
          });
        });
      });
  });

  // 3. Siapkan Tampilan Notifikasi
  const title =
    payload.notification?.title || payload.data?.title || "Smart Home";
  const body = payload.notification?.body || payload.data?.body || "Pesan Baru";

  const notificationOptions = {
    body: body,
    icon: new URL("/logoapk.png", self.location.origin).href,
    badge: new URL("/ic_stat_cpu.png", self.location.origin).href, // Pastikan file ini monochrome (putih transparan)
    data: {
      url: new URL("/index.html?view=notifications", self.location.origin).href,
      time: new Date().toISOString(),
    },
    tag: "iot-alert-" + Date.now(), // Jadikan tag unik berdasarkan milidetik saat ini
    // renotify: true, // Hapus atau jadikan komentar baris ini. Renotify tidak diperlukan lagi jika tag sudah unik.
  };

  // Gabungkan promise simpan DB dan tampilkan notifikasi
  return Promise.all([
    savePromise,
    self.registration.showNotification(title, notificationOptions),
  ]);
});

// 3. HANDLER KLIK NOTIFIKASI (NAVIGASI)
self.addEventListener("notificationclick", (event) => {
  console.log("[sw.js] Notifikasi diklik");
  event.notification.close(); // Tutup notifikasi

  // Ambil URL
  const urlToOpen =
    event.notification.data.url ||
    new URL("/index.html?view=notifications", self.location.origin).href;

  const promiseChain = clients
    .matchAll({
      type: "window",
      includeUncontrolled: true,
    })
    .then((windowClients) => {
      // A. Jika aplikasi sudah terbuka, fokuskan dan reload
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes("index.html") && "focus" in client) {
          return client.focus().then((focusedClient) => {
            // Kirim pesan ke logic.js untuk buka modal (jika app sudah jalan)
            focusedClient.postMessage({
              action: "OPEN_NOTIF_MODAL",
              payload: event.notification.data,
            });
            // Arahkan ulang (opsional, agar query param terbaca)
            if ("navigate" in focusedClient) {
              return focusedClient.navigate(urlToOpen);
            }
          });
        }
      }
      // B. Jika aplikasi tertutup, buka jendela baru
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    });

  event.waitUntil(promiseChain);
});

// 4. CACHE STRATEGY (FIX AUDIO 206)
const CACHE_NAME = "iot-smart-v53.7";
const ASSETS_TO_CACHE = [
  // 1. File Lokal Utama
  "/",
  "/index.html",
  "/style.css",
  "/logic.js",
  "/manifest.json",
  "/adzan.mp3",
  "/imsak.mp3",
  "/animasi4.html",
  "/animasi5.html",
];

// INSTALL: Download semua aset di atas saat pertama kali install
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Install & Caching External Assets");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Menggunakan {cache: 'reload'} untuk memastikan mendapatkan versi terbaru saat install
      return cache.addAll(ASSETS_TO_CACHE);
    }),
  );
  self.skipWaiting();
});

// ACTIVATE: Bersihkan cache lama jika ada update versi
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activate & Cleanup Old Cache");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Menghapus Cache Lama:", cache);
            return caches.delete(cache);
          }
        }),
      );
    }),
  );
  return self.clients.claim();
});

// FETCH: Strategi "Cache First, Network Fallback"
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !event.request.url.startsWith("http"))
    return;

  const url = new URL(event.request.url);
  if (url.origin !== location.origin) {
    return; 
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            (networkResponse.type !== "basic" &&
              networkResponse.type !== "cors")
          ) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            const url = event.request.url;
            if (
              url.endsWith(".js") ||
              url.endsWith(".css") ||
              url.endsWith(".html") ||
              url.endsWith(".png") ||
              url.endsWith(".mp3")
            ) {
              cache.put(event.request, responseToCache);
            }
          });
          return networkResponse;
        })
        .catch(() => {});
    }),
  );
});
