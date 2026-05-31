var isAppExiting = false; // Flag penanda sedang proses keluar
// ==========================================
// 0. MOBILE DEBUGGER (HAPUS JIKA SUDAH FIX)
// ==========================================
(function initMobileLogger() {
  // Buat elemen visual untuk log
  const logBox = document.createElement("div");
  logBox.id = "mobile-debug-console";
  logBox.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 150px;
        background: rgba(0, 0, 0, 0.85);
        color: #0f0;
        font-family: monospace;
        font-size: 10px;
        overflow-y: scroll;
        z-index: 99999;
        padding: 5px;
        border-top: 2px solid #0f0;
        pointer-events: none; /* Agar bisa diklik tembus */
        display: none; /* Default Hidden, tap 3x di layar untuk muncul */
    `;
  document.body.appendChild(logBox);

  // Override console.log
  const oldLog = console.log;
  console.log = function (...args) {
    oldLog.apply(console, args);
    appendLog("INFO", args);
  };

  // Override console.error
  const oldErr = console.error;
  console.error = function (...args) {
    oldErr.apply(console, args);
    appendLog("ERR", args, "red");
  };

  // Override console.warn
  const oldWarn = console.warn;
  console.warn = function (...args) {
    oldWarn.apply(console, args);
    appendLog("WARN", args, "yellow");
  };

  function appendLog(type, args, color = "#0f0") {
    const msg = args
      .map((a) => (typeof a === "object" ? JSON.stringify(a) : a))
      .join(" ");
    const line = document.createElement("div");
    line.style.color = color;
    line.style.borderBottom = "1px solid #333";
    line.textContent = `[${new Date().toLocaleTimeString()}] ${type}: ${msg}`;
    logBox.insertBefore(line, logBox.firstChild); // Log baru di atas
  }

  // Fitur Rahasia: Ketuk 3 kali di pojok kiri atas untuk menampilkan/menyembunyikan log
  let tapCount = 0;
  document.addEventListener("click", (e) => {
    if (e.clientY < 100 && e.clientX < 100) {
      // Area pojok kiri atas
      tapCount++;
      if (tapCount === 3) {
        logBox.style.display =
          logBox.style.display === "none" ? "block" : "none";
        logBox.style.pointerEvents =
          logBox.style.display === "block" ? "auto" : "none";
        tapCount = 0;
        alert("Debug Console Toggled");
      }
    } else {
      tapCount = 0;
    }
  });
})();

// --- KONFIGURASI WATCHDOG STATUS ---
// Waktu toleransi (dalam milidetik).
// Jika ESP mengirim data setiap 3 detik, set ini ke 8000 (8 detik) atau 10000 (10 detik) agar aman.
const OFFLINE_TIMEOUT_MS = 10000;

// Objek untuk menyimpan waktu terakhir data diterima dari setiap ESP
let deviceLastSeen = {
  1: 0, // ESP 1
  2: 0, // ESP 2
  3: 0, // ESP 3
  4: 0, // ESP 4
  5: 0, // ESP 5
};

// Fungsi Loop Pengecekan Otomatis (Berjalan setiap 1 detik)
setInterval(() => {
  const now = Date.now();

  // Cek untuk ESP 1 sampai 4
  for (let id = 1; id <= 5; id++) {
    // Jika waktu sekarang dikurangi waktu terakhir terlihat > batas toleransi
    if (now - deviceLastSeen[id] > OFFLINE_TIMEOUT_MS) {
      // Pastikan status belum offline sebelumnya agar tidak spam update UI
      const elSsid = document.getElementById("ssid-esp" + id);
      if (elSsid && elSsid.innerText !== "Offline") {
        console.log(`⚠️ ESP ${id} Lost Connection (Timeout)`);
        updateDeviceStatus(id, false); // Set jadi Merah/Offline
      }
    }
  }
}, 1000);

// --- KONFIGURASI FIREBASE (Wajib Diisi) ---
// Ambil data ini dari: Firebase Console -> Project Settings -> General
const firebaseConfig = {
  apiKey: "AIzaSyCv9tyXQxRjToixJz33qa2ndxLbpBj5bvA",
  authDomain: "iotdasboard.firebaseapp.com",
  projectId: "iotdasboard",
  storageBucket: "iotdasboard.firebasestorage.app",
  messagingSenderId: "757867351059",
  appId: "1:757867351059:web:b71aeefbb52224ed8703e6",
  measurementId: "G-WGL8ZVPMVC",
};

// ==========================================================
// 1. INISIALISASI FIREBASE & SERVICE WORKER YANG BENAR
// ==========================================================
let messaging; // 👇 DEKLARASIKAN SEBAGAI GLOBAL DISINI

if (typeof firebase !== "undefined") {
  try {
    firebase.initializeApp(firebaseConfig);
    if (firebase.messaging.isSupported()) {
      messaging = firebase.messaging();

      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .register("./sw.js")
          .then((registration) => {
            console.log("✅ SW Terdaftar. Scope:", registration.scope);
            // Daftarkan Service Worker ini untuk FCM
            try {
              messaging.useServiceWorker(registration);
            } catch (e) {}
            // Panggil token otomatis setelah SW siap
            requestPermission();
          })
          .catch((err) => console.error("Gagal Register SW:", err));
      }
    } else {
      console.warn(
        "Firebase Messaging tidak didukung di lingkungan ini (misal file://)",
      );
    }
  } catch (e) {
    console.warn("Gagal inisialisasi Firebase", e);
  }
}

// --- SAKLAR TOKEN (Ubah ke false jika tidak ingin token tampil di console) ---
const TAMPILKAN_TOKEN_DI_CONSOLE = true;

function requestPermission() {
  if (!messaging) return;
  console.log("🚀 Meminta Izin Notifikasi...");
  Notification.requestPermission().then((permission) => {
    if (permission === "granted") {
      navigator.serviceWorker.ready.then((registration) => {
        messaging
          .getToken({
            vapidKey:
              "BF50iLdcrPG0e1fSIGB1r8PznPd2G69BDzRvieEPpznBx2CUTqIC1-JXoacsQA4T__3BOoHubR8G6P6DD6lAGZo",
            serviceWorkerRegistration: registration,
          })
          .then((token) => {
            if (token) {
              // Logika menampilkan/menyembunyikan token
              if (TAMPILKAN_TOKEN_DI_CONSOLE) {
                console.log("🎉 DEVICE TOKEN:", token);
              }
              // Simpan token ke database Anda jika diperlukan
            } else {
              console.warn("⚠️ Token Null. Coba Reset Izin Browser.");
            }
          })
          .catch((err) => console.error("❌ Error Get Token:", err));
      });
    } else {
      console.log("🚫 Izin Ditolak.");
    }
  });
}

// ============================================================
// 1. DEFINISI PLUGIN CAPACITOR (WAJIB DI PALING ATAS)
// ============================================================
// Ini mencegah error "ReferenceError: ... is not defined"
const LocalNotifications =
  window.Capacitor && window.Capacitor.Plugins
    ? window.Capacitor.Plugins.LocalNotifications
    : null;
const App =
  window.Capacitor && window.Capacitor.Plugins
    ? window.Capacitor.Plugins.App
    : null;
const NativeBiometric =
  window.Capacitor && window.Capacitor.Plugins
    ? window.Capacitor.Plugins.NativeBiometric
    : null;
const NativeSpeechRec =
  window.Capacitor && window.Capacitor.Plugins
    ? window.Capacitor.Plugins.SpeechRecognition
    : null;

// Cek status native
const isNative = window.Capacitor && window.Capacitor.isNative;
// --- TAMBAHAN VARIABEL SYNC ---
const mqtt_topic_jadwal_data = "projek/belajar/jadwal/data"; // Topik Retained
let tempCloudSchedule = null; // Menyimpan data cloud sementara
let isScheduleSynced = false; // Penanda agar tidak loop

// --- VARIABEL GLOBAL PERFORMA ---
let startupMetrics = {
  time: 0,
  score: "N/A",
  grade: "Checking...",
  desc: "Menunggu...",
};

let lastAutoFanTrigger = !1;
let isCameraOn = !1;
let isDoorLocked = !0;
let currentLat = null;
let currentLon = null;
let lastCapturedRawData = null;
let lastCapturedHex = null;
let isBackgroundAnimationRunning = !0;
let lastIrSentTime = 0;
let lastHandCheck = 0;
let isModelLoaded = false; // <--- INI YANG HILANG SEBELUMNYA
let selectedSsidTarget = "";
const HAND_CHECK_FPS = 100;
const GAS_URL =
  "https://script.google.com/macros/s/AKfycbwamKBiIgw8vREOcxNGE6hezQUzm-dl88RqApNaOOec33O7kssxb3w_yyhZK6zUCVFUNw/exec";
let player;
let isMusicPlaying = !1;
let pausedByVoice = !1;
let watchdogTimer = null;
let backgroundWorker = null;
let currentFacingMode = "user"; // 'user' (depan) atau 'environment' (belakang)
let YOUTUBE_LINK =
  "https://youtube.com/playlist?list=PL8NGhre-uK_MnZpWNCX2l8kYvqzwy9x6b&si=mPHQRL7P5sDjdNui";
function getYoutubeData(url) {
  let videoId = null;
  let listId = null;
  const listMatch = url.match(/[?&]list=([^#\&\?]+)/);
  if (listMatch) listId = listMatch[1];
  const videoMatch = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
  );
  if (videoMatch) videoId = videoMatch[1];
  return { videoId, listId };
}
// --- UPDATE KONFIGURASI PLAYER (HARDCODE ORIGIN) ---
function onYouTubeIframeAPIReady() {
  player = new YT.Player("youtube-player", {
    height: "1",
    width: "1",
    videoId: "",
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      rel: 0,
      iv_load_policy: 3,
      playsinline: 1,
      // ⚠️ PENTING: Tulis alamat Netlify Anda secara manual di sini
      // Ini membuat Android "menyamar" jadi website, sehingga video VEVO mau diputar
      origin: "https://dashboardesp8266.netlify.app",
      host: "https://www.youtube.com",
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError,
    },
  });
}
function onPlayerReady(event) {
  console.log("✅ Musik Player Siap (Background Mode)");
  event.target.setVolume(100);
}
// --- UPDATE HANDLER ERROR (AUTO SKIP PLAYLIST) ---
function onPlayerError(event) {
  const errCode = event.data;
  console.log("⚠️ YouTube Error:", errCode);

  // Error 150/101 = Hak Cipta / Blocked Embed
  if (errCode === 150 || errCode === 101) {
    console.warn(
      "⛔ Video ini diblokir di Android. Mencoba video selanjutnya...",
    );

    // 1. Jika sedang memutar PLAYLIST, loncat ke lagu berikutnya
    // (Karena mungkin hanya lagu ke-1 yang error, lagu ke-2 bisa jadi aman)
    if (player && typeof player.nextVideo === "function") {
      // Cek apakah kita sedang dalam mode playlist
      const playlist = player.getPlaylist();
      if (playlist && playlist.length > 0) {
        console.log("⏭️ Skip ke track berikutnya dalam playlist...");
        player.nextVideo();
        return; // Stop di sini, jangan cari cover
      }
    }

    // 2. Jika BUKAN playlist (Search biasa), baru cari Cover
    if (
      typeof lastSearchQuery !== "undefined" &&
      !lastSearchQuery.includes("cover")
    ) {
      console.log("🔍 Mencari versi Cover...");
      if (typeof bicara === "function")
        bicara("Video orisinal dibatasi, mencari versi cover.", true);
      searchYouTube(lastSearchQuery + " cover");
    }
  }
}
function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    isMusicPlaying = !0;
    setupMediaSession();
    startWatchdog();
  } else if (event.data === YT.PlayerState.PAUSED) {
    // --- [LOGIKA ANTI-PAUSE BACKGROUND] ---
    if (isMusicPlaying && !pausedByVoice) {
      console.log("⚠️ Musik ter-pause. Mengecek visibility...");

      // Jika tab sedang disembunyikan (background), PAKSA PLAY LAGI
      if (document.visibilityState === "hidden") {
        console.log("🙈 App di Background: Memaksa Play...");
        if (player && player.playVideo) player.playVideo();
      } else {
        // Jika user sengaja pause di UI (layar aktif), biarkan pause tapi nyalakan lagi jika ketahuan otomatis
        // Opsional: Hilangkan else ini jika ingin SUPER AGRESIF
        console.log("⏸️ Pause terdeteksi di layar aktif.");
      }
    } else {
      stopWatchdog();
    }
  } else if (event.data === YT.PlayerState.ENDED) {
    if (player && player.nextVideo) player.nextVideo();
  }
}
function setupMediaSession() {
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "IoT Background Music",
      artist: "Smart Dashboard",
      album: "Lofi Mode",
      artwork: [
        { src: "./logoapk.jpg", sizes: "96x96", type: "image/png" },
        { src: "./logoapk.jpg", sizes: "192x192", type: "image/png" },
      ],
    });
    navigator.mediaSession.setActionHandler("play", function () {
      controlMusic("PLAY");
    });
    navigator.mediaSession.setActionHandler("pause", function () {
      controlMusic("STOP");
    });
    navigator.mediaSession.setActionHandler("stop", function () {
      controlMusic("STOP");
    });
    navigator.mediaSession.setActionHandler("nexttrack", function () {
      if (player) player.nextVideo();
    });
  }
}
function controlMusic(action) {
  if (!player || typeof player.playVideo !== "function")
    return bicara("Player sedang memuat.", !1);
  if (action === "PLAY") {
    isMusicPlaying = !0;
    pausedByVoice = !1;
    player.playVideo();
  } else if (action === "STOP") {
    isMusicPlaying = !1;
    player.pauseVideo();
  }
}
// --- [FIX] PENGGANTI SETINTERVAL BIASA (MENGGUNAKAN WEB WORKER) ---
function startWatchdog() {
  // Hentikan yang lama jika ada
  stopWatchdog();

  // Buat Blob Worker secara on-the-fly (Tanpa file eksternal)
  // Worker ini berjalan di thread terpisah, browser tidak akan mematikannya saat pindah tab.
  const workerScript = `
    setInterval(() => {
      postMessage("tick");
    }, 2000); // Kirim sinyal setiap 2 detik
  `;

  const blob = new Blob([workerScript], { type: "application/javascript" });
  backgroundWorker = new Worker(URL.createObjectURL(blob));

  backgroundWorker.onmessage = function (e) {
    // Logic ini berjalan setiap 2 detik, bahkan saat layar mati/pindah tab
    if (isMusicPlaying && !pausedByVoice) {
      if (player && typeof player.getPlayerState === "function") {
        const state = player.getPlayerState();
        // State 1 = Playing, 3 = Buffering.
        // Jika status bukan Playing (1) dan bukan Buffering (3), paksa Play.
        if (state !== 1 && state !== 3) {
          console.log("🐶 Worker Watchdog: Musik mati/pause sendiri -> PLAY!");
          player.playVideo();
        }
      }
    }
  };

  console.log("✅ Background Worker Started");
}

function stopWatchdog() {
  if (backgroundWorker) {
    backgroundWorker.terminate(); // Bunuh worker
    backgroundWorker = null;
    console.log("🛑 Background Worker Stopped");
  }
}

const video = document.getElementById("video");
const canvas = document.getElementById("snapshot-canvas");
const captureBtn = document.getElementById("capture-btn");
const toggleCamBtn = document.getElementById("toggle-cam-btn");
const lightBtn = document.getElementById("light-btn");
const helpBtn = document.getElementById("help-btn");
const nameInput = document.getElementById("name-input");
const saveBtn = document.getElementById("save-btn");
const globalModal = document.getElementById("global-modal");
const registerModal = document.getElementById("register-modal");
const modalTitle = document.getElementById("modal-title");
const modalMsg = document.getElementById("modal-msg");
const modalIcon = document.getElementById("modal-icon");
const modalIconBg = document.getElementById("modal-icon-bg");
const modalButtons = document.getElementById("modal-buttons");
const DEFAULT_LAT = -7.7956;
const DEFAULT_LON = 110.3695;
function switchPage(pageId, element) {
  // 1. [FIX MOBILE SCROLL] Paksa scroll ke paling atas
  window.scrollTo({ top: 0, behavior: "auto" });

  const btnSetMobile = document.getElementById("btn-settings-mobile");
  const btnSetDesktop = document.getElementById("btn-settings-desktop");

  // Jika di halaman utama (Home), TAMPILKAN tombol. Selain itu SEMBUNYIKAN.
  if (pageId === "page-home") {
    if (btnSetMobile) btnSetMobile.classList.remove("hidden");
    if (btnSetDesktop) btnSetDesktop.classList.remove("hidden");
  } else {
    if (btnSetMobile) btnSetMobile.classList.add("hidden");
    if (btnSetDesktop) btnSetDesktop.classList.add("hidden");
  }

  // --- [LOGIKA BARU] CLEANUP SAAT KELUAR HALAMAN ---
  // Kita cek halaman apa yang SEDANG AKTIF sebelum pindah
  const activeSection = document.querySelector(".page-section.active-page");

  if (activeSection) {
    const oldId = activeSection.id;

    // A. KELUAR DARI HAND CONTROL -> Hapus AI & Matikan Kamera
    if (oldId === "page-hand" && pageId !== "page-hand") {
      console.log("🧹 Cleanup: Hand Control");
      stopHandCamera(); // Matikan kamera
      handsAI = null; // Hapus instance AI dari memori
      handCameraObj = null; // Hapus objek kamera
      isAiReady = false; // Reset flag AI
      // Reset Text UI
      const btn = document.getElementById("toggle-hand-btn");
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-power-off"></i> AKTIFKAN KAMERA';
        btn.classList.replace("bg-red-600", "bg-blue-600");
        btn.classList.replace("hover:bg-red-500", "hover:bg-blue-500");
        btn.disabled = false;
      }
    }

    // B. KELUAR DARI SCAN WAJAH -> Hapus Model & Matikan Kamera
    if (oldId === "page-absensi" && pageId !== "page-absensi") {
      console.log("🧹 Cleanup: Face ID");
      stopCamera(); // Matikan kamera
      isModelLoaded = false; // [PENTING] Reset flag agar AI dimuat ulang nanti
      // Reset UI Placeholder
      document.getElementById("initial-placeholder").classList.remove("hidden");
    }

    // C. KELUAR DARI CUACA -> Hancurkan Peta Leaflet
    if (oldId === "page-cuaca" && pageId !== "page-cuaca") {
      console.log("🧹 Cleanup: Weather Map");
      if (map) {
        map.remove(); // Hapus instance map Leaflet
        map = null; // Kosongkan variabel
        marker = null;
      }
      // Reset UI Loading untuk next visit
      document.getElementById("loader-cuaca").classList.add("hidden");
    }
  }

  // --- GANTI HALAMAN (UI SWITCH) ---
  document
    .querySelectorAll(".page-section")
    .forEach((el) => el.classList.remove("active-page"));
  document.getElementById(pageId).classList.add("active-page");

  // --- [LOGIKA BARU] INITIALIZE SAAT MASUK HALAMAN ---
  if (pageId !== "page-car") {
    // Reset jika keluar dari halaman Car
    if (isCarLandscape) toggleCarMode(); // Kembali ke portrait
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (e) {
      console.warn("Fullscreen exit error", e);
    }
  }
  // A. MASUK HALAMAN CUACA
  if (pageId === "page-cuaca") {
    console.log("🗺️ Membuka Cuaca: Memuat ulang Data & Peta...");

    // Selalu tampilkan loading karena map sudah kita hancurkan tadi
    document.getElementById("loader-cuaca").classList.remove("hidden");

    setTimeout(() => {
      initMap(); // Load Peta Baru
      getMyLocation(); // Load GPS & Weather

      // Sembunyikan loading setelah 1.5 detik
      setTimeout(() => {
        document.getElementById("loader-cuaca").classList.add("hidden");
      }, 1500);
    }, 500);
  }

  // B. MASUK HALAMAN ABSENSI (FACE API)
  if (pageId === "page-absensi") {
    // Karena isModelLoaded sudah di-false-kan saat keluar, ini akan selalu true
    if (!isModelLoaded) {
      console.log("👤 Membuka Absensi: Memuat Ulang AI Wajah...");

      document.getElementById("loader-absensi").classList.remove("hidden");

      initFaceApp().then(() => {
        // Loader akan di-hide di dalam initFaceApp saat sukses
      });
    }
  }

  // C. MASUK HALAMAN HAND CONTROL
  if (pageId === "page-hand") {
    console.log("Membuka Hand Control: Menyiapkan AI...");

    const loader = document.getElementById("loader-hand");
    const placeholder = document.getElementById("hand-placeholder");

    // 1. TAMPILKAN LOADER (Logika disamakan dengan Scan Wajah)
    if (loader) loader.classList.remove("hidden");

    // Sembunyikan placeholder sementara loading
    if (placeholder) placeholder.classList.add("hidden");

    // 2. Inisialisasi AI di Background
    // Kita panggil initHandAI() di sini agar model dimuat saat masuk halaman
    if (!handsAI) {
      initHandAI();
    }

    // 3. Simulasi Waktu Tunggu & Animasi Masuk
    // Kita beri jeda 1.5 detik agar terlihat seolah-olah sedang memuat "AI Neural Network"
    // (Sama seperti efek loading di Face ID)
    setTimeout(() => {
      // Hilangkan Loader
      if (loader) loader.classList.add("hidden");

      // Munculkan kembali placeholder (karena kamera belum on)
      if (placeholder) placeholder.classList.remove("hidden");

      // 4. JALANKAN ANIMASI ELEMENT (Pop-up effect)
      requestAnimationFrame(() => {
        // Animasikan kartu status dan tombol
        if (typeof applyGlobalAnimation === "function") {
          applyGlobalAnimation(
            "#page-hand .bg-slate-800, #page-hand .camera-box",
            0.1,
          );
        }
      });
    }, 1500); // Delay 1.5 Detik

    const voiceBtn =
      document.getElementById("btn-voice-command") ||
      document.querySelector(".floating-voice-btn");
  } // <--- Restore closing brace for if (pageId === "page-hand")

  // --- UPDATE HEADER & NAVIGATION UI ---
  const backBtn = document.getElementById("btn-back-home");
  const headerTitle = document.getElementById("mobile-header-title");
  const titles = {
    "page-home": "IoT Dashboard",
    "page-absensi": "Scan Wajah",
    "page-sensor": "Monitor Suhu",
    "page-control": "Smart Control",
    "page-remote": "Smart Remote",
    "page-cuaca": "Cuaca Pro",
    "page-hand": "Hand Control",
    "page-car": "Car Control",
    "page-youtube": "CCTV LIVE",
  };

  if (headerTitle) {
    headerTitle.innerText = titles[pageId] || "IoT Dashboard";
  }

  if (backBtn) {
    if (pageId === "page-home") {
      backBtn.classList.add("hidden");
    } else {
      backBtn.classList.remove("hidden");
    }
  }

  const voiceBtn =
    document.getElementById("btn-voice-command") ||
    document.querySelector(".floating-voice-btn");

  if (pageId === "page-car") {
    if (voiceBtn) voiceBtn.style.display = "none"; // Sembunyikan
  } else {
    if (voiceBtn) voiceBtn.style.display = "flex"; // Munculkan kembali
  }
  if (element && element.classList.contains("nav-item")) {
    document
      .querySelectorAll(".nav-item")
      .forEach((el) => el.classList.remove("active"));
    element.classList.add("active");
  }

  // Atur Background Canvas (Animasi 3D)
  if (pageId === "page-absensi" || pageId === "page-hand") {
    isBackgroundAnimationRunning = false;
    const bgContainer = document.getElementById("bg-container");
    if (bgContainer) bgContainer.style.display = "none";
  } else {
    isBackgroundAnimationRunning = true;
    const bgContainer = document.getElementById("bg-container");
    if (bgContainer) bgContainer.style.display = "block";
  }

  setTimeout(() => {
    if (pageId === "page-control") {
      // Animasikan kartu-kartu di Smart Control
      applyGlobalAnimation("#page-control .bg-slate-800");
    } else if (pageId === "page-sensor") {
      // Animasikan kartu suhu & kelembaban
      applyGlobalAnimation("#page-sensor .bg-slate-800");
    } else if (pageId === "page-remote") {
      // Animasikan daftar remote atau tombol tambah
      applyGlobalAnimation("#view-remote-list > div");
    } else if (pageId === "page-home") {
      // 1. Animasikan STATUS PERANGKAT terlebih dahulu (ID baru yang kita buat)
      // Selector menargetkan anak langsung (div) di dalam #device-status-list
      if (typeof applyGlobalAnimation === "function") {
        applyGlobalAnimation("#device-status-list > div", 0.1);
      }

      // 2. Animasikan MENU GRID (Kotak-kotak besar) dengan sedikit jeda
      setTimeout(() => {
        if (typeof applyGlobalAnimation === "function") {
          // Selector ini menargetkan item menu utama
          applyGlobalAnimation("#page-home .grid.grid-cols-2.gap-4 > div", 0.1);
        }
      }, 300); // Muncul 0.3 detik setelah status mulai
    }
  }, 100);
}
const mqtt_topic_ir_send = "projek/belajar/ir_remote_riyan10/send";
const mqtt_topic_ir_recv = "projek/belajar/ir_remote_riyan10/recv";
const mqtt_topic_sensor = "projek/belajar/sensoe_suhu_riyan10_bro";
const mqtt_topic_fan_ctrl = "projek/belajar/sensoe_suhu_riyan10_bro/control";
const mqtt_topic_schedule = "projek/belajar/jadwal_kipas_riyan10_storage";
const mqtt_topic_security_ctrl = "projek/belajar/perintah_kipas";
const mqtt_topic_status_esp1 = "projek/belajar/status/esp1";
const mqtt_topic_status_esp2 = "projek/belajar/status/esp2";
const mqtt_topic_status_esp3 = "projek/belajar/status/esp3";
const mqtt_topic_status_esp4 = "projek/belajar/status/esp4";
const mqtt_topic_status_esp5 = "projek/belajar/status/esp5";
const mqtt_topic_jadwal_info = "projek/belajar/jadwal/info";
const mqtt_topic_cctv_sync = "projek/belajar/cctv_data_store";
const mqtt_topic_kulkas = "projek/belajar/kulkas";
const mqtt_broker = "broker.emqx.io";
const mqtt_port = 8084;
const mqtt_useSSL = true;
const mqtt_clientID = "web-" + Math.random().toString(36).substring(7);
const mqttClient = new Paho.MQTT.Client(
  mqtt_broker,
  mqtt_port,
  "/mqtt",
  mqtt_clientID,
);
mqttClient.onConnectionLost = (res) => {
  console.warn("⚠️ MQTT Terputus:", res.errorMessage);
  updateStatus(!1, "Terputus");

  // [BARU] Reconnect otomatis setelah 3 detik jika tidak sengaja menekan keluar
  if (typeof isAppExiting !== "undefined" && !isAppExiting) {
    console.log("🔄 Mencoba menghubungkan ulang MQTT...");
    setTimeout(() => {
      // Pastikan tidak dobel koneksi
      if (!mqttClient.isConnected()) {
        connectMQTT();
      }
    }, 3000);
  }
};
mqttClient.onMessageArrived = (msg) => {
  const topic = msg.destinationName;
  const payload = msg.payloadString;
  if (topic.includes("/control/")) {
    let toggleId = "";

    if (topic.endsWith("/laser"))
      toggleId = "toggle-keamanan"; // Sesuaikan ID di HTML Anda
    else if (topic.endsWith("/ir")) toggleId = "toggle-ir";
    else if (topic.endsWith("/hc")) toggleId = "toggle-hc";
    else if (topic.endsWith("/api")) toggleId = "toggle-api";

    const toggleElement = document.getElementById(toggleId);
    if (toggleElement) {
      const cleanPayload = payload.trim();
      toggleElement.checked = cleanPayload === "ON";
      console.log(`🔄 [SYNC] ${toggleId} set ke ${cleanPayload}`);
    }
    return; // Berhenti di sini untuk pesan kontrol
  }
  if (topic === mqtt_topic_kulkas) {
    try {
      const data = JSON.parse(payload);
      // Update Suhu Kulkas (ID: temp-kulkas)
      if (data.temp !== undefined && data.temp !== null) {
        const tempEl = document.getElementById("temp-kulkas");
        if (tempEl) tempEl.innerText = parseFloat(data.temp).toFixed(1);
      }
      // Update Kelembaban Kulkas (ID: hum-kulkas)
      if (data.hum !== undefined && data.hum !== null) {
        const humEl = document.getElementById("hum-kulkas");
        if (humEl) humEl.innerText = parseFloat(data.hum).toFixed(0);
      }
    } catch (e) {
      console.error("Gagal update sensor kulkas:", e);
    }
  }
  if (topic.includes("rfid") || payload.includes("Akses")) {
    console.log("💳 RFID Data:", payload);

    // 1. JIKA AKSES DITERIMA
    if (payload.includes("Diterima") || payload.includes("Accepted")) {
      // Ambil nama user (misal format: "Akses Diterima: Riyan")
      // Split berdasarkan titik dua, ambil bagian belakang
      const parts = payload.split(":");
      const namaUser = parts.length > 1 ? parts[1].trim() : "User";

      showInfoModal("Akses Diterima", `Selamat datang, ${namaUser}`, "success");
      setTimeout(() => {
        closeModalAndReset();
      }, 5000);
    }

    // 2. JIKA AKSES DITOLAK
    else if (payload.includes("Ditolak") || payload.includes("Denied")) {
      showInfoModal("Akses Ditolak", "Kartu tidak terdaftar!", "error");
      setTimeout(() => {
        closeModalAndReset();
      }, 5000);
      // Opsional: Bunyikan suara peringatan
      if (typeof bicara === "function")
        bicara("Peringatan, akses kartu ditolak.", true);
    }
  }
  if (topic === mqtt_topic_jadwal_info) {
    const infoEl = document.getElementById("prayer-update-info");
    if (infoEl) {
      infoEl.innerText = payload;
      infoEl.classList.add("text-emerald-500");
      // Simpan ke memory agar tetap ada saat reload
      localStorage.setItem("prayerUpdateStr", payload);
      console.log("🔄 Info Update Jadwal Diterima: " + payload);
    }
    return;
  }
  if (topic === mqtt_topic_jadwal_data) {
    try {
      const cloudData = JSON.parse(payload);

      // LOGIKA BARU: Otomatis ikut Cloud agar semua device seragam
      // Tidak perlu cek lokal atau modal konfirmasi
      console.log("🔄 Menerima Sync Jadwal Solat dari Cloud...");
      applySchedule(cloudData);
      isScheduleSynced = true;
    } catch (e) {
      console.log("Error parse jadwal cloud", e);
    }
  }
  if (topic === mqtt_topic_car_status) {
    try {
      const data = JSON.parse(payload); // Baca JSON dari Arduino

      // 1. Update Nama WiFi
      const elContainer = document.getElementById("marquee-content-car");

      if (elContainer) {
        // Kita isi dengan 2 SPAN sekaligus agar looping nyambung rapat
        // Pastikan class style teks-nya sama dengan index.html Anda
        const textHtml = `<span class="text-[10px] text-[#00f0ff] font-mono font-bold">${data.ssid}</span>`;
        elContainer.innerHTML = textHtml + textHtml;
      }

      // 2. Update Angka dBm
      const elDBM = document.getElementById("car-ping");
      if (elDBM) elDBM.innerText = data.dbm + " dBm";

      // 3. Update Bar Sinyal (Visual)
      // Pastikan selector ini mengarah ke bar yang ada di dalam panel mobil
      const bars = document.querySelectorAll(".wifi-panel-car .sig-bar");
      if (bars.length > 0) {
        // Reset (matikan semua bar dulu)
        bars.forEach((b) => b.classList.remove("on"));

        // Nyalakan bar berdasarkan kualitas (data.quality 0-100)
        if (data.quality > 20) bars[0].classList.add("on");
        if (data.quality > 50) bars[1].classList.add("on");
        if (data.quality > 80) bars[2].classList.add("on");
      }
    } catch (e) {
      console.warn("Gagal parsing status mobil:", e);
    }
  }
  if (topic === mqtt_topic_security_ctrl) {
    // --- [TAMBAHAN BARU: DETEKSI TRIGGER SINKRONISASI NOTIF] ---
    if (payload === "SYNC_NOTIF") {
      console.log(
        "🔄 Menerima perintah sinkronisasi notifikasi dari device lain...",
      );
      if (typeof loadNotifFromCloud === "function") {
        loadNotifFromCloud(); // Tarik data terbaru dari Google Sheet
      }
      return;
    }
    if (payload === "UPDATE_JADWAL_NOW") {
      const isAutoOn = localStorage.getItem("autoUpdateJadwalState") === "ON";
      if (isAutoOn) {
        console.log("📡 Menerima trigger dari ESP32: Update Jadwal Harian!");
        // Panggil fungsi sinkronisasi jadwal terkini
        cariJadwalLokasiTerkini();
      } else {
        console.log(
          "⏸️ Trigger ESP32 diterima, tapi fitur Auto Update sedang OFF.",
        );
      }
      return; // Hentikan di sini agar tidak masuk ke logika alarm di bawahnya
    }
    if (payload === "ALARM_API") {
      const toggleApi = document.getElementById("toggle-api");
      if (toggleApi && !toggleApi.checked) {
        console.warn("⚠️ Alarm Api diabaikan karena Sistem Web OFF.");
        return;
      }
      showInfoModal(
        "BAHAYA API!",
        "Sensor mendeteksi api! Sistem Alarm menyala.",
        "alarm",
      );
      console.log("🚨 [CRITICAL] ALARM API DITERIMA!");
      return;
    }
    if (payload === "ALARM_LASER") {
      const toggleLaser = document.getElementById("toggle-laser");
      if (toggleLaser && !toggleLaser.checked) return;
      showInfoModal(
        "PENYUSUP!",
        "Sensor Laser Terputus! Alarm berbunyi terus-menerus.",
        "alarm",
      );
      return;
    }
    if (payload === "SAFE_LASER") {
      showInfoModal("Aman", "Laser kembali menyatu. Area aman.", "success");
      console.log("✅ Laser Kembali Normal");
      return;
    }
    if (payload === "ALARM_IR") {
      const toggleIr = document.getElementById("toggle-ir");
      if (toggleIr && !toggleIr.checked) return;
      showInfoModal(
        "GERAKAN!",
        "Sensor IR mendeteksi pergerakan objek.",
        "alarm",
      );
      return;
    }
    if (payload === "ALARM_HC") {
      const toggleHc = document.getElementById("toggle-hc");
      if (toggleHc && !toggleHc.checked) return;
      showInfoModal(
        "OBJEK DEKAT!",
        "Sensor Jarak mendeteksi objek mencurigakan.",
        "alarm",
      );
      return;
    }
    if (payload === "SAFE_API") {
      showInfoModal(
        "Aman",
        "Api sudah padam. Sistem kembali normal.",
        "success",
      );
      setTimeout(() => {
        closeModalAndReset();
      }, 5000);
      return;
    }
    if (payload === "RESET_FACES_DONE") {
      console.log("🧹 Perintah Reset Wajah diterima dari Telegram/ESP");
      labeledDescriptors = [];
      renderList();
      showInfoModal(
        "Reset Berhasil",
        "Database wajah telah dikosongkan via Telegram.",
        "info",
      );
      setAppStatus("Database Kosong", "success");
      setTimeout(() => {
        closeModalAndReset();
      }, 3000);
      return;
    }
  }
  if (topic.includes("/control/ble")) {
    const toggleBle = document.getElementById("toggle-ble");
    if (toggleBle) toggleBle.checked = payload === "ON";
    return;
  }
  if (topic.includes("/control/hybrid")) {
    const toggleHybrid = document.getElementById("toggle-hybrid");
    if (toggleHybrid) toggleHybrid.checked = payload === "ON";
    console.log(`🔄 [SYNC] Mode Hybrid -> ${payload}`);
    return;
  }
  if (topic.includes("/control/laser")) {
    const el = document.getElementById("toggle-laser");
    if (el) el.checked = payload === "ON";
    return;
  }
  if (topic.includes("/control/ir")) {
    const el = document.getElementById("toggle-ir");
    if (el) el.checked = payload === "ON";
    return;
  }
  if (topic.includes("/control/hc")) {
    const el = document.getElementById("toggle-hc");
    if (el) el.checked = payload === "ON";
    return;
  }
  if (topic.includes("/signal/")) {
    try {
      // 1. Parse Data JSON
      var signalData = JSON.parse(payload);

      // 2. Ambil ID ESP dari topik (.../signal/esp1 -> "1")
      var parts = topic.split("/");
      var espId = parts[parts.length - 1].replace("esp", "");

      // 3. Update UI (Pastikan fungsi updateDeviceSignal ada di paling bawah file)
      updateDeviceSignal(espId, signalData.dbm, signalData.qual);

      return; // Stop agar tidak diproses logika lain
    } catch (e) {
      console.error("Error parsing signal:", e);
    }
  }
  if (topic === "projek/belajar/sensor_jarak") {
    try {
      let dist = parseFloat(payload);

      // 1. Abaikan angka 0 atau error (Noise/pantulan hilang sesaat)
      if (dist <= 0) return;

      let hcVal = document.getElementById("hc-val");
      let hcBar = document.getElementById("hc-bar");

      // 2. Bersihkan timer lama karena ada data asli yang masuk
      clearTimeout(window.hcResetTimer);

      if (hcVal) hcVal.innerText = dist.toFixed(1);
      if (hcBar) {
        let percentage = Math.min((dist / 200) * 100, 100); // Batas visual 200cm
        hcBar.style.width = percentage + "%";

        // Berubah merah jika jarak bahaya (< 60cm sesuai ESP)
        if (dist < 60) {
          hcBar.classList.replace("bg-purple-500", "bg-red-500");
          hcVal.classList.add("text-red-500");
        } else {
          hcBar.classList.replace("bg-red-500", "bg-purple-500");
          hcVal.classList.remove("text-red-500");
        }
      }

      // 3. Set timer 2 detik: Jika selama 2 detik benar-benar tidak ada benda, baru reset UI ke 0
      window.hcResetTimer = setTimeout(() => {
        if (hcVal) {
          hcVal.innerText = "--";
          hcVal.classList.remove("text-red-500");
        }
        if (hcBar) {
          hcBar.style.width = "0%";
          hcBar.classList.replace("bg-red-500", "bg-purple-500");
        }
      }, 10000);
    } catch (e) {}
    return;
  }
  if (topic === mqtt_topic_sensor) {
    // Gunakan 'topic' agar konsisten
    try {
      const data = JSON.parse(payload);
      // Update Suhu (ID: temp2)
      if (data.suhu2 !== undefined && data.suhu2 !== null) {
        const tempEl = document.getElementById("temp2");
        if (tempEl) tempEl.innerText = parseFloat(data.suhu2).toFixed(1);
      }
      // Update Kelembaban (ID: hum2)
      if (data.hum2 !== undefined && data.hum2 !== null) {
        const humEl = document.getElementById("hum2");
        if (humEl) humEl.innerText = parseFloat(data.hum2).toFixed(0);
      }
    } catch (e) {
      console.error("Gagal update sensor:", e);
    }
  } else if (msg.destinationName === mqtt_topic_fan_ctrl) {
    let speed = payload === "OFF" || payload === "0" ? 0 : parseInt(payload);
    if (!isNaN(speed)) {
      updateFanUI(speed);
      currentFanSpeed = speed;
    }
  } else if (msg.destinationName === mqtt_topic_schedule) {
    try {
      fanSchedules = JSON.parse(msg.payloadString);
      renderSchedules();
    } catch (e) {}
  } else if (topic === mqtt_topic_ir_recv) {
    if (Date.now() - lastIrSentTime < 3000) {
      console.log("🛡️ Mengabaikan sinyal pantulan (Anti-Loopback aktif).");
      return;
    }
    try {
      const data = JSON.parse(payload);
      const rawData = data.raw;
      const hexCode = data.hex;
      lastCapturedRawData = rawData;
      lastCapturedHex = hexCode;
      console.log(
        `📡 Sinyal Masuk -> HEX: ${hexCode} | RAW Length: ${rawData.length}`,
      );
      const displayEl = document.getElementById("scanned-code-display");
      const infoEl = document.getElementById("raw-size-info");
      if (displayEl) {
        displayEl.innerHTML = `
            <div class="flex flex-col items-center gap-1 animate-pulse">
              <i class="fa-solid fa-satellite-dish text-emerald-400 text-2xl mb-1"></i>
              <span class="text-white text-2xl font-mono tracking-widest">${hexCode}</span>
              <span class="text-[10px] text-slate-400 font-normal">Sinyal Baru Diterima</span>
            </div>`;
        if (infoEl)
          infoEl.innerText = `Type: RAW & HEX | Size: ${rawData.length} chars`;
        displayEl.parentElement.classList.remove("border-emerald-500/30");
        displayEl.parentElement.classList.add(
          "ring-2",
          "ring-emerald-500",
          "bg-emerald-900/20",
        );
        setTimeout(() => {
          displayEl.parentElement.classList.remove(
            "ring-2",
            "ring-emerald-500",
            "bg-emerald-900/20",
          );
          displayEl.parentElement.classList.add("border-emerald-500/30");
        }, 1000);
        safeVibrate([100, 50, 100]);
      }
    } catch (e) {
      console.error("Gagal parse JSON IR:", e);
    }
  } else if (topic === mqtt_topic_cctv_sync) {
    try {
      console.log("🔄 Sinkronisasi Data CCTV dari Cloud...");
      const cloudStreams = JSON.parse(payload);

      // Simpan ke LocalStorage HP ini
      localStorage.setItem("myYoutubeStreams", JSON.stringify(cloudStreams));

      // Render ulang tampilan agar update terlihat
      renderYoutubeStreams();
    } catch (e) {
      console.error("Gagal sync CCTV:", e);
    }
  }

  if (topic.includes("projek/belajar/status/")) {
    try {
      let espId = "";

      // 1. Deteksi ID ESP
      if (topic.endsWith("esp1")) espId = "1";
      else if (topic.endsWith("esp2")) espId = "2";
      else if (topic.endsWith("esp3")) espId = "3";
      else if (topic.endsWith("esp4")) espId = "4";
      else if (topic.endsWith("esp5")) espId = "5";

      if (espId) {
        // [FIX] Update Waktu Terakhir Terlihat agar Watchdog tidak mematikannya
        deviceLastSeen[espId] = Date.now();

        // [FIX EROR JSON] Cek jika payload adalah teks "Online" atau "Offline"
        if (payload === "Online" || payload === "Offline") {
          updateDeviceStatus(espId, payload === "Online");
          return; // Hentikan di sini agar tidak dilanjutkan ke JSON.parse()
        }

        // Jika bukan teks biasa, asumsikan JSON (Untuk ESP 1 - 4)
        const statusData = JSON.parse(payload);
        updateDeviceStatus(espId, true);

        // Update Detail Teks
        const txt = document.getElementById(`ssid-esp${espId}`);
        const distEl = document.getElementById(`dist-esp${espId}`);
        const pingEl = document.getElementById(`ping-esp${espId}`);

        let rssiVal = parseInt(statusData.rssi);

        if (txt) {
          txt.innerText = `${statusData.ssid || "WiFi"}`;
          txt.className = "text-[9px] text-emerald-400 font-mono";
        }

        // [FIX] HANYA update tampilan UI sinyal JIKA data rssiVal benar-benar valid (bukan NaN dan bernilai minus)
        if (!isNaN(rssiVal) && rssiVal < 0) {
          if (distEl) {
            distEl.classList.remove("hidden");
            distEl.innerText = `| Signal: ${rssiVal} dBm`;

            if (rssiVal > -60)
              distEl.className =
                "text-emerald-400 font-mono text-[9px] font-bold";
            else if (rssiVal > -75)
              distEl.className =
                "text-yellow-400 font-mono text-[9px] font-bold";
            else
              distEl.className = "text-red-400 font-mono text-[9px] font-bold";
          }

          if (pingEl) {
            let quality = Math.min(Math.max(2 * (rssiVal + 100), 0), 100);
            pingEl.innerText = `Qual: ${quality}%`;
            pingEl.className = "text-[9px] text-slate-400 font-mono";
          }
        }
      }
    } catch (e) {
      console.error("Status Update Error:", e, "| Payload:", payload);
    }
  }
  if (msg.destinationName === "projek/belajar/wifi_scan_result") {
    try {
      const networks = JSON.parse(msg.payloadString);
      const container = document.getElementById("wifi-list-container");
      container.innerHTML = "";

      networks.forEach((net) => {
        const div = document.createElement("div");
        div.className =
          "flex justify-between items-center bg-slate-800 p-2 rounded cursor-pointer hover:bg-slate-700 border border-transparent hover:border-emerald-500";
        div.innerHTML = `<span class="font-bold text-white text-xs">${net.ssid}</span> <span class="text-[10px] text-emerald-400">${net.rssi}dBm</span>`;
        div.onclick = () => {
          selectedSsidTarget = net.ssid;
          document.getElementById("wifi-pass-input").focus();
          // Highlight pilihan
          document
            .querySelectorAll("#wifi-list-container > div")
            .forEach((d) => d.classList.remove("border-emerald-500"));
          div.classList.add("border-emerald-500");
        };
        container.appendChild(div);
      });

      if (typeof closeInfoModal === "function") closeInfoModal();
      document.getElementById("modal-wifi-scan").classList.add("active");
    } catch (e) {
      console.error("Parse WiFi Error", e);
    }
  }
};
// [Cari fungsi ini di logic.js]
let isMqttConnecting = false;

function connectMQTT() {
  if (isMqttConnecting || (mqttClient && mqttClient.isConnected())) {
    console.log("MQTT sedang menghubungkan atau sudah terhubung.");
    return;
  }
  isMqttConnecting = true;
  console.log("🔄 Menghubungkan ke MQTT...");
  try {
    mqttClient.connect({
      useSSL: mqtt_useSSL,
      keepAliveInterval: 30, // [FIX] Kirim sinyal 'hidup' setiap 30 detik agar tidak diputus broker
      timeout: 10, // [FIX] Waktu tunggu koneksi
      cleanSession: true,
      onSuccess: () => {
        isMqttConnecting = false;
        console.log("✅ MQTT Terhubung!");
        updateStatus(!0, "Terhubung");

        // --- PERBAIKAN: Safety Check sebelum Subscribe ---
        if (mqttClient && typeof mqttClient.subscribe === "function") {
          mqttClient.subscribe(mqtt_topic_ir_recv);
          mqttClient.subscribe(mqtt_topic_sensor);
          mqttClient.subscribe(mqtt_topic_kulkas);
          mqttClient.subscribe(mqtt_topic_schedule);
          mqttClient.subscribe(mqtt_topic_fan_ctrl);
          mqttClient.subscribe(
            "projek/belajar/sensoe_suhu_riyan10_bro/control/#",
          );
          mqttClient.subscribe(mqtt_topic_security_ctrl);
          mqttClient.subscribe(mqtt_topic_car_status);
          mqttClient.subscribe(mqtt_topic_jadwal_data);
          mqttClient.subscribe(mqtt_topic_jadwal_info);
          mqttClient.subscribe(mqtt_topic_cctv_sync);
          mqttClient.subscribe("projek/belajar/status/#");
          mqttClient.subscribe(
            "projek/belajar/sensoe_suhu_riyan10_bro/signal/+",
          );
          mqttClient.subscribe("projek/belajar/wifi_scan_result");
          mqttClient.subscribe("projek/belajar/sensor_jarak");
          console.log("📡 Subscribed to All Control Topics");
        } else {
          console.error("⚠️ Error: MQTT Client belum siap untuk Subscribe.");
        }
        // ------------------------------------------------

        if (fanSchedules.length > 0) {
          console.log("♻️ Restore Jadwal dari HP ke Alat...");
          uploadScheduleToCloud();
        }
        if (
          typeof syncRemoteToESP === "function" &&
          remoteDashboards &&
          remoteDashboards.length > 0
        ) {
          console.log("♻️ Sync Database Remote tertunda ke OLED...");
          syncRemoteToESP();
        }
      },
      onFailure: (m) => {
        isMqttConnecting = false;
        console.error("❌ Gagal Koneksi MQTT:", m.errorMessage);
        updateStatus(!1, "Gagal Koneksi");
        setTimeout(connectMQTT, 5000);
      },
    });
  } catch (e) {
    isMqttConnecting = false;
    console.error("❌ Error System MQTT:", e);
    updateStatus(!1, "Error Koneksi MQTT");
    setTimeout(connectMQTT, 5000);
  }
}
let homeClockInterval = null;
function updateStatus(isCon, text) {
  const elText = document.getElementById("status-text");
  const dot = document.getElementById("status-dot");
  const headerDot = document.getElementById("header-status-dot");
  const homeTopDot = document.getElementById("home-top-dot");
  const homeTopText = document.getElementById("home-top-text");
  const homeHeaderBox = document.getElementById("home-header-status");
  if (isCon) {
    const greenStyle = { bg: "#22c55e", shadow: "0 0 10px #22c55e" };
    if (dot) {
      dot.style.backgroundColor = greenStyle.bg;
      dot.style.boxShadow = greenStyle.shadow;
    }
    if (elText) elText.innerText = "Terhubung";
    if (headerDot) {
      headerDot.style.backgroundColor = greenStyle.bg;
      headerDot.style.boxShadow = greenStyle.shadow;
    }
    if (homeTopDot) {
      homeTopDot.style.backgroundColor = greenStyle.bg;
      homeTopDot.style.boxShadow = greenStyle.shadow;
    }
    if (homeTopText) {
      homeTopText.innerText = "Sistem Terhubung!";
      homeTopText.classList.add("text-emerald-400");
      if (homeClockInterval) clearInterval(homeClockInterval);
      setTimeout(() => {
        updateRealTimeClock(homeTopText);
        homeClockInterval = setInterval(() => {
          updateRealTimeClock(homeTopText);
        }, 1000);
      }, 3000);
    }
  } else {
    const redStyle = { bg: "#ef4444", shadow: "0 0 10px #ef4444" };
    if (homeClockInterval) clearInterval(homeClockInterval);
    if (dot) {
      dot.style.backgroundColor = redStyle.bg;
      dot.style.boxShadow = redStyle.shadow;
    }
    if (elText) elText.innerText = "Terputus";
    if (headerDot) {
      headerDot.style.backgroundColor = redStyle.bg;
      headerDot.style.boxShadow = redStyle.shadow;
    }
    if (homeTopDot) {
      homeTopDot.style.backgroundColor = redStyle.bg;
      homeTopDot.style.boxShadow = redStyle.shadow;
    }
    if (homeTopText) {
      homeTopText.innerText = "Koneksi Terputus!";
      homeTopText.classList.remove("text-emerald-400");
      homeTopText.classList.add("text-red-400");
    }
  }
}
function updateRealTimeClock(element) {
  const now = new Date();
  const dateOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  const dateStr = now.toLocaleDateString("id-ID", dateOptions);
  const timeStr = now
    .toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    .replace(/\./g, ":");
  element.innerText = `${dateStr} • ${timeStr} WIB`;
  element.classList.remove("text-red-400");
  element.classList.add("text-emerald-300");
}
let map, marker, searchTimeout;
let isMapFullscreen = !1;
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth();
function initMap() {
  map = L.map("map", { zoomControl: !1 }).setView(
    [DEFAULT_LAT, DEFAULT_LON],
    13,
  );
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; CARTO",
    maxZoom: 19,
  }).addTo(map);
  marker = L.marker([DEFAULT_LAT, DEFAULT_LON]).addTo(map);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  map.on("click", (e) => {
    fetchWeather(e.latlng.lat, e.latlng.lng, !0);
  });
}
function toggleMapSize() {
  const container = document.getElementById("mapContainer");
  const icon = document.getElementById("resizeIcon");
  isMapFullscreen = !isMapFullscreen;
  if (isMapFullscreen) {
    container.classList.add("fullscreen");
    icon.className = "fa-solid fa-compress";
  } else {
    container.classList.remove("fullscreen");
    icon.className = "fa-solid fa-expand";
  }
  setTimeout(() => {
    map.invalidateSize();
  }, 300);
}
async function getPreciseAddress(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "Accept-Language": "id",
        "User-Agent": "IoT-Dashboard-Project/1.0",
      },
    });
    if (!res.ok) throw new Error("Nominatim Failed");
    const data = await res.json();
    const a = data.address;
    const parts = [];
    if (a.road) parts.push(a.road);
    if (a.neighbourhood) parts.push(a.neighbourhood);
    if (a.quarter) parts.push(a.quarter);
    if (a.village || a.suburb) parts.push(a.village || a.suburb);
    if (a.city_district || a.district)
      parts.push(a.city_district || a.district);
    if (a.city || a.town || a.county) parts.push(a.city || a.town || a.county);
    if (a.state) parts.push(a.state);
    if (a.country) parts.push(a.country);
    const mainName = a.village || a.road || data.name || "Lokasi Terpilih";
    const subName = parts.join(", ");
    return { main: mainName, sub: subName };
  } catch (e) {
    const url2 = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=id`;
    try {
      const res2 = await fetch(url2);
      const data2 = await res2.json();
      const city = data2.city || data2.locality || "";
      const district = data2.principalSubdivision || "";
      const country = data2.countryName || "";
      return {
        main: city ? city : district,
        sub: `${city}, ${district}, ${country}`,
      };
    } catch (ex) {
      return {
        main: "Koordinat Peta",
        sub: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      };
    }
  }
}
// Konfigurasi API Key Windy (Kosongkan jika belum punya, otomatis beralih ke Open-Meteo)
const WINDY_API_KEY = "5TlbByIta8ddwzvcvdQn0L6BbBk6zBs4";
// --- LOGIKA CUACA CERDAS (WINDY + CACHE + OPEN-METEO) ---

const WINDY_CACHE_KEY = "windyDataCache";
const WINDY_LAST_FETCH = "windyLastFetchTime";
const CACHE_DURATION = 3 * 60 * 60 * 1000; // 3 Jam (Agar awet 500 request/hari)

// ==========================================================
// 2. LOGIKA CUACA HYBRID (WINDY + OPEN-METEO)
// FIX: NaN km, Ikon Berawan Terus, dan Error 400
// ==========================================================

async function fetchWeather(lat, lon, autoAddress = !1, manualName = null) {
  currentLat = lat;
  currentLon = lon;
  if (marker) marker.setLatLng([lat, lon]);
  if (!isMapFullscreen && map) map.setView([lat, lon], 14);

  document.getElementById("locName").innerText = "Memuat Data...";
  document.getElementById("locSub").innerText = "Sinkronisasi Cuaca Hybrid...";

  try {
    const addr = await getPreciseAddress(lat, lon);
    document.getElementById("locName").innerText = addr.main;
    document.getElementById("locSub").innerText = addr.sub;
  } catch (e) {
    document.getElementById("locName").innerText =
      manualName || "Lokasi Terpilih";
  }

  // 1. AMBIL DATA DARI OPEN-METEO (Sebagai fondasi Ikon Cuaca & Jadwal 16 Hari)
  let meteoData = null;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min&hourly=temperature_2m,weather_code&timezone=auto&forecast_days=16`;
    const res = await fetch(url);
    meteoData = await res.json();
  } catch (e) {
    console.error("Meteo gagal", e);
  }

  // 2. AMBIL DATA WINDY (Hanya minta Suhu & Angin agar terhindar dari Error 400)
  try {
    if (!WINDY_API_KEY) throw new Error("API Key Kosong");

    const windyRes = await fetch(
      "https://api.windy.com/api/point-forecast/v2",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: Number(lat),
          lon: Number(lon),
          model: "gfs",
          parameters: ["temp", "wind", "rh"], // HANYA MEMINTA PARAMETER DASAR
          levels: ["surface"],
          key: WINDY_API_KEY,
        }),
      },
    );

    if (!windyRes.ok) throw new Error("Gagal Akses Windy");
    const windyData = await windyRes.json();

    // 3. GABUNGKAN DATA KEDUANYA
    processHybridWeather(windyData, meteoData);
  } catch (err) {
    console.warn(`⚠️ Windy Gagal: ${err.message}. Pakai Open-Meteo Full.`);
    // Jika Windy Error, Tampilkan Data Meteo Sepenuhnya
    if (meteoData) {
      renderCurrent(meteoData.current);
      renderHourly(meteoData.hourly);
      renderCalendar(meteoData.daily);
      const loader = document.getElementById("loader-cuaca");
      if (loader) loader.classList.add("hidden");
    }
  }
}

// FUNGSI PENGGABUNG DATA (WINDY + METEO)
function processHybridWeather(windy, meteo) {
  if (!meteo) return;

  const tempK = windy["temp-surface"] || [];
  const rh = windy["rh-surface"] || [];

  // A. CUACA SAAT INI
  let currentTemp = meteo.current.temperature_2m;

  // 👇 INI KUNCINYA: Angin murni dari Open-Meteo agar stabil dan tidak mungkin NaN
  let currentWind = meteo.current.wind_speed_10m;
  let currentRh = meteo.current.relative_humidity_2m;

  // Jika Windy berhasil, timpa suhu saja dengan suhu Windy
  if (tempK.length > 0) {
    currentTemp = (tempK[0] - 273.15).toFixed(1);
    currentRh = Math.round(rh[0] || currentRh);
  }

  const currentData = {
    temperature_2m: currentTemp,
    relative_humidity_2m: currentRh,
    wind_speed_10m: currentWind, // Angka angin dijamin keluar disini
    weather_code: meteo.current.weather_code, // IKON PASTI AKURAT (Cerah/Hujan/dll)
  };
  renderCurrent(currentData);

  // B. JADWAL PER JAM (Suhu ditimpa pakai Windy)
  let hourlyData = meteo.hourly;
  if (tempK.length > 0 && hourlyData.temperature_2m) {
    for (let i = 0; i < 24 && i < tempK.length; i++) {
      hourlyData.temperature_2m[i] = (tempK[i] - 273.15).toFixed(1);
    }
  }
  renderHourly(hourlyData);

  // C. JADWAL 16 HARI (Tetap pakai Open-Meteo agar stabil 16 Hari penuh)
  renderCalendar(meteo.daily);

  const loader = document.getElementById("loader-cuaca");
  if (loader) loader.classList.add("hidden");
  console.log("✅ Sistem Cuaca Hybrid Berhasil Diterapkan (Tanpa NaN)!");
}

// 4. API LAMA: Ganti nama fungsi asli Anda untuk dijadikan Fallback
async function fetchWeatherOpenMeteo(lat, lon) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min&hourly=temperature_2m,weather_code&timezone=auto&forecast_days=16`;
    const res = await fetch(url);
    const data = await res.json();

    renderCurrent(data.current);
    renderCalendar(data.daily);
    renderHourly(data.hourly);

    const loader = document.getElementById("loader-cuaca");
    if (loader && !loader.classList.contains("hidden")) {
      loader.classList.add("hidden");
      // Animasikan Kartu Cuaca Utama & Grid
      setTimeout(() => {
        if (typeof applyGlobalAnimation === "function") {
          applyGlobalAnimation(
            "#page-cuaca .glass, #page-cuaca .bg-slate-900",
            0.1,
          );
        }
      }, 300);
    }
    console.log("☁️ Menggunakan data dari Open-Meteo (Fallback Sukses).");
  } catch (e) {
    console.error("Open-Meteo Error:", e);
    showInfoModal(
      "Gagal",
      "Tidak dapat mengambil data cuaca dari semua server.",
      "error",
    );
    setTimeout(() => {
      closeModalAndReset();
    }, 5000);
  }
}
function renderCurrent(curr) {
  const info = getWeatherInfo(curr.weather_code);
  const tempVal = Math.round(curr.temperature_2m);
  document.getElementById("mainTemp").innerText = tempVal + "°";
  document.getElementById("mainDesc").innerText = info.desc;
  document.getElementById("mainIcon").className =
    `fa-solid ${info.icon} text-5xl mb-4 ${info.color}`;
  document.getElementById("wind").innerText = curr.wind_speed_10m + " km/h";
  document.getElementById("humid-weather").innerText =
    curr.relative_humidity_2m + "%";
  document.getElementById("vis").innerText =
    (curr.visibility / 1000).toFixed(1) + " km";
  const options = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  document.getElementById("currentDateStr").innerText =
    new Date().toLocaleDateString("id-ID", options);
  if (tempVal <= 20) {
    if (!lastAutoFanTrigger) {
      console.log(`❄️ Dingin Sekali (${tempVal}°C)! Matikan Kipas.`);
      triggerESP("kipas-off");
      lastAutoFanTrigger = !0;
    }
  } else {
    lastAutoFanTrigger = !1;
  }
}
function renderHourly(hourly) {
  const container = document.getElementById("hourly-container");
  container.innerHTML = "";
  const now = new Date();
  let startIndex = -1;
  for (let i = 0; i < hourly.time.length; i++) {
    if (new Date(hourly.time[i]) >= now) {
      startIndex = i;
      break;
    }
  }
  if (startIndex === -1) startIndex = 0;
  for (let i = 0; i < 12; i++) {
    const idx = startIndex + i;
    if (idx >= hourly.time.length) break;
    const timeObj = new Date(hourly.time[idx]);
    const hourStr = timeObj.getHours().toString().padStart(2, "0") + ":00";
    const temp = Math.round(hourly.temperature_2m[idx]);
    const code = hourly.weather_code[idx];
    const info = getWeatherInfo(code);
    const div = document.createElement("div");
    div.className = "hourly-item";
    div.innerHTML = `
            <div class="text-[9px] text-gray-400 mb-0.5">${hourStr}</div>
            <i class="fa-solid ${info.icon} ${info.color} text-lg mb-0.5"></i>
            <div class="text-[8px] text-blue-300 leading-tight w-full text-center overflow-hidden text-ellipsis px-1">${info.desc}</div>
            <div class="text-xs font-bold text-white">${temp}°</div>
        `;
    container.appendChild(div);
  }
}
function getWeatherInfo(code) {
  const map = {
    0: { desc: "Cerah", icon: "fa-sun", color: "text-yellow-400" },
    1: {
      desc: "Cerah Berawan",
      icon: "fa-cloud-sun",
      color: "text-yellow-300",
    },
    2: { desc: "Berawan", icon: "fa-cloud", color: "text-gray-400" },
    3: { desc: "Mendung", icon: "fa-cloud", color: "text-gray-500" },
    45: { desc: "Kabut", icon: "fa-smog", color: "text-gray-400" },
    51: { desc: "Gerimis", icon: "fa-cloud-rain", color: "text-blue-300" },
    61: {
      desc: "Hujan",
      icon: "fa-cloud-showers-heavy",
      color: "text-blue-400",
    },
    80: {
      desc: "Hujan Lokal",
      icon: "fa-cloud-sun-rain",
      color: "text-indigo-400",
    },
    95: { desc: "Petir", icon: "fa-bolt", color: "text-yellow-500" },
  };
  return map[code] || { desc: "-", icon: "fa-minus", color: "text-gray-600" };
}
function renderCalendar(daily) {
  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = "";
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const weatherMap = {};
  daily.time.forEach((t, i) => {
    weatherMap[t] = {
      code: daily.weather_code[i],
      max: Math.round(daily.temperature_2m_max[i]),
      min: Math.round(daily.temperature_2m_min[i]),
    };
  });
  for (let i = 0; i < firstDayIndex; i++)
    grid.innerHTML += `<div class="bg-slate-800/50 min-h-[auto] aspect-square rounded"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${currentYear}-${(currentMonth + 1)
      .toString()
      .padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
    const w = weatherMap[dateKey];
    const isToday = dateKey === new Date().toISOString().split("T")[0];
    let html = `<div class="calendar-square-fix p-1 transition rounded hover:bg-white/5 ${
      isToday ? "bg-blue-600/10 border border-blue-500/30" : "bg-slate-800/80"
    }">
            <span class="text-[10px] font-bold w-full text-left ${
              isToday ? "text-blue-400" : "text-gray-500"
            }">${d}</span>`;

    if (w) {
      const info = getWeatherInfo(w.code);
      // Ikon dan Teks
      html += `<div class="flex-1 flex items-center justify-center -mt-1"><i class="fa-solid ${info.icon} ${info.color} text-lg"></i></div>
               <div class="text-[9px] text-center text-white w-full pb-1">${w.max}° <span class="text-gray-500 text-[8px]">${w.min}°</span></div>`;
    } else {
      // Penanganan jika data kosong agar kotak tetap utuh
      html += `<div class="flex-1"></div>`;
    }
    html += `</div>`;
    grid.innerHTML += html;
  }
}
function getMyLocation() {
  if (!navigator.geolocation) {
    showInfoModal("Info GPS", "GPS tidak didukung perangkat ini.", "error");
    fetchWeather(DEFAULT_LAT, DEFAULT_LON, !0);
    setTimeout(() => {
      closeModalAndReset();
    }, 5000);
    return;
  }
  document.getElementById("locName").innerText = "Mendeteksi GPS...";
  navigator.geolocation.getCurrentPosition(
    (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude, !0),
    (err) => {
      console.log("GPS Gagal, Default Yogyakarta");
      fetchWeather(DEFAULT_LAT, DEFAULT_LON, !0);
    },
    { enableHighAccuracy: !0, timeout: 5000 },
  );
}
const searchInp = document.getElementById("searchInput");
const searchRes = document.getElementById("searchResults");
searchInp.addEventListener("input", (e) => {
  clearTimeout(searchTimeout);
  const val = e.target.value;
  if (val.length < 3) {
    searchRes.classList.add("hidden");
    return;
  }
  searchTimeout = setTimeout(async () => {
    searchRes.classList.remove("hidden");
    searchRes.innerHTML = '<div class="p-3 text-xs text-gray-400">...</div>';
    try {
      const r = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${val}&count=5&language=id&format=json`,
      );
      const d = await r.json();
      searchRes.innerHTML = "";
      if (!d.results) {
        searchRes.innerHTML =
          '<div class="p-3 text-xs text-red-400">Nihil</div>';
        return;
      }
      d.results.forEach((loc) => {
        const div = document.createElement("div");
        div.className =
          "px-4 py-2 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 flex flex-col";
        div.innerHTML = `<span class="text-sm font-bold text-white">${
          loc.name
        }</span><span class="text-xs text-gray-400">${loc.admin1 || ""}, ${
          loc.country || ""
        }</span>`;
        div.onclick = () => {
          fetchWeather(loc.latitude, loc.longitude, !1, loc.name);
          searchRes.classList.add("hidden");
        };
        searchRes.appendChild(div);
      });
    } catch (e) {}
  }, 500);
});
document.addEventListener("click", (e) => {
  if (!searchInp.contains(e.target) && !searchRes.contains(e.target))
    searchRes.classList.add("hidden");
});
const token_p1 = "ghp_";
const token_p2 = "CB5JQHNEPJ5SigYzD0o3alKHqwXcbW309ZGa";
const GH_TOKEN = token_p1 + token_p2;
const GH_USERNAME = "rynnn10";
const GH_REPO = "Pengenalan_wajah";
const GH_DB_PATH = "database/face_db.json";
const GH_EXCEL_PATH = "foto/absensi.xlsx";
const ESP_IP = "http://192.168.1.2";
const TELEGRAM_BOT_TOKEN = "8034966869:AAFtWJTN0Y1tZaBPR71YBFIwW2w7Ifbsybs";
const TELEGRAM_CHAT_ID = "6439820196";
const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";
let SSD_OPTIONS = null; // Ubah jadi null dulu agar tidak error saat start
const MATCH_THRESHOLD = 0.5;
let labeledDescriptors = [],
  metadata = [],
  currentDescriptor = null,
  isUnlocking = !1;

function startVideo() {
  console.log("🔄 Mengalihkan ke startCamera()...");
  startCamera();
}

async function initFaceApp() {
  const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
  if (!SSD_OPTIONS) {
    SSD_OPTIONS = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
  }
  try {
    console.log("⏳ Memulai Face API (Lazy Mode)...");
    if (typeof setAppStatus === "function")
      setAppStatus("Menyiapkan AI (1/3)...", "loading");

    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    console.log("✅ Model 1/3 Siap");

    // Update Loading Overlay Text (Opsional)
    const loaderText = document.querySelector("#loader-absensi p");
    if (loaderText) loaderText.innerText = "MEMUAT DATA WAJAH...";

    await new Promise((r) => setTimeout(r, 300)); // Kurangi delay agar lebih cepat

    if (typeof setAppStatus === "function")
      setAppStatus("Menyiapkan AI (2/3)...", "loading");
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);

    await new Promise((r) => setTimeout(r, 300));

    if (typeof setAppStatus === "function")
      setAppStatus("Menyiapkan AI (3/3)...", "loading");
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

    // Load Data Wajah dari GitHub
    await loadFacesFromGitHub();

    isModelLoaded = true;

    if (typeof setAppStatus === "function")
      setAppStatus("Sistem Siap", "success");
    console.log("🎉 SEMUA AI BERHASIL DIMUAT!");

    // [PENTING] Sembunyikan Loader Absensi Jika Sukses
    const loader = document.getElementById("loader-absensi");
    if (loader) {
      loader.classList.add("hidden");

      // [BARU] JALANKAN ANIMASI PROGRESIF SETELAH LOADER HILANG
      setTimeout(() => {
        // Animasikan Camera Box & List User
        applyGlobalAnimation(
          "#page-absensi .camera-box, #page-absensi .bg-slate-800",
          0.1,
        );
      }, 100);
    }

    // Otomatis nyalakan kamera
    startVideo();
  } catch (err) {
    console.error("❌ Gagal memuat AI:", err);
    if (typeof setAppStatus === "function")
      setAppStatus("Gagal Memuat AI", "error");

    // [PENTING] Sembunyikan Loader meskipun Gagal (supaya user bisa retry)
    const loader = document.getElementById("loader-absensi");
    if (loader) loader.classList.add("hidden");

    showInfoModal("Koneksi", "Gagal mengunduh AI. Cek internet.", "error");
    setTimeout(() => {
      closeModalAndReset();
    }, 5000);
  }
}

// Modifikasi sedikit pada loadFacesFromGitHub agar tidak menimpa status error
async function loadFacesFromGitHub(isBackground = !1) {
  try {
    if (!isBackground) setAppStatus("Sinkronisasi Data...", "loading");

    // Tambahkan timestamp agar tidak cache
    const uniqueUrl = `https://api.github.com/repos/${GH_USERNAME}/${GH_REPO}/contents/${GH_DB_PATH}?t=${Date.now()}`;

    const res = await fetch(uniqueUrl, {
      method: "GET",
      headers: {
        Authorization: `token ${GH_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
      // Hapus mode: 'cors' jika menyebabkan masalah di WebView tertentu,
      // tapi biasanya diperlukan untuk fetch ke domain lain.
    });

    if (res.ok) {
      const data = await res.json();
      const cleanContent = data.content.replace(/\s/g, "");
      const decodedContent = atob(cleanContent); // Base64 decode

      let jsonDB;
      try {
        jsonDB = JSON.parse(decodedContent);
      } catch (err) {
        console.error("JSON Parse Error:", err);
        jsonDB = [];
      }

      if (!Array.isArray(jsonDB)) jsonDB = [];

      // Mapping data
      labeledDescriptors = jsonDB.map(
        (i) =>
          new faceapi.LabeledFaceDescriptors(
            i.label,
            i.descriptors.map((d) => new Float32Array(Object.values(d))),
          ),
      );

      renderList();
      if (!isBackground) setAppStatus("AI Siap Digunakan", "success");
    } else if (res.status === 404) {
      console.log("Database wajah baru/kosong.");
      labeledDescriptors = [];
      renderList();
      if (!isBackground) setAppStatus("AI Siap (DB Kosong)", "success");
    } else {
      throw new Error(`GitHub API: ${res.status}`);
    }
  } catch (e) {
    console.error("Sync Error:", e);
    if (!isBackground) {
      // Jangan set error fatal, cukup warning agar AI tetap bisa dipakai scan (register baru)
      setAppStatus("Gagal Sync Data", "error");
      throw e; // Lempar error agar ditangkap initFaceApp
    }
  }
}
function setAppStatus(msg, type = "normal") {
  const el = document.getElementById("app-status");
  if (!el) return;
  el.innerHTML = msg;
  el.className =
    type === "success"
      ? "bg-emerald-900/30 border border-emerald-500/30 p-3 rounded-lg text-center text-sm text-emerald-400 font-bold"
      : type === "error"
        ? "bg-red-900/30 border border-red-500/30 p-3 rounded-lg text-center text-sm text-red-400 font-bold"
        : "bg-slate-800 border border-slate-700 p-3 rounded-lg text-center text-sm text-slate-300";
}
let isLoadingModel = false;

async function startCamera() {
  // Cek jika model belum siap
  if (!isModelLoaded) {
    // Jika sedang loading, jangan panggil lagi! Cukup beri tahu user.
    if (isLoadingModel) {
      showInfoModal("Sabar", "Sedang mengunduh data AI...", "loading");
      return;
    }

    // Jika belum loading, baru mulai load
    isLoadingModel = true;
    console.warn("⚠️ Model belum siap, mencoba memuat...");
    await initFaceApp();
    isLoadingModel = false; // Reset flag setelah selesai
    return;
  }

  try {
    // Minta izin kamera
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode },
    });

    video.srcObject = stream;

    // Tunggu metadata video siap
    video.onloadedmetadata = () => {
      video.play();
      isCameraOn = true;
      video.style.display = "block";

      // Sembunyikan placeholder icon wajah
      const placeholder = document.getElementById("initial-placeholder");
      if (placeholder) placeholder.classList.add("hidden");

      // Aktifkan tombol
      captureBtn.disabled = false;
      captureBtn.innerHTML = '<i class="fa-solid fa-camera"></i> SCAN WAJAH';
      toggleCamBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
    };
  } catch (err) {
    console.error("Camera Error:", err);
    showInfoModal(
      "Izin Ditolak",
      "Mohon izinkan akses kamera di pengaturan HP.",
      "error",
    );
    setTimeout(() => {
      closeModalAndReset();
    }, 5000);
  }
}
function stopCamera() {
  const stream = video.srcObject;
  if (stream) {
    // Matikan semua track secara eksplisit
    stream.getTracks().forEach((t) => {
      t.stop();
      // Hapus referensi agar memori dibersihkan garbage collector
      t.enabled = false;
    });
  }

  video.srcObject = null; // Putus hubungan video dengan stream
  video.load(); // Paksa reset elemen video (Trik Android WebView)

  isCameraOn = !1;
  video.style.display = "none";
  document.getElementById("initial-placeholder").classList.remove("hidden");
  captureBtn.disabled = !0;
  toggleCamBtn.innerHTML = '<i class="fa-solid fa-video-slash"></i>';
}
toggleCamBtn.addEventListener("click", () =>
  isCameraOn ? stopCamera() : startCamera(),
);
captureBtn.addEventListener("click", async () => {
  if (!isCameraOn) return;
  captureBtn.disabled = !0;
  captureBtn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> SCANNING...';
  video.pause();
  document.getElementById("scan-loading").classList.remove("hidden");
  setTimeout(async () => {
    try {
      const detections = await faceapi
        .detectAllFaces(video, SSD_OPTIONS)
        .withFaceLandmarks()
        .withFaceDescriptors();
      document.getElementById("scan-loading").classList.add("hidden");
      if (detections.length === 0) {
        showOverlay("error-overlay");
        return;
      }
      if (detections.length > 1) {
        showOverlay("multi-face-overlay");
        return;
      }
      const d = detections[0];
      if (d.detection.box.x < 20 || d.detection.box.y < 20) {
        showOverlay("boundary-overlay");
        return;
      }
      currentDescriptor = d.descriptor;
      drawSnapshot(d);
      processFace();
    } catch (e) {
      document.getElementById("scan-loading").classList.add("hidden");
      video.play();
      captureBtn.disabled = !1;
      captureBtn.innerHTML = '<i class="fa-solid fa-camera"></i> SCAN WAJAH';
    }
  }, 600);
});
function showOverlay(id) {
  document.getElementById(id).classList.add("active-overlay");
}
window.hideOverlays = function () {
  document
    .querySelectorAll(".error-overlay, .warning-overlay")
    .forEach((e) => e.classList.remove("active-overlay"));
  video.play();
  if (isCameraOn) {
    captureBtn.disabled = !1;
    captureBtn.innerHTML = '<i class="fa-solid fa-camera"></i> SCAN WAJAH';
  }
};
function drawSnapshot(detection) {
  const dims = { width: video.videoWidth, height: video.videoHeight };
  faceapi.matchDimensions(canvas, dims);
  canvas.style.display = "block";
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, dims.width, dims.height);
  const box = faceapi.resizeResults(detection, dims).detection.box;
  ctx.strokeStyle = "#34d399";
  ctx.lineWidth = 4;
  ctx.strokeRect(
    canvas.width - box.x - box.width,
    box.y,
    box.width,
    box.height,
  );
}
function processFace() {
  if (isUnlocking) return;
  if (document.getElementById("register-modal").classList.contains("active"))
    return;
  if (labeledDescriptors.length === 0) {
    triggerESP("akses-ditolak");
    showRegisterModal();
    return;
  }
  const matcher = new faceapi.FaceMatcher(labeledDescriptors, MATCH_THRESHOLD);
  const match = matcher.findBestMatch(currentDescriptor);
  const acc = Math.round((1 - match.distance) * 100);
  if (match.label !== "unknown") {
    isUnlocking = !0;
    triggerESP("buzzer-ok");
    showInfoModal(
      "Akses Diterima",
      `Halo <b>${match.label}</b><br>Akurasi: ${acc}%<br>Pintu terbuka 10 detik.`,
      "success",
    );
    triggerESP("door-unlock");
    kirimTelegram(
      match.label,
      acc,
      "AKSES DITERIMA",
      "🔓 Pintu Terbuka (Face ID)",
    );
    logToSpreadsheet(match.label, "FACE", "DITERIMA");
    console.log("⏳ Pintu terbuka, menunggu 10 detik...");
    setTimeout(() => {
      console.log("🔒 Pintu dikunci kembali otomatis.");
      closeModalAndReset();
      isUnlocking = !1;
    }, 10000);
  } else {
    triggerESP("akses-ditolak");
    kirimTelegram(
      "Tidak Dikenal",
      acc,
      "AKSES DITOLAK",
      "⛔ Pintu Tetap Terkunci",
    );
    showInfoModal("Akses Ditolak", "Wajah tidak dikenali sistem.", "error");
    setTimeout(() => {
      closeModalAndReset();
    }, 2000);
    logToSpreadsheet("Unknown User", "FACE", "DITOLAK");
  }
}
function logToSpreadsheet(name, type, status) {
  fetch(GAS_URL, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({
      action: "log_access",
      name: name,
      type: type,
      status: status,
    }),
  })
    .then(() => console.log(`📝 Log Spreadsheet: ${name} - ${status}`))
    .catch((e) => console.error("Gagal Log Spreadsheet:", e));
}
function triggerESP(ep) {
  let command = "";
  if (ep === "kipas-on") command = "ON";
  else if (ep === "kipas-off") command = "OFF";
  else if (ep === "door-unlock") command = "DOOR_UNLOCK";
  else if (ep === "door-lock") command = "DOOR_LOCK";
  else if (ep === "akses-ditolak") command = "ACCESS_DENIED";
  else if (ep === "buzzer-ok") command = "BUZZER_OK";
  if (command && mqttClient.isConnected()) {
    console.log(`📤 MQTT Command: ${command}`);
    const message = new Paho.MQTT.Message(command);
    message.destinationName = "projek/belajar/perintah_kipas";
    mqttClient.send(message);
  } else {
    console.warn("MQTT disconnect / command unknown");
  }
}
function kirimTelegram(nama, acc, judul, statusPintu) {
  canvas.toBlob(
    (blob) => {
      const fd = new FormData();
      fd.append("chat_id", TELEGRAM_CHAT_ID);
      fd.append("photo", blob, "scan.jpg");
      fd.append(
        "caption",
        `✅ *${judul}*\n👤 ${nama}\n🎯 ${acc}%\n${statusPintu}`,
      );
      fd.append("parse_mode", "Markdown");
      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        body: fd,
      });
    },
    "image/jpeg",
    0.8,
  );
}
function sendTelegramText(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(
    text,
  )}&parse_mode=Markdown`;
  fetch(url).catch((e) => console.error("Gagal kirim Telegram:", e));
}
saveBtn.addEventListener("click", async () => {
  if (labeledDescriptors.length >= 1) {
    showInfoModal("Penuh", "Maksimal 1 Wajah! Hapus via Telegram.", "error");
    return;
  }
  const name = nameInput.value.trim();
  if (!name) return showInfoModal("Error", "Nama tidak boleh kosong!", "error");
  setAppStatus("Menyimpan...", "loading");
  try {
    labeledDescriptors.push(
      new faceapi.LabeledFaceDescriptors(name, [currentDescriptor]),
    );
    triggerESP("buzzer-ok");
    kirimTelegram(name, 100, "PENDAFTARAN BARU", "✅ Wajah Berhasil Disimpan");
    await saveFacesToGitHub();
    await debugUploadGitHub();
    fetch(GAS_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({ action: "add_face", name: name }),
    });
    document.getElementById("register-modal").classList.remove("active");
    renderList();
    showInfoModal(
      "Tersimpan",
      "Sukses! Data tersimpan di Cloud & Spreadsheet.",
      "success",
    );
    setAppStatus("Siap", "success");
    setTimeout(() => {
      closeModalAndReset();
    }, 5000);
  } catch (error) {
    console.error(error);
    setAppStatus("Gagal Menyimpan", "error");
    showInfoModal("Error", "Gagal menyimpan ke Cloud.", "error");
    setTimeout(() => {
      closeModalAndReset();
    }, 5000);
  }
});
function showRegisterModal() {
  nameInput.value = "";
  registerModal.classList.add("active");
  isUnlocking = !0;
  setTimeout(() => nameInput.focus(), 100);
}
window.askDelete = function (name) {
  modalTitle.innerText = "Hapus?";
  modalMsg.innerText = `Yakin hapus "${name}"?`;
  modalButtons.innerHTML = `<button onclick="globalModal.classList.remove('active')" class="flex-1 py-2 rounded bg-slate-700 text-white">Batal</button>
                              <button onclick="execDelete('${name}')" class="flex-1 py-2 rounded bg-red-600 text-white font-bold">Hapus</button>`;
  globalModal.classList.add("active");
};
window.execDelete = async function (name) {
  labeledDescriptors = labeledDescriptors.filter((d) => d.label !== name);
  metadata = metadata.filter((m) => m.name !== name);
  setAppStatus("Menghapus...", "loading");
  await saveFacesToGitHub();
  await debugUploadGitHub();
  renderList();
  globalModal.classList.remove("active");
  setAppStatus("Siap", "success");
};
window.confirmReset = function () {
  modalTitle.innerText = "Reset?";
  modalMsg.innerText = "Hapus SEMUA data wajah?";
  modalButtons.innerHTML = `<button onclick="globalModal.classList.remove('active')" class="flex-1 py-2 rounded bg-slate-700 text-white">Batal</button>
                              <button onclick="execReset()" class="flex-1 py-2 rounded bg-red-600 text-white font-bold">Reset</button>`;
  globalModal.classList.add("active");
};
window.execReset = async function () {
  labeledDescriptors = [];
  metadata = [];
  setAppStatus("Mereset...", "loading");
  await saveFacesToGitHub();
  renderList();
  globalModal.classList.remove("active");
  setAppStatus("Siap (Kosong)", "success");
};
async function loadFacesFromGitHub(isBackground = !1) {
  try {
    if (!isBackground) setAppStatus("Memuat Data Wajah...", "loading");
    const uniqueUrl = `https://api.github.com/repos/${GH_USERNAME}/${GH_REPO}/contents/${GH_DB_PATH}?t=${Date.now()}`;
    const res = await fetch(uniqueUrl, {
      method: "GET",
      headers: {
        Authorization: `token ${GH_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
      cache: "no-store",
      mode: "cors",
    });
    if (res.ok) {
      const data = await res.json();
      const cleanContent = data.content.replace(/\s/g, "");
      const decodedContent = atob(cleanContent);
      let jsonDB;
      try {
        jsonDB = JSON.parse(decodedContent);
      } catch (err) {
        console.error("JSON Parse Error:", err);
        jsonDB = [];
      }
      if (!Array.isArray(jsonDB)) jsonDB = [];
      labeledDescriptors = jsonDB.map(
        (i) =>
          new faceapi.LabeledFaceDescriptors(
            i.label,
            i.descriptors.map((d) => new Float32Array(Object.values(d))),
          ),
      );
      renderList();
      if (!isBackground) setAppStatus("Siap", "success");
    } else if (res.status === 404) {
      console.log("Database wajah kosong/tidak ditemukan.");
      labeledDescriptors = [];
      renderList();
      if (!isBackground) setAppStatus("Siap (Kosong)", "success");
    } else {
      throw new Error(`GitHub API Error: ${res.status}`);
    }
  } catch (e) {
    console.error("Sync Error:", e);
    if (!isBackground) setAppStatus("Gagal Sinkronisasi", "error");
  }
}
// --- UPDATE: Loop Aman Sinkronisasi ---
// Hapus setInterval lama, ganti dengan logic timeout di dalam fungsi
let syncTimer = null;

async function scheduleNextSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    // Cek jika tab/aplikasi sedang hidden (hemat baterai & RAM)
    if (document.visibilityState === "hidden") {
      scheduleNextSync(); // Coba lagi nanti, jangan request sekarang
      return;
    }

    await loadFacesFromGitHub(!0);
    scheduleNextSync(); // Jadwalkan ulang setelah selesai
  }, 10000); // 10 Detik
}

// Panggil pertama kali
scheduleNextSync();
async function saveFacesToGitHub() {
  const url = `https://api.github.com/repos/${GH_USERNAME}/${GH_REPO}/contents/${GH_DB_PATH}`;
  const content = btoa(
    JSON.stringify(
      labeledDescriptors.map((ld) => ({
        label: ld.label,
        descriptors: ld.descriptors.map((d) => Array.from(d)),
      })),
    ),
  );
  let sha = null;
  try {
    const r = await fetch(url, {
      headers: { Authorization: `token ${GH_TOKEN}` },
    });
    if (r.ok) sha = (await r.json()).sha;
  } catch (e) {}
  const body = { message: "Update", content: content, branch: "main" };
  if (sha) body.sha = sha;
  await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
function debugUploadGitHub() {
  const url = `https://api.github.com/repos/${GH_USERNAME}/${GH_REPO}/contents/${GH_EXCEL_PATH}`;
  fetch(url, { headers: { Authorization: `token ${GH_TOKEN}` } })
    .then((r) => (r.ok ? r.json() : null))
    .then(async (d) => {
      const wb = new ExcelJS.Workbook();
      let sha = d ? d.sha : null;
      if (d)
        await wb.xlsx.load(
          Uint8Array.from(atob(d.content.replace(/\s/g, "")), (c) =>
            c.charCodeAt(0),
          ).buffer,
        );
      let sh = wb.getWorksheet(1) || wb.addWorksheet("Data");
      const l = metadata[metadata.length - 1];
      if (l) {
        const row = sh.addRow([l.name, l.time]);
        const id = wb.addImage({ base64: l.image, extension: "jpeg" });
        sh.addImage(id, {
          tl: { col: 2, row: row.number - 1 },
          ext: { width: 160, height: 120 },
        });
        sh.getRow(row.number).height = 120;
        const buf = await wb.xlsx.writeBuffer();
        await fetch(url, {
          method: "PUT",
          headers: {
            Authorization: `token ${GH_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "Excel",
            content: btoa(String.fromCharCode(...new Uint8Array(buf))),
            branch: "main",
            sha: sha,
          }),
        });
      }
      setAppStatus("Siap", "success");
    })
    .catch(() => {});
}
function renderList() {
  const ul = document.getElementById("user-list");

  // [PERBAIKAN] Cek apakah elemen ada sebelum memanipulasi
  if (!ul) {
    // Jika user-list tidak ketemu (misal sedang di halaman lain), kita skip update UI
    // tapi console.log agar tau proses berjalan
    // console.log("Info: User-list UI belum siap dirender (Skip).");
    return;
  }

  ul.innerHTML = "";

  // Update counter jika elemen ada
  const countDisplay = document.getElementById("count-display");
  if (countDisplay) countDisplay.innerText = labeledDescriptors.length;

  if (labeledDescriptors.length === 0) {
    ul.innerHTML =
      '<li class="text-xs text-center text-slate-600 italic">Kosong</li>';
    return;
  }

  labeledDescriptors.forEach((d) => {
    ul.innerHTML += `
        <li class="flex justify-between items-center bg-slate-800 p-3 rounded border border-slate-700">
            <span class="text-xs text-slate-200 font-bold"><i class="fa-solid fa-user-check mr-2 text-emerald-500"></i>${d.label}</span>
            <span class="text-[10px] text-slate-500 italic">Hapus via Telegram</span>
        </li>`;
  });
}

// ==========================================
// [PERBAIKAN] MODAL INFO (DENGAN KONTROL SUARA & NATIVE NOTIFICATION)
// ==========================================
function showInfoModal(title, message, type, useVoice = true) {
  // Default useVoice = true (bicara)
  const modal = document.getElementById("info-modal");
  const modalTitle = document.getElementById("info-modal-title");
  const modalMessage = document.getElementById("info-modal-message");
  const modalIcon = document.getElementById("info-modal-icon");

  if (!modal) return console.error("Modal element not found!");

  modalTitle.innerText = title;

  // 👇 UBAH BARIS INI DARI innerText MENJADI innerHTML 👇
  modalMessage.innerHTML = message;

  // Reset Icon Classes
  modalIcon.className = "text-4xl mb-2";

  if (type === "success") {
    modalIcon.classList.add("fa-solid", "fa-circle-check", "text-emerald-500");
  } else if (type === "error") {
    modalIcon.classList.add(
      "fa-solid",
      "fa-triangle-exclamation",
      "text-red-500",
    );
  } else {
    modalIcon.classList.add("fa-solid", "fa-circle-info", "text-blue-500");
  }

  // Tampilkan Modal Web
  modal.classList.remove("hidden");
  modal.classList.add("flex");

  // --- LOGIKA SUARA DIPERBAIKI ---
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  let cleanMessage = message.replace(/<[^>]*>?/gm, "");

  if (useVoice === true) {
    speakText(title + ". " + cleanMessage);
  }

  // --- [BARU] TEMBAK KE NOTIFIKASI NATIVE ANDROID ---
  // Mencegah spam notifikasi untuk alert sepele (seperti "Memuat...")
  if (
    type !== "loading" &&
    typeof AndroidApp !== "undefined" &&
    AndroidApp.showSystemNotification
  ) {
    AndroidApp.showSystemNotification(title, cleanMessage);
  }
}

window.closeModalAndReset = function () {
  // 1. Tutup Global Modal (Modal Konfirmasi/Delete)
  document.getElementById("global-modal").classList.remove("active");

  // 2. [PERBAIKAN] Tutup juga Info Modal (Modal Sukses/Error)
  // Ini memanggil fungsi closeInfoModal() yang sudah ada di bawah
  if (typeof closeInfoModal === "function") {
    closeInfoModal();
  } else {
    // Fallback manual jika fungsi belum terload
    const infoModal = document.getElementById("info-modal");
    if (infoModal) {
      infoModal.classList.add("hidden");
      infoModal.classList.remove("flex");
    }
  }

  // 3. Reset tampilan kamera jika sedang aktif (Scan Wajah)
  if (canvas.style.display === "block") resetToCamera();
};
window.resetToCamera = function () {
  canvas.style.display = "none";
  video.play();
  document.getElementById("register-modal").classList.remove("active");
  currentDescriptor = null;
  if (isCameraOn) {
    captureBtn.disabled = !1;
    captureBtn.innerHTML = '<i class="fa-solid fa-camera"></i> SCAN WAJAH';
  }
};
helpBtn.addEventListener("click", () =>
  showInfoModal("Info", "Scan Wajah Untuk Buka Kunci", "info"),
);
lightBtn.addEventListener("click", () =>
  document.body.classList.toggle("flash-active"),
);
setInterval(() => {
  const now = new Date();
  const clockEl = document.getElementById("live-clock");
  if (clockEl) {
    clockEl.innerText = now.toLocaleTimeString("id-ID");
  }
}, 1000);
setInterval(() => {
  if (currentLat && currentLon) {
    console.log("Auto-Refreshing Weather Data...");
    const currentLocName = document.getElementById("locName").innerText;
    fetchWeather(currentLat, currentLon, !1, currentLocName);
  }
}, 60000);
let fanSchedules = JSON.parse(localStorage.getItem("fanSchedules")) || [];
function saveToLocal() {
  localStorage.setItem("fanSchedules", JSON.stringify(fanSchedules));
}
// --- UBAH FUNGSI uploadScheduleToCloud() ---
async function uploadScheduleToCloud() {
  saveToLocal();

  if (mqttClient.isConnected()) {
    console.log("📤 MQTT: Mengirim data jadwal...");
    const payload = JSON.stringify(fanSchedules);
    const message = new Paho.MQTT.Message(payload);
    message.destinationName = mqtt_topic_schedule;
    message.retained = true; // PAstikan True
    mqttClient.send(message);
  }

  // Gunakan async/await agar urutannya jelas
  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain",
      },
      body: JSON.stringify({
        action: "saveJadwal",
        data: fanSchedules,
      }),
    });
    console.log("✅ Data Jadwal disinkronkan ke Google Sheet!");
  } catch (e) {
    console.error("❌ Gagal sync Jadwal ke Google Sheet:", e);
  }
}

// --- UBAH FUNGSI saveSchedule() ---
async function saveSchedule() {
  const time = document.getElementById("sched-time").value;
  const action = document.getElementById("sched-action").value;
  const isOneTime = document.getElementById("sched-onetime")
    ? document.getElementById("sched-onetime").checked
    : false;

  let days = [];
  if (isOneTime) {
    days = [new Date().getDay()];
  } else {
    days = Array.from(document.querySelectorAll(".day-chk:checked")).map((cb) =>
      parseInt(cb.value),
    );
  }

  if (!time || days.length === 0) {
    return showInfoModal(
      "Data Kurang",
      "Pilih jam dan minimal satu hari!",
      "error",
    );
  }

  const duplicate = fanSchedules.find(
    (s) =>
      s.id !== editingScheduleId &&
      s.time === time &&
      String(s.action) === String(action) && // Pastikan tipe data sama
      s.days.some((d) => days.includes(d)), // Cek apakah ada hari yang bentrok
  );

  if (duplicate) {
    // 1. Langsung tutup form jadwal sesaat setelah tombol ditekan
    closeScheduleModal();

    // 2. Beri sedikit jeda (200ms) agar animasi tutup selesai, lalu munculkan popup konfirmasi
    setTimeout(() => {
      showConfirmationModal(
        "Jadwal Bentrok",
        `Jadwal otomatis pada pukul ${time} dengan aksi tersebut pada hari yang sama sudah terdaftar. Ingin mengedit jadwal yang sudah ada?`,
        function () {
          editSchedule(duplicate.id); // Buka form edit untuk jadwal yang bertumpuk
        },
        "Ya, Edit", // Parameter teks tombol
        "fa-pen", // Parameter ikon tombol
      );
    }, 200);

    return; // Hentikan fungsi agar jadwal duplikat tidak tersimpan
  }

  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  let daysStr = isOneTime
    ? "Hanya Hari Ini"
    : days.length === 7
      ? "Setiap Hari"
      : days.map((d) => dayNames[d]).join(", ");

  const scheduleObj = {
    id: editingScheduleId || Date.now(),
    time: time,
    action: action,
    days: days,
    active: true,
    oneTime: isOneTime,
    targetDate: isOneTime ? new Date().toDateString() : null,
  };

  if (editingScheduleId) {
    fanSchedules = fanSchedules.filter((s) => s.id !== editingScheduleId);
    fanSchedules.push(scheduleObj);
    sendTelegramText(
      `📝 *JADWAL DIUBAH*\n\n⏰ Jam: ${time}\n⚡ Aksi: ${action}\n📅 ${daysStr}\n_Via Dashboard_`,
    );
    editingScheduleId = null;
  } else {
    fanSchedules.push(scheduleObj);
    sendTelegramText(
      `➕ *JADWAL BARU*\n\n⏰ Jam: ${time}\n⚡ Aksi: ${action}\n📅 ${daysStr}\n_Via Dashboard_`,
    );
  }

  // 👇 PERBAIKAN: Tutup modal terlebih dahulu agar UI langsung merespon
  closeScheduleModal();

  // Biarkan proses sinkronisasi jalan di background tanpa 'await'
  uploadScheduleToCloud();

  document.getElementById("sched-time").value = "";
  if (document.getElementById("sched-onetime"))
    document.getElementById("sched-onetime").checked = false;
  document.querySelectorAll(".day-chk").forEach((cb) => (cb.checked = false));

  renderSchedules();
}

// --- PADA BAGIAN INISIALISASI (loadJadwalFromDB) ---
function loadJadwalFromDB() {
  fetch(GAS_URL + "?action=getJadwal")
    .then((response) => response.json())
    .then((data) => {
      if (data && Array.isArray(data)) {
        // SELALU IKUTI DATA CLOUD AGAR JADWAL YANG DIHAPUS OTOMATIS OLEH ALAT IKUT TERHAPUS DI WEB
        fanSchedules = data;
        localStorage.setItem("fanSchedules", JSON.stringify(fanSchedules));
        renderSchedules();
        console.log(
          "✅ Database Jadwal Kipas berhasil disinkronkan dari Cloud!",
        );
      }
    })
    .catch((error) =>
      console.error("❌ Gagal sinkronisasi Jadwal dari DB:", error),
    );
}
function toggleAllDays(source) {
  const checkboxes = document.querySelectorAll(".day-chk");
  checkboxes.forEach((cb) => (cb.checked = source.checked));
}
function deleteSchedule(id) {
  const mTitle = document.getElementById("modal-title");
  const mMsg = document.getElementById("modal-msg");
  const mIcon = document.getElementById("modal-icon");
  const mBg = document.getElementById("modal-icon-bg");
  const mButtons = document.getElementById("modal-buttons");
  mTitle.innerText = "Hapus Jadwal?";
  mMsg.innerText = "Apakah Anda yakin ingin menghapus jadwal otomatis ini?";
  mIcon.className = "fa-solid fa-trash text-white";
  mBg.className =
    "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-600";
  mButtons.innerHTML = `
        <button onclick="document.getElementById('global-modal').classList.remove('active')" class="flex-1 py-3 rounded-lg bg-slate-700 text-white font-bold hover:bg-slate-600 transition">Batal</button>
        <button onclick="execDeleteSchedule(${id})" class="flex-1 py-3 rounded-lg bg-red-600 text-white font-bold hover:bg-red-500 transition shadow-lg shadow-red-900/50">Hapus</button>
    `;
  document.getElementById("global-modal").classList.add("active");
}
function toggleScheduleActive(id, isChecked) {
  const target = fanSchedules.find((s) => s.id === id);
  if (target) {
    target.active = isChecked;
    uploadScheduleToCloud();
    console.log(
      `Status Jadwal ID ${id} diubah menjadi: ${isChecked ? "ON" : "OFF"}`,
    );
    if (navigator.vibrate) navigator.vibrate(30);
  }
}
function execDeleteSchedule(id) {
  const target = fanSchedules.find((s) => s.id === id);
  if (target) {
    sendTelegramText(
      `🗑️ *JADWAL DIHAPUS*\n\n⏰ Jam: ${target.time}\n⚡ Aksi: ${target.action}\n\n_Dihapus via Web Dashboard_`,
    );
  }
  console.log("🗑️ Menghapus jadwal ID:", id);
  fanSchedules = fanSchedules.filter((s) => s.id !== id);
  uploadScheduleToCloud();
  renderSchedules();
  document.getElementById("global-modal").classList.remove("active");
  setTimeout(() => {
    showInfoModal("Berhasil", "Jadwal telah dihapus.", "success");
  }, 300);
}
function renderSchedules() {
  const list = document.getElementById("schedule-list");
  if (!list) return;
  list.innerHTML = "";
  if (fanSchedules.length === 0) {
    list.innerHTML =
      '<li class="text-center text-xs text-slate-500 py-4 italic">Belum ada jadwal tersimpan (Cloud).</li>';
    return;
  }
  // 💡 TAMBAHAN BARU: Otomatis buang tulisan GMT/Tahun dan ambil "02:55"-nya saja
  fanSchedules.forEach((s) => {
    let jamBersih = String(s.time).match(/\d{2}:\d{2}/);
    if (jamBersih) {
      s.time = jamBersih[0];
    }
  });
  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  fanSchedules
    .sort((a, b) => {
      // 1. Tentukan Prioritas Kategori
      const getPriority = (s) => {
        if (s.oneTime) return 1; // Prioritas 1: Hanya Hari Ini
        if (s.days.length === 7) return 2; // Prioritas 2: Setiap Hari
        if (s.days.length > 1) return 3; // Prioritas 3: Beberapa Hari (2-6 hari)
        return 4; // Prioritas 4: 1 Hari Spesifik (Senin - Minggu)
      };

      const prioA = getPriority(a);
      const prioB = getPriority(b);

      // Jika kategorinya beda, urutkan berdasarkan prioritas (1 paling atas)
      if (prioA !== prioB) {
        return prioA - prioB;
      }

      // 2. Jika sama-sama Kategori 4 (Satu hari), urutkan harinya dari Senin ke Minggu
      if (prioA === 4 && prioB === 4) {
        // JavaScript default: Minggu = 0, Senin = 1. Kita ubah Minggu jadi 7 agar di bawah.
        const hariA = a.days[0] === 0 ? 7 : a.days[0];
        const hariB = b.days[0] === 0 ? 7 : b.days[0];

        if (hariA !== hariB) {
          return hariA - hariB;
        }
      }

      // 3. Terakhir, jika kategorinya sama (dan harinya sama), urutkan berdasarkan Jam 00:00 - 23:59
      return a.time.localeCompare(b.time);
    })
    .forEach((s) => {
      const daysStr = s.oneTime
        ? `Hanya Hari Ini (${dayNames[s.days[0]] || "Selesai"})`
        : s.days.length === 7
          ? "Setiap Hari"
          : s.days.map((d) => dayNames[d]).join(", ");
      let actionLabel = "";
      let colorClass = "";
      let badgeClass = "";

      // 💡 PERBAIKAN: Paksa nilai action menjadi teks agar cocok dengan pengecekan
      let aksiKecepatan = String(s.action);

      if (aksiKecepatan === "1") {
        actionLabel = "SPEED 1";
        colorClass = "text-emerald-400";
        badgeClass = "bg-emerald-500/10 border-emerald-500/30";
      } else if (aksiKecepatan === "2") {
        actionLabel = "SPEED 2";
        colorClass = "text-blue-400";
        badgeClass = "bg-blue-500/10 border-blue-500/30";
      } else if (aksiKecepatan === "3") {
        actionLabel = "SPEED 3";
        colorClass = "text-orange-400";
        badgeClass = "bg-orange-500/10 border-orange-500/30";
      } else {
        actionLabel = "OFF";
        colorClass = "text-red-400";
        badgeClass = "bg-red-500/10 border-red-500/30";
      }
      if (s.active === undefined) s.active = !0;
      const isChecked = s.active ? "checked" : "";
      const opacityClass = s.active ? "opacity-100" : "schedule-inactive";
      list.innerHTML += `
      <li class="flex flex-col gap-3 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm mb-2 transition-all ${opacityClass}">
          
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <span class="text-2xl font-bold text-white tracking-wide">${s.time}</span>
                <span class="text-[10px] px-2 py-1 rounded border ${badgeClass} ${colorClass} font-bold whitespace-nowrap">${actionLabel}</span>
            </div>
            
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" class="sr-only peer" ${isChecked} onchange="toggleScheduleActive(${s.id}, this.checked)">
              <div class="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full border border-slate-600 peer-checked:border-emerald-500"></div>
            </label>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-slate-700/50">
            <div class="text-xs text-slate-400 truncate pr-2"><i class="fa-regular fa-calendar mr-1"></i> ${daysStr}</div>
            
            <div class="flex items-center gap-1">
                 <button onclick="editSchedule(${s.id})" class="w-8 h-8 rounded-lg bg-slate-700/50 text-slate-400 hover:text-yellow-400 hover:bg-slate-700 flex items-center justify-center transition border border-transparent hover:border-slate-600">
                    <i class="fa-solid fa-pen text-xs"></i>
                 </button>
                <button onclick="deleteSchedule(${s.id})" class="w-8 h-8 rounded-lg bg-slate-700/50 text-slate-400 hover:text-red-400 hover:bg-slate-700 flex items-center justify-center transition border border-transparent hover:border-slate-600">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
            </div>
          </div>
      </li>`;
    });
}
let editingScheduleId = null;
function openScheduleModal(isEdit = !1) {
  const modal = document.getElementById("schedule-modal");
  const title = document.getElementById("schedule-modal-title");
  const btn = document.getElementById("btn-save-schedule");
  if (isEdit) {
    title.innerText = "Edit Jadwal";
    btn.innerText = "Update Perubahan";
  } else {
    editingScheduleId = null;
    document.getElementById("sched-action").value = "1";
    document.getElementById("sched-time").value = "";
    document.getElementById("sched-action").value = "ON";
    if (document.getElementById("sched-onetime"))
      document.getElementById("sched-onetime").checked = false;
    handleOneTimeToggle(false);
    document.querySelectorAll(".day-chk").forEach((cb) => (cb.checked = !1));
    title.innerText = "Tambah Jadwal Baru";
    btn.innerText = "Simpan Jadwal";
  }
  modal.classList.add("active");
}
function closeScheduleModal() {
  document.getElementById("schedule-modal").classList.remove("active");
}
function editSchedule(id) {
  const s = fanSchedules.find((item) => item.id === id);
  if (!s) return;
  editingScheduleId = id;
  document.getElementById("sched-time").value = s.time;
  document.getElementById("sched-action").value = s.action;

  // 👇 UBAH BAGIAN BAWAH INI 👇
  const oneTimeEl = document.getElementById("sched-onetime");
  if (oneTimeEl) {
    oneTimeEl.checked = s.oneTime;
    if (s.oneTime) {
      handleOneTimeToggle(true); // Otomatis mengunci jika jadwal sebelumnya adalah "Hanya Hari Ini"
    } else {
      handleOneTimeToggle(false);
      // Centang manual sesuai hari yang tersimpan
      document.querySelectorAll(".day-chk").forEach((cb) => {
        cb.checked = s.days.includes(parseInt(cb.value));
      });
    }
  }
  openScheduleModal(!0);
}
setInterval(() => {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours().toString().padStart(2, "0");
  const currentMin = now.getMinutes().toString().padStart(2, "0");
  const currentTime = `${currentHour}:${currentMin}`;
  const todayDateStr = now.toDateString();

  // Konversi waktu sekarang ke total menit untuk perbandingan akurat
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

  let needUpload = false;
  let schedulesToDelete = [];

  fanSchedules.forEach((s) => {
    // =======================================================
    // 👇 PERBAIKAN BUG: Hapus Otomatis Jadwal One-Time Jika Waktu Terlewat 👇
    // =======================================================
    if (s.oneTime === true) {
      if (s.targetDate && s.targetDate !== todayDateStr) {
        // Jika sudah beda hari (besoknya)
        console.log(
          `⏳ Jadwal One-Time ID ${s.id} beda hari. Menghapus dari memori...`,
        );
        schedulesToDelete.push(s.id);
        needUpload = true;
      } else if (s.targetDate === todayDateStr) {
        // Jika masih di hari yang sama, cek apakah MENITNYA sudah terlewat
        const timeParts = s.time.split(":");
        if (timeParts.length === 2) {
          const sTotalMins =
            parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
          // Jika waktu saat ini lebih besar dari jadwal, langsung hapus
          if (currentTotalMinutes > sTotalMins) {
            console.log(
              `🗑️ Jadwal One-Time ID ${s.id} (Pukul ${s.time}) sudah terlewat. Menghapus otomatis...`,
            );
            schedulesToDelete.push(s.id);
            needUpload = true;
          }
        }
      }
    }
    // =======================================================
    // 👆 BATAS PERBAIKAN BUG 👆
    // =======================================================

    // Eksekusi Kipas (Hanya Backup MQTT, Notif Web Dihapus)
    if (s.active && (s.days.includes(currentDay) || s.oneTime)) {
      if (s.time === currentTime) {
        if (s.lastTriggered !== currentTime) {
          console.log(
            `%c ✅ JADWAL MATCH! ID: ${s.id}`,
            "color: green; font-weight: bold;",
          );

          let speedVal = parseInt(s.action);
          if (isNaN(speedVal)) speedVal = 0;

          controlFan(speedVal, true); // Eksekusi kipas mode silent
          s.lastTriggered = currentTime;

          // 👇 TAMBAHAN LOGIKA: Hapus langsung jika "Hanya Hari Ini"
          if (s.oneTime) {
            console.log(
              `🗑️ Jadwal Hanya Hari Ini (ID: ${s.id}) selesai dieksekusi. Langsung dihapus.`,
            );
            schedulesToDelete.push(s.id);
            needUpload = true;
          }
        }
      }
    }
  });

  // Eksekusi penghapusan jadwal dari array secara permanen
  if (schedulesToDelete.length > 0) {
    fanSchedules = fanSchedules.filter(
      (s) => !schedulesToDelete.includes(s.id),
    );
    needUpload = true; // Paksa upload jika ada yang dihapus
  }

  // Sync ke cloud dan refresh UI agar hilang dari layar
  if (needUpload) {
    uploadScheduleToCloud();
    renderSchedules();
  }
}, 1000);
window.addEventListener("load", renderSchedules);

// connectMQTT();
// initMap();
// window.onload = function () {
//   getMyLocation();
// };
let currentFanSpeed = -1;
function updateFanUI(speed) {
  for (let i = 0; i <= 3; i++) {
    const btn = document.getElementById(`btn-fan-${i}`);
    if (btn) {
      btn.classList.remove(
        "bg-emerald-600",
        "bg-red-600",
        "text-white",
        "ring-2",
        "ring-emerald-400",
        "shadow-lg",
      );
      btn.classList.add("bg-slate-700", "text-slate-200");
      if (i === 0) {
        btn.classList.add(
          "bg-red-900/50",
          "text-red-200",
          "border",
          "border-red-800",
        );
        btn.classList.remove("bg-slate-700", "text-slate-200");
      }
    }
  }
  const activeBtn = document.getElementById(`btn-fan-${speed}`);
  if (activeBtn) {
    activeBtn.classList.remove(
      "bg-slate-700",
      "text-slate-200",
      "bg-red-900/50",
      "text-red-200",
      "border",
      "border-red-800",
    );
    if (speed === 0) {
      activeBtn.classList.add("bg-red-600", "text-white", "shadow-lg");
    } else {
      activeBtn.classList.add(
        "bg-emerald-600",
        "text-white",
        "ring-2",
        "ring-emerald-400",
        "shadow-lg",
      );
    }
  }
}
function controlFan(speed, isSilent = !1) {
  if (!mqttClient.isConnected())
    return showInfoModal("Error", "MQTT Terputus", "error");
  updateFanUI(speed);
  currentFanSpeed = speed;
  const message = new Paho.MQTT.Message(String(speed));
  message.destinationName = mqtt_topic_fan_ctrl;
  message.retained = !0;
  mqttClient.send(message);
  if (!isSilent) {
    showInfoModal("Terkirim", `Kipas Speed ${speed} aktif!`, "success");
    // --- FITUR AUTO CLOSE ---
    setTimeout(() => {
      closeModalAndReset();
    }, 5000); // Menutup dalam 1.5 detik
  }
}
function toggleSecurity(type, isActive, isSilent = !1) {
  if (!mqttClient.isConnected()) {
    console.error("❌ Gagal: MQTT Terputus");
    return showInfoModal("Error", "MQTT Terputus", "error");
  }
  let command = "";
  if (type === "laser") {
    command = isActive ? "/keamananON" : "/keamananOFF";
  } else if (type === "ir") {
    command = isActive ? "/irON" : "/irOFF";
  } else if (type === "hc") {
    command = isActive ? "/sensorHCON" : "/sensorHCOFF";
  } else if (type === "api") {
    command = isActive ? "/apiON" : "/apiOFF";
  }

  if (command !== "") {
    const message = new Paho.MQTT.Message(command);
    message.destinationName = mqtt_topic_security_ctrl;
    mqttClient.send(message);
    console.log(`✅ BERHASIL: Perintah '${command}' dikirim.`);
    if (!isSilent) {
      showInfoModal(
        "Sukses",
        `Sensor ${type.toUpperCase()} diubah.`,
        "success",
      );
      // --- FITUR AUTO CLOSE ---
      setTimeout(() => {
        closeModalAndReset();
      }, 5000);
    }
  } else {
    console.warn(`⚠️ Sensor '${type}' tidak dikenali.`);
  }
}
function controlDoor(action, isSilent = !1) {
  if (!mqttClient.isConnected())
    return showInfoModal("Error", "MQTT Terputus", "error");
  let cmd = action === "UNLOCK" ? "DOOR_UNLOCK" : "DOOR_LOCK";
  if (action === "UNLOCK") {
    isDoorLocked = !1;
  } else {
    isDoorLocked = !0;
  }
  const message = new Paho.MQTT.Message(cmd);
  message.destinationName = mqtt_topic_security_ctrl;
  mqttClient.send(message);
  if (!isSilent) {
    showInfoModal("Pintu", `Perintah ${action} dikirim.`, "success");
    // --- FITUR AUTO CLOSE ---
    setTimeout(() => {
      closeModalAndReset();
    }, 5000);
  }
}
const handVideo = document.getElementById("hand-video");
const handCanvas = document.getElementById("hand-canvas");
let handCtx = null;
if (handCanvas) handCtx = handCanvas.getContext("2d");
let isHandCameraOn = !1;
let handCameraObj = null;
let handsAI = null;
let isAiReady = !1;
let lastHandGesture = -1;
let gestureStabilityCount = 0;
const GESTURE_THRESHOLD = 20;
let lastCommandTime = 0;
const COMMAND_COOLDOWN = 2000;
function initHandAI() {
  if (!handsAI) {
    handsAI = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
      },
    });
    handsAI.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    handsAI.onResults(onHandResults);
  }
}
function onHandResults(results) {
  handCanvas.width = handVideo.videoWidth;
  handCanvas.height = handVideo.videoHeight;
  handCtx.save();
  handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
  if (isHandCameraOn) {
    handCtx.drawImage(results.image, 0, 0, handCanvas.width, handCanvas.height);
  }
  if (!isAiReady && isHandCameraOn) {
    isAiReady = !0;
    document.getElementById("hand-status-text").innerText =
      "✅ AI SIAP! Tunjukkan Tangan.";
    document.getElementById("hand-status-text").className =
      "text-sm font-bold text-emerald-400 mt-3 animate-pulse";
    document.getElementById("hand-loading").classList.add("hidden");
  }
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    const handedness = results.multiHandedness[0].label;
    drawConnectors(handCtx, landmarks, HAND_CONNECTIONS, {
      color: "#00f2ff",
      lineWidth: 2,
    });
    drawLandmarks(handCtx, landmarks, {
      color: "#ffffff",
      lineWidth: 1,
      radius: 4,
    });
    let fingers = 0;
    if (handedness === "Right") {
      if (landmarks[4].x < landmarks[3].x) fingers++;
    } else {
      if (landmarks[4].x > landmarks[3].x) fingers++;
    }
    const tips = [8, 12, 16, 20];
    const pips = [6, 10, 14, 18];
    for (let i = 0; i < tips.length; i++) {
      if (landmarks[tips[i]].y < landmarks[pips[i]].y) {
        fingers++;
      }
    }
    document.getElementById("hand-count-display").innerText = fingers;
    const statusText = document.getElementById("hand-status-text");
    if (fingers === lastHandGesture) {
      gestureStabilityCount++;
      if (
        gestureStabilityCount > 5 &&
        gestureStabilityCount < GESTURE_THRESHOLD
      ) {
        let progress = Math.round(
          (gestureStabilityCount / GESTURE_THRESHOLD) * 100,
        );
        statusText.innerText = `Menahan... ${progress}%`;
        statusText.className = "text-sm font-bold text-yellow-400 mt-3";
      }
    } else {
      lastHandGesture = fingers;
      gestureStabilityCount = 0;
      statusText.innerText = "Mendeteksi...";
      statusText.className = "text-sm font-bold text-white mt-3";
    }
    if (gestureStabilityCount === GESTURE_THRESHOLD) {
      const now = Date.now();
      if (now - lastCommandTime > COMMAND_COOLDOWN) {
        executeHandCommand(fingers);
        lastCommandTime = now;
      } else {
        statusText.innerText = "⏳ Tunggu Sebentar...";
        statusText.className = "text-sm text-gray-400 mt-3";
      }
    }
  } else {
    document.getElementById("hand-count-display").innerText = "-";
    gestureStabilityCount = 0;
    lastHandGesture = -1;
    if (isAiReady) {
      document.getElementById("hand-status-text").innerText =
        "Menunggu Tangan...";
      document.getElementById("hand-status-text").className =
        "text-sm text-slate-400 mt-3";
    }
  }
  handCtx.restore();
}
function executeHandCommand(fingers) {
  const statusText = document.getElementById("hand-status-text");
  statusText.className =
    "text-sm font-bold text-emerald-400 mt-3 animate-pulse";
  if (fingers === 1) {
    statusText.innerText = "✅ SPEED 1 AKTIF";
    controlFan(1);
  } else if (fingers === 2) {
    statusText.innerText = "✅ SPEED 2 AKTIF";
    controlFan(2);
  } else if (fingers === 3) {
    statusText.innerText = "✅ SPEED 3 AKTIF";
    controlFan(3);
  } else if (fingers === 4) {
    statusText.innerText = "🔴 KIPAS OFF";
    controlFan(0);
  } else if (fingers === 5) {
    statusText.innerText = "🔓 MEMBUKA PINTU...";
    triggerESP("door-unlock");
    showInfoModal("Akses Tangan", "Pintu Terbuka 10 Detik", "success");
    setTimeout(() => {
      console.log("🔒 Pintu dikunci kembali (Auto-Timer Hand)");
    }, 10000);
  } else {
    statusText.innerText = "⚠️ TIDAK DIKENAL";
    statusText.className = "text-sm font-bold text-red-400 mt-3 animate-bounce";
    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
  }
}
async function toggleHandCamera() {
  const btn = document.getElementById("toggle-hand-btn");
  const placeholder = document.getElementById("hand-placeholder");
  const loading = document.getElementById("hand-loading");

  if (isHandCameraOn) {
    stopHandCamera();
  } else {
    // --- JIKA MENGHIDUPKAN ---

    // 1. Reset UI ke State Loading
    if (placeholder) placeholder.classList.add("hidden"); // Sembunyikan icon tangan diam
    if (loading) loading.classList.remove("hidden"); // TAMPILKAN LOADER

    // Update Text Tombol
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> MENYIAPKAN...';
    btn.disabled = true;

    // Reset AI & Status
    initHandAI();
    isAiReady = false;

    try {
      // 2. Nyalakan Kamera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: currentFacingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      handVideo.srcObject = stream;
      await handVideo.play();

      isHandCameraOn = true;
      handVideo.style.display = "block";
      processHandFrame();

      // 3. [PENTING] Sembunyikan Loader & Jalankan Animasi Masuk
      // Beri jeda 800ms agar user sempat melihat proses loading (UX better)
      setTimeout(() => {
        if (loading) loading.classList.add("hidden"); // Sembunyikan Loader

        // Update Tombol jadi Merah (Stop)
        btn.innerHTML = '<i class="fa-solid fa-power-off"></i> MATIKAN KAMERA';
        btn.classList.replace("bg-blue-600", "bg-red-600");
        btn.classList.replace("hover:bg-blue-500", "hover:bg-red-500");
        btn.disabled = false;

        // 4. JALANKAN EFEK ANIMASI "POP-IN" (Sama seperti Face ID)
        // Menganimasikan Kotak Kamera
        if (handBox) {
          handBox.classList.remove("animate-blur-in");
          void handBox.offsetWidth; // Trigger reflow
          handBox.classList.add("animate-blur-in");
        }

        // Menganimasikan Panel Status & Info di bawahnya
        if (typeof applyGlobalAnimation === "function") {
          applyGlobalAnimation("#page-hand .bg-slate-800", 0.2);
        }
      }, 800); // Delay sedikit agar smooth
    } catch (err) {
      console.error("Camera Error:", err);
      stopHandCamera(); // Reset jika error

      // Sembunyikan loader jika error
      if (loading) loading.classList.add("hidden");

      showInfoModal("Gagal", "Kamera error atau izin ditolak.", "error");
    }
  }
}

// [FUNGSI BARU] PENGGANTI CLASS CAMERA MEDIAPIPE
async function processHandFrame() {
  if (!isHandCameraOn) return;

  if (handsAI && handVideo.readyState === 4) {
    // 4 = HAVE_ENOUGH_DATA
    await handsAI.send({ image: handVideo });
  }

  requestAnimationFrame(processHandFrame);
}
function stopHandCamera() {
  isHandCameraOn = !1;
  isAiReady = !1;
  if (handVideo.srcObject) {
    const tracks = handVideo.srcObject.getTracks();
    tracks.forEach((track) => track.stop());
    handVideo.srcObject = null;
  }
  if (handCameraObj) {
    try {
      handCameraObj.stop();
    } catch (e) {
      console.log("Camera stop handled");
    }
  }
  const btn = document.getElementById("toggle-hand-btn");
  const placeholder = document.getElementById("hand-placeholder");
  const loading = document.getElementById("hand-loading");
  const statusText = document.getElementById("hand-status-text");
  const countDisplay = document.getElementById("hand-count-display");
  handVideo.style.display = "none";
  placeholder.classList.remove("hidden");
  loading.classList.add("hidden");
  if (handCtx) handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-power-off"></i> AKTIFKAN KAMERA';
    btn.classList.replace("bg-red-600", "bg-blue-600");
    btn.classList.replace("hover:bg-red-500", "hover:bg-blue-500");
    btn.disabled = !1;
  }
  if (statusText) {
    statusText.innerText = "Menunggu...";
    statusText.className = "text-sm font-bold text-white mt-3";
  }
  if (countDisplay) countDisplay.innerText = "-";
}
function openRfidModal() {
  document.getElementById("rfid-modal").classList.add("active");
}
function closeRfidModal() {
  document.getElementById("rfid-modal").classList.remove("active");
}
async function saveNewCard() {
  const uid = document.getElementById("rfid-uid").value.trim();
  const name = document.getElementById("rfid-name").value.trim();
  const btn = document.getElementById("btn-save-rfid");
  if (!uid || !name) return alert("Isi UID dan Nama!");
  btn.innerText = "Menyimpan...";
  try {
    await fetch(GAS_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({ action: "add_rfid", uid: uid, name: name }),
    });
    closeRfidModal();
    showInfoModal(
      "Berhasil",
      `Kartu milik <b>${name}</b> berhasil disimpan ke Cloud!<br>Alat sedang sinkronisasi...`,
      "success",
    );
    setTimeout(() => {
      closeModalAndReset();
    }, 5000);
    document.getElementById("rfid-uid").value = "";
    document.getElementById("rfid-name").value = "";
    const message = new Paho.MQTT.Message("REFRESH_DB");
    message.destinationName = "projek/belajar/perintah_kipas";
    mqttClient.send(message);
  } catch (e) {
    showInfoModal("Gagal", "Tidak dapat terhubung ke Spreadsheet.", "error");
    setTimeout(() => {
      closeModalAndReset();
    }, 5000);
  }
  btn.innerText = "Simpan Kartu";
}
function forceSync() {
  if (typeof mqttClient === "undefined" || !mqttClient.isConnected()) {
    showInfoModal("Gagal", "MQTT tidak terhubung. Cek internet.", "error");
    return;
  }
  closeRfidModal();
  const message = new Paho.MQTT.Message("REFRESH_DB");
  message.destinationName = "projek/belajar/perintah_kipas";
  mqttClient.send(message);
  showInfoModal(
    "Sinkronisasi",
    "Perintah dikirim ke ESP! Alat sedang mendownload data terbaru dari Spreadsheet...(Tunggu ±5-10 detik)",
    "info",
  );
  setTimeout(() => {
    closeModalAndReset();
  }, 5000);
  console.log("📤 Perintah REFRESH_DB dikirim manual.");
}
async function syncFacesToSheet() {
  if (labeledDescriptors.length === 0) {
    return showInfoModal(
      "Info",
      "Tidak ada data wajah untuk disinkronkan.",
      "info",
    );
    setTimeout(() => {
      closeModalAndReset();
    }, 5000);
  }
  const btn = document.getElementById("btn-sync-face");
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Proses...';
  btn.disabled = !0;
  let successCount = 0;
  for (let face of labeledDescriptors) {
    const name = face.label;
    try {
      await fetch(GAS_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({ action: "add_face", name: name }),
      });
      console.log(`✅ ${name} dikirim ke Sheet`);
      successCount++;
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.error(`Gagal sync ${name}`);
    }
  }
  btn.innerHTML = originalText;
  btn.disabled = !1;
  showInfoModal(
    "Selesai",
    `Berhasil mengirim ${successCount} data wajah ke Spreadsheet.`,
    "success",
  );
  setTimeout(() => {
    closeModalAndReset();
  }, 5000);
}
function kirimIR(hexCode) {
  if (!mqttClient.isConnected()) {
    showInfoModal("Gagal", "MQTT Terputus. Cek koneksi internet.", "error");
    return;
  }
  if (navigator.vibrate) navigator.vibrate(50);
  const message = new Paho.MQTT.Message(hexCode);
  message.destinationName = mqtt_topic_ir_send;
  mqttClient.send(message);
  console.log(`📡 IR Sent: ${hexCode}`);
}
let remoteDashboards =
  JSON.parse(localStorage.getItem("remoteDashboards")) || [];
let activeDashboardId = null;
function openAddDashboardModal() {
  document.getElementById("dash-name").value = "";
  document.getElementById("dash-brand").value = "";
  document.getElementById("add-dashboard-modal").classList.add("active");
}
function closeAddDashboardModal() {
  document.getElementById("add-dashboard-modal").classList.remove("active");
}
function createNewDashboard() {
  const name = document.getElementById("dash-name").value.trim();
  const type = document.getElementById("dash-type").value;
  const brand = document.getElementById("dash-brand").value.trim() || "Generic";
  if (!name) return showInfoModal("Error", "Nama Remote wajib diisi!", "error");
  const newDash = {
    id: Date.now(),
    name: name,
    type: type,
    brand: brand,
    buttons: [],
  };
  remoteDashboards.push(newDash);
  saveDashboards();
  closeAddDashboardModal();
  renderDashboardList();
  showInfoModal("Berhasil", `Remote "${name}" dibuat!`, "success");
}
function saveDashboards() {
  localStorage.setItem("remoteDashboards", JSON.stringify(remoteDashboards));

  fetch(scriptURLRemote, {
    method: "POST",
    mode: "no-cors", // <--- TAMBAHAN WAJIB UNTUK GOOGLE APPS SCRIPT
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action: "saveRemote",
      data: JSON.stringify(remoteDashboards),
    }),
  })
    .then(() => {
      // PERHATIAN: Dengan mode 'no-cors', balasan dari Google menjadi "opaque" (tertutup).
      // Kita tidak bisa membaca response.text() lagi, jadi langsung log sukses saja.
      console.log("✅ Berhasil mengirim perintah simpan Remote ke Cloud");
    })
    .catch((error) => {
      console.error("❌ Gagal simpan ke Cloud:", error);
    });
  syncRemoteToESP();
}
// 3. Pastikan data ditarik otomatis saat web pertama kali di-load
document.addEventListener("DOMContentLoaded", function () {
  loadRemoteFromDB();
  loadJadwalFromDB();
  loadNotifFromCloud(); // <--- TAMBAHKAN BARIS INI
});
function syncRemoteToESP() {
  if (typeof mqttClient !== "undefined" && mqttClient.isConnected()) {
    let payload = remoteDashboards
      .map((r) => ({
        n: r.name,
        t: `${r.brand}-${r.type}`,
        b: (r.buttons || []).slice(0, 8).map((btn) => ({
          n: btn.name,
          x: btn.hex || "0x0",
          r: btn.code || "", // <--- TAMBAHKAN BARIS INI WAJIB (Mengirim data RAW)
        })),
      }))
      .slice(0, 5);

    const message = new Paho.MQTT.Message(JSON.stringify(payload));
    message.destinationName = "projek/belajar/ir_remote/sync_db";
    message.retained = true;
    mqttClient.send(message);

    console.log("✅ Sync DB Remote Ringan ke OLED ESP8266 Berhasil Terkirim!");
  } else {
    console.warn("⚠️ MQTT belum terhubung, gagal sync daftar remote ke OLED.");
  }
}
function renderDashboardList() {
  const list = document.getElementById("dashboard-list");
  if (!list) return;
  list.innerHTML = "";
  if (remoteDashboards.length === 0) {
    list.innerHTML = `<div class="text-center p-8 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 text-sm">Belum ada remote. Buat baru!</div>`;
    return;
  }
  remoteDashboards.forEach((dash) => {
    let iconClass = "fa-tower-broadcast";
    let colorClass = "text-slate-400";
    let bgClass = "bg-slate-800";
    if (dash.type === "tv") {
      iconClass = "fa-tv";
      colorClass = "text-blue-400";
    } else if (dash.type === "ac") {
      iconClass = "fa-snowflake";
      colorClass = "text-cyan-400";
    } else if (dash.type === "fan") {
      iconClass = "fa-fan";
      colorClass = "text-emerald-400";
    } else if (dash.type === "light") {
      iconClass = "fa-lightbulb";
      colorClass = "text-yellow-400";
    } else if (dash.type === "speaker") {
      iconClass = "fa-music";
      colorClass = "text-purple-400";
    }
    list.innerHTML += `
      <div onclick="openDashboardDetail(${dash.id})" class="bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-md hover:border-emerald-500/50 transition cursor-pointer flex items-center justify-between group active:scale-95">
        <div class="flex items-center gap-4">
           <div class="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center ${colorClass} text-xl shadow-inner">
              <i class="fa-solid ${iconClass}"></i>
           </div>
           <div>
              <h4 class="font-bold text-white text-lg">${dash.name}</h4>
              <p class="text-xs text-slate-500 uppercase tracking-wide font-bold">${dash.brand} &bull; ${(dash.buttons || []).length} Tombol</p>
           </div>
        </div>
        <i class="fa-solid fa-chevron-right text-slate-600 group-hover:text-emerald-500 transition"></i>
      </div>
    `;
  });
}
function openDashboardDetail(id) {
  const dash = remoteDashboards.find((d) => d.id === id);
  if (!dash) return;
  activeDashboardId = id;

  // Berikan nilai default jika dash.name, brand, atau type tiba-tiba hilang (undefined)
  document.getElementById("detail-remote-name").innerText =
    dash.name || "Tanpa Nama";
  document.getElementById("detail-remote-type").innerText = `${
    dash.brand || "Generic"
  } - ${(dash.type || "other").toUpperCase()}`;

  document.getElementById("view-remote-list").classList.add("hidden");
  document.getElementById("view-remote-detail").classList.remove("hidden");
  renderCustomRemotes();
}
function backToDashboardList() {
  activeDashboardId = null;
  document.getElementById("view-remote-detail").classList.add("hidden");
  document.getElementById("view-remote-list").classList.remove("hidden");
  renderDashboardList();
}
function deleteCurrentDashboard() {
  const dash = remoteDashboards.find((d) => d.id === activeDashboardId);
  if (!dash) return;
  const mTitle = document.getElementById("modal-title");
  const mMsg = document.getElementById("modal-msg");
  const mButtons = document.getElementById("modal-buttons");
  const mIcon = document.getElementById("modal-icon");
  mTitle.innerText = "Hapus Remote?";
  mMsg.innerHTML = `Hapus remote <b>${dash.name}</b> beserta semua tombolnya?`;
  mIcon.className = "fa-solid fa-trash text-white";
  mButtons.innerHTML = `
    <button onclick="closeModalAndReset()" class="flex-1 py-3 rounded-lg bg-slate-700 text-white font-bold">Batal</button>
    <button onclick="execDeleteDashboard()" class="flex-1 py-3 rounded-lg bg-red-600 text-white font-bold">Hapus</button>
  `;
  document.getElementById("global-modal").classList.add("active");
}
function execDeleteDashboard() {
  remoteDashboards = remoteDashboards.filter((d) => d.id !== activeDashboardId);
  saveDashboards();
  closeModalAndReset();
  backToDashboardList();
  showInfoModal("Terhapus", "Remote berhasil dihapus.", "success");
}
function saveLearnedButton() {
  if (!activeDashboardId) return;
  const dash = remoteDashboards.find((d) => d.id === activeDashboardId);
  const nameInput = document.getElementById("new-remote-name");
  const name = nameInput.value.trim();
  if (!lastCapturedRawData)
    return showInfoModal("Belum Scan", "Scan sinyal dulu!", "error");
  if (!name) return showInfoModal("Nama Kosong", "Isi nama tombol!", "error");
  if (dash.buttons.some((b) => b.name.toLowerCase() === name.toLowerCase())) {
    return showInfoModal(
      "Nama Terpakai",
      "Nama tombol sudah ada di remote ini.",
      "error",
    );
  }
  dash.buttons.push({
    id: Date.now(),
    name: name,
    code: lastCapturedRawData,
    hex: lastCapturedHex,
    type: "RAW",
  });
  saveDashboards();
  nameInput.value = "";
  lastCapturedRawData = null;
  lastCapturedHex = null;
  document.getElementById("scanned-code-display").innerHTML =
    "Menunggu Sinyal...";
  document.getElementById("raw-size-info").innerText = "Buffer Kosong";
  renderCustomRemotes();
  showInfoModal("Sukses", "Tombol ditambahkan!", "success");
}
function renderCustomRemotes() {
  const container = document.getElementById("custom-buttons-list");
  const countEl = document.getElementById("total-buttons-detail");
  if (!container || !activeDashboardId) return;
  const dash = remoteDashboards.find((d) => d.id === activeDashboardId);
  const buttons = dash ? dash.buttons || [] : [];
  container.innerHTML = "";
  if (countEl) countEl.innerText = `${buttons.length} Tombol`;
  if (buttons.length === 0) {
    container.innerHTML =
      '<div class="col-span-2 text-center text-xs text-slate-500 italic py-4">Belum ada tombol di remote ini.</div>';
    return;
  }
  buttons.forEach((btn) => {
    const div = document.createElement("div");
    div.className =
      "bg-slate-700/50 rounded-xl p-3 border border-slate-600 shadow-sm relative group";
    // [MULAI KODE BARU]
    let nameHtml = "";
    // Jika panjang nama lebih dari 10 karakter, gunakan efek marquee (teks berjalan)
    if (btn.name.length > 10) {
      nameHtml = `
          <div class="w-full overflow-hidden relative h-5 mb-3">
             <div class="marquee-track">
                <span class="text-white font-bold text-sm whitespace-nowrap mr-8">
                   ${btn.name}
                </span>
                
                <span class="text-white font-bold text-sm whitespace-nowrap mr-8">
                   ${btn.name}
                </span>
             </div>
          </div>
        `;
    } else {
      // Jika pendek, tampilkan biasa
      nameHtml = `<h4 class="text-white font-bold text-sm truncate mb-3">${btn.name}</h4>`;
    }

    div.innerHTML = `
      <div class="flex justify-between items-start mb-2">
         <div class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-emerald-400 text-xs font-bold border border-slate-600">
           <i class="fa-solid fa-power-off"></i>
         </div>
         <div class="flex gap-1">
             <button onclick="openEditButtonModal('${btn.id}')" class="text-slate-500 hover:text-yellow-400 transition px-1">
                <i class="fa-solid fa-pen text-xs"></i>
             </button>
             <button onclick="deleteCustomButton('${btn.id}')" class="text-slate-500 hover:text-red-400 transition px-1">
                <i class="fa-solid fa-times text-xs"></i>
             </button>
         </div>
      </div>
      
      ${nameHtml} 

      <button onclick="kirimIR_RAW('${btn.id}')" class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow active:scale-95 transition">
         TEKAN
      </button>
    `;
    // [AKHIR KODE BARU]

    container.appendChild(div);
  });
}
function openEditDashboardModal() {
  if (!activeDashboardId) return;
  const dash = remoteDashboards.find((d) => d.id === activeDashboardId);
  if (!dash) return;
  document.getElementById("edit-dash-name").value = dash.name;
  document.getElementById("edit-dash-brand").value = dash.brand;
  document.getElementById("edit-dash-type").value = dash.type;
  document.getElementById("edit-dashboard-modal").classList.add("active");
}
function closeEditDashboardModal() {
  document.getElementById("edit-dashboard-modal").classList.remove("active");
}
function saveDashboardChanges() {
  if (!activeDashboardId) return;
  const newName = document.getElementById("edit-dash-name").value.trim();
  const newBrand = document.getElementById("edit-dash-brand").value.trim();
  const newType = document.getElementById("edit-dash-type").value;
  if (!newName)
    return showInfoModal("Error", "Nama Remote tidak boleh kosong!", "error");
  const index = remoteDashboards.findIndex((d) => d.id === activeDashboardId);
  if (index !== -1) {
    remoteDashboards[index].name = newName;
    remoteDashboards[index].brand = newBrand || "Generic";
    remoteDashboards[index].type = newType;
    saveDashboards();
    document.getElementById("detail-remote-name").innerText = newName;
    document.getElementById("detail-remote-type").innerText =
      `${newBrand} - ${newType.toUpperCase()}`;
    closeEditDashboardModal();
    showInfoModal("Sukses", "Informasi Remote diperbarui.", "success");
  }
}
function openEditButtonModal(btnId) {
  if (!activeDashboardId) return;
  const dash = remoteDashboards.find((d) => d.id === activeDashboardId);
  const btn = dash.buttons.find((b) => b.id == btnId);
  if (!btn) return;
  document.getElementById("edit-btn-id").value = btnId;
  document.getElementById("edit-btn-name").value = btn.name;
  document.getElementById("edit-button-modal").classList.add("active");
}
function closeEditButtonModal() {
  document.getElementById("edit-button-modal").classList.remove("active");
}
function saveButtonChanges() {
  if (!activeDashboardId) return;
  const btnId = document.getElementById("edit-btn-id").value;
  const newName = document.getElementById("edit-btn-name").value.trim();
  if (!newName)
    return showInfoModal("Error", "Nama tombol wajib diisi!", "error");
  const dash = remoteDashboards.find((d) => d.id === activeDashboardId);
  if (!dash) return;
  const btnIndex = dash.buttons.findIndex((b) => b.id == btnId);
  if (btnIndex !== -1) {
    const isDuplicate = dash.buttons.some(
      (b, idx) =>
        b.name.toLowerCase() === newName.toLowerCase() && idx !== btnIndex,
    );
    if (isDuplicate)
      return showInfoModal("Error", "Nama tombol sudah dipakai!", "error");
    dash.buttons[btnIndex].name = newName;
    saveDashboards();
    renderCustomRemotes();
    closeEditButtonModal();
    showInfoModal("Tersimpan", "Nama tombol berhasil diubah.", "success");
  }
}
function kirimIR_RAW(btnId) {
  if (!activeDashboardId) return;
  const dash = remoteDashboards.find((d) => d.id === activeDashboardId);
  const btn = dash.buttons.find((b) => b.id == btnId);
  if (btn) {
    kirimIR(btn.hex, btn.code, btn.name);
  } else {
    console.error("Tombol tidak ditemukan di dashboard aktif");
  }
}
function kirimIR(hexCode, rawData, btnName = "Tombol") {
  if (!mqttClient.isConnected()) {
    showInfoModal("Gagal", "MQTT Terputus. Cek koneksi internet.", "error");
    return;
  }
  if (navigator.vibrate) navigator.vibrate(50);
  lastIrSentTime = Date.now();
  const payload = JSON.stringify({ hex: hexCode || "0", raw: rawData || "" });
  const message = new Paho.MQTT.Message(payload);
  message.destinationName = mqtt_topic_ir_send;
  mqttClient.send(message);
  console.log(`📡 Dual IR Sent: ${btnName}`);
  showInfoModal(
    "Terkirim",
    `<div class="text-center">
        <i class="fa-solid fa-satellite-dish text-3xl text-emerald-400 mb-2 animate-pulse"></i><br>
        Perintah <b>"${btnName}"</b><br>
        <span class="text-[10px] text-slate-400">Mode Ganda (Hex + Raw) dikirim</span>
     </div>`,
    "success",
  );
  setTimeout(() => {
    const modal = document.getElementById("global-modal");
    if (modal.classList.contains("active")) {
      closeModalAndReset();
    }
  }, 5000);
}
function deleteCustomButton(id) {
  // 1. Cari dashboard mana yang sedang aktif
  if (!activeDashboardId) return;
  const dash = remoteDashboards.find((d) => d.id === activeDashboardId);
  if (!dash) return;

  // 2. Cari tombol mana yang ingin dihapus dari dashboard tersebut
  const targetBtn = dash.buttons.find((b) => b.id == id);
  if (!targetBtn) return;

  const mTitle = document.getElementById("modal-title");
  const mMsg = document.getElementById("modal-msg");
  const mIcon = document.getElementById("modal-icon");
  const mBg = document.getElementById("modal-icon-bg");
  const mButtons = document.getElementById("modal-buttons");

  mTitle.innerText = "Hapus Tombol?";
  mMsg.innerHTML = `Anda yakin ingin menghapus tombol <b>"${targetBtn.name}"</b>?<br><span class="text-xs text-red-400">Tindakan ini tidak bisa dibatalkan.</span>`;
  mIcon.className = "fa-solid fa-trash-can text-white text-2xl";
  mBg.className =
    "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-600 shadow-lg shadow-red-900/50";

  // FIX: Ubah execDeleteRemote menjadi execDeleteButton sesuai fungsi yang didefinisikan
  mButtons.innerHTML = `
    <button onclick="closeModalAndReset()" class="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-bold hover:bg-slate-600 transition">Batal</button>
    <button onclick="execDeleteButton('${id}')" class="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition shadow-lg shadow-red-900/40">Ya, Hapus</button>
  `;
  document.getElementById("global-modal").classList.add("active");
}
function execDeleteButton(btnId) {
  if (!activeDashboardId) return;
  const dash = remoteDashboards.find((d) => d.id === activeDashboardId);
  if (!dash) return;

  // Hapus tombol dari array dashboard aktif
  dash.buttons = dash.buttons.filter((b) => b.id != btnId);

  // Simpan dan Render Ulang
  saveDashboards();
  renderCustomRemotes();
  closeModalAndReset();

  if (navigator.vibrate) navigator.vibrate(50);
  showInfoModal("Terhapus", "Tombol berhasil dihapus.", "success");
}

// ==========================================
// LOGIKA VOICE COMMAND (HYBRID: ANDROID & WEB)
// ==========================================
const synthesis = window.speechSynthesis;
let recognition; // Untuk Web Browser
let isListening = false;

// Fungsi Utama Toggle (Dipanggil Tombol Mic)
async function toggleVoiceCommand() {
  if (isListening) {
    stopVoiceCommand();
  } else {
    startVoiceCommand();
  }
}

// Fungsi Memulai
async function startVoiceCommand() {
  isListening = true;

  // UI Update
  document.getElementById("voice-overlay").classList.remove("hidden");
  const micIcon = document.getElementById("mic-icon");
  if (micIcon) micIcon.className = "fa-solid fa-spinner fa-spin text-2xl";

  // Pause Musik jika ada
  if (isMusicPlaying) {
    controlMusic("STOP");
    pausedByVoice = true;
  }

  // --- JIKA ANDROID (NATIVE PLUGIN) ---
  if (isNative && NativeSpeechRec) {
    try {
      // Cek Izin Dulu
      const perm = await NativeSpeechRec.checkPermissions();
      if (perm.speechRecognition !== "granted") {
        await NativeSpeechRec.requestPermissions();
      }

      // Mulai Native Listening
      await NativeSpeechRec.start({
        language: "id-ID",
        maxResults: 1,
        prompt: "Katakan perintah...",
        partialResults: true,
        popup: false,
      });

      // Listener Hasil Native (Beda dengan Web)
      NativeSpeechRec.addListener("partialResults", (data) => {
        if (data.matches && data.matches.length > 0) {
          document.getElementById("voice-text-preview").innerText =
            `"${data.matches[0]}"`;
        }
      });
    } catch (e) {
      console.error("Native Speech Error:", e);
      stopVoiceCommand();
      showInfoModal("Gagal", "Error Mic Native: " + JSON.stringify(e), "error");
    }
  } else {
    if (!recognition) {
      const SpeechConstructor =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechConstructor) {
        recognition = new SpeechConstructor();
        recognition.continuous = false; // Tetap false agar hasil cepat diproses
        recognition.lang = "id-ID";
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        let voiceStuckTimer = null;

        recognition.onstart = () => {
          console.log("🎙️ Web Mic Start");
          const preview = document.getElementById("voice-text-preview");
          if (preview) preview.innerText = "Mendengarkan...";

          // Timer Safety: Jika 8 detik hening/stuck, restart sesi (bukan stop total)
          voiceStuckTimer = setTimeout(() => {
            console.warn("⏳ Voice Timeout - Restarting session...");
            if (recognition)
              try {
                recognition.stop();
              } catch (e) {}
            // Jangan panggil stopVoiceCommand(), biarkan onend me-restart
          }, 8000);
        };

        // [PERBAIKAN 1: ANTI BATUK/NOISE]
        recognition.onnomatch = (event) => {
          console.warn("❌ Suara tidak jelas (Noise/Batuk). Mengabaikan...");
          // JANGAN panggil stopVoiceCommand().
          // Cukup update UI sedikit, lalu biarkan onend me-restart loop.
          const preview = document.getElementById("voice-text-preview");
          if (preview) preview.innerText = "...";
        };

        // [PERBAIKAN 2: ERROR HANDLING LEBIH PINTAR]
        recognition.onerror = (event) => {
          console.error("❌ Mic Error:", event.error);
          if (voiceStuckTimer) clearTimeout(voiceStuckTimer);

          if (event.error === "no-speech") {
            // Hening terlalu lama, abaikan agar restart
            console.log("Silakan bicara...");
          } else if (event.error === "aborted") {
            // Di-stop manual
          } else if (
            event.error === "not-allowed" ||
            event.error === "service-not-allowed"
          ) {
            // Izin ditolak -> BARU STOP TOTAL
            stopVoiceCommand();
            bicara("Izin mikrofon ditolak.", true);
          }
          // Error lain (network, etc): Biarkan restart via onend
        };

        // [PERBAIKAN 3: LOOPING ABADI (SAMPAI DIMATIKAN MANUAL)]
        recognition.onend = () => {
          if (voiceStuckTimer) clearTimeout(voiceStuckTimer);

          // --- [PERBAIKAN] CEK VISIBILITAS OVERLAY ---
          // Hanya restart mic jika flag isListening TRUE **DAN** Overlay TERLIHAT
          const overlay = document.getElementById("voice-overlay");
          const isOverlayVisible =
            overlay && !overlay.classList.contains("hidden");

          if (isListening && isOverlayVisible) {
            console.log("🔄 Mic mati sendiri -> Menyalakan kembali (Loop)...");
            try {
              recognition.start();
            } catch (e) {
              // Retry safety
              setTimeout(() => {
                // Cek lagi sebelum start
                if (
                  isListening &&
                  !document
                    .getElementById("voice-overlay")
                    .classList.contains("hidden")
                ) {
                  recognition.start();
                }
              }, 1000);
            }
          } else {
            // Benar-benar berhenti
            console.log(
              "⛔ Mic berhenti total (User Request / Overlay Closed).",
            );
            const micIcon = document.getElementById("mic-icon");
            if (micIcon) micIcon.className = "fa-solid fa-microphone text-2xl";

            // Pastikan flag mati
            isListening = false;
          }
        };

        recognition.onresult = (event) => {
          if (voiceStuckTimer) clearTimeout(voiceStuckTimer);

          // Reset timer timeout setiap ada kata
          voiceStuckTimer = setTimeout(() => {
            if (recognition)
              try {
                recognition.stop();
              } catch (e) {}
          }, 5000);

          const transcript = event.results[0][0].transcript.toLowerCase();
          document.getElementById("voice-text-preview").innerText =
            `"${transcript}"`;

          if (event.results[0].isFinal) {
            clearTimeout(voiceStuckTimer);

            // [FIX BUG VOICE LOOP]
            // 1. Set flag false agar 'onend' tidak otomatis restart mic saat ini
            isListening = false;

            // 2. Matikan mic secara paksa agar hening saat sistem memproses jawaban
            try {
              recognition.stop();
            } catch (e) {}

            // 3. Proses perintah (Mic dalam keadaan MATI sekarang)
            prosesPerintahSuara(transcript);
          }
        };
      } else {
        alert("Browser tidak support Voice Command.");
        stopVoiceCommand();
        return;
      }
    }
    try {
      recognition.start();
    } catch (e) {
      console.log("Mic restart");
    }
  }
}

// Fungsi Stop (Update agar support Native)
function stopVoiceCommand() {
  console.log("⛔ Menghentikan Voice Command...");
  isListening = false;

  // 1. Stop Native (Bungkus dengan Try Catch)
  if (isNative && NativeSpeechRec) {
    try {
      NativeSpeechRec.stop();
    } catch (e) {
      console.warn("Speech Native Stop Ignored:", e);
    }
  }

  // 2. Stop Web
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {}
  }

  // 3. Stop TTS
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }

  // 4. UI Reset
  const overlay = document.getElementById("voice-overlay");
  if (overlay) overlay.classList.add("hidden");

  const micIcon = document.getElementById("mic-icon");
  if (micIcon) micIcon.className = "fa-solid fa-microphone text-2xl";

  // 5. Resume Musik
  if (pausedByVoice) {
    controlMusic("PLAY");
    pausedByVoice = false;
  }
}

// --- FUNGSI PENCARIAN YOUTUBE (SOLUSI ERROR 2: cuePlaylist) ---
let lastSearchQuery = ""; // Variabel global untuk simpan pencarian terakhir

function searchYouTube(keyword) {
  console.log("Mencari YouTube:", keyword);

  if (!keyword || keyword.trim().length < 1) {
    if (typeof bicara === "function")
      bicara("Mohon ulangi judul lagunya.", true);
    return;
  }

  // 1. Simpan keyword untuk fitur Auto-Retry
  lastSearchQuery = keyword;

  // 2. Bersihkan Query (Hapus karakter aneh)
  // Kita hanya ambil huruf, angka, dan spasi agar aman dari Error 2
  let query = keyword.replace(/[^a-zA-Z0-9 ]/g, "");

  // 3. Logic Anti-Blokir (Tambah kata 'lyrics' agar dapat video ringan)
  if (
    !query.toLowerCase().includes("lirik") &&
    !query.toLowerCase().includes("lyrics")
  ) {
    query += " lyrics";
  }

  console.log("Query Final:", query);

  // 4. Eksekusi Player
  if (player && typeof player.cuePlaylist === "function") {
    try {
      player.stopVideo();

      // [PERBAIKAN UTAMA] Gunakan cuePlaylist, BUKAN loadPlaylist
      // Ini memberi waktu bagi YouTube untuk mencari video sebelum memutarnya
      player.cuePlaylist({
        listType: "search",
        list: query,
      });

      // Beri jeda 1 detik sebelum memaksa putar
      if (typeof bicara === "function") bicara(`Memutar ${keyword}`, true);

      setTimeout(() => {
        if (player.playVideo) player.playVideo();
        isMusicPlaying = true;
        pausedByVoice = false;
      }, 1000);
    } catch (e) {
      console.error("Player Error:", e);
      if (typeof bicara === "function") bicara("Gagal memuat player.", true);
    }
  } else {
    // Jika player belum siap, inisialisasi ulang
    if (typeof bicara === "function")
      bicara("Sistem musik sedang inisialisasi...", true);
    onYouTubeIframeAPIReady();
  }
}

// --- FUNGSI PUTAR VIDEO SPESIFIK BY ID ---
function playYoutubeVideoById(videoId) {
  console.log("▶️ Memutar Video ID:", videoId);

  if (!player || typeof player.loadVideoById !== "function") {
    if (typeof bicara === "function") bicara("Player belum siap.", true);
    onYouTubeIframeAPIReady(); // Coba init ulang
    return;
  }

  try {
    // 1. Stop video yang sedang berjalan
    player.stopVideo();

    // 2. Load Video Tunggal berdasarkan ID
    player.loadVideoById({
      videoId: videoId,
      startSeconds: 0,
      suggestedQuality: "small", // Hemat kuota
    });

    // 3. Update Status Aplikasi
    isMusicPlaying = true;
    pausedByVoice = false;

    // Bicara konfirmasi
    if (typeof bicara === "function") bicara("Memutar video pilihan.", true);
  } catch (e) {
    console.error("Player Error:", e);
    if (typeof bicara === "function") bicara("Gagal memutar video.", true);
  }
}

// const ELEVENLABS_API_KEY =
//   "sk_0952f72a48941acbf2b903eb8e13081547aae3f357171aaa";
// const ELEVENLABS_VOICE_ID = "X8n8hOy3e8VLQnHTUcc5";

// --- FUNGSI BICARA (UPDATE FINAL: SUPPORT NATIVE) ---
async function bicara(teks, autoClose = false, callback = null) {
  console.log("🗣️ Memproses suara:", teks);

  const TTS =
    window.Capacitor && window.Capacitor.Plugins
      ? window.Capacitor.Plugins.TextToSpeech
      : null;
  const isNativeApp = window.Capacitor && window.Capacitor.isNative;

  if (isNativeApp && TTS) {
    // --- JALUR APLIKASI ANDROID (NATIVE) ---
    try {
      await TTS.stop();

      await TTS.speak({
        text: teks,
        lang: "id-ID",
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        category: "ambient",
      });

      // [FIX BUG VOICE LOOP - NATIVE]
      if (callback) callback();

      if (autoClose) {
        // Jika perintah selesai (misal: "Matikan lampu"), tutup mic total
        stopVoiceCommand();
      } else {
        // Jika perintah butuh balasan/lanjutan, NYALAKAN mic lagi sekarang
        console.log("🔊 Native TTS Selesai -> Restart Mic...");
        setTimeout(() => startVoiceCommand(), 500); // Delay dikit biar gak tabrakan
      }
    } catch (e) {
      console.error("⚠️ Gagal TTS Native, mencoba browser...", e);
      bicaraBrowser(teks, autoClose, callback);
    }
  } else {
    // --- JALUR WEBSITE / LAPTOP (BROWSER) ---
    bicaraBrowser(teks, autoClose, callback);
  }
}

// Fungsi Cadangan (Bawaan Browser)
function bicaraBrowser(teks, autoClose, callback) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(teks);
  utterance.lang = "id-ID";
  utterance.rate = 1;

  utterance.onend = function () {
    if (callback) callback();

    // [FIX BUG VOICE LOOP - BROWSER]
    if (autoClose) {
      stopVoiceCommand();
    } else {
      // Mic dinyalakan KEMBALI hanya setelah suara sistem selesai
      console.log("🔊 Browser TTS Selesai -> Restart Mic...");
      setTimeout(() => {
        // Cek ulang agar tidak tumpang tindih
        startVoiceCommand();
      }, 500);
    }
  };

  window.speechSynthesis.speak(utterance);
}

function bicaraRobot(teks, stopListening, callback = null) {
  const ucapan = new SpeechSynthesisUtterance(teks);
  ucapan.lang = "id-ID";
  ucapan.rate = 1;
  ucapan.pitch = 1;
  ucapan.onend = function () {
    selesaiBicara(stopListening, callback);
  };
  synthesis.speak(ucapan);
}
function selesaiBicara(stopListening, callback) {
  if (callback && typeof callback === "function") {
    console.log("✅ Menjalankan aksi setelah bicara...");
    callback();
  }
  if (stopListening) {
    stopVoiceCommand();
  } else {
    if (isListening === !1) return;
    try {
      const preview = document.getElementById("voice-text-preview");
      if (preview) preview.innerText = "Mendengarkan lagi...";
      recognition.start();
    } catch (e) {}
  }
}
function prosesPerintahSuara(teks) {
  console.log("Mendeteksi suara:", teks);
  let responsSuara = "";
  let aksiDitemukan = false;

  // ==========================================
  // 1. BLOK NAVIGASI (Bisa jalan bersamaan dengan aksi perangkat)
  // ==========================================
  if (
    teks.includes("buka") ||
    teks.includes("pergi ke") ||
    teks.includes("tampilkan") ||
    teks.includes("menu")
  ) {
    if (teks.includes("kontrol") || teks.includes("smart control")) {
      switchPage(
        "page-control",
        document.querySelector(".nav-item:nth-child(4)"),
      );
      responsSuara += "Membuka pusat kontrol. ";
      aksiDitemukan = true;
    } else if (teks.includes("cuaca")) {
      switchPage(
        "page-cuaca",
        document.querySelector(".nav-item:nth-child(8)"),
      );
      responsSuara += "Menampilkan informasi cuaca. ";
      aksiDitemukan = true;
    } else if (teks.includes("wajah") || teks.includes("absensi")) {
      switchPage(
        "page-absensi",
        document.querySelector(".nav-item:nth-child(2)"),
      );
      responsSuara += "Membuka scan wajah. ";
      aksiDitemukan = true;
    } else if (teks.includes("cctv") || teks.includes("kamera")) {
      switchPage(
        "page-youtube",
        document.querySelector(".nav-item:nth-child(11)"),
      );
      responsSuara += "Membuka pantauan CCTV. ";
      aksiDitemukan = true;
    } else if (teks.includes("sensor") || teks.includes("suhu")) {
      switchPage(
        "page-sensor",
        document.querySelector(".nav-item:nth-child(3)"),
      );
      responsSuara += "Membuka monitor sensor. ";
      aksiDitemukan = true;
    }
  }

  // ==========================================
  // 2. BLOK KONTROL HARDWARE (Bisa dijalankan bersama navigasi)
  // ==========================================
  if (teks.includes("kipas") || teks.includes("angin")) {
    if (teks.includes("1") || teks.includes("satu") || teks.includes("pelan")) {
      controlFan(1, !0);
      responsSuara += "Kipas menyala kecepatan satu. ";
      aksiDitemukan = true;
    } else if (
      teks.includes("2") ||
      teks.includes("dua") ||
      teks.includes("sedang")
    ) {
      controlFan(2, !0);
      responsSuara += "Kipas menyala kecepatan dua. ";
      aksiDitemukan = true;
    } else if (
      teks.includes("3") ||
      teks.includes("tiga") ||
      teks.includes("maksimal") ||
      teks.includes("kencang")
    ) {
      controlFan(3, !0);
      responsSuara += "Kipas menyala maksimal. ";
      aksiDitemukan = true;
    } else if (
      teks.includes("mati") ||
      teks.includes("nol") ||
      teks.includes("off")
    ) {
      controlFan(0, !0);
      responsSuara += "Kipas dimatikan. ";
      aksiDitemukan = true;
    }
  }

  if (teks.includes("pintu")) {
    if (teks.includes("buka")) {
      controlDoor("UNLOCK", !0);
      responsSuara += "Pintu berhasil dibuka 10 detik. ";
      aksiDitemukan = true;
    } else if (teks.includes("kunci") || teks.includes("tutup")) {
      controlDoor("LOCK", !0);
      responsSuara += "Pintu telah dikunci. ";
      aksiDitemukan = true;
    }
  }

  // Eksekusi jika terjadi kombinasi perintah (Navigasi + Alat)
  if (aksiDitemukan) {
    bicara(responsSuara, !0);
    return; // Hentikan fungsi di sini agar tidak membaca logika lama di bawahnya
  }

  // ==========================================
  // 3. LOGIKA LAMA KAMU YANG TIDAK DIUBAH (Musik, Info, Sensor, dll)
  // ==========================================
  if (
    teks.includes("terima kasih") ||
    teks.includes("makasih") ||
    teks.includes("cukup") ||
    teks.includes("sudah")
  ) {
    bicara(
      "Sama-sama tuan. Senang bisa membantu Anda. Voice Command ditutup.",
      !0,
    );
  } else if (
    teks.includes("keluar aplikasi") ||
    teks.includes("tutup aplikasi") ||
    teks.includes("keluar dari dashboard") ||
    teks.includes("exit")
  ) {
    bicara("Baik tuan. Menutup aplikasi. Sampai jumpa.", !0, () => {
      showExitConfirmation();
    });
  } else if (
    teks.includes("mainkan musik") ||
    teks.includes("putar musik") ||
    teks.includes("nyalakan lagu") ||
    teks.includes("nyalakan musik")
  ) {
    let keyword = teks
      .replace("mainkan musik", "")
      .replace("putar musik", "")
      .replace("putar lagu", "")
      .replace("mainkan lagu", "")
      .replace("nyalakan lagu", "")
      .replace("nyalakan musik", "")
      .trim();
    if (keyword.length > 2) {
      searchYouTube(keyword);
      return;
    }
    if (
      typeof YT === "undefined" ||
      typeof player === "undefined" ||
      !player.loadPlaylist
    ) {
      bicara("Sistem musik sedang disiapkan, coba lagi.", true);
      onYouTubeIframeAPIReady();
      return;
    }
    const ytData = getYoutubeData(YOUTUBE_LINK);
    try {
      if (player && typeof player.setVolume === "function")
        player.setVolume(100);
      if (ytData.listId) {
        player.stopVideo();
        player.loadPlaylist({
          listType: "playlist",
          list: ytData.listId,
          index: 0,
          startSeconds: 0,
        });
        player.setLoop(true);
        setTimeout(() => {
          player.playVideo();
        }, 1000);
      } else if (ytData.videoId) {
        player.loadVideoById(ytData.videoId);
        setTimeout(() => {
          player.playVideo();
        }, 500);
      } else {
        player.playVideo();
      }
      isMusicPlaying = true;
      pausedByVoice = false;
      bicara("Memutar playlist musik favorit Anda.", true);
    } catch (e) {
      alert("Gagal memutar otomatis. Silakan tekan tombol Play.");
    }
  } else if (
    teks.includes("matikan musik") ||
    teks.includes("stop musik") ||
    teks.includes("berhenti lagu")
  ) {
    controlMusic("STOP");
    pausedByVoice = !1;
    bicara("Musik dihentikan secara permanen.", !0);
  } else if (
    teks.includes("ganti lagu") ||
    teks.includes("ganti musik") ||
    teks.includes("lagu selanjutnya")
  ) {
    if (player && typeof player.nextVideo === "function") {
      player.nextVideo();
      pausedByVoice = !1;
      isMusicPlaying = !0;
      bicara("Memutar lagu selanjutnya.", !0);
    } else {
      bicara("Maaf, player belum siap.", !0);
    }
  } else if (
    teks.includes("tambah kartu") ||
    teks.includes("registrasi kartu") ||
    teks.includes("daftar kartu")
  ) {
    openRfidModal();
    bicara("Membuka menu registrasi kartu RFID. Silakan tempel kartu.", !0);
  } else if (
    teks.includes("cek kartu") ||
    teks.includes("info kartu") ||
    teks.includes("siapa saja yang terdaftar")
  ) {
    bicara("Sedang mengambil data database, mohon tunggu sebentar...");
    fetch(GAS_URL)
      .then((res) => res.json())
      .then((data) => {
        if (!data || data.length === 0) {
          bicara("Database kosong. Belum ada kartu terdaftar.", !0);
          return;
        }
        const total = data.length;
        let spokenNames =
          total <= 5
            ? data.map((u) => u.name).join(", ")
            : `${data
                .map((u) => u.name)
                .slice(0, 5)
                .join(", ")}, dan ${total - 5} orang lainnya`;
        let htmlList = `<div class="bg-slate-900/50 p-2 rounded-lg mb-2 text-xs text-slate-400">Total: ${total} Kartu</div><ul class="text-left space-y-2 max-h-60 overflow-y-auto pr-1">`;
        data.forEach((u) => {
          htmlList += `<li class="bg-slate-700 p-3 rounded-lg flex justify-between items-center border border-slate-600"><div class="flex items-center gap-2"><i class="fa-solid fa-id-card text-emerald-500"></i><span class="font-bold text-white text-sm">${u.name}</span></div><span class="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">${u.uid}</span></li>`;
        });
        htmlList += `</ul>`;
        showInfoModal("Database RFID", htmlList, "info");
        bicara(
          `Ditemukan ${total} kartu terdaftar. Pemiliknya adalah: ${spokenNames}.`,
          !0,
        );
      })
      .catch((e) => {
        bicara("Maaf, gagal mengambil data dari server.", !0);
      });
  } else if (
    teks.includes("status kipas") ||
    teks.includes("cek kipas") ||
    teks.includes("info kipas")
  ) {
    bicara(
      currentFanSpeed <= 0
        ? "Kipas saat ini dalam kondisi mati."
        : `Kipas menyala pada kecepatan ${currentFanSpeed}.`,
      !0,
    );
  } else if (
    teks.includes("status kunci") ||
    teks.includes("cek kunci") ||
    teks.includes("kondisi kunci")
  ) {
    bicara(
      isDoorLocked
        ? "Pintu saat ini TERKUNCI aman."
        : "Kunci saat ini dalam kondisi TERBUKA.",
      !0,
    );
  } else if (
    teks.includes("status sensor") ||
    teks.includes("cek sensor") ||
    teks.includes("laporan sistem")
  ) {
    const laser = document.getElementById("toggle-laser").checked
      ? "Aktif"
      : "Mati";
    const ir = document.getElementById("toggle-ir").checked ? "Aktif" : "Mati";
    const hc = document.getElementById("toggle-hc").checked ? "Aktif" : "Mati";
    const api = document.getElementById("toggle-api").checked
      ? "Aktif"
      : "Mati";
    bicara(
      `Laporan status sensor: Laser ${laser}, Sensor Gerak ${ir}, Sensor Jarak ${hc}, dan Detektor Api ${api}.`,
      !0,
    );
  } else if (
    teks.includes("nyalakan laser") ||
    teks.includes("aktifkan keamanan")
  ) {
    toggleSecurity("laser", !0, !0);
    bicara("Sistem keamanan laser diaktifkan.", !0);
  } else if (
    teks.includes("matikan laser") ||
    teks.includes("matikan keamanan")
  ) {
    toggleSecurity("laser", !1, !0);
    bicara("Sistem keamanan laser dinonaktifkan.", !0);
  } else if (teks.includes("hidupkan sensor gerak")) {
    toggleSecurity("ir", !0, !0);
    bicara("Sensor gerak aktif.", !0);
  } else if (teks.includes("matikan sensor gerak")) {
    toggleSecurity("ir", !1, !0);
    bicara("Sensor gerak mati.", !0);
  } else if (teks.includes("hidupkan sensor jarak")) {
    toggleSecurity("hc", !0, !0);
    bicara("Sensor jarak aktif.", !0);
  } else if (teks.includes("matikan sensor jarak")) {
    toggleSecurity("hc", !1, !0);
    bicara("Sensor jarak mati.", !0);
  } else if (teks.includes("hidupkan sensor api")) {
    toggleSecurity("api", !0, !0);
    bicara("Detektor api aktif.", !0);
  } else if (teks.includes("matikan sensor api")) {
    toggleSecurity("api", !1, !0);
    bicara("Detektor api mati.", !0);
  } else if (teks.includes("suhu ruangan") || teks.includes("cek suhu")) {
    const temp = document.getElementById("temp2").innerText;
    const hum = document.getElementById("hum2").innerText;
    bicara(
      `Suhu ruangan saat ini ${temp} derajat celcius, kelembaban ${hum} persen.`,
      !0,
    );
  } else if (teks.includes("cek cuaca") || teks.includes("info cuaca")) {
    const lokasi = document.getElementById("locName").innerText;
    const deskripsi = document.getElementById("mainDesc").innerText;
    bicara(`Cuaca di ${lokasi} saat ini ${deskripsi}.`, !0);
  } else {
    bicara("Maaf, perintah tidak dikenali. Silakan ulangi.", !1);
  }
}
let currentPin = "";
const savedPin = "121232";
// ==========================================
// GABUNGAN FIX: BIOMETRIK, STARTUP & HISTORI DISCONNECT
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
  // --- 1. MEMUAT HISTORI DISCONNECT SAAT WEB PERTAMA DIBUKA ---
  let disconnectTimes =
    JSON.parse(localStorage.getItem("espDisconnectTimes")) || {};
  for (let id = 1; id <= 5; id++) {
    // Jika ESP tertentu punya riwayat terputus di memori, tampilkan langsung
    if (disconnectTimes[id]) {
      updateDeviceStatus(id, false);
    }
  }

  // --- 2. CEK AUTO LOGIN TERLEBIH DAHULU ---
  // Jika token valid, HENTIKAN proses setup biometrik agar tidak muncul popup
  const TRUSTED_TOKEN = "DEVICE_RIYAN_TERVERIFIKASI_2026";
  const savedToken = localStorage.getItem("my_trusted_device_token");

  if (savedToken === TRUSTED_TOKEN) {
    console.log(
      "🛑 Auto Login Terdeteksi: Membatalkan trigger biometrik & UI Lock.",
    );
    return; // BERHENTI DI SINI, Biarkan unlockApp() di window.load yang bekerja
  }

  // --- 3. SETUP UI LOCK SCREEN (Jika tidak auto login) ---
  const title = document.getElementById("lock-title");
  const msg = document.getElementById("lock-msg");

  if (title) title.innerText = "LOCKED";
  if (msg) msg.innerText = "Ketuk layar untuk Scan Sidik Jari";

  // --- 4. INISIALISASI BIOMETRIK ---
  if (window.PublicKeyCredential) {
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(
      (available) => {
        if (available) {
          console.log("Biometrik tersedia.");
          let hasTriggeredAuth = !1;

          // Fungsi Trigger Aman
          const safeTrigger = () => {
            // Cek lagi double protection
            if (
              localStorage.getItem("my_trusted_device_token") === TRUSTED_TOKEN
            )
              return;

            if (hasTriggeredAuth) return;
            hasTriggeredAuth = !0;
            console.log("Memicu Biometrik...");

            verifyBiometric().catch(() => {
              // Reset status setelah delay jika gagal/cancel
              setTimeout(() => {
                hasTriggeredAuth = !1;
              }, 2000);
            });
          };

          // Auto-start hanya jika Tab terlihat & belum login
          setTimeout(() => {
            if (
              document.visibilityState === "visible" &&
              !localStorage.getItem("my_trusted_device_token")
            ) {
              console.log("🚀 Auto-Start Biometrik dipicu...");
              safeTrigger();
            }
          }, 1500);
        }
      },
    );
  }
});

function unlockApp(isAuto = false) {
  console.log("🚀 Memulai Koneksi MQTT...");
  connectMQTT();

  if (typeof applyGlobalAnimation === "function") {
    setTimeout(() => {
      applyGlobalAnimation("#device-status-list > div", 0.2);
    }, 100);
    setTimeout(() => {
      applyGlobalAnimation("#page-home .grid.grid-cols-2.gap-4 > div", 0.15);
    }, 300);
  }

  if (
    typeof onYouTubeIframeAPIReady === "function" &&
    (typeof player === "undefined" || !player)
  ) {
    console.log("🎵 UNLOCK BERHASIL: Menyiapkan Musik Player...");
    setTimeout(() => onYouTubeIframeAPIReady(), 1500);
  }

  // Start background mode
  setTimeout(() => {
    if (
      window.cordova &&
      window.cordova.plugins &&
      window.cordova.plugins.backgroundMode
    ) {
      window.cordova.plugins.backgroundMode.enable();
    }
  }, 4000);
}

let historyPushed = !1;
function initHistoryGuard() {
  if (!historyPushed) {
    window.history.pushState({ page: "guard" }, "", window.location.href);
    historyPushed = !0;
  }
}
document.addEventListener("click", initHistoryGuard, { once: !0 });
document.addEventListener("touchstart", initHistoryGuard, { once: !0 });
document.addEventListener("scroll", initHistoryGuard, { once: !0 });
// --- CARI BAGIAN INI DAN GANTI ---
window.onpopstate = function (event) {
  // 1. JIKA SEDANG PROSES KELUAR, BIARKAN (Jangan menahan)
  if (isAppExiting) {
    return; // Biarkan history.back() dari forceExitApp bekerja
  }

  // 2. LOGIKA NORMAL (Push Guard Kembali)
  window.history.pushState({ page: "guard" }, "", window.location.href);

  const globalModal = document.getElementById("global-modal");
  const isExitModalOpen =
    globalModal.classList.contains("active") &&
    document.getElementById("modal-title").innerText.includes("Keluar");

  const activeModals = document.querySelectorAll(".modal-overlay.active");

  if (isExitModalOpen) {
    closeModalAndReset();
  } else if (activeModals.length > 0) {
    activeModals.forEach((modal) => modal.classList.remove("active"));
    if (typeof resetToCamera === "function") resetToCamera();
  } else {
    const homeSection = document.getElementById("page-home");
    const isHome = homeSection && homeSection.classList.contains("active-page");

    if (!isHome) {
      switchPage("page-home");
    } else {
      showExitConfirmation();
    }
  }
};
// --- UPDATE POPUP KELUAR APLIKASI (FIX ERROR & ID MATCHING) ---
function showExitConfirmation() {
  // 1. Ambil Element dengan ID yang BENAR (Sesuai index.html)
  const modal = document.getElementById("global-modal");
  const modalIcon = document.getElementById("modal-icon");
  const modalTitle = document.getElementById("modal-title");
  const modalMsg = document.getElementById("modal-msg"); // FIX: Sebelumnya 'modal-message'
  const modalButtons = document.getElementById("modal-buttons"); // FIX: Sebelumnya 'modal-btn'

  // 2. Safety Check: Cegah crash jika elemen belum siap
  if (!modal || !modalTitle || !modalMsg || !modalButtons) {
    console.error("❌ Error: Elemen Modal Exit tidak lengkap di HTML.");
    // Fallback darurat jika UI rusak
    if (confirm("Keluar Aplikasi?")) forceExitApp();
    return;
  }

  // 3. Setup Icon Power Besar
  modalIcon.innerHTML = `
    <div class="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
        <i class="fa-solid fa-power-off text-4xl text-red-500 animate-pulse"></i>
    </div>
  `;

  // 4. Isi Teks (Ini yang sebelumnya error 'innerText of null')
  modalTitle.innerText = "Keluar Aplikasi?";
  modalMsg.innerText = "Sistem akan dimatikan dan koneksi sensor diputus.";

  // 5. Buat Tombol Matikan (Timpa isi modal-buttons)
  modalButtons.innerHTML = `
    <button onclick="closeModalAndReset()" class="flex-1 py-3 rounded-xl bg-slate-700 text-white font-bold hover:bg-slate-600 transition">
        Batal
    </button>
    <button onclick="forceExitApp()" class="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold hover:from-red-500 hover:to-rose-500 transition shadow-lg shadow-red-500/40">
        <i class="fa-solid fa-power-off mr-2"></i>Matikan
    </button>
  `;

  // 6. Tampilkan
  modal.classList.add("active");

  // Suara konfirmasi (Opsional, jika belum dipanggil sebelumnya)
  // bicara("Apakah Anda yakin ingin keluar?", true);
}
// --- 1. HANDLING TOMBOL BACK FISIK ANDROID ---
if (isNative && App) {
  App.addListener("backButton", ({ canGoBack }) => {
    const modal = document.getElementById("global-modal");

    // Jika ada modal terbuka, tutup modal dulu
    if (modal && modal.classList.contains("active")) {
      closeModalAndReset();
      return;
    }

    // Jika sedang di halaman selain Home, kembali ke Home
    const homePage = document.getElementById("page-home");
    if (homePage && !homePage.classList.contains("active-page")) {
      switchPage("page-home");
      return;
    }

    // Jika sudah di Home dan tidak ada modal, TAMPILKAN KONFIRMASI KELUAR
    showExitConfirmation();
  });
}

/* =========================================
   FUNGSI KELUAR APLIKASI (WINDOW HIJACK METHOD)
   ========================================= */
function forceExitApp() {
  console.log("🚀 Memproses Keluar Aplikasi...");
  isAppExiting = true;

  // 1. STOP MQTT & Audio
  if (typeof mqttClient !== "undefined") {
    try {
      mqttClient.end(true);
    } catch (e) {}
  }
  if (typeof player !== "undefined" && player.stopVideo) {
    player.stopVideo();
  }

  // JIKA NATIVE ANDROID
  if (window.AndroidApp) {
    window.AndroidApp.exitApp();
    return;
  }

  // 2. JIKA APLIKASI NATIVE (Android/APK via Capacitor/Cordova)
  if (
    window.Capacitor &&
    window.Capacitor.Plugins &&
    window.Capacitor.Plugins.App
  ) {
    window.Capacitor.Plugins.App.exitApp();
    return;
  }
  if (navigator.app && navigator.app.exitApp) {
    navigator.app.exitApp();
    return;
  }

  // 3. JIKA PWA INSTALLED (Mode Standalone)
  // window.close() biasanya diizinkan di sini
  if (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  ) {
    window.close();
    // Jika gagal close di PWA, dia akan lanjut ke fallback di bawah
  }

  // 4. JIKA BROWSER BIASA (Chrome/Safari Tab)
  // Browser melarang script menutup tab. Solusi terbaik adalah REDIRECT.
  // Opsi A: Arahkan ke Google (User merasa sudah keluar web)
  window.location.replace("https://www.google.com");

  // Opsi B (Alternatif): Tampilkan layar hitam (seperti kode lama Anda, tapi ini opsional)
  /*
  document.body.innerHTML = "<div style='display:flex;justify-content:center;align-items:center;height:100vh;background:#000;color:#333;'>Aplikasi Telah Ditutup</div>";
  */
}

/* =========================================
   SISTEM DIAGNOSA & PERFORMANCE MONITOR
   (Paste di bagian paling bawah logic.js)
   ========================================= */

let fps = 0;
let frameCount = 0;
let lastTime = performance.now();
let isDiagnosticsOpen = false;
let perfInterval = null;

// 1. FPS Counter Loop
function countFPS() {
  const now = performance.now();
  frameCount++;
  if (now - lastTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    lastTime = now;

    // Jika diagnosa sedang dibuka, update UI real-time
    if (isDiagnosticsOpen) updateDiagnosticsUI();

    // Deteksi Patah-patah otomatis
    checkLagSpike(fps);
  }
  requestAnimationFrame(countFPS);
}
// Jalankan counter
countFPS();

// --- REVISI: checkLagSpike (Agar tidak mematikan animasi saat loading awal) ---

let startupGracePeriod = true;

// Beri waktu 5 detik pertama agar sistem stabil (abaikan lag saat loading)
setTimeout(() => {
  startupGracePeriod = false;
}, 5000);

function checkLagSpike(currentFps) {
  // Fungsi ini sekarang HANYA MEMANTAU, tidak melakukan tindakan otomatis.
  // Analisa penyebab lag sudah ditangani oleh fungsi 'updateDiagnosticsUI'
  // yang akan mengubah warna bar dan teks menjadi merah jika FPS rendah.

  if (startupGracePeriod) return;

  // Kita hanya log ke console untuk developer, user hanya lihat indikator visual di menu Diagnosa
  if (currentFps < 15 && isBackgroundAnimationRunning) {
    console.warn("⚠️ Monitor: FPS drop terdeteksi (Hanya Analisa)");
  }
}

/* ==========================================================
   UPDATE LOGIC.JS: FUNGSI DIAGNOSA REALTIME
   ========================================================== */
// --- 1. FUNGSI DIAGNOSA (DISESUAIKAN DENGAN HTML ANDA) ---
function openDiagnostics() {
  const modal = document.getElementById("diag-modal");
  if (!modal) return;
  modal.classList.add("active");

  // 1. TAMPILKAN DATA STARTUP (FITUR BARU)
  const bootTimeEl = document.getElementById("boot-time");
  const bootScoreEl = document.getElementById("boot-score");
  const bootDescEl = document.getElementById("boot-desc");

  if (bootTimeEl) {
    bootTimeEl.innerText = startupMetrics.time + " ms";
    bootScoreEl.innerText = startupMetrics.score;
    bootScoreEl.className = `font-bold ${startupMetrics.grade}`;
    bootDescEl.innerText = startupMetrics.desc || "Menganalisa...";
  }

  // 2. NETWORK INFO
  if (document.getElementById("net-type"))
    document.getElementById("net-type").innerText = "Scanning...";

  const conn =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;
  const netType = conn ? conn.effectiveType.toUpperCase() : "WIFI/4G";
  const netSpeed = conn ? conn.downlink + " Mbps" : "Fast";
  const netRtt = conn ? conn.rtt + " ms" : "~20 ms";

  setTimeout(() => {
    if (document.getElementById("net-type"))
      document.getElementById("net-type").innerText = netType;
    if (document.getElementById("net-speed"))
      document.getElementById("net-speed").innerText = netSpeed;
    if (document.getElementById("net-ping"))
      document.getElementById("net-ping").innerText = netRtt;

    // 3. FPS & LAG DETECTOR
    const fpsVal = document.getElementById("fps-val");
    const fpsBar = document.getElementById("fps-bar");
    const lagReason = document.getElementById("lag-reason");

    if (fpsVal) {
      const finalFPS = Math.round(realFPS);
      fpsVal.innerText = finalFPS + " FPS";

      let barColor = "bg-emerald-500";
      let health = Math.min(100, (finalFPS / 60) * 100);
      let reason = "Sistem berjalan optimal.";

      if (finalFPS < 45) {
        barColor = "bg-yellow-500";
        reason = "Sedikit frame drop. Masih wajar.";
      }
      if (finalFPS < 25) {
        barColor = "bg-red-500";
        reason = "Lag berat! Matikan animasi background/kamera.";
      }

      fpsBar.style.width = health + "%";
      fpsBar.className = `h-full ${barColor} transition-all duration-300`;
      lagReason.innerText = reason;
    }
  }, 500);
}

function closeDiagnostics() {
  const modal = document.getElementById("diag-modal");
  if (modal) modal.classList.remove("active");
}

function reloadPWA() {
  window.location.reload();
}

function updateDiagnosticsUI() {
  const fpsEl = document.getElementById("fps-val");
  const fpsBar = document.getElementById("fps-bar");
  const reasonEl = document.getElementById("lag-reason");

  if (!fpsEl) return;

  // Update Angka FPS
  fpsEl.innerText = fps + " FPS";

  // Update Bar Visual
  let percentage = Math.min((fps / 60) * 100, 100);
  fpsBar.style.width = percentage + "%";

  // Logic Warna Bar
  fpsBar.className = "h-full transition-all duration-300 ";
  if (fps >= 50) fpsBar.classList.add("fps-high");
  else if (fps >= 30) fpsBar.classList.add("fps-med");
  else fpsBar.classList.add("fps-low");

  // --- ANALISA PENYEBAB (DIAGNOSA REAL-TIME) ---
  // Kita cek variabel global apa saja yang sedang aktif
  let causes = [];
  let loadStatus = "Ringan";
  let statusColor = "text-emerald-400";

  // 1. Cek Kamera Wajah
  if (typeof isCameraOn !== "undefined" && isCameraOn) {
    causes.push("Kamera Wajah Aktif (Berat)");
  }

  // 2. Cek AI Tangan (Sangat Berat)
  if (typeof isHandCameraOn !== "undefined" && isHandCameraOn) {
    causes.push("AI Hand Tracking (Sangat Berat)");
  }

  // 3. Cek Animasi Background
  if (
    typeof isBackgroundAnimationRunning !== "undefined" &&
    isBackgroundAnimationRunning
  ) {
    causes.push("Efek Visual Matrix");
  }

  // 4. Cek Peta
  const mapContainer = document.getElementById("mapContainer");
  if (mapContainer && mapContainer.classList.contains("fullscreen")) {
    causes.push("Rendering Peta Fullscreen");
  }

  // 5. Cek Memory (Chrome only API)
  if (window.performance && window.performance.memory) {
    const memUsed = Math.round(
      window.performance.memory.usedJSHeapSize / 1024 / 1024,
    );
    if (memUsed > 50) {
      // Jika RAM JS > 50MB
      causes.push(`RAM Usage Tinggi (${memUsed} MB)`);
    }
  }

  // Menentukan Status Berdasarkan FPS
  if (fps >= 50) {
    loadStatus = "Optimal";
    statusColor = "text-emerald-400";
    reasonEl.innerHTML = `<span class="${statusColor} font-bold">✅ Sistem Berjalan Lancar</span>`;
  } else if (fps >= 30) {
    loadStatus = "Sedang";
    statusColor = "text-yellow-400";
    // Jika FPS medium tapi tidak ada fitur berat aktif, mungkin device low-end
    let causeText =
      causes.length > 0 ? causes.join(", ") : "Performa Perangkat Standar";
    reasonEl.innerHTML = `<span class="${statusColor} font-bold">⚠️ Beban ${loadStatus}</span><br>Aktif: ${causeText}`;
  } else {
    loadStatus = "Berat (Lag)";
    statusColor = "text-red-400";

    let causeText = "";
    if (causes.length > 0) {
      causeText = `<ul class="list-disc list-inside mt-1 text-left pl-2">${causes.map((c) => `<li>${c}</li>`).join("")}</ul>`;
    } else {
      causeText =
        "<br>- CPU Perangkat High Load<br>- Terlalu banyak aplikasi di background";
    }

    reasonEl.innerHTML = `<span class="${statusColor} font-bold">🔴 Beban Kritis!</span>${causeText}`;
  }
}

// 5. Info Jaringan (Network API)
function updateNetworkInfo() {
  const typeEl = document.getElementById("net-type");
  const speedEl = document.getElementById("net-speed");

  if (navigator.connection) {
    const conn = navigator.connection;
    typeEl.innerText = conn.effectiveType
      ? conn.effectiveType.toUpperCase()
      : "WIFI/4G";
    speedEl.innerText = conn.downlink ? `±${conn.downlink} Mbps` : "Unknown";
  } else {
    typeEl.innerText = "Tidak Didukung";
    speedEl.innerText = "-";
  }
}

// 6. Ping Latency Check (Ke Server MQTT)
function updatePingSimulation() {
  const start = Date.now();
  const pingEl = document.getElementById("net-ping");

  if (mqttClient.isConnected()) {
    // Karena MQTT JS library Paho tidak punya fitur ping langsung yang bisa diukur time-nya,
    // Kita gunakan estimasi socket browser atau simulasi beban
    // Cara terbaik: Gunakan image fetch ke server kecil
    const img = new Image();
    img.onload = function () {
      const end = Date.now();
      if (pingEl) pingEl.innerText = end - start + " ms";
    };
    img.onerror = function () {
      if (pingEl) pingEl.innerText = "Timeout";
    };
    // Ping ke icon google kecil atau favicon sendiri dengan cache buster
    img.src = "logoapk.png?t=" + start;
  } else {
    if (pingEl) pingEl.innerText = "Offline";
  }
}

// 7. Toggle Animasi Manual
function toggleBackgroundAnimManual() {
  const btn = document.getElementById("btn-toggle-anim");
  isBackgroundAnimationRunning = !isBackgroundAnimationRunning;

  if (isBackgroundAnimationRunning) {
    btn.innerHTML =
      '<i class="fa-solid fa-power-off mr-1"></i> Matikan Animasi Background';
    btn.classList.replace("bg-red-900", "bg-slate-700");
    requestAnimationFrame(animate); // Fungsi animate() dari kode lama
  } else {
    btn.innerHTML =
      '<i class="fa-solid fa-power-off mr-1"></i> Hidupkan Animasi';
    btn.classList.replace("bg-slate-700", "bg-red-900");
  }
}

function reloadPWA() {
  window.location.reload();
}

// Panggil di awal untuk cek status
updateNetworkInfo();

/* ==========================================================
   SISTEM MANAJEMEN BACKGROUND (OPTIMIZED)
   Letakkan ini di paling bawah logic.js menggantikan kode Matrix lama
   ========================================================== */
let selectedAnim5Shape = "galaxy";
let realFPS = 60;
let lastLoop = performance.now();
function trackSystemFPS() {
  // --- OPTIMASI LOCK SCREEN ---
  const lockScreen = document.getElementById("lock-screen");
  const isLocked =
    lockScreen && lockScreen.style.transform !== "translateY(-100%)";

  // Jika sedang terkunci, JANGAN render animasi background (Hemat GPU & RAM)
  if (isLocked) {
    requestAnimationFrame(trackSystemFPS);
    return;
  }
  // -----------------------------

  const now = performance.now();
  const delta = now - lastLoop;
  lastLoop = now;
  if (delta > 0) {
    const fps = 1000 / delta;
    realFPS = realFPS * 0.9 + fps * 0.1;
  }
  requestAnimationFrame(trackSystemFPS);
}
trackSystemFPS(); // Jalankan loop
const BgManager = {
  currentId: null,
  animationFrameId: null,
  cleanupFunc: null,
  container: document.getElementById("bg-container"),

  // Switch: Dipanggil saat user KLIK tombol menu
  switch: function (type) {
    // 1. Jika Matrix dipilih, buka Popup Matrix dulu
    if (type === "matrix") {
      openMatrixSettings();
      return;
    }
    // 2. Jika Anim5 dipilih, buka Popup Anim5
    if (type === "anim5") {
      openAnim5Settings();
      return;
    }
    // 3. Sisanya langsung jalankan
    this.executeSwitch(type);
  },

  // ExecuteSwitch: Dipanggil sistem/reload (Bypass Popup)
  executeSwitch: function (type, params = "") {
    // A. Bersihkan background lama
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (typeof this.cleanupFunc === "function") this.cleanupFunc();
    this.container.innerHTML = "";
    this.cleanupFunc = null;
    this.animationFrameId = null;

    // B. Tutup semua modal setup background
    const mtxModal = document.getElementById("matrix-settings-modal");
    const anim5Modal = document.getElementById("anim5-settings-modal");
    if (mtxModal) mtxModal.classList.remove("active");
    if (anim5Modal) anim5Modal.classList.remove("active");

    // C. Stop kamera jika sebelumnya aktif (Penting!)
    // (Walaupun loadIframeBackground akan menimpa, kita pastikan stream mati)
    if (
      typeof stopCamera === "function" &&
      typeof isCameraOn !== "undefined" &&
      isCameraOn
    ) {
      stopCamera();
    }

    console.log("🔄 Memuat Background:", type, params);

    // D. LOGIKA TOMBOL STOP KAMERA (BARU)
    // Jika tipe adalah anim4 atau anim5, TAMPILKAN tombol stop kamera
    const isCameraBg = type === "anim4" || type === "anim5";
    toggleCameraStopButton(isCameraBg);

    // E. Load Background Sesuai Tipe
    switch (type) {
      case "anim1":
        this.loadAnim1();
        break;
      case "anim2":
        this.loadAnim2();
        break;
      case "anim3":
        this.loadAnim3();
        break;
      case "anim4":
        this.loadIframeBackground("animasi4.html");
        break;
      case "anim5":
        this.loadAnim5(params);
        break;
      case "matrix":
      default:
        this.loadMatrix(params); // Kirim params (tipe matrix)
        break;
    }

    // F. Simpan state
    localStorage.setItem("savedBg", type);
    // Simpan param matrix khusus jika ada
    if (type === "matrix" && params)
      localStorage.setItem("savedMatrixType", params);

    if (typeof closeBgModal === "function") closeBgModal();
  },

  loadAnim5: function (queryParams) {
    if (!queryParams) {
      queryParams =
        localStorage.getItem("savedAnim5Params") ||
        "?shape=galaxy&color=00FFFF";
    }
    const url = "animasi5.html" + queryParams;
    this.loadIframeBackground(url);
  },

  loadIframeBackground: function (srcUrl) {
    const iframe = document.createElement("iframe");
    iframe.src = srcUrl;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.allow = "camera; microphone";

    // --- PERBAIKAN BUG RELOAD ---
    // Pastikan membaca status TERBARU dari localStorage sebelum kirim pesan
    iframe.onload = () => {
      // Baca ulang status dari memori
      const currentState = localStorage.getItem("iframeCamState");
      const shouldBeOn = currentState !== "OFF"; // Default ON jika null

      // Update variabel global agar sinkron
      isIframeCameraActive = shouldBeOn;
      updateCameraBtnUI(isIframeCameraActive);

      // Kirim pesan yang BENAR ke iframe
      const stateMsg = shouldBeOn ? "START_CAMERA_ONLY" : "STOP_CAMERA_ONLY";
      iframe.contentWindow.postMessage(stateMsg, "*");
      console.log(`🔄 Sync Kamera Iframe: Mengirim ${stateMsg}`);
    };

    this.container.appendChild(iframe);
    this.cleanupFunc = () => {
      iframe.src = "";
      iframe.remove();
    };
  },

  // --- ANIMASI MATRIX (UPDATED DENGAN VARIASI) ---
  loadMatrix: function (matrixType) {
    // Default fallback
    if (!matrixType)
      matrixType = localStorage.getItem("savedMatrixType") || "katakana";

    const canvas = document.createElement("canvas");
    this.container.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    let width,
      height,
      matrixDrops = [];

    // Konfigurasi Karakter
    let chars = "";
    if (matrixType === "binary") chars = "10";
    else if (matrixType === "alphabet")
      chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*";
    else if (matrixType === "emoji") chars = "⚡🔥💀👾👽🤖💾💿📱🔌";
    else
      chars =
        "アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン";

    const fontSize = matrixType === "emoji" ? 20 : 14;

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initMatrix();
    };
    window.addEventListener("resize", resize);

    function initMatrix() {
      matrixDrops = [];
      const cols = width / fontSize;
      for (let i = 0; i < cols; i++)
        matrixDrops.push({ x: i * fontSize, y: Math.random() * -height });
    }

    resize();

    const animate = () => {
      // Efek Trail (Bayangan)
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = matrixType === "emoji" ? "#FFF" : "#0F0"; // Hijau Hacker atau Putih Emoji
      ctx.font = `${fontSize}px monospace`;

      matrixDrops.forEach((d) => {
        // Pilih karakter acak
        const text = chars.charAt(Math.floor(Math.random() * chars.length));

        // Warna khusus binary agar variatif
        if (matrixType === "binary") {
          ctx.fillStyle = Math.random() > 0.9 ? "#FFF" : "#0F0";
        }

        ctx.fillText(text, d.x, d.y);

        // Reset drop jika sudah di bawah layar (dengan random start)
        if (d.y > height && Math.random() > 0.975) {
          d.y = 0;
        }
        d.y += fontSize; // Kecepatan turun
      });
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
    this.cleanupFunc = () => window.removeEventListener("resize", resize);
  },

  // --- ANIMASI 1: PARTIKEL 2D ---
  loadAnim1: function () {
    const canvas = document.createElement("canvas");
    this.container.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    let particlesArray = [];
    let hue = 0;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };
    window.addEventListener("resize", resize);
    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 3 + 1;
        this.speedX = Math.random() * 2 - 1;
        this.speedY = Math.random() * 2 - 1;
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x > canvas.width || this.x < 0) this.speedX *= -1;
        if (this.y > canvas.height || this.y < 0) this.speedY *= -1;
      }
      draw() {
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    function init() {
      particlesArray = [];
      let count = (canvas.width * canvas.height) / 15000;
      for (let i = 0; i < count; i++) particlesArray.push(new Particle());
    }
    resize();
    const animate = () => {
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      hue += 2;
      particlesArray.forEach((p, index) => {
        p.update();
        p.draw();
        for (let j = index; j < particlesArray.length; j++) {
          let dx = p.x - particlesArray[j].x;
          let dy = p.y - particlesArray[j].y;
          if (Math.sqrt(dx * dx + dy * dy) < 100) {
            ctx.beginPath();
            ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(particlesArray[j].x, particlesArray[j].y);
            ctx.stroke();
          }
        }
      });
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
    this.cleanupFunc = () => window.removeEventListener("resize", resize);
  },

  // --- ANIMASI 2: BOLA 3D ---
  loadAnim2: function () {
    if (typeof THREE === "undefined") return;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.02);
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.z = 50;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.container.appendChild(renderer.domElement);
    const geometry = new THREE.BufferGeometry();
    const count = 2000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const c1 = new THREE.Color(0x8a2be2),
      c2 = new THREE.Color(0x00ffff);
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count),
        theta = Math.sqrt(count * Math.PI) * phi,
        r = 20;
      positions[i * 3] = r * Math.cos(theta) * Math.sin(phi);
      positions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const c = c1.clone().lerp(c2, (positions[i * 3 + 1] + r) / (r * 2));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const particles = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
      }),
    );
    scene.add(particles);
    const resize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", resize);
    const animate = () => {
      particles.rotation.y += 0.002;
      particles.rotation.z += 0.001;
      renderer.render(scene, camera);
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
    this.cleanupFunc = () => {
      window.removeEventListener("resize", resize);
      geometry.dispose();
      renderer.dispose();
    };
  },

  // --- ANIMASI 3: BINTANG ---
  loadAnim3: function () {
    const canvas = document.createElement("canvas");
    this.container.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    let width,
      height,
      angle = 0;
    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    resize();
    const getStarPoint = (t, scale) => {
      const r =
        (Math.floor(t / ((Math.PI * 2) / 10)) % 2 === 0 ? 16 : 8) * scale;
      return {
        x: width / 2 + Math.cos(t) * r,
        y: height / 2 + Math.sin(t) * r,
      };
    };
    const animate = () => {
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(0, 0, width, height);
      angle += 0.02;
      const scale =
        (Math.min(width, height) / 50) * (1 + Math.sin(angle) * 0.2);
      ctx.strokeStyle = `hsl(${(angle * 50) % 360}, 70%, 60%)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        const p = getStarPoint(t, scale);
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
    this.cleanupFunc = () => window.removeEventListener("resize", resize);
  },
};
// --- FUNGSI HELPER UNTUK MATRIX POPUP ---
let selectedMatrixType = "katakana";

function openMatrixSettings() {
  if (typeof closeBgModal === "function") closeBgModal();
  const modal = document.getElementById("matrix-settings-modal");
  if (modal) modal.classList.add("active");
}

function closeMatrixSettings() {
  const modal = document.getElementById("matrix-settings-modal");
  if (modal) modal.classList.remove("active");
}

function selectMatrixType(type) {
  selectedMatrixType = type;
  document
    .querySelectorAll(".btn-matrix-pre")
    .forEach((b) => b.classList.remove("active"));
  const btn = document.getElementById("mtx-" + type);
  if (btn) btn.classList.add("active");
}

function confirmMatrixStart() {
  // Jalankan Matrix dengan tipe yang dipilih
  BgManager.executeSwitch("matrix", selectedMatrixType);
}

// --- VARIABEL STATUS KAMERA IFRAME ---
let isIframeCameraActive = localStorage.getItem("iframeCamState") !== "OFF";

// --- FUNGSI HELPER UNTUK TOMBOL KAMERA ---
// --- FUNGSI HELPER UNTUK TOMBOL KAMERA ---
function toggleCameraStopButton(isAnimCameraMode) {
  const desktopBtn = document.getElementById("sidebar-stop-cam");
  const mobileBtn = document.getElementById("mobile-stop-cam");
  const headerSwitchBtn = document.getElementById("header-cam-switch");

  // Simpan status mode (apakah kita di anim4/5) ke variabel global sementara/scope ini
  // agar bisa diakses oleh emergencyStopCamera jika perlu, atau cukup andalkan logika di bawah.

  if (isAnimCameraMode) {
    // 1. Tampilkan Tombol ON/OFF Kamera
    if (desktopBtn) desktopBtn.classList.remove("hidden");
    if (mobileBtn) mobileBtn.classList.remove("hidden");

    // 2. Logika Tombol Switch: Hanya muncul jika Kamera sedang AKTIF (ON)
    if (headerSwitchBtn) {
      if (isIframeCameraActive) {
        headerSwitchBtn.classList.remove("hidden");
      } else {
        headerSwitchBtn.classList.add("hidden");
      }
    }
    updateCameraBtnUI(isIframeCameraActive);
  } else {
    // Sembunyikan semua jika bukan anim4/5
    if (desktopBtn) desktopBtn.classList.add("hidden");
    if (mobileBtn) mobileBtn.classList.add("hidden");
    if (headerSwitchBtn) headerSwitchBtn.classList.add("hidden");
  }
}

// Fungsi Ubah Tampilan Tombol (Merah vs Hijau)
function updateCameraBtnUI(isActive) {
  const desktopBtn = document.getElementById("sidebar-stop-cam");
  const mobileBtn = document.getElementById("mobile-stop-cam");

  if (isActive) {
    // UI: Tombol Matikan (Merah)
    if (desktopBtn) {
      desktopBtn.innerHTML =
        '<i class="fa-solid fa-video-slash w-6 animate-pulse"></i><span>Matikan Kamera</span>';
      desktopBtn.className =
        "nav-item text-red-400 hover:text-red-300 hover:bg-red-900/20 border border-red-900/30";
    }
    if (mobileBtn) {
      mobileBtn.innerHTML = '<i class="fa-solid fa-video-slash text-xs"></i>';
      mobileBtn.className =
        "w-8 h-8 rounded-full bg-red-900/50 border border-red-500 flex items-center justify-center text-red-400 shadow-lg active:scale-90 transition animate-pulse";
    }
  } else {
    // UI: Tombol Hidupkan (Hijau/Biru)
    if (desktopBtn) {
      desktopBtn.innerHTML =
        '<i class="fa-solid fa-video w-6"></i><span>Hidupkan Kamera</span>';
      desktopBtn.className =
        "nav-item text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 border border-blue-900/30";
    }
    if (mobileBtn) {
      mobileBtn.innerHTML = '<i class="fa-solid fa-video text-xs"></i>';
      mobileBtn.className =
        "w-8 h-8 rounded-full bg-blue-900/50 border border-blue-500 flex items-center justify-center text-blue-400 shadow-lg active:scale-90 transition";
    }
  }
}

// Fungsi Toggle (ON/OFF)
function emergencyStopCamera() {
  const iframe = document.querySelector("#bg-container iframe");
  const headerSwitchBtn = document.getElementById("header-cam-switch");

  if (iframe) {
    if (isIframeCameraActive) {
      // --- MEMATIKAN KAMERA ---
      iframe.contentWindow.postMessage("STOP_CAMERA_ONLY", "*");
      showInfoModal(
        "Kamera Off",
        "Kamera dimatikan. Status tersimpan.",
        "info",
      );
      setTimeout(() => {
        closeModalAndReset();
      }, 5000);
      isIframeCameraActive = false;

      // SEMBUNYIKAN TOMBOL SWITCH SAAT KAMERA MATI
      if (headerSwitchBtn) headerSwitchBtn.classList.add("hidden");
    } else {
      // --- MENGHIDUPKAN KAMERA ---
      iframe.contentWindow.postMessage("START_CAMERA_ONLY", "*");

      // Tampilkan Modal Loading sebentar
      showInfoModal("Kamera On", "Mengaktifkan sensor kamera...", "loading");
      setTimeout(() => {
        // Tutup modal loading ganti info sukses
        showInfoModal("Kamera On", "Sensor kamera aktif.", "success");
        // Auto close info sukses
        setTimeout(() => closeModalAndReset(), 1500);
      }, 1000);

      isIframeCameraActive = true;

      // TAMPILKAN TOMBOL SWITCH SAAT KAMERA NYALA
      if (headerSwitchBtn) headerSwitchBtn.classList.remove("hidden");
    }

    // SIMPAN STATUS KE MEMORI
    localStorage.setItem("iframeCamState", isIframeCameraActive ? "ON" : "OFF");

    // Update Ikon Tombol Stop/Start
    updateCameraBtnUI(isIframeCameraActive);
  } else {
    // Fallback jika iframe tidak ada
    const savedMtx = localStorage.getItem("savedMatrixType") || "katakana";
    BgManager.executeSwitch("matrix", savedMtx);
  }
}
function openAnim5Settings() {
  if (typeof closeBgModal === "function") closeBgModal();
  const modal = document.getElementById("anim5-settings-modal");
  if (modal) modal.classList.add("active");
}

function closeAnim5Settings() {
  const modal = document.getElementById("anim5-settings-modal");
  if (modal) modal.classList.remove("active");
}

function selectShapePreview(shape) {
  selectedAnim5Shape = shape;
  document
    .querySelectorAll(".btn-shape-pre")
    .forEach((b) => b.classList.remove("active"));
  const btn = document.getElementById("pre-" + shape);
  if (btn) btn.classList.add("active");
}

function confirmAnim5Start() {
  const colorInput = document.getElementById("anim5-color");
  const color = colorInput ? colorInput.value.replace("#", "") : "00FFFF";

  // Simpan parameter ke Storage agar ingat saat reload
  const params = `?shape=${selectedAnim5Shape}&color=${color}`;
  localStorage.setItem("savedAnim5Params", params);

  // Jalankan (ini akan otomatis menutup popup via executeSwitch)
  BgManager.executeSwitch("anim5", params);
}

// Listener warna hex text update
const colPick = document.getElementById("anim5-color");
if (colPick) {
  colPick.addEventListener("input", (e) => {
    document.getElementById("anim5-hex").innerText =
      e.target.value.toUpperCase();
  });
}

// --- FUNGSI GLOBAL UNTUK UI MODAL ---
function openBgModal() {
  document.getElementById("bg-modal").classList.add("active");
  const currentBg = localStorage.getItem("savedBg") || "matrix";
  document
    .querySelectorAll(".bg-option")
    .forEach((btn) => btn.classList.remove("bg-selected"));
  const activeBtn = document.getElementById(`btn-bg-${currentBg}`);
  if (activeBtn) activeBtn.classList.add("bg-selected");
}

function closeBgModal() {
  document.getElementById("bg-modal").classList.remove("active");
}

function changeBackground(type) {
  BgManager.switch(type);
}

// --- FUNGSI CEK STATUS NOTIFIKASI ---
async function checkNotificationPermission() {
  if (!window.Capacitor) {
    console.log("ℹ️ Notifikasi: Mode Browser (Menggunakan Service Worker)");
    return;
  }

  try {
    const perm = await LocalNotifications.checkPermissions();
    console.log("🔔 Status Izin Notifikasi:", perm.display);

    if (perm.display !== "granted") {
      // Jika belum diizinkan, minta izin
      const request = await LocalNotifications.requestPermissions();
      if (request.display === "granted") {
        showInfoModal(
          "Sistem",
          "✅ Notifikasi berhasil diaktifkan!",
          "success",
        );
      } else {
        showInfoModal(
          "Sistem",
          "⚠️ Notifikasi dimatikan oleh Android. Cek Pengaturan.",
          "error",
        );
      }
    } else {
      // Opsional: Beri tahu di console saja agar tidak mengganggu user setiap buka app
      console.log("✅ Notifikasi SIAP digunakan.");
    }
  } catch (e) {
    console.error("Gagal cek notifikasi:", e);
  }
}

// --- FUNGSI TEST NOTIFIKASI SEMENTARA ---
async function testNotification() {
  if (!LocalNotifications) {
    showInfoModal(
      "Gagal",
      "Plugin Notifikasi tidak terdeteksi (Coba di HP).",
      "error",
    );
    return;
  }

  try {
    // Minta izin dulu jika belum
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") {
      showInfoModal(
        "Izin Ditolak",
        "Anda tidak mengizinkan notifikasi.",
        "error",
      );
      return;
    }

    // Jadwalkan notifikasi 1 detik dari sekarang
    await LocalNotifications.schedule({
      notifications: [
        {
          title: "🔔 Tes Berhasil!",
          body: "Sistem notifikasi IoT Dashboard berjalan normal.",
          id: Math.floor(Math.random() * 100),
          schedule: { at: new Date(Date.now() + 1000) },
          sound: null,
          attachments: null,
          actionTypeId: "",
          extra: null,
        },
      ],
    });

    showInfoModal(
      "Terkirim",
      "Notifikasi akan muncul dalam 1 detik. Cek status bar HP Anda.",
      "success",
    );
    setTimeout(() => {
      closeModalAndReset();
    }, 5000);
  } catch (e) {
    console.error(e);
    showInfoModal(
      "Error",
      "Gagal memanggil notifikasi: " + JSON.stringify(e),
      "error",
    );
    setTimeout(() => {
      closeModalAndReset();
    }, 5000);
  }
}

// ============================================
// WINDOW LOAD (GABUNGAN SEMUA FUNGSI STARTUP)
// ============================================
window.addEventListener("load", () => {
  console.log("🚀 Aplikasi Memulai Proses Startup...");

  // Auto logic removed, unlockApp managed independently

  // 1. MIGRASI REMOTE LAMA (JIKA ADA)
  try {
    let oldRemotes = JSON.parse(localStorage.getItem("myRemotes"));
    if (
      oldRemotes &&
      oldRemotes.length > 0 &&
      typeof remoteDashboards !== "undefined" &&
      remoteDashboards.length === 0
    ) {
      const migrationId = Date.now();
      remoteDashboards.push({
        id: migrationId,
        name: "Remote Lama (Migrasi)",
        type: "other",
        brand: "Universal",
        buttons: oldRemotes,
      });
      localStorage.setItem(
        "remoteDashboards",
        JSON.stringify(remoteDashboards),
      );
      localStorage.removeItem("myRemotes");
      console.log("✅ Migrasi Remote Berhasil");
    }
    if (typeof renderDashboardList === "function") renderDashboardList();
  } catch (e) {
    console.error("Gagal Migrasi Remote:", e);
  }

  // 2. HITUNG WAKTU STARTUP & UPDATE UI DIAGNOSA
  setTimeout(() => {
    const perf = window.performance;
    if (perf) {
      const t = perf.timing;
      const loadTime = t.loadEventEnd - t.navigationStart;

      // Pastikan objek startupMetrics ada
      if (typeof startupMetrics === "undefined") window.startupMetrics = {};

      startupMetrics.time = loadTime;

      // Tentukan Grade
      let scoreText = "";
      let gradeClass = "";
      let descText = "";

      if (loadTime < 1500) {
        scoreText = "S (Sempurna)";
        gradeClass = "text-emerald-400";
        descText = "Booting super cepat!";
      } else if (loadTime < 3000) {
        scoreText = "A (Baik)";
        gradeClass = "text-blue-400";
        descText = "Kecepatan optimal.";
      } else {
        scoreText = "C (Lambat)";
        gradeClass = "text-red-400";
        descText = "Periksa koneksi/beban.";
      }

      // Simpan ke metrics global
      startupMetrics.score = scoreText;
      startupMetrics.grade = gradeClass;
      startupMetrics.desc = descText;

      console.log(`🚀 Startup Time: ${loadTime}ms (${scoreText})`);

      // Update UI (Jika elemen ada di HTML)
      const uiScore = document.getElementById("startup-result");
      const uiDesc = document.getElementById("startup-desc");

      if (uiScore) {
        uiScore.innerText = scoreText;
        uiScore.className = `font-bold ${gradeClass}`;
      }
      if (uiDesc) {
        uiDesc.innerText = descText;
      }
    }
  }, 0);

  // 3. REGISTER SERVICE WORKER
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => console.log("✅ SW Terdaftar"))
      .catch((e) => console.log("❌ SW Gagal:", e));
  }

  // 4. SET BACKGROUND (Logic Gabungan)
  setTimeout(() => {
    const savedBg = localStorage.getItem("savedBg") || "matrix";
    console.log(`🚀 Memuat Background: ${savedBg}`);

    if (typeof BgManager !== "undefined") {
      if (savedBg === "matrix") {
        const savedType = localStorage.getItem("savedMatrixType") || "katakana";
        BgManager.executeSwitch("matrix", savedType);
      } else if (savedBg === "anim5") {
        BgManager.executeSwitch("anim5");
      } else {
        BgManager.executeSwitch(savedBg);
      }
    }
  }, 500); // Delay 500ms agar DOM siap sepenuhnya

  // 5. LOAD JADWAL, NOTIFIKASI & STATUS ESP
  if (typeof loadSavedJadwal === "function") loadSavedJadwal();
  if (typeof updateNotifBadge === "function") updateNotifBadge();
  if (typeof checkNotificationPermission === "function")
    checkNotificationPermission();
  loadEspStatusFromCloud(); // <--- PANGGIL DISINI

  // 6. SYNC BACKGROUND NOTIFICATIONS
  if (typeof syncBackgroundNotifications === "function")
    syncBackgroundNotifications();

  // 7. CEK URL (DEEP LINK DARI NOTIFIKASI)
  // Cek apakah aplikasi dibuka karena KLIK notifikasi (via URL parameter ?view=notifications)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("view") === "notifications") {
    console.log("🔔 App dibuka via Klik Notifikasi");
    setTimeout(() => {
      if (typeof openNotificationModal === "function") openNotificationModal();
    }, 1500); // Beri jeda agak lama agar animasi loading selesai

    // Bersihkan URL agar bersih kembali
    window.history.replaceState({}, document.title, window.location.pathname);
  } else {
    // Cek fallback URL lama (jika ada fungsi ini)
    if (typeof checkAndOpenNotificationModal === "function")
      checkAndOpenNotificationModal();
  }

  // 8. LOGGING (INFORMASI DEBUG)
  setTimeout(() => {
    console.log("⏳ Menunggu Unlock untuk memuat Face API...");
    console.log("⏳ Menunggu Unlock untuk memuat YouTube API...");
  }, 3000);
});

// ============================================================
// INITIALIZATION SAAT APLIKASI ANDROID SIAP
// ============================================================
document.addEventListener(
  "deviceready",
  function () {
    console.log("📱 Device Ready triggered. Menunggu sistem stabil...");

    // --- [TAMBAHAN BARU] EVENT SAAT APLIKASI DIBUKA KEMBALI DARI BACKGROUND ---
    document.addEventListener(
      "resume",
      function () {
        console.log("☀️ App Resumed (Bangun dari Background) - Cek Koneksi...");

        // Cek apakah MQTT terputus
        if (typeof mqttClient === "undefined" || !mqttClient.isConnected()) {
          console.warn("⚠️ MQTT Terputus saat Resume. Menyambung ulang...");
          updateStatus(false, "Menyambung..."); // Update teks status jadi merah dulu
          connectMQTT(); // Panggil fungsi koneksi
        } else {
          console.log("✅ MQTT Masih Terhubung saat Resume.");

          // Opsional: Paksa subscribe ulang untuk memastikan topik aktif
          // mqttClient.subscribe("projek/belajar/#");
        }

        // Sinkronisasi ulang Jam/Jadwal jika perlu
        if (typeof updateRealTimeClock === "function") {
          const el = document.getElementById("home-top-text");
          if (el) updateRealTimeClock(el);
        }
      },
      false,
    );
    // TUNDA 5 DETIK AGAR APLIKASI TIDAK CRASH (SAFE STARTUP)
    setTimeout(() => {
      // ------------------------------------------------------------
      // 1. KONFIGURASI BACKGROUND MODE (Agar MQTT Tetap Jalan)
      // ------------------------------------------------------------
      try {
        if (
          window.cordova &&
          window.cordova.plugins &&
          window.cordova.plugins.backgroundMode
        ) {
          // Konfigurasi Tampilan Notifikasi Background
          window.cordova.plugins.backgroundMode.setDefaults({
            title: "IoT Dashboard Aktif",
            text: "Sistem memantau sensor & api...",
            icon: "ic_stat_notify", // Pastikan icon ini ada (atau dia pakai default)
            color: "10b981",
            resume: true,
            hidden: false,
            bigText: true,
          });

          // Aktifkan Baetap bangun
          window.cordova.plugins.backgroundMode.on("activate", function () {
            window.cordova.plugins.backgroundMode.disableWebViewOptimizations();
          });

          console.log("✅ Background Mode Berhasil Diaktifkan");

          // LOG HEARTBEAT (Cek setiap 10 detik apakah app masih hidup)
          setInterval(() => {
            const isActive = window.cordova.plugins.backgroundMode.isActive();
            if (isActive) {
              console.log(
                `💓 [HEARTBEAT] Background OK - ${new Date().toLocaleTimeString()}`,
              );
            }
          }, 10000);
        } else {
          console.warn("⚠️ Plugin Background Mode tidak terdeteksi.");
        }
      } catch (e) {
        console.error("❌ Error Background Mode:", e);
      }

      // ------------------------------------------------------------
      // 2. KONFIGURASI FCM PUSH NOTIFICATION (Untuk Ambil Token)
      // ------------------------------------------------------------
      try {
        // Pastikan plugin Capacitor tersedia
        if (
          window.Capacitor &&
          window.Capacitor.Plugins &&
          window.Capacitor.Plugins.PushNotifications
        ) {
          const PushNotifications = window.Capacitor.Plugins.PushNotifications;

          // A. Minta Izin Notifikasi ke User
          PushNotifications.requestPermissions().then((result) => {
            if (result.receive === "granted") {
              // Jika diizinkan, daftar ke Server Google (FCM)
              PushNotifications.register();
            } else {
              console.warn("❌ Izin Notifikasi Ditolak User");
            }
          });

          // B. JIKA BERHASIL DAPAT TOKEN (Event ini yang kita tunggu)
          PushNotifications.addListener("registration", (token) => {
            console.log("🔥 ========================================");
            console.log("🔥 MY DEVICE TOKEN (COPY KODE DI BAWAH):");
            console.log(token.value);
            console.log("🔥 ========================================");

            // Opsional: Munculkan di layar agar mudah dicatat
            // alert("FCM Token: " + token.value);
          });

          // C. JIKA ERROR SAAT REGISTRASI
          PushNotifications.addListener("registrationError", (error) => {
            console.error("❌ Gagal Daftar FCM:", error);
          });

          // D. SAAT NOTIFIKASI MASUK (Ketika Aplikasi Sedang Dibuka)
          PushNotifications.addListener(
            "pushNotificationReceived",
            (notification) => {
              console.log("🔔 Notifikasi Masuk:", notification);
              showInfoModal(
                notification.title || "Info",
                notification.body || "Pesan baru",
                "alarm",
              );

              // Bunyikan suara sirine di HP lewat JS (Opsional)
              if (typeof playSiren === "function") playSiren();
            },
          );

          console.log("✅ Listener Notifikasi Siap");
        } else {
          console.warn(
            "⚠️ Plugin PushNotifications tidak ditemukan (Cek npx cap sync)",
          );
        }
      } catch (e) {
        console.error("❌ Error Setup Notifikasi:", e);
      }
    }, 5000); // Akhir dari Delay 5 Detik
  },
  false,
);

// [TAMBAHKAN INI DI BAGIAN BAWAH LOGIC.JS ATAU SEBELUM unlockApp]

// Fungsi Global untuk Animasi Staggered
function applyGlobalAnimation(selector, initialDelay = 0.1) {
  const elements = document.querySelectorAll(selector);
  let count = 0;

  elements.forEach((el, index) => {
    // Reset animasi (Hapus class lalu tambahkan lagi agar restart)
    el.classList.remove("animate-blur-in");
    void el.offsetWidth; // Trigger Reflow (Reset browser paint)

    // Set delay bertingkat
    el.style.animationDelay = `${initialDelay + index * 0.1}s`; // 0.1s jeda antar elemen

    // Tambahkan kelas animasi
    el.classList.add("animate-blur-in");
    count++;
  });
}

// [FUNGSI BARU] GANTI SISI KAMERA
async function switchCameraFacing(mode = "face") {
  // Toggle Mode
  currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
  console.log("🔄 Switch Camera to:", currentFacingMode);

  if (mode === "face") {
    if (isCameraOn) {
      stopCamera();
      setTimeout(() => startCamera(), 500); // Restart dengan mode baru
    }
  } else if (mode === "hand") {
    if (isHandCameraOn) {
      stopHandCamera();
      setTimeout(() => toggleHandCamera(), 500);
    }
  } else if (mode === "bg") {
    // Kirim sinyal ke Iframe (Anim 4/5)
    const iframe = document.querySelector("#bg-container iframe");
    if (iframe) {
      iframe.contentWindow.postMessage("SWITCH_CAMERA", "*");
    }
  }
}

// --- FUNGSI UPDATE TAMPILAN SINYAL ---
function updateDeviceSignal(id, dbm, quality) {
  // [PERBAIKAN] Abaikan pembacaan glitch (dBm bernilai positif atau 0).
  // Menahan UI tetap menampilkan data terakhir sampai ESP menembak data valid.
  if (dbm >= 0 || quality === 0) {
    console.log(
      `⚠️ Mengabaikan sinyal glitch ESP${id}: ${dbm}dBm, ${quality}%`,
    );
    return;
  }

  // Update Teks
  var elDbm = document.getElementById("dbm-" + id);
  var elQual = document.getElementById("qual-" + id);
  if (elDbm) elDbm.innerText = dbm + " dBm";
  if (elQual) elQual.innerText = quality + "%";

  // Update Warna Ikon
  var elIcon = document.getElementById("signal-strength-" + id);
  if (elIcon) {
    elIcon.classList.remove(
      "text-green-500",
      "text-yellow-500",
      "text-red-500",
      "text-gray-400",
      "text-slate-700",
    );

    if (quality >= 70) elIcon.classList.add("text-green-500");
    else if (quality >= 40) elIcon.classList.add("text-yellow-500");
    else elIcon.classList.add("text-red-500");
  }
}

// --- [FIX] FUNGSI UPDATE STATUS PERANGKAT (AUTO OFFLINE) ---
function updateDeviceStatus(id, isOnline, cloudTime = null) {
  // Ambil elemen UI berdasarkan ID ESP
  const dot = document.getElementById(`status-dot-esp${id}`);
  const ssid = document.getElementById(`ssid-esp${id}`);
  const dist = document.getElementById(`dist-esp${id}`);
  const ping = document.getElementById(`ping-esp${id}`);
  const signalIcon = document.getElementById(`signal-strength-${id}`);

  // [BARU] Buat atau cari elemen Waktu Disconnect secara dinamis
  let lastSeenEl = document.getElementById(`last-seen-esp${id}`);
  if (!lastSeenEl && ssid) {
    lastSeenEl = document.createElement("div");
    lastSeenEl.id = `last-seen-esp${id}`;
    lastSeenEl.className =
      "text-[9px] text-red-400 font-mono mt-1 italic leading-tight";
    // Tempelkan elemen di bawah container SSID
    ssid.parentElement.parentElement.appendChild(lastSeenEl);
  }

  if (!isOnline) {
    // JIKA OFFLINE
    if (dot) {
      dot.style.backgroundColor = "#ef4444"; // Merah
      dot.style.boxShadow = "0 0 5px #ef4444";
    }
    if (ssid) {
      ssid.innerText = "Offline";
      ssid.className = "text-[9px] text-slate-500 font-mono"; // Jadi abu-abu
    }
    if (dist) {
      dist.innerText = "";
      dist.classList.add("hidden");
    }
    if (ping) {
      ping.innerText = "Timeout";
      ping.className = "text-[9px] text-red-400 font-mono";
    }
    if (signalIcon) {
      signalIcon.classList.remove("text-green-500", "text-yellow-500");
      signalIcon.classList.add("text-slate-700");
    }

    // [BARU] Simpan dan Tampilkan Waktu Putus Koneksi
    let disconnectTimes =
      JSON.parse(localStorage.getItem("espDisconnectTimes")) || {};

    // Jika ada waktu dari cloud, prioritaskan itu. Jika tidak, pakai waktu lokal browser.
    if (cloudTime) {
      disconnectTimes[id] = cloudTime;
      localStorage.setItem(
        "espDisconnectTimes",
        JSON.stringify(disconnectTimes),
      );
    } else if (!disconnectTimes[id]) {
      const now = new Date();
      const dateOpts = {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      };
      disconnectTimes[id] = now
        .toLocaleDateString("id-ID", dateOpts)
        .replace(/\./g, ":");
      localStorage.setItem(
        "espDisconnectTimes",
        JSON.stringify(disconnectTimes),
      );
    }

    if (lastSeenEl) {
      lastSeenEl.innerText = `Terputus: ${disconnectTimes[id]}`;
      lastSeenEl.classList.remove("hidden");
    }
  } else {
    // JIKA ONLINE
    if (dot) {
      dot.style.backgroundColor = "#22c55e"; // Hijau
      dot.style.boxShadow = "0 0 5px #22c55e";
    }

    // [BARU] Hapus data riwayat putus koneksi karena sudah kembali normal
    let disconnectTimes =
      JSON.parse(localStorage.getItem("espDisconnectTimes")) || {};
    if (disconnectTimes[id]) {
      delete disconnectTimes[id];
      localStorage.setItem(
        "espDisconnectTimes",
        JSON.stringify(disconnectTimes),
      );
    }
    if (lastSeenEl) {
      lastSeenEl.innerText = "";
      lastSeenEl.classList.add("hidden");
    }
  }
}

/* =================================================================
   TAMBAHKAN KODE INI DI BAGIAN PALING BAWAH FILE logic.js
   (Di bawah semua kode yang sudah ada)
   ================================================================= */

// --- 1. CONFIGURASI RIWAYAT NOTIFIKASI ---
// Fungsi menyimpan notifikasi ke LocalStorage
function saveNotificationToStorage(title, body, timestamp) {
  let notifications =
    JSON.parse(localStorage.getItem("appNotifications")) || [];

  // --- FIX FORMAT TANGGAL ---
  let finalTime = timestamp;
  if (!finalTime || finalTime.includes("GMT")) {
    const now = new Date();
    // Format: DD/MM/YYYY HH:MM:SS
    finalTime = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
  }

  notifications.unshift({
    title: title,
    body: body,
    time: finalTime,
  });

  // Batasi maksimal 20 notifikasi terakhir
  if (notifications.length > 20) notifications.pop();

  localStorage.setItem("appNotifications", JSON.stringify(notifications));
  updateNotifBadge();

  // 👇 SYNC KE CLOUD & TRIGGER DEVICE LAIN 👇
  if (typeof syncNotifToCloud === "function") syncNotifToCloud(notifications);

  // Kirim trigger MQTT agar device lain refresh tanpa reload web
  if (typeof mqttClient !== "undefined" && mqttClient.isConnected()) {
    const message = new Paho.MQTT.Message("SYNC_NOTIF");
    message.destinationName = "projek/belajar/perintah_kipas"; // Nebeng di topik ini
    mqttClient.send(message);
  }
}

// [TIMPA FUNGSI LAMA DENGAN INI]
function updateNotifBadge() {
  const notifications =
    JSON.parse(localStorage.getItem("appNotifications")) || [];
  const count = notifications.length;

  // Ambil jumlah yang terakhir kali user lihat/buka
  const lastSeenCount =
    parseInt(localStorage.getItem("lastSeenNotifCount")) || 0;

  // Hanya tampilkan badge jika ada notifikasi BARU (count > lastSeen)
  // Jadi kalau count 5, dan lastSeen 5, badge hidden.
  const hasNew = count > lastSeenCount;

  // 1. Update Badge di Sidebar (Desktop)
  const badge = document.getElementById("notif-badge");
  if (badge) {
    if (hasNew) {
      badge.innerText = count - lastSeenCount; // Tampilkan selisih (jumlah baru) atau '!'
      badge.innerText = "!"; // Opsional: Tanda seru lebih rapi daripada angka jika banyak
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  // 2. Update Badge di Header Mobile
  const mobileBadge = document.getElementById("mobile-notif-badge");
  if (mobileBadge) {
    if (hasNew) {
      mobileBadge.classList.remove("hidden");
    } else {
      mobileBadge.classList.add("hidden");
    }
  }
}

// === FUNGSI BUKA/TUTUP MODAL NOTIFIKASI (FIX RESPONSIVE & CENTER) ===

function openNotificationModal() {
  const modal = document.getElementById("modal-notif");
  if (modal) {
    // 1. Hapus class 'hidden' agar modal muncul di DOM
    modal.classList.remove("hidden");

    // 2. Beri delay 10ms untuk memicu animasi CSS
    setTimeout(() => {
      modal.classList.add("active");

      const innerBox = document.getElementById("notif-inner-box");
      if (innerBox) {
        // Animasi masuk: Muncul dan Membesar perlahan ke tengah (Scale Up & Fade In)
        innerBox.classList.remove("scale-95", "opacity-0");
        innerBox.classList.add("scale-100", "opacity-100");
      }
    }, 10);

    renderNotificationList();

    const notifications =
      JSON.parse(localStorage.getItem("appNotifications")) || [];
    localStorage.setItem("lastSeenNotifCount", notifications.length);

    updateNotifBadge();
  }
}

function closeNotificationModal() {
  const modal = document.getElementById("modal-notif");
  if (modal) {
    const innerBox = document.getElementById("notif-inner-box");
    if (innerBox) {
      // Animasi keluar: Mengecil perlahan dan Menghilang (Scale Down & Fade Out)
      innerBox.classList.remove("scale-100", "opacity-100");
      innerBox.classList.add("scale-95", "opacity-0");
    }

    modal.classList.remove("active");

    // Sembunyikan elemen 100% setelah durasi animasi selesai (300ms)
    setTimeout(() => {
      modal.classList.add("hidden");
    }, 300);
  }

  const url = new URL(window.location);
  if (url.searchParams.get("view") === "notifications") {
    url.searchParams.delete("view");
    window.history.replaceState({}, "", url);
  }
}

// Fungsi Render List HTML (DIPERBAIKI LAYOUT WAKTU AGAR TIDAK KELUAR KOTAK)
function renderNotificationList() {
  const listContainer = document.getElementById("notif-list");
  const notifications =
    JSON.parse(localStorage.getItem("appNotifications")) || [];

  if (notifications.length === 0) {
    if (listContainer)
      listContainer.innerHTML =
        '<div class="flex flex-col items-center justify-center py-8 opacity-50"><i class="fa-regular fa-bell-slash text-4xl mb-2 text-slate-500"></i><div class="text-xs text-slate-500">Belum ada riwayat</div></div>';
    return;
  }

  let html = "";
  notifications.forEach((notif, index) => {
    let theme = {
      color: "blue",
      icon: "fa-circle-info",
      bgIcon: "bg-blue-500/20",
      text: "text-blue-400",
      border: "bg-blue-500",
    };

    const titleLower = notif.title.toLowerCase();

    // Penentuan Warna Sesuai Judul
    if (
      titleLower.includes("bahaya") ||
      titleLower.includes("penyusup") ||
      titleLower.includes("api") ||
      titleLower.includes("error") ||
      titleLower.includes("gagal")
    ) {
      theme = {
        color: "red",
        icon: "fa-triangle-exclamation",
        bgIcon: "bg-red-500/20",
        text: "text-red-500",
        border: "bg-red-500",
      };
    } else if (
      titleLower.includes("sukses") ||
      titleLower.includes("diterima") ||
      titleLower.includes("terbuka") ||
      titleLower.includes("aman")
    ) {
      theme = {
        color: "emerald",
        icon: "fa-check",
        bgIcon: "bg-emerald-500/20",
        text: "text-emerald-400",
        border: "bg-emerald-500",
      };
    } else if (
      titleLower.includes("jadwal") ||
      titleLower.includes("otomatis") ||
      titleLower.includes("peringatan")
    ) {
      theme = {
        color: "yellow",
        icon: "fa-clock",
        bgIcon: "bg-yellow-500/20",
        text: "text-yellow-400",
        border: "bg-yellow-500",
      };
    }

    let titleHtml = "";
    if (notif.title.length > 16) {
      titleHtml = `
          <div class="w-full overflow-hidden relative h-5 text-left">
             <div class="marquee-track">
                <span class="${theme.text} font-bold text-sm uppercase whitespace-nowrap mr-8">${notif.title}</span>
                <span class="${theme.text} font-bold text-sm uppercase whitespace-nowrap mr-8">${notif.title}</span>
             </div>
          </div>
       `;
    } else {
      titleHtml = `<span class="notif-title ${theme.text} font-bold truncate pr-2 w-full block text-left">${notif.title}</span>`;
    }

    let displayTime = notif.time;
    if (displayTime && displayTime.includes("GMT")) {
      const d = new Date(displayTime);
      displayTime = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    }

    // FIX LAYOUT: Div tambahan dihapus, 'displayTime' menjadi span langsung di dalam flex-col utama
    html += `
      <div class="notif-card group hover:bg-slate-700/50 transition-colors relative flex p-3 gap-3 border-b border-slate-700 items-start">
          <div class="notif-line ${theme.border} absolute left-0 top-0 bottom-0 w-1 rounded-l"></div>
          
          <div class="notif-icon-box flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${theme.bgIcon} ${theme.text} mt-0.5">
              <i class="fa-solid ${theme.icon}"></i>
          </div>

          <div class="notif-content flex-1 min-w-0 flex flex-col justify-center"> 
              <div class="notif-header w-full overflow-hidden mb-1">
                  ${titleHtml}
              </div>
              <p class="notif-body break-words text-sm text-slate-300 leading-snug mb-1.5">${notif.body}</p> 
              <span class="text-[10px] text-slate-500 font-mono inline-flex items-center gap-1">
                  <i class="fa-regular fa-clock"></i>${displayTime}
              </span>
          </div>

          <div class="flex-shrink-0 flex items-center h-full pt-1 pl-2">
              <input type="checkbox" class="notif-checkbox w-5 h-5 text-red-500 rounded border-slate-500 bg-slate-800 focus:ring-red-500 cursor-pointer" data-index="${index}" onchange="updateDeleteText()">
          </div>
      </div>
    `;
  });

  if (listContainer) listContainer.innerHTML = html;

  // Reset centang saat dirender ulang
  const checkAllBox = document.getElementById("check-all-notif");
  if (checkAllBox) checkAllBox.checked = false;

  updateDeleteText();
}

// === LOGIKA PILIH SEMUA & TEKS HAPUS DINAMIS ===

// Fungsi untuk mencentang / menghilangkan centang semua notifikasi
function toggleAllNotif(source) {
  const checkboxes = document.querySelectorAll(".notif-checkbox");
  checkboxes.forEach((cb) => {
    cb.checked = source.checked; // Ikuti status checkbox "Pilih Semua"
  });
  updateDeleteText(); // Perbarui teks hitungan
}

// Fungsi untuk mengubah teks "Hapus Semua" menjadi "Hapus (X)"
function updateDeleteText() {
  const checkedBoxes = document.querySelectorAll(".notif-checkbox:checked");
  const allBoxes = document.querySelectorAll(".notif-checkbox");
  const textHapusBtn = document.getElementById("text-hapus-notif");

  if (textHapusBtn) {
    if (checkedBoxes.length > 0) {
      textHapusBtn.innerText = `Hapus (${checkedBoxes.length})`;
    } else {
      textHapusBtn.innerText = "Hapus Semua";
    }
  }

  // Sinkronkan balik status checkbox "Pilih Semua" jika user mencentang satu per satu secara manual
  const checkAllBox = document.getElementById("check-all-notif");
  if (checkAllBox && allBoxes.length > 0) {
    // Jika semua tercentang, otomatis check "Pilih Semua". Jika tidak, uncheck.
    checkAllBox.checked = checkedBoxes.length === allBoxes.length;
  }
}

// Fungsi Hapus Notifikasi (Mendukung Penghapusan Terpilih & Sinkronisasi Lintas Device)
function clearNotifications() {
  let notifications =
    JSON.parse(localStorage.getItem("appNotifications")) || [];

  if (notifications.length === 0) {
    showInfoModal("Info", "Riwayat notifikasi sudah kosong.", "info");
    setTimeout(() => closeInfoModal(), 5000);
    return;
  }

  // Cek apakah ada checkbox yang dicentang
  const checkedBoxes = document.querySelectorAll(".notif-checkbox:checked");

  // LOGIKA 1: JIKA ADA NOTIFIKASI YANG DIPILIH (CHECKBOX DICENTANG)
  if (checkedBoxes.length > 0) {
    closeNotificationModal(); // Tutup tumpukan modal

    showConfirmationModal(
      "Hapus Pilihan?",
      `Anda yakin ingin menghapus ${checkedBoxes.length} notifikasi yang dipilih dari semua perangkat?`,
      function () {
        // Dapatkan index notifikasi yang dicentang
        let indicesToRemove = Array.from(checkedBoxes).map((cb) =>
          parseInt(cb.getAttribute("data-index")),
        );

        // Filter out (buang) notifikasi yang index-nya termasuk dalam daftar hapus
        notifications = notifications.filter(
          (_, index) => !indicesToRemove.includes(index),
        );

        // Simpan, Perbarui UI, dan Sinkronisasi
        localStorage.setItem("appNotifications", JSON.stringify(notifications));
        renderNotificationList();
        updateNotifBadge();

        if (typeof syncNotifToCloud === "function")
          syncNotifToCloud(notifications);
        if (typeof mqttClient !== "undefined" && mqttClient.isConnected()) {
          const message = new Paho.MQTT.Message("SYNC_NOTIF");
          message.destinationName = "projek/belajar/perintah_kipas";
          mqttClient.send(message);
        }

        setTimeout(() => {
          showInfoModal(
            "Terhapus",
            `${checkedBoxes.length} notifikasi pilihan berhasil dihapus.`,
            "success",
          );
        }, 300);
      },
    );
  }
  // LOGIKA 2: JIKA TIDAK ADA YANG DIPILIH (HAPUS SEMUA SEPERTI BIASA)
  else {
    closeNotificationModal();

    showConfirmationModal(
      "Hapus Semua Riwayat?",
      "Anda tidak memilih notifikasi spesifik. Semua riwayat notifikasi akan dihapus permanen dari semua perangkat.",
      function () {
        // Kosongkan array
        localStorage.removeItem("appNotifications");
        localStorage.setItem("lastSeenNotifCount", "0");
        renderNotificationList();
        updateNotifBadge();

        // Sinkronisasi dengan array kosong
        if (typeof syncNotifToCloud === "function") syncNotifToCloud([]);
        if (typeof mqttClient !== "undefined" && mqttClient.isConnected()) {
          const message = new Paho.MQTT.Message("SYNC_NOTIF");
          message.destinationName = "projek/belajar/perintah_kipas";
          mqttClient.send(message);
        }

        setTimeout(() => {
          showInfoModal(
            "Terhapus",
            "Seluruh riwayat notifikasi telah dibersihkan.",
            "success",
          );
        }, 300);
      },
    );
  }
}

// --- 2. LISTENER PESAN MASUK (FOREGROUND / SAAT APLIKASI AKTIF) ---

if (typeof firebase !== "undefined" && firebase.messaging.isSupported()) {
  const messaging = firebase.messaging();

  messaging.onMessage((payload) => {
    console.log("🔔 NOTIFIKASI DITERIMA (APP AKTIF):", payload);

    const title = payload.notification?.title || payload.data?.title || "Info";
    const body =
      payload.notification?.body || payload.data?.body || "Pesan baru";
    const tag = payload.data?.tag; // Ambil tag (azan/imsak) dari data payload
    const timestamp = new Date()
      .toLocaleString("id-ID", {
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(/\./g, ":");

    // 1. [MODIFIKASI DISINI] Mainkan Suara Spesifik atau Default
    let audioToPlay;

    if (tag === "azan") {
      audioToPlay = document.getElementById("azan-audio");
    } else if (tag === "imsak") {
      audioToPlay = document.getElementById("imsak-audio");
    } else {
      audioToPlay = document.getElementById("notificationSound");
    }

    if (audioToPlay) {
      // Cek memori apakah user mematikan suara
      const isSuaraOn = localStorage.getItem("suaraAzanState") !== "OFF";

      if (isSuaraOn) {
        audioToPlay.currentTime = 0;
        audioToPlay.play().catch((e) => console.log("Gagal memutar suara:", e));
      } else {
        console.log(
          "🔕 Notifikasi masuk, tapi suara Azan/Imsak dimatikan di Pengaturan.",
        );
      }
    }

    // 2. Tampilkan Popup (LOGIKA LAMA TETAP ADA)
    showInfoModal(title, body, "info");

    // Tembak ke Android Native
    if (
      typeof AndroidApp !== "undefined" &&
      AndroidApp.showSystemNotification
    ) {
      AndroidApp.showSystemNotification(title, body);
    }

    // 3. [PENTING] SIMPAN KE RIWAYAT (LocalStorage)
    saveNotificationToStorage(title, body, timestamp);

    // 4. Update Badge Icon Lonceng
    updateNotifBadge();

    // 5. Refresh List jika modal sedang terbuka
    const modal = document.getElementById("modal-notif");
    if (modal && modal.classList.contains("active")) {
      renderNotificationList();
    }
  });
} else {
  console.warn("Firebase Messaging tidak didukung atau belum dimuat.");
}

// --- 3. EXPORT KE WINDOW & CEK URL SAAT LOAD ---

// Agar fungsi bisa dipanggil dari onclick di HTML
window.openNotificationModal = openNotificationModal;
window.closeNotificationModal = closeNotificationModal;
window.clearNotifications = clearNotifications;

// ============================================================
// LOGIKA AUTO-OPEN NOTIFIKASI (DARI KLIK STATUS BAR)
// ============================================================
function checkAndOpenNotificationModal() {
  const urlParams = new URLSearchParams(window.location.search);

  // Cek apakah ada parameter ?view=notifications
  if (urlParams.get("view") === "notifications") {
    console.log("🔔 Membuka Modal Notifikasi dari URL...");

    // 1. Buka Modal (Beri delay sedikit agar animasi loading selesai dulu)
    setTimeout(() => {
      // Pastikan fungsi openNotificationModal ada & bisa dipanggil
      if (typeof openNotificationModal === "function") {
        openNotificationModal();
      } else {
        // Fallback manual jika fungsi belum siap
        const modal = document.getElementById("modal-notif");
        if (modal) modal.classList.add("active");
      }
    }, 1000); // Delay 1 detik

    // 2. BERSIHKAN URL (PENTING!)
    // Agar saat user refresh halaman, modal tidak muncul lagi
    const newUrl =
      window.location.protocol +
      "//" +
      window.location.host +
      window.location.pathname;
    window.history.replaceState({ path: newUrl }, "", newUrl);
  }
}

// ==========================================================
// [BARU] LOGIKA KONEKSI ULANG OTOMATIS SAAT APP DIBUKA KEMBALI
// ==========================================================

// 1. Deteksi untuk Web Browser & PWA (Pindah Tab / Balik dari Minimize)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    console.log("📱 PWA kembali ke layar utama. Mengecek koneksi MQTT...");

    if (typeof mqttClient !== "undefined" && !mqttClient.isConnected()) {
      console.log(
        "🔌 MQTT terdeteksi putus di background! Menghubungkan ulang...",
      );
      updateStatus(false, "Menghubungkan...");
      connectMQTT();
    }
  }
});

// Deteksi saat pengguna kembali menyentuh/masuk ke layar PWA dari recent apps
window.addEventListener("focus", () => {
  console.log("📱 PWA difokuskan kembali (Resume). Mengecek koneksi MQTT...");
  if (typeof mqttClient !== "undefined" && !mqttClient.isConnected()) {
    console.log(
      "🔌 MQTT terdeteksi putus saat difokuskan! Menghubungkan ulang...",
    );
    updateStatus(false, "Menghubungkan...");
    connectMQTT();
  }
});

// Deteksi saat halaman dipulihkan dari cache memori HP (bfcache)
window.addEventListener("pageshow", (e) => {
  if (
    e.persisted &&
    typeof mqttClient !== "undefined" &&
    !mqttClient.isConnected()
  ) {
    console.log("📱 PWA dipulihkan dari memori. Mengecek koneksi MQTT...");
    updateStatus(false, "Menghubungkan...");
    connectMQTT();
  }
});

// 2. Deteksi khusus untuk format APK Native (Capacitor)
if (typeof App !== "undefined" && App) {
  App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) {
      console.log("📱 APK Capacitor kembali aktif.");
      if (typeof mqttClient !== "undefined" && !mqttClient.isConnected()) {
        console.log("🔌 MQTT terputus! Menghubungkan ulang...");
        updateStatus(false, "Menghubungkan...");
        connectMQTT();
      }
    }
  });
}

// ==========================================
// [BARU] JADWAL SHOLAT PRESISI (KOORDINAT)
// ==========================================
let jadwalSholatHariIni = {};

// --- UPDATE: Load Saved Jadwal dengan Pengecekan Tanggal ---
function loadSavedJadwal() {
  const saved = localStorage.getItem("myJadwalSholat");
  const lastUpdateDate = localStorage.getItem("lastJadwalDate"); // Cek tanggal simpanan

  // Buat string tanggal hari ini (Format: DD-MM-YYYY)
  const now = new Date();
  const todayStr = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;

  // 1. Jika Tanggal BEDA dengan Hari Ini, paksa update dari Internet (Auto Refresh)
  if (lastUpdateDate !== todayStr) {
    // Cek Switch Dulu
    const isAutoOn = localStorage.getItem("autoUpdateJadwalState") === "ON";

    if (isAutoOn) {
      console.log("📅 Hari berganti & Auto ON, memperbarui jadwal sholat...");
      const savedLat = parseFloat(localStorage.getItem("savedLat"));
      const savedLon = parseFloat(localStorage.getItem("savedLon"));
      const savedLocName = localStorage.getItem("myLokasiDetailMain");

      if (!isNaN(savedLat)) {
        prosesAmbilJadwal(savedLat, savedLon, savedLocName);
      }
    } else {
      console.log(
        "📅 Hari berganti tapi Auto Update OFF. Mempertahankan jadwal lama.",
      );
    }
  }
  // 2. Jika Tanggal SAMA, load dari LocalStorage
  else if (saved) {
    jadwalSholatHariIni = JSON.parse(saved);
    updateFormInputs(jadwalSholatHariIni);
  }

  // Load tampilan lokasi (kode lama)
  const savedMain = localStorage.getItem("myLokasiDetailMain");
  const savedSub = localStorage.getItem("myLokasiDetailSub");
  const savedLocOld = localStorage.getItem("myLokasiDetail");

  if (savedMain || savedLocOld) {
    document.getElementById("lokasi-detail-box").classList.remove("hidden");
    document.getElementById("jadwal-loc-main").innerText =
      savedMain || savedLocOld;
    document.getElementById("jadwal-loc-sub").innerText =
      savedSub || "Lokasi Tersimpan";
  }

  // --- TAMBAHAN: Load Info Update ---
  const lastUpdateStr = localStorage.getItem("prayerUpdateStr");
  const infoEl = document.getElementById("prayer-update-info");
  if (infoEl) {
    if (lastUpdateStr) {
      infoEl.innerText = lastUpdateStr;
      infoEl.classList.add("text-emerald-500"); // Beri warna hijau dikit
    } else {
      infoEl.innerText = "Belum ada riwayat pembaruan.";
    }
  }
  loadJadwalToggles();
}

// ==========================================
// [PERBAIKAN] GPS DENGAN API BIGDATACLOUD (ANTI-ERROR)
// ==========================================
function cariJadwalLokasiTerkini() {
  // Matikan suara (Silent Mode)
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();

  if (!navigator.geolocation) {
    return showInfoModal(
      "Error",
      "Browser tidak mendukung GPS.",
      "error",
      false,
    );
  }

  setAppStatus("Mendeteksi Lokasi...", "loading");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      try {
        // GANTI API ke BigDataCloud (Gratis & Mendukung CORS)
        // Ini mengubah Koordinat -> Nama Desa/Kota
        const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=id`;

        const res = await fetch(url);
        const data = await res.json();

        // Ambil nama lokasi yang relevan
        // locality = Desa/Kecamatan, city = Kab/Kota, principalSubdivision = Provinsi
        const desa = data.locality || "";
        const kota = data.city || "";
        const prov = data.principalSubdivision || "";

        const locationName = `${desa}, ${kota}, ${prov}`; // Format Nama

        // Lanjut ke proses ambil jadwal
        prosesAmbilJadwal(lat, lon, locationName);
      } catch (e) {
        console.error("Gagal Reverse Geo:", e);
        // Jika gagal cari nama, tetap lanjut cari jadwal pakai koordinat saja
        prosesAmbilJadwal(lat, lon, "Lokasi GPS (Nama tidak terdeteksi)");
      }
    },
    (error) => {
      console.error("GPS Error:", error);
      let msg = "Gagal mengambil lokasi GPS.";
      if (error.code === 1)
        msg = "Izin lokasi ditolak. Mohon izinkan akses lokasi di browser.";

      showInfoModal("GPS Gagal", msg, "error", false); // false = Tanpa Suara
      setAppStatus("GPS Gagal", "error");
    },
    {
      enableHighAccuracy: true, // Paksa akurasi tinggi
      timeout: 10000, // Batas waktu 10 detik
      maximumAge: 0,
    },
  );
}
// 2. Fungsi Tombol Cari Manual (Update agar Silent)
async function cariLokasiDanJadwal() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel(); // Stop suara lama

  const query = document.getElementById("location-input").value.trim();
  if (!query)
    return showInfoModal(
      "Input Kosong",
      "Masukkan nama Desa/Kecamatan!",
      "error",
      false,
    );

  setAppStatus("Mencari...", "loading");

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=id&format=json`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) throw new Error("Koneksi server gangguan");
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      setAppStatus("404", "error");
      return showInfoModal(
        "Tidak Ditemukan",
        "Lokasi tidak ditemukan.",
        "error",
        false,
      );
    }

    const lokasi = geoData.results[0];
    const displayName = `${lokasi.name}, ${lokasi.admin1 || ""}`;

    // Lanjut ke proses ambil jadwal
    prosesAmbilJadwal(lokasi.latitude, lokasi.longitude, displayName);
  } catch (e) {
    showInfoModal("Error", "Gagal mencari lokasi.", "error", false);
  }
}

let currentHijriMonth = 0; // 9 = Ramadhan
// UPDATE: Logic Pengambilan Jadwal dengan Address yang Akurat (Sama seperti Cuaca)
async function prosesAmbilJadwal(lat, lon, locationNameFallback) {
  // 1. Tampilkan Box Lokasi
  const detailBox = document.getElementById("lokasi-detail-box");
  if (detailBox) {
    detailBox.classList.remove("hidden");
    // Reset Text Loading
    document.getElementById("jadwal-loc-main").innerText =
      "Menganalisa Area...";
    document.getElementById("jadwal-loc-sub").innerText =
      "Mohon tunggu sebentar...";
    document.getElementById("detail-coords").innerText =
      `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
  }

  // 2. Ambil Detail Alamat yang Presisi (Reuse fungsi getPreciseAddress dari Weather)
  try {
    // Kita panggil fungsi getPreciseAddress yang sudah ada di logic.js (bagian cuaca)
    const addr = await getPreciseAddress(lat, lon);

    // Update UI dengan Format Ala Cuaca
    document.getElementById("jadwal-loc-main").innerText = addr.main; // Contoh: Gondangrejo
    document.getElementById("jadwal-loc-sub").innerText = addr.sub; // Contoh: Karanganyar, Jawa Tengah, Indonesia

    // Simpan nama yang cantik ini ke LocalStorage
    localStorage.setItem("myLokasiDetailMain", addr.main);
    localStorage.setItem("myLokasiDetailSub", addr.sub);
  } catch (e) {
    console.warn("Gagal getPreciseAddress, fallback ke nama dasar", e);
    document.getElementById("jadwal-loc-main").innerText =
      locationNameFallback || "Lokasi Terpilih";
    document.getElementById("jadwal-loc-sub").innerText = "Area Koordinat GPS";
  }

  // 3. Ambil Jadwal Sholat dari API
  setAppStatus("Sinkronisasi Jadwal...", "loading");
  try {
    const today = new Date();
    const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;

    // Gunakan endpoint yang memberikan data Hijriah lengkap
    const res = await fetch(
      `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lon}&method=20`,
    );
    const data = await res.json();

    if (data.code === 200) {
      // 1. SIMPAN BULAN HIJRIAH (PENTING UNTUK IMSAK)
      const hijriMonth = data.data.date.hijri.month.number; // 9 = Ramadhan
      localStorage.setItem("hijriMonth", hijriMonth);
      console.log("📅 Bulan Hijriah saat ini: " + hijriMonth);
      const t = data.data.timings;

      // Fungsi kecil untuk menambah menit pada string jam (HH:mm)
      const tambahMenit = (jamStr, menitTambahan) => {
        if (!jamStr) return "";
        const [h, m] = jamStr.split(":").map(Number);
        const dateObj = new Date();
        dateObj.setHours(h, m + menitTambahan, 0, 0);
        return (
          dateObj.getHours().toString().padStart(2, "0") +
          ":" +
          dateObj.getMinutes().toString().padStart(2, "0")
        );
      };

      // Fungsi kecil untuk update hanya jika dicentang dan tambah 3 menit
      const updateIfChecked = (idInput, idCheck, apiValue) => {
        const chk = document.getElementById(idCheck);
        const inp = document.getElementById(idInput);
        if (chk && chk.checked) {
          const valueWithOffset = tambahMenit(apiValue, 3); // Tambah 3 menit
          inp.value = valueWithOffset;
          return valueWithOffset;
        }
        return inp.value; // Kembalikan nilai lama (manual)
      };

      // Ambil nilai (Entah dari API atau Manual user yang dipertahankan)
      const valImsak = updateIfChecked(
        "input-imsak",
        "chk-auto-imsak",
        t.Imsak,
      );
      const valSubuh = updateIfChecked("input-subuh", "chk-auto-subuh", t.Fajr);
      const valDzuhur = updateIfChecked(
        "input-dzuhur",
        "chk-auto-dzuhur",
        t.Dhuhr,
      );
      const valAshar = updateIfChecked("input-ashar", "chk-auto-ashar", t.Asr);
      const valMaghrib = updateIfChecked(
        "input-maghrib",
        "chk-auto-maghrib",
        t.Maghrib,
      );
      // PERBAIKAN BUG: Gunakan t.Isha (bukan t.Maghrib)
      const valIsya = updateIfChecked("input-isya", "chk-auto-isya", t.Isha);

      // --- SIMPAN DATA CAMPURAN (AUTO + MANUAL) ---
      const dataYangDisimpan = {
        Sahur: document.getElementById("input-sahur")
          ? document.getElementById("input-sahur").value
          : "03:00", // [TAMBAHKAN INI]
        Imsak: valImsak,
        Subuh: valSubuh,
        Dzuhur: valDzuhur,
        Ashar: valAshar,
        Maghrib: valMaghrib,
        Isya: valIsya,
      };
      // Kita gunakan key "myJadwalSholat" karena itulah key yang dibaca
      // oleh fungsi loadSavedJadwal() di baris 1922 kodemu.
      localStorage.setItem("myJadwalSholat", JSON.stringify(dataYangDisimpan));
      // --- INTEGRASI SINKRONISASI ---
      publishScheduleToCloud(dataYangDisimpan);
      kirimJadwalKeESP(dataYangDisimpan);
      const cacheData = {
        tanggal: new Date().toDateString(), // Simpan tanggal hari ini (Format: Fri Jan 30 2026)
        jadwal: dataYangDisimpan, // Gunakan variabel dataYangDisimpan yang sudah ada di situ
      };
      localStorage.setItem("jadwalSholatCache", JSON.stringify(cacheData));

      // Update variabel global agar alarm langsung jalan tanpa reload
      jadwalSholatHariIni = dataYangDisimpan;
      localStorage.setItem("lastJadwalDate", dateStr);
      localStorage.setItem("savedLat", lat);
      localStorage.setItem("savedLon", lon);

      setAppStatus("Selesai", "success");
      updatePrayerTimestamp();

      showInfoModal(
        "Berhasil",
        "Jadwal & Info Ramadhan diperbarui!",
        "success",
        false,
      );
      setTimeout(() => {
        closeInfoModal();
      }, 5000);
    }
  } catch (e) {
    console.error(e);
    showInfoModal("Error", "Gagal mengunduh jadwal sholat.", "error", false);
  }
}

function updateFormInputs(t) {
  document.getElementById("input-sahur").value = t.Sahur || "03:00"; // [TAMBAHKAN INI]
  document.getElementById("input-imsak").value = t.Imsak || ""; // [BARU]
  document.getElementById("input-subuh").value = t.Subuh || t.Fajr || "";
  document.getElementById("input-dzuhur").value = t.Dzuhur || "";
  document.getElementById("input-ashar").value = t.Ashar || "";
  document.getElementById("input-maghrib").value = t.Maghrib || "";
  document.getElementById("input-isya").value = t.Isya || "";
}

function simpanJadwalManual() {
  const data = {
    Sahur: document.getElementById("input-sahur")
      ? document.getElementById("input-sahur").value
      : "03:00", // <-- [TAMBAHKAN BARIS INI]
    Imsak: document.getElementById("input-imsak").value, // [BARU]
    Subuh: document.getElementById("input-subuh").value,
    Dzuhur: document.getElementById("input-dzuhur").value,
    Ashar: document.getElementById("input-ashar").value,
    Maghrib: document.getElementById("input-maghrib").value,
    Isya: document.getElementById("input-isya").value,
  };

  if (!data.Subuh)
    return showInfoModal("Gagal", "Waktu sholat tidak boleh kosong", "error");

  jadwalSholatHariIni = data;
  localStorage.setItem("myJadwalSholat", JSON.stringify(data));
  // --- INTEGRASI SINKRONISASI ---
  publishScheduleToCloud(data);
  kirimJadwalKeESP(data);
  updatePrayerTimestamp();

  showInfoModal("Tersimpan", "Jadwal dikirim ke Alat", "success");
  setTimeout(() => {
    closeInfoModal();
  }, 5000);
  sinkronkanAlarmKeNative();
}

function kirimJadwalKeESP(jadwal) {
  if (!mqttClient.isConnected()) return;

  // Kirim Data Jadwal ke ESP Penyimpan (ESP3)
  const message = new Paho.MQTT.Message(JSON.stringify(jadwal));
  message.destinationName = "projek/belajar/jadwal_sholat";
  message.retained = true;
  mqttClient.send(message);
  console.log("📤 Jadwal dikirim ke MQTT");
}

// Tombol Reset (Memunculkan Modal Konfirmasi dengan Pengecekan)
function resetJadwalSholat() {
  // 1. CEK DATA KOSONG
  const savedData = localStorage.getItem("myJadwalSholat");

  if (!savedData) {
    showInfoModal("Info", "Jadwal sholat sudah kosong.", "info");
    // Auto tutup info modal setelah 2 detik
    setTimeout(() => {
      closeInfoModal();
    }, 5000);
    return; // Berhenti di sini, jangan lanjut ke modal hapus
  }

  // 2. JIKA DATA ADA, LANJUT TAMPILKAN KONFIRMASI
  const mTitle = document.getElementById("modal-title");
  const mMsg = document.getElementById("modal-msg");
  const mIcon = document.getElementById("modal-icon");
  const mBg = document.getElementById("modal-icon-bg");
  const mButtons = document.getElementById("modal-buttons");

  mTitle.innerText = "Hapus Jadwal?";
  mMsg.innerHTML =
    "Apakah Anda yakin ingin menghapus data jadwal sholat?<br><span class='text-xs text-red-400'>Data di alat juga akan direset.</span>";

  mIcon.className = "fa-solid fa-trash-can text-white text-2xl";
  mBg.className =
    "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-600 shadow-lg shadow-red-900/50";

  mButtons.innerHTML = `
    <button onclick="closeModalAndReset()" class="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-bold hover:bg-slate-600 transition">
        Batal
    </button>
    <button onclick="execResetJadwalSholat()" class="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition shadow-lg shadow-red-900/40">
        Ya, Hapus
    </button>
  `;

  document.getElementById("global-modal").classList.add("active");
}

// Fungsi Eksekusi Penghapusan (Dipanggil dari tombol "Ya, Hapus")
function execResetJadwalSholat() {
  // 1. Hapus dari Local Storage
  localStorage.removeItem("myJadwalSholat");
  localStorage.removeItem("myLokasiDetail");

  // 2. Reset UI
  document.getElementById("lokasi-detail-box").classList.add("hidden");
  updateFormInputs({
    Subuh: "",
    Dzuhur: "",
    Ashar: "",
    Maghrib: "",
    Isya: "",
  });

  // 3. Reset di Alat (Kirim MQTT)
  kirimJadwalKeESP({
    Subuh: "--:--",
    Dzuhur: "--:--",
    Ashar: "--:--",
    Maghrib: "--:--",
    Isya: "--:--",
  });

  // 4. Tutup Modal & Beri Info Sukses
  closeModalAndReset();

  setTimeout(() => {
    showInfoModal("Terhapus", "Jadwal sholat berhasil direset.", "success");
    closeInfoModal();
  }, 5000); // Delay sedikit agar transisi modal mulus
}

// ==========================================
// FUNGSI MENUTUP MODAL (Solusi Error ReferenceError)
// ==========================================
function closeInfoModal() {
  const modal = document.getElementById("info-modal");

  if (modal) {
    // Sembunyikan Modal
    modal.classList.add("hidden");
    modal.classList.remove("flex");

    // Matikan suara (Voice) jika user menutup paksa
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }
}

// Opsional: Tutup modal jika user klik di area gelap (luar kotak)
window.onclick = function (event) {
  const modal = document.getElementById("info-modal");
  if (event.target == modal) {
    closeInfoModal();
  }
};

// Tambahkan variabel global penanda di luar interval
let jadwalSudahTrigger = {};

setInterval(() => {
  if (!jadwalSholatHariIni || Object.keys(jadwalSholatHariIni).length === 0)
    return;

  const now = new Date();
  const jam = now.getHours().toString().padStart(2, "0");
  const menit = now.getMinutes().toString().padStart(2, "0");
  const waktuSekarang = `${jam}:${menit}`;

  if (currentHijriMonth === 0) {
    currentHijriMonth = parseInt(localStorage.getItem("hijriMonth") || "0");
  }

  for (const [namaSholat, waktuJadwal] of Object.entries(jadwalSholatHariIni)) {
    // HAPUS syarat detik === 0, cukup samakan HH:MM
    if (waktuJadwal === waktuSekarang) {
      // Pastikan hanya tereksekusi 1x dalam menit tersebut
      if (jadwalSudahTrigger[namaSholat] !== waktuSekarang) {
        jadwalSudahTrigger[namaSholat] = waktuSekarang; // Tandai sudah trigger

        // --- LOGIKA KHUSUS SAHUR ---
        if (namaSholat === "Sahur") {
          const isSahurOn = document.getElementById("chk-auto-sahur")
            ? document.getElementById("chk-auto-sahur").checked
            : true;
          if (currentHijriMonth === 9 && isSahurOn) {
            if (typeof mqttClient !== "undefined" && mqttClient.isConnected()) {
              const message = new Paho.MQTT.Message("ALARM_SAHUR");
              message.destinationName = "projek/belajar/azan_trigger";
              mqttClient.send(message);
            }
            showInfoModal(
              "Sahur",
              "Waktu Sahur Telah Tiba! Segera bersiap.",
              "info",
              false,
            );
          }
        }
        // --- LOGIKA KHUSUS IMSAK ---
        else if (namaSholat === "Imsak") {
          if (currentHijriMonth === 9) {
            const audioImsak = document.getElementById("imsak-audio");
            if (
              audioImsak &&
              localStorage.getItem("suaraAzanState") !== "OFF"
            ) {
              audioImsak.currentTime = 0;
              audioImsak.play().catch((e) => console.log(e));
            }
            if (typeof mqttClient !== "undefined" && mqttClient.isConnected()) {
              const message = new Paho.MQTT.Message("IMSAK");
              message.destinationName = "projek/belajar/azan_trigger";
              mqttClient.send(message);
            }
            showInfoModal(
              "Imsak",
              "Waktu Imsak Telah Tiba (Ramadhan)",
              "info",
              false,
            );
          }
        }
        // --- LOGIKA AZAN LAINNYA ---
        else {
          putarAudioAzan();
          if (typeof mqttClient !== "undefined" && mqttClient.isConnected()) {
            const message = new Paho.MQTT.Message("ON");
            message.destinationName = "projek/belajar/azan_trigger";
            mqttClient.send(message);
          }
          const pesanSpesifik = `Waktu ${namaSholat} Telah Tiba`;
          showInfoModal(
            "Waktu Sholat",
            pesanSpesifik + ` (${waktuJadwal})`,
            "info",
            false,
          );
          saveNotificationToStorage(
            "Waktu Sholat",
            pesanSpesifik,
            new Date()
              .toLocaleString("id-ID", {
                weekday: "long",
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
              .replace(/\./g, ":"),
          );
        }
      }
    }
  }
}, 1000);

// Fungsi Helper: Putar Audio Web
function putarAudioAzan() {
  if (localStorage.getItem("suaraAzanState") === "OFF") return;
  const audio = document.getElementById("azan-audio");
  if (audio) {
    audio.currentTime = 0; // Mulai dari awal
    audio
      .play()
      .catch((e) =>
        console.log("Gagal autoplay audio (perlu interaksi user):", e),
      );
  }
}

// ==========================================
// FUNGSI TEXT-TO-SPEECH (HILANG/BELUM ADA)
// ==========================================
function speakText(text) {
  // Cek apakah browser mendukung suara
  if ("speechSynthesis" in window) {
    // Hentikan suara sebelumnya (jika ada)
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "id-ID"; // Bahasa Indonesia
    utterance.rate = 1.0; // Kecepatan Bicara (0.1 - 10)
    utterance.pitch = 1.0; // Nada Suara

    // Bicara
    window.speechSynthesis.speak(utterance);
  } else {
    console.warn("Browser ini tidak mendukung Text-to-Speech.");
  }
}

// [TAMBAHKAN FUNGSI BARU INI]
function updatePrayerTimestamp() {
  const now = new Date();
  const options = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  const timeStr =
    "Terupdate: " + now.toLocaleDateString("id-ID", options) + " WIB";

  // 1. Simpan Lokal
  localStorage.setItem("prayerUpdateStr", timeStr);

  // 2. Update UI Lokal
  const infoEl = document.getElementById("prayer-update-info");
  if (infoEl) {
    infoEl.innerText = timeStr;
    infoEl.classList.add("text-emerald-500");
  }

  // 3. KIRIM KE MQTT (Agar device lain update)
  if (typeof mqttClient !== "undefined" && mqttClient.isConnected()) {
    const message = new Paho.MQTT.Message(timeStr);
    message.destinationName = mqtt_topic_jadwal_info;
    message.retained = true; // Penting agar tersimpan
    mqttClient.send(message);
    console.log("📤 Info Update dikirim ke Cloud");
  }
}

// --- 1. MENANGKAP NOTIFIKASI BACKGROUND & SIMPAN KE HISTORY ---
const notifChannel = new BroadcastChannel("notification_channel");
notifChannel.onmessage = (event) => {
  if (event.data && event.data.action === "save_history") {
    console.log("📥 Menyimpan notifikasi background ke riwayat...");

    // Ambil riwayat lama
    let history = JSON.parse(localStorage.getItem("notifHistory")) || [];

    // Tambah notifikasi baru di paling atas
    history.unshift({
      title: event.data.title,
      body: event.data.body,
      date: event.data.time,
      read: false,
    });

    // Simpan & Update Badge
    localStorage.setItem("notifHistory", JSON.stringify(history));
    if (typeof updateNotifBadge === "function") updateNotifBadge();
  }
};

// --- 2. JADWAL SHOLAT OTOMATIS (CEK SETIAP BUKA APLIKASI) ---
function cekUpdateJadwalHarian() {
  const lastUpdate = localStorage.getItem("lastJadwalUpdate");
  const today = new Date().toISOString().split("T")[0]; // Format YYYY-MM-DD

  // Cek tanggal DAN cek apakah Auto Update dinyalakan user
  if (lastUpdate !== today) {
    console.log("📅 Hari baru! Mencoba sinkronisasi jadwal terpilih...");
    cariJadwalLokasiTerkini(); // Ini akan memanggil prosesAmbilJadwal
    localStorage.setItem("lastJadwalUpdate", today);
  } else {
    // Jika hari masih sama, muat dari cache
    const savedJadwal = localStorage.getItem("jadwalSholatData");
    if (savedJadwal && typeof updateJadwalUI === "function") {
      updateJadwalUI(JSON.parse(savedJadwal));
    }
  }
}

// Panggil cek update saat halaman dimuat
window.addEventListener("load", cekUpdateJadwalHarian);

// --- 2. JADWAL SHOLAT OTOMATIS & PERSISTEN (DIPERBAIKI) ---
function initJadwalSholat() {
  const tanggalHariIni = new Date().toDateString(); // Contoh: "Fri Feb 17 2026"

  // Cek apakah ada data tersimpan
  const storedData = localStorage.getItem("jadwalSholatCache");

  if (storedData) {
    const parsedData = JSON.parse(storedData);

    // LOGIKA PENTING: Bandingkan tanggal simpan dengan tanggal hari ini
    if (parsedData.tanggal === tanggalHariIni) {
      console.log("📅 Menggunakan jadwal tersimpan (Cache Valid).");
      updateJadwalUI(parsedData.jadwal); // Render ke layar langsung
      return; // BERHENTI DI SINI
    }
  }

  // --- [PERBAIKAN BUG] ---
  // Jika tanggal beda (ganti hari) ATAU data kosong,
  // CEK DULU apakah user mengizinkan Auto Update?
  const isAutoOn = localStorage.getItem("autoUpdateJadwalState") === "ON";

  if (isAutoOn) {
    console.log(
      "🔄 Tanggal berubah & Auto Update ON. Mengambil jadwal baru...",
    );
    cariJadwalLokasiTerkini();
  } else {
    console.log(
      "⏸️ Tanggal berubah tapi Auto Update OFF. Menunggu update manual.",
    );

    // Opsional: Tetap load tampilan lama agar tidak kosong, tapi beri notifikasi visual
    if (storedData) {
      const oldData = JSON.parse(storedData);
      updateJadwalUI(oldData.jadwal);
      showInfoModal(
        "Info Jadwal",
        "Hari berganti. Silakan update jadwal manual.",
        "info",
      );
    }
  }
}

// Panggil inisialisasi saat start
document.addEventListener("DOMContentLoaded", initJadwalSholat);

// --- TAMBAHKAN FUNGSI INI DI BAGIAN BAWAH FILE logic.js ---
function updateJadwalUI(jadwal) {
  if (!jadwal) return;

  // Masukkan data ke input form sesuai ID di HTML Anda
  if (document.getElementById("input-sahur"))
    // <-- [TAMBAHKAN BARIS INI]
    document.getElementById("input-sahur").value = jadwal.Sahur || "03:00";
  if (document.getElementById("input-imsak"))
    document.getElementById("input-imsak").value = jadwal.Imsak;
  if (document.getElementById("input-subuh"))
    document.getElementById("input-subuh").value = jadwal.Subuh;
  if (document.getElementById("input-dzuhur"))
    document.getElementById("input-dzuhur").value = jadwal.Dzuhur;
  if (document.getElementById("input-ashar"))
    document.getElementById("input-ashar").value = jadwal.Ashar;
  if (document.getElementById("input-maghrib"))
    document.getElementById("input-maghrib").value = jadwal.Maghrib;
  if (document.getElementById("input-isya"))
    document.getElementById("input-isya").value = jadwal.Isya;

  console.log("✅ UI Jadwal diperbarui dari Cache.");

  // Update variabel global jika diperlukan untuk alarm
  if (typeof jadwalSholatHariIni !== "undefined") {
    jadwalSholatHariIni = jadwal;
  }
  sinkronkanAlarmKeNative();
}

// ============================================================
// [PERBAIKAN] SINKRONISASI NOTIFIKASI BACKGROUND (Letakkan di logic.js)
// ============================================================

// 1. Fungsi Sinkronisasi dari SW (IndexedDB) ke App (LocalStorage)
function syncBackgroundNotifications() {
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

    // Ambil semua data yang disimpan SW saat aplikasi mati
    const getAllReq = store.getAll();

    getAllReq.onsuccess = () => {
      const bgNotifications = getAllReq.result;

      if (bgNotifications && bgNotifications.length > 0) {
        console.log(
          "📥 Menemukan",
          bgNotifications.length,
          "notifikasi background. Menyinkronkan...",
        );

        // Ambil riwayat notifikasi lokal yang sudah ada
        // Ganti 'appNotifications' dengan nama key localStorage yang Anda pakai (misal: 'notifHistory' atau 'riwayatData')
        // Berdasarkan kode Anda sebelumnya: 'appNotifications'
        let currentHistory =
          JSON.parse(localStorage.getItem("appNotifications")) || [];

        // Gabungkan notifikasi baru di urutan paling atas
        bgNotifications.forEach((notif) => {
          // Format sesuai struktur data Anda
          currentHistory.unshift({
            title: notif.title,
            body: notif.body,
            time: notif.time,
            read: false,
          });
        });

        // Batasi histori (opsional, misal max 50)
        if (currentHistory.length > 50)
          currentHistory = currentHistory.slice(0, 50);

        // Simpan Kembali ke LocalStorage
        localStorage.setItem(
          "appNotifications",
          JSON.stringify(currentHistory),
        );

        // Update UI
        if (typeof updateNotifBadge === "function") updateNotifBadge();
        if (typeof renderNotificationList === "function")
          renderNotificationList();

        // 👇 TAMBAHKAN BARIS INI UNTUK SYNC BACKGROUND KE CLOUD 👇
        if (typeof syncNotifToCloud === "function")
          syncNotifToCloud(currentHistory);

        // BERSIHKAN IndexedDB (Agar tidak duplikat saat reload berikutnya)
        store.clear();
      }
    };
  };

  request.onerror = (e) => console.log("DB Sync Error:", e);
}

// 2. Listener Pesan dari Service Worker (Jika aplikasi sedang terbuka di background/tab lain)
navigator.serviceWorker.addEventListener("message", (event) => {
  if (event.data && event.data.action === "OPEN_NOTIF_MODAL") {
    console.log("📩 Klik Notifikasi diterima saat aplikasi aktif");
    // Buka Modal
    if (typeof openNotificationModal === "function") {
      openNotificationModal();
    }
  }
});

// ============================================
// LISTENER PESAN DARI SERVICE WORKER (GABUNGAN)
// ============================================
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    // Pastikan ada data yang dikirim
    if (!event.data) return;

    const action = event.data.action;
    const payload = event.data.data; // Data tambahan (opsional)

    console.log(`📩 Menerima Pesan SW: ${action}`);

    // ----------------------------------------------------------------
    // KASUS 1: NOTIFICATION_CLICKED (Logika Manual - Simpan ke Storage)
    // ----------------------------------------------------------------
    if (action === "NOTIFICATION_CLICKED") {
      console.log("👆 User mengklik notifikasi (Handler Manual):", payload);

      // 1. Buat objek riwayat baru
      const newHistory = {
        waktu: new Date()
          .toLocaleString("id-ID", {
            weekday: "long",
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
          .replace(/\./g, ":"),
        pesan: payload ? payload.body : "Notifikasi Baru",
        tipe: payload ? payload.title : "Info",
      };

      // 2. Simpan ke LocalStorage secara Manual
      try {
        let currentHistory =
          JSON.parse(localStorage.getItem("riwayatData")) || [];
        currentHistory.unshift(newHistory);
        localStorage.setItem("riwayatData", JSON.stringify(currentHistory));
      } catch (e) {
        console.error("Gagal menyimpan riwayat manual:", e);
      }

      // 3. Update Tampilan & Buka Modal Manual
      if (typeof renderHistory === "function") renderHistory();

      const historyModal = document.getElementById("history-modal");
      if (historyModal) {
        historyModal.classList.remove("hidden");
        historyModal.classList.add("flex");
      }
    }

    // ----------------------------------------------------------------
    // KASUS 2: BACKGROUND_NOTIF_RECEIVED (Sync Data Realtime)
    // ----------------------------------------------------------------
    else if (action === "BACKGROUND_NOTIF_RECEIVED") {
      console.log("📥 Notifikasi Background diterima! Syncing...");

      // Jalankan Sinkronisasi (IndexedDB -> LocalStorage)
      if (typeof syncBackgroundNotifications === "function") {
        syncBackgroundNotifications();
      }
    }

    // ----------------------------------------------------------------
    // KASUS 3: OPEN_NOTIF_MODAL (Buka Modal via Helper)
    // ----------------------------------------------------------------
    else if (action === "OPEN_NOTIF_MODAL") {
      console.log("📂 Membuka modal notifikasi (Handler Otomatis)...");

      // Sync dulu agar data terbaru muncul
      if (typeof syncBackgroundNotifications === "function") {
        syncBackgroundNotifications();
      }

      // Delay sedikit lalu buka modal
      setTimeout(() => {
        if (typeof openNotificationModal === "function") {
          openNotificationModal();
        }
      }, 300);
    }
  });
}

// ==========================================
// [BARU] LOGIKA SWITCH AUTO UPDATE JADWAL
// ==========================================

// 1. Fungsi saat Switch diklik/digeser
function toggleAutoJadwal(isChecked) {
  // Simpan status ke LocalStorage (ON/OFF)
  const status = isChecked ? "ON" : "OFF";
  localStorage.setItem("autoUpdateJadwalState", status);

  console.log(`🔄 Auto Update Jadwal: ${status}`);

  // Tampilkan notifikasi kecil
  if (isChecked) {
    showInfoModal(
      "Auto Update Aktif",
      "Jadwal akan diperbarui otomatis setiap jam 00:01 WIB berdasarkan lokasi.",
      "success",
    );
    setTimeout(() => {
      closeModalAndReset();
    }, 10000);
  } else {
    showInfoModal(
      "Auto Update Mati",
      "Jadwal tidak akan berubah otomatis.",
      "info",
    );
    setTimeout(() => {
      closeModalAndReset();
    }, 10000);
  }

  // Auto close modal info setelah 2 detik
  setTimeout(() => closeModalAndReset(), 2500);
}

// 2. Fungsi Load Status Switch (Dipanggil saat Startup)
function loadAutoJadwalState() {
  const toggle = document.getElementById("toggle-auto-jadwal");
  const savedState = localStorage.getItem("autoUpdateJadwalState"); // Default null

  if (toggle) {
    // Jika belum pernah diset, anggap OFF (atau ON, terserah Riyan)
    // Di sini saya buat default-nya OFF agar aman
    if (savedState === "ON") {
      toggle.checked = true;
    } else {
      toggle.checked = false;
    }
  }
}

// Panggil fungsi load ini saat halaman selesai dimuat
window.addEventListener("load", loadAutoJadwalState);

/* =========================================
   LOGIKA CAR CONTROLLER (RC)
   ========================================= */
const mqtt_topic_car_move = "projek/belajar/car/move";
const mqtt_topic_car_cmd = "projek/belajar/car/cmd";
const mqtt_topic_car_status = "projek/belajar/car/status";

// Variabel Joystick
let isCarLandscape = false;
let carDragging = false;
const stickBase = document.getElementById("joystick-car");
const stickNub = document.getElementById("nub-car");
const dispX = document.getElementById("val-x");
const dispY = document.getElementById("val-y");

// --- 1. Fungsi Toggle Landscape/Portrait ---
function toggleCarMode() {
  const wrapper = document.getElementById("car-wrapper");
  isCarLandscape = !isCarLandscape;

  if (isCarLandscape) {
    wrapper.classList.remove("mode-portrait");
    wrapper.classList.add("mode-landscape");
    if (navigator.vibrate) navigator.vibrate(50);
    // Request Fullscreen agar immersive
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch((e) => {});
    }
  } else {
    wrapper.classList.remove("mode-landscape");
    wrapper.classList.add("mode-portrait");
    if (navigator.vibrate) navigator.vibrate(50);
    if (document.exitFullscreen) {
      document.exitFullscreen().catch((e) => {});
    }
  }
  resetCarJoystick();
}
/* --- TAMBAHAN LOGIKA KELUAR DARI CAR CONTROL --- */
function exitCarMode() {
  // 1. Cek apakah layar sedang miring (Landscape)? Jika ya, kembalikan ke Portrait
  if (isCarLandscape) {
    toggleCarMode(); // Panggil fungsi toggle yang sudah ada untuk reset rotasi
  }

  // 2. Pindah ke Halaman Utama
  switchPage("page-home");
}

// --- 2. Logika Joystick ---
function updateCarStick(clientX, clientY) {
  if (!stickBase) return;

  const rect = stickBase.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const maxDist = rect.width / 2;

  let dx = clientX - centerX;
  let dy = clientY - centerY;

  // Koreksi koordinat jika dalam mode Landscape (Rotated 90deg)
  if (isCarLandscape) {
    // Saat diputar 90 derajat via CSS, sumbu input touch perlu ditukar
    const temp = dx;
    dx = dy;
    dy = -temp;
  }

  const dist = Math.sqrt(dx * dx + dy * dy);
  const limit = maxDist * 0.6; // Batas gerak nub

  if (dist > limit) {
    const angle = Math.atan2(dy, dx);
    dx = Math.cos(angle) * limit;
    dy = Math.sin(angle) * limit;
  }

  // Gerakkan Visual Nub
  stickNub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

  // Normalisasi Nilai (-100 sampai 100)
  // Y dibalik (Atas = Positif)
  const valX = Math.round((dx / limit) * 100);
  const valY = Math.round((dy / limit) * -100);

  if (dispX) dispX.innerText = valX;
  if (dispY) dispY.innerText = valY;

  // Kirim MQTT (Throttle agar tidak spam)
  sendCarMove(valX, valY);
}

function resetCarJoystick() {
  carDragging = false;
  if (stickNub) stickNub.style.transform = `translate(-50%, -50%)`;
  if (stickBase) stickBase.classList.remove("active");
  if (dispX) dispX.innerText = "0";
  if (dispY) dispY.innerText = "0";
  sendCarMove(0, 0); // Kirim stop
}

function startCarDrag(e) {
  carDragging = true;
  if (stickBase) stickBase.classList.add("active");
  handleCarMove(e);
  if (navigator.vibrate) navigator.vibrate(5);
}

function handleCarMove(e) {
  if (!carDragging) return;
  // Mencegah scroll layar saat main joystick
  e.preventDefault();

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  updateCarStick(clientX, clientY);
}

// Event Listeners Joystick
if (stickBase) {
  stickBase.addEventListener("mousedown", startCarDrag);
  stickBase.addEventListener("touchstart", startCarDrag, { passive: false });

  window.addEventListener("mousemove", handleCarMove);
  window.addEventListener("touchmove", handleCarMove, { passive: false });

  window.addEventListener("mouseup", resetCarJoystick);
  window.addEventListener("touchend", resetCarJoystick);
}

// --- 3. Pengiriman MQTT ---
let lastCarSent = 0;
function sendCarMove(x, y) {
  // Kirim setiap 50ms maksimal agar tidak lag
  const now = Date.now();
  if (now - lastCarSent > 50 || (x === 0 && y === 0)) {
    if (mqttClient && mqttClient.isConnected()) {
      // Format Payload: "X:100,Y:100"
      const payload = `X:${x},Y:${y}`;
      const message = new Paho.MQTT.Message(payload);
      message.destinationName = mqtt_topic_car_move;
      mqttClient.send(message);

      // Update UI Status di Car Panel
      const statusEl = document.getElementById("car-status-text");
      if (statusEl) {
        statusEl.innerText = "CONNECTED - TX";
        statusEl.classList.add("text-green-400");
      }
    }
    lastCarSent = now;
  }
}

// Tambahkan Fungsi ini untuk Speed Control
function setCarSpeed(level, el) {
  if (navigator.vibrate) navigator.vibrate(10);

  // Update Tampilan (Pindah class .active)
  document
    .querySelectorAll(".spd-opt")
    .forEach((d) => d.classList.remove("active"));
  el.classList.add("active");

  // Kirim ke MQTT
  if (mqttClient && mqttClient.isConnected()) {
    let cmd = "SPD_2"; // Default
    if (level === 1) cmd = "SPD_1";
    if (level === 2) cmd = "SPD_2";
    if (level === 3) cmd = "SPD_3";

    const message = new Paho.MQTT.Message(cmd);
    message.destinationName = mqtt_topic_car_cmd;
    mqttClient.send(message);
  }
}

// Update fungsi sendCarCmd untuk REM
function sendCarCmd(cmd) {
  if (navigator.vibrate) navigator.vibrate(20);

  // Visual Feedback REM
  if (cmd === "BRAKE")
    document.getElementById("btn-car-brake").classList.add("active");

  // ... (Logika Horn & Light biarkan tetap sama) ...
  if (cmd === "HORN_ON")
    document.getElementById("btn-car-horn").classList.add("active");
  if (cmd === "HORN_OFF")
    document.getElementById("btn-car-horn").classList.remove("active");
  if (cmd === "LIGHT_FRONT") {
    const btn = document.getElementById("btn-light-front");
    if (btn) btn.classList.toggle("is-on");
  }
  if (cmd === "LIGHT_REAR") {
    const btn = document.getElementById("btn-light-rear");
    if (btn) btn.classList.toggle("is-on");
  }

  // Kirim MQTT
  if (mqttClient && mqttClient.isConnected()) {
    const message = new Paho.MQTT.Message(cmd);
    message.destinationName = mqtt_topic_car_cmd;
    mqttClient.send(message);
  }

  // Hilangkan efek tekan Rem setelah sebentar (opsional, atau pakai onmouseup)
  if (cmd === "BRAKE") {
    setTimeout(() => {
      document.getElementById("btn-car-brake").classList.remove("active");
    }, 200);
  }
}

// --- FUNGSI BARU: RESOLVE SYNC ---
function resolveScheduleSync(choice) {
  const modal = document.getElementById("modal-sync-jadwal");
  if (modal) modal.classList.add("hidden");

  if (choice === "CLOUD" && tempCloudSchedule) {
    // User pilih data Cloud (Lama)
    console.log("Menggunakan jadwal dari Cloud...");
    applySchedule(tempCloudSchedule);

    showInfoModal(
      "Sinkronisasi Berhasil",
      "Jadwal mengikuti data tersimpan.",
      "success",
    );
  } else if (choice === "LOCAL") {
    // User pilih update baru (Lokal) -> Kirim ke Cloud agar device lain ikut update
    console.log("Mengupdate jadwal Cloud dengan Lokal...");

    // Ambil data yang sedang aktif sekarang
    const currentLocal = JSON.parse(localStorage.getItem("jadwalSholatData"));
    publishScheduleToCloud(currentLocal);

    showInfoModal(
      "Jadwal Diperbarui",
      "Jadwal baru disimpan ke server.",
      "success",
    );
  }
}

// Fungsi menerapkan jadwal ke sistem (Save & Render)
function applySchedule(data) {
  // GUNAKAN KEY YANG SAMA DENGAN SISTEM LAMA ANDA
  localStorage.setItem("myJadwalSholat", JSON.stringify(data));

  // Update juga cache agar konsisten
  const cacheData = {
    tanggal: new Date().toDateString(),
    jadwal: data,
  };
  localStorage.setItem("jadwalSholatCache", JSON.stringify(cacheData));

  // Update Tampilan UI
  if (typeof updateJadwalUI === "function") {
    updateJadwalUI(data);
  } else {
    location.reload();
  }
}

// Fungsi Publish ke MQTT dengan RETAIN = TRUE
function publishScheduleToCloud(data) {
  if (mqttClient && mqttClient.isConnected()) {
    const payload = JSON.stringify(data);
    const message = new Paho.MQTT.Message(payload);
    message.destinationName = mqtt_topic_jadwal_data;
    message.retained = true; // PENTING: Agar tersimpan di broker
    mqttClient.send(message);
  }
}

// ============================================
// LOGIKA YOUTUBE DYNAMIC (MULTI STREAM)
// ============================================

// 1. Load Data Saat Aplikasi Dibuka
window.addEventListener("load", () => {
  renderYoutubeStreams();
});

// ============================================
// FUNGSI RENDER CCTV (CARD LAYOUT + EDIT FEATURE)
// ============================================
function renderYoutubeStreams() {
  const container = document.getElementById("youtube-container");
  const emptyState = document.getElementById("youtube-empty-state");
  if (!container) return;

  // Ambil data dari LocalStorage
  const streams = JSON.parse(localStorage.getItem("myYoutubeStreams")) || [];
  container.innerHTML = "";

  // Cek jika data kosong
  if (streams.length === 0) {
    if (emptyState) emptyState.classList.remove("hidden");
  } else {
    if (emptyState) emptyState.classList.add("hidden");

    streams.forEach((stream, index) => {
      const currentOrigin = window.location.origin;
      let playerHtml = "";
      let uniqueId = `cctv-player-${index}`;

      // --- TIPE 1: YOUTUBE ---
      if (stream.type === "youtube" || !stream.type) {
        playerHtml = `
            <iframe id="iframe-${index}" class="w-full h-full object-cover absolute inset-0 z-0" 
                src="https://www.youtube.com/embed/${stream.id}?autoplay=1&mute=1&rel=0&modestbranding=1&origin=${currentOrigin}" 
                frameborder="0" allowfullscreen>
            </iframe>`;
      }
      // --- TIPE 2: CCTV (.m3u8) ---
      else if (stream.type === "cctv") {
        playerHtml = `
            <video id="${uniqueId}" 
                class="absolute inset-0 w-full h-full object-cover bg-black z-0" 
                style="transform: scaleX(1) !important;" 
                muted playsinline preload="none" controls> 
            </video>
            
            <div id="play-overlay-${index}" onclick="playCctv(${index}, '${stream.id}')"
                class="absolute inset-0 flex items-center justify-center bg-black/60 z-20 cursor-pointer group/play hover:bg-black/40 transition">
                <div class="w-16 h-16 bg-red-600/80 rounded-full flex items-center justify-center shadow-lg group-hover/play:scale-110 transition">
                    <i class="fa-solid fa-play text-2xl text-white ml-1"></i>
                </div>
            </div>

            <div id="loading-${index}" class="absolute inset-0 flex items-center justify-center bg-black/70 z-10 pointer-events-none hidden">
                <i class="fa-solid fa-spinner fa-spin text-white text-3xl"></i>
            </div>
        `;
      }

      // --- JUDUL SCROLL DENGAN GAP KECIL ---
      let titleHtml = "";
      if (stream.name.length > 20) {
        titleHtml = `
            <div class="w-full overflow-hidden relative h-5">
                <div class="marquee-track">
                    <span class="text-white font-bold text-sm whitespace-nowrap mr-4">
                        ${stream.name}
                    </span>
                    <span class="text-white font-bold text-sm whitespace-nowrap mr-4">
                        ${stream.name}
                    </span>
                </div>
            </div>`;
      } else {
        titleHtml = `<h3 class="text-white font-bold text-sm truncate" title="${stream.name}">${stream.name}</h3>`;
      }

      // --- RENDER CARD (DENGAN CLASS 'cctv-item' & DATA-NAME) ---
      const cardHtml = `
<div class="cctv-item bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-lg flex flex-col relative group/card" 
     data-name="${stream.name.toLowerCase()}"> 
    
    <div class="relative w-full bg-black" style="padding-top: 56.25%;">
        <div class="absolute inset-0 w-full h-full">
            ${playerHtml}
            
            <div class="absolute top-2 left-2 z-30">
                <input type="checkbox" 
                    class="cctv-checkbox w-5 h-5 accent-blue-600 cursor-pointer shadow-md rounded" 
                    value="${stream.id}" 
                    onchange="updateSelectedCount()">
            </div>

            <div class="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow z-10 pointer-events-none">
                ${stream.type === "cctv" ? "CCTV" : "LIVE"}
            </div>
        </div>
    </div>

    <div class="p-3 bg-slate-800 flex justify-between items-center border-t border-slate-700">
        <div class="flex-1 mr-2 overflow-hidden">
            ${titleHtml}
            <p class="text-[10px] text-slate-400 truncate">ID: ${stream.id.substring(0, 15)}...</p>
        </div>
        
        <div class="flex gap-2">
            <button onclick="restartCctv(${index}, '${stream.type}', '${stream.id}')" class="w-8 h-8 rounded-full bg-blue-600/20 hover:bg-blue-600 text-blue-500 hover:text-white border border-blue-600/50 flex items-center justify-center transition"><i class="fa-solid fa-rotate-right text-xs"></i></button>
            <button onclick="openEditYoutubeModal(${index})" class="w-8 h-8 rounded-full bg-yellow-600/20 hover:bg-yellow-600 text-yellow-500 hover:text-white border border-yellow-600/50 flex items-center justify-center transition"><i class="fa-solid fa-pen text-xs"></i></button>
            <button onclick="confirmDeleteYoutubeStream(${index})" class="w-8 h-8 rounded-full bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/50 flex items-center justify-center transition"><i class="fa-solid fa-trash text-xs"></i></button>
        </div>
    </div>
</div>
`;
      container.innerHTML += cardHtml;
    });
  }
}

// ============================================
// LOGIKA HAPUS BANYAK (BULK DELETE)
// ============================================

// Update angka di tombol Hapus saat checkbox diklik
function updateSelectedCount() {
  const checkedBoxes = document.querySelectorAll(".cctv-checkbox:checked");
  const countSpan = document.getElementById("selected-count");
  if (countSpan) countSpan.innerText = checkedBoxes.length;
}

// Fungsi Hapus Data yang Dicentang (DENGAN POPUP KEREN)
function deleteSelectedStreams() {
  const checkedBoxes = document.querySelectorAll(".cctv-checkbox:checked");

  if (checkedBoxes.length === 0) {
    showInfoModal("Info", "Pilih minimal satu CCTV untuk dihapus.", "info");
    return;
  }

  // PANGGIL POPUP CUSTOM, BUKAN ALERT BIASA
  showConfirmationModal(
    "Hapus CCTV Terpilih?",
    `Anda akan menghapus ${checkedBoxes.length} data CCTV secara permanen. Tindakan ini tidak bisa dibatalkan.`,
    function () {
      // --- Logika Penghapusan (Dijalankan jika user klik Ya) ---
      const idsToDelete = Array.from(checkedBoxes).map((cb) => cb.value);
      let currentStreams =
        JSON.parse(localStorage.getItem("myYoutubeStreams")) || [];

      // Filter data
      const newStreams = currentStreams.filter(
        (stream) => !idsToDelete.includes(stream.id),
      );

      // Simpan
      localStorage.setItem("myYoutubeStreams", JSON.stringify(newStreams));

      // Sync
      if (typeof syncCctvToCloud === "function") {
        syncCctvToCloud(newStreams);
      }

      renderYoutubeStreams();
      updateSelectedCount();
      showInfoModal("Berhasil", "Data terpilih berhasil dihapus.", "success");
    },
  );
}

// Update juga fungsi hapus satuan agar pakai popup keren
function confirmDeleteYoutubeStream(index) {
  showConfirmationModal(
    "Hapus Stream?",
    "Apakah Anda yakin ingin menghapus stream ini?",
    function () {
      deleteYoutubeStream(index);
    },
  );
}

// ============================================
// LOGIKA PLAY MANUAL CCTV (HEMAT DATA)
// ============================================
let activeHlsInstances = {}; // Menyimpan instance HLS aktif

function playCctv(index, streamUrl) {
  const video = document.getElementById(`cctv-player-${index}`);
  const overlay = document.getElementById(`play-overlay-${index}`);
  const loading = document.getElementById(`loading-${index}`);

  if (!video) return;

  // Tampilkan loading, sembunyikan tombol play
  if (overlay) overlay.classList.add("hidden");
  if (loading) loading.classList.remove("hidden");

  // Fungsi saat video berhasil play
  const onPlaying = () => {
    if (loading) loading.classList.add("hidden");
    // Tampilkan kontrol native browser saat mouse hover agar bisa pause
    video.setAttribute("controls", "true");
  };

  // --- INISIALISASI HLS ---
  if (Hls.isSupported()) {
    // Hancurkan instance HLS lama jika ada (agar tidak numpuk)
    if (activeHlsInstances[index]) {
      activeHlsInstances[index].destroy();
    }

    const hls = new Hls({
      enableWorker: true, // Gunakan Web Worker untuk performa
      lowLatencyMode: true, // Mode latency rendah untuk CCTV
    });

    hls.loadSource(streamUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      // Gunakan promise untuk menangani jika autoplay diblokir browser
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then((_) => onPlaying())
          .catch((error) => {
            console.warn("Autoplay diblokir, menunggu interaksi user:", error);
            if (loading) loading.classList.add("hidden");
            if (overlay) overlay.classList.remove("hidden"); // Munculkan lagi tombol play
          });
      }
    });

    hls.on(Hls.Events.ERROR, function (event, data) {
      if (data.fatal) {
        console.error("HLS Fatal Error:", data.type);

        // Coba recover jika network error (auto retry)
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          console.log("⚠️ Network error, mencoba recover...");
          hls.startLoad();
        } else {
          hls.destroy();
          if (loading) loading.classList.add("hidden");
          if (overlay) overlay.classList.remove("hidden"); // Tampilkan tombol play lagi

          // [GANTI ALERT DENGAN POPUP MENARIK]
          showInfoModal(
            "Gagal Memuat",
            `Stream CCTV tidak dapat diakses saat ini.<br><span class="text-xs text-slate-400 mt-1 block">Error: ${data.details}</span>`,
            "error",
          );
        }
      }
    });

    // Simpan instance
    activeHlsInstances[index] = hls;
  }
  // --- FALLBACK SAFARI (iOS) ---
  else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = streamUrl;
    video.addEventListener("playing", onPlaying);
    video.play().catch((e) => {
      if (loading) loading.classList.add("hidden");
      if (overlay) overlay.classList.remove("hidden");
    });
  }
}

// --- FUNGSI RESTART CCTV ---
function restartCctv(index, type, url) {
  console.log(`🔄 Restarting CCTV index: ${index}`);

  // Beri efek getar sedikit
  if (navigator.vibrate) navigator.vibrate(20);

  if (type === "cctv") {
    // Hancurkan instance HLS lama jika ada
    if (activeHlsInstances[index]) {
      activeHlsInstances[index].destroy();
      delete activeHlsInstances[index];
    }

    // Reset elemen video
    const video = document.getElementById(`cctv-player-${index}`);
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }

    // Tampilkan loading lagi
    const overlay = document.getElementById(`play-overlay-${index}`);
    const loading = document.getElementById(`loading-${index}`);
    if (overlay) overlay.classList.add("hidden");
    if (loading) loading.classList.remove("hidden");

    // Panggil ulang playCctv setelah jeda singkat
    setTimeout(() => {
      playCctv(index, url);
    }, 500);
  } else {
    // Untuk YouTube, reload iframe
    const iframe = document.getElementById(`iframe-${index}`);
    if (iframe) {
      const currentSrc = iframe.src;
      iframe.src = ""; // Kosongkan dulu
      setTimeout(() => {
        iframe.src = currentSrc; // Isi ulang
      }, 200);
    }
  }
}

// Variabel Global untuk melacak Index Edit
let editingStreamIndex = -1; // -1 artinya Mode Tambah Baru

// 1. Modifikasi Fungsi Buka Modal (Untuk Reset Form)
function openAddYoutubeModal() {
  editingStreamIndex = -1; // Set ke Mode Tambah
  document.getElementById("input-yt-name").value = "";
  document.getElementById("input-yt-link").value = "";

  // Update Judul Modal (Opsional, manipulasi DOM)
  const titleEl = document.querySelector("#modal-add-youtube h3");
  if (titleEl)
    titleEl.innerHTML =
      '<i class="fa-brands fa-youtube text-red-500 mr-2"></i>Tambah Live';

  document.getElementById("modal-add-youtube").classList.remove("hidden");
}

// 2. [BARU] Fungsi Buka Modal Edit
function openEditYoutubeModal(index) {
  editingStreamIndex = index; // Set ke Mode Edit
  const streams = JSON.parse(localStorage.getItem("myYoutubeStreams")) || [];
  const data = streams[index];

  if (data) {
    document.getElementById("input-yt-name").value = data.name;

    // Kembalikan Link Asli
    let linkDisplay = data.id;
    if (data.type === "youtube") {
      linkDisplay = `https://youtu.be/${data.id}`;
    }
    document.getElementById("input-yt-link").value = linkDisplay;

    // Update Judul Modal
    const titleEl = document.querySelector("#modal-add-youtube h3");
    if (titleEl)
      titleEl.innerHTML =
        '<i class="fa-solid fa-pen text-yellow-500 mr-2"></i>Edit Live';

    document.getElementById("modal-add-youtube").classList.remove("hidden");
  }
}

// 3. Modifikasi Fungsi Simpan (Handle Add & Edit)
function saveYoutubeVideo() {
  const nameInput = document.getElementById("input-yt-name").value;
  const linkInput = document.getElementById("input-yt-link").value.trim();

  if (!nameInput || !linkInput) {
    alert("Nama dan Link harus diisi!");
    return;
  }

  let videoData = {};

  // Cek Tipe Link
  if (linkInput.includes(".m3u8")) {
    videoData = { name: nameInput, id: linkInput, type: "cctv" };
  } else {
    const ytId = extractYoutubeId(linkInput);
    if (ytId) {
      videoData = { name: nameInput, id: ytId, type: "youtube" };
    } else {
      // Jika edit tapi ID tidak berubah (masih ID lama)
      if (editingStreamIndex !== -1 && !linkInput.includes("http")) {
        // Asumsi user tidak mengubah link, hanya nama
        // (Logic sederhana, bisa diperbaiki jika perlu validasi ketat)
      } else {
        alert("Link tidak valid!");
        return;
      }
    }
  }

  const streams = JSON.parse(localStorage.getItem("myYoutubeStreams")) || [];

  if (editingStreamIndex === -1) {
    streams.push(videoData);
    showInfoModal("Berhasil", "Video Live ditambahkan.", "success");
  } else {
    streams[editingStreamIndex] = videoData;
    showInfoModal("Berhasil", "Data Video diperbarui.", "success");
    editingStreamIndex = -1;
  }

  // 1. Simpan Lokal
  localStorage.setItem("myYoutubeStreams", JSON.stringify(streams));

  // 2. [BARU] Upload ke Cloud (Agar device lain update)
  syncCctvToCloud(streams);

  document.getElementById("modal-add-youtube").classList.add("hidden");
  renderYoutubeStreams();
}

// ============================================
// LOGIKA HAPUS VIDEO (DENGAN MODAL KEREN)
// ============================================
let streamIndexToDelete = null; // Variabel sementara penyimpan index

// 1. Buka Modal Konfirmasi
function confirmDeleteYoutubeStream(index) {
  streamIndexToDelete = index; // Simpan index yang mau dihapus
  const modal = document.getElementById("modal-confirm-delete");
  const btnConfirm = document.getElementById("btn-confirm-delete-action");

  if (modal && btnConfirm) {
    // Pasang event listener pada tombol "Hapus" di modal
    // Gunakan 'once: true' agar listener otomatis terhapus setelah diklik
    btnConfirm.onclick = function () {
      executeDeleteStream();
      closeDeleteModal();
    };

    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
}

// 2. Tutup Modal
function closeDeleteModal() {
  const modal = document.getElementById("modal-confirm-delete");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
  streamIndexToDelete = null; // Reset index
}

// 3. Eksekusi Hapus (Dipanggil oleh tombol di modal)
function executeDeleteStream() {
  if (streamIndexToDelete === null) return;

  const streams = JSON.parse(localStorage.getItem("myYoutubeStreams")) || [];

  // Hentikan HLS instance (biarkan kode ini)
  if (activeHlsInstances[streamIndexToDelete]) {
    activeHlsInstances[streamIndexToDelete].destroy();
    delete activeHlsInstances[streamIndexToDelete];
  }

  streams.splice(streamIndexToDelete, 1);

  // 1. Simpan Lokal
  localStorage.setItem("myYoutubeStreams", JSON.stringify(streams));

  // 2. [BARU] Upload ke Cloud (Agar device lain ikut menghapus)
  syncCctvToCloud(streams);

  renderYoutubeStreams();
  showInfoModal("Dihapus", "Video telah dihapus dari daftar.", "info");
}

// 6. Helper: Ekstrak ID dari URL YouTube
function extractYoutubeId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

// Helper Getaran Aman
function safeVibrate(pattern) {
  try {
    // Cek apakah user pernah interaksi
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
      console.log("🔕 Getaran dilewati (Belum ada interaksi user)");
      return;
    }

    if ("vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch (e) {
    // Silent catch (abaikan error intervention)
  }
}

// Fungsi Helper: Kirim Data CCTV ke MQTT (Retain = True)
function syncCctvToCloud(data) {
  if (mqttClient && mqttClient.isConnected()) {
    const payload = JSON.stringify(data);
    const message = new Paho.MQTT.Message(payload);
    message.destinationName = mqtt_topic_cctv_sync;
    message.retained = true; // PENTING: Agar data tersimpan di server meski device offline
    mqttClient.send(message);
    console.log("☁️ Data CCTV di-upload ke Cloud.");
  } else {
    console.warn("⚠️ MQTT Offline. Data hanya tersimpan lokal.");
  }
}

// ============================================
// FUNGSI IMPORT MASSAL CCTV JOGJA (UPDATE 2026)
// ============================================
function importJogjaCCTV() {
  // Daftar Preset CCTV Jogja (Sumber Stabil HLS)
  const jogjaList = [
    {
      name: "Simpang Tugu Jogja",
      id: "https://mamikos.com/cam/hls/tugu_jogja.m3u8",
      type: "cctv",
    },
    {
      name: "Titik Nol KM",
      id: "https://mamikos.com/cam/hls/nol_km.m3u8",
      type: "cctv",
    },
    {
      name: "Malioboro (Depan Mall)",
      id: "https://mamikos.com/cam/hls/malioboro_mall.m3u8",
      type: "cctv",
    },
    {
      name: "Simpang Gejayan",
      id: "https://mamikos.com/cam/hls/gejayan.m3u8",
      type: "cctv",
    },
    {
      name: "Simpang Janti (Flyover)",
      id: "https://mamikos.com/cam/hls/janti.m3u8",
      type: "cctv",
    },
    {
      name: "Simpang Demangan",
      id: "https://mamikos.com/cam/hls/demangan.m3u8",
      type: "cctv",
    },
    {
      name: "Simpang UIN Sunan Kalijaga",
      id: "https://mamikos.com/cam/hls/uin.m3u8",
      type: "cctv",
    },
    {
      name: "Simpang Kentungan",
      id: "https://mamikos.com/cam/hls/kentungan.m3u8",
      type: "cctv",
    },
    {
      name: "Simpang Seturan",
      id: "https://mamikos.com/cam/hls/seturan.m3u8",
      type: "cctv",
    },
    {
      name: "Simpang Pingit",
      id: "https://mamikos.com/cam/hls/pingit.m3u8",
      type: "cctv",
    },
    {
      name: "Simpang MM UGM",
      id: "https://mamikos.com/cam/hls/mm_ugm.m3u8",
      type: "cctv",
    },
    {
      name: "Simpang Gramedia",
      id: "https://mamikos.com/cam/hls/gramedia.m3u8",
      type: "cctv",
    },
    {
      name: "Simpang Jetis",
      id: "https://mamikos.com/cam/hls/jetis.m3u8",
      type: "cctv",
    },
    {
      name: "Simpang Terban",
      id: "https://mamikos.com/cam/hls/terban.m3u8",
      type: "cctv",
    },
    {
      name: "Simpang Gondomanan",
      id: "https://mamikos.com/cam/hls/gondomanan.m3u8",
      type: "cctv",
    },
    {
      name: "Simpang Wirobrajan",
      id: "https://mamikos.com/cam/hls/wirobrajan.m3u8",
      type: "cctv",
    },
    {
      name: "Simpang Tegalrejo",
      id: "https://mamikos.com/cam/hls/tegalrejo.m3u8",
      type: "cctv",
    },
    {
      name: "Simpang Galeria",
      id: "https://mamikos.com/cam/hls/galeria.m3u8",
      type: "cctv",
    },
    {
      name: "Simpang UKDW",
      id: "https://mamikos.com/cam/hls/ukdw.m3u8",
      type: "cctv",
    },
    {
      name: "Simpang Gardu Ani",
      id: "https://mamikos.com/cam/hls/gardu_ani.m3u8",
      type: "cctv",
    },
  ];

  let currentStreams =
    JSON.parse(localStorage.getItem("myYoutubeStreams")) || [];
  let addedCount = 0;

  // Logika Filter Duplikat (Agar tidak menumpuk jika tombol ditekan 2x)
  jogjaList.forEach((cam) => {
    // Cek apakah URL stream sudah ada di database lokal
    const exists = currentStreams.some((s) => s.id === cam.id);
    if (!exists) {
      currentStreams.push(cam);
      addedCount++;
    }
  });

  if (addedCount > 0) {
    // Simpan ke LocalStorage
    localStorage.setItem("myYoutubeStreams", JSON.stringify(currentStreams));

    // Sync ke Cloud (Jika fitur ini aktif di kode Anda)
    if (typeof syncCctvToCloud === "function") syncCctvToCloud(currentStreams);

    // Render Ulang Tampilan
    renderYoutubeStreams();

    showInfoModal(
      "Import Sukses",
      `Berhasil menambahkan ${addedCount} CCTV Jogja baru!`,
      "success",
    );
  } else {
    showInfoModal(
      "Info",
      "Semua CCTV dalam daftar ini sudah Anda miliki.",
      "info",
    );
  }
}

// ============================================
// LOGIKA MODAL KONFIRMASI (CUSTOM)
// ============================================
let pendingConfirmAction = null; // Menyimpan fungsi yang akan dijalankan jika user klik "Ya"

function showConfirmationModal(
  title,
  message,
  onConfirm,
  btnText = "Ya, Hapus",
  btnIcon = "fa-trash-can",
) {
  const modal = document.getElementById("confirmation-modal");
  const content = document.getElementById("confirmation-content");
  const titleEl = document.getElementById("confirm-title");
  const msgEl = document.getElementById("confirm-message");
  const confirmBtn = document.getElementById("btn-confirm-action");

  // --- SAFETY CHECK ---
  if (!modal || !confirmBtn) {
    if (confirm(message)) {
      if (onConfirm) onConfirm();
    }
    return;
  }

  if (titleEl) titleEl.innerText = title;
  if (msgEl) msgEl.innerText = message;

  // --- UPDATE TEKS DAN IKON TOMBOL DINAMIS ---
  confirmBtn.innerHTML = `<i class="fa-solid ${btnIcon}"></i> ${btnText}`;

  // Ubah warna tombol menjadi kuning/orange jika mode Edit, dan Merah jika mode Hapus
  if (btnText.includes("Edit")) {
    confirmBtn.className =
      "bg-yellow-600 hover:bg-yellow-500 text-white py-2.5 rounded-xl font-bold shadow-lg flex justify-center items-center gap-2 transition";
  } else {
    confirmBtn.className =
      "bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl font-bold shadow-lg flex justify-center items-center gap-2 transition";
  }

  pendingConfirmAction = onConfirm;

  confirmBtn.onclick = function () {
    if (pendingConfirmAction) pendingConfirmAction();
    closeConfirmationModal();
  };

  modal.classList.remove("hidden");
  setTimeout(() => {
    modal.classList.remove("opacity-0");
    if (content) {
      content.classList.remove("scale-95");
      content.classList.add("scale-100");
    }
  }, 10);
}

function closeConfirmationModal() {
  const modal = document.getElementById("confirmation-modal");
  const content = document.getElementById("confirmation-content");

  // Animasi keluar
  modal.classList.add("opacity-0");
  content.classList.remove("scale-100");
  content.classList.add("scale-95");

  setTimeout(() => {
    modal.classList.add("hidden");
    pendingConfirmAction = null; // Reset aksi
  }, 300); // Sesuaikan dengan durasi CSS
}

// ============================================
// FITUR PENCARIAN & PILIH SEMUA
// ============================================

// 1. Fungsi Pencarian Real-time
function filterCCTV() {
  const input = document.getElementById("search-cctv");
  const filter = input.value.toLowerCase();
  const cards = document.querySelectorAll(".cctv-item");
  let hasResult = false;

  cards.forEach((card) => {
    const name = card.getAttribute("data-name");
    if (name.includes(filter)) {
      card.style.display = ""; // Tampilkan
      hasResult = true;
    } else {
      card.style.display = "none"; // Sembunyikan
    }
  });

  // Opsional: Tampilkan pesan jika tidak ada hasil
  // (Bisa ditambahkan elemen khusus di HTML untuk 'No Result')
}

// 2. Fungsi Pilih Semua (Select All)
function toggleSelectAll() {
  const masterCheckbox = document.getElementById("select-all-cctv");
  const checkboxes = document.querySelectorAll(".cctv-checkbox");

  // Hanya centang yang sedang TAMPIL (hasil pencarian)
  // Jika tidak sedang mencari, maka semua dicentang
  checkboxes.forEach((cb) => {
    // Cek apakah elemen induknya (card) sedang visible
    const card = cb.closest(".cctv-item");
    if (card && card.style.display !== "none") {
      cb.checked = masterCheckbox.checked;
    }
  });

  updateSelectedCount();
}

// Update fungsi updateSelectedCount untuk mematikan 'Select All' jika ada yang di-uncheck manual
function updateSelectedCount() {
  const checkedBoxes = document.querySelectorAll(".cctv-checkbox:checked");
  const countSpan = document.getElementById("selected-count");
  if (countSpan) countSpan.innerText = checkedBoxes.length;

  // Sinkronisasi checkbox 'Pilih Semua'
  const allCheckboxes = document.querySelectorAll(".cctv-checkbox");
  const masterCheckbox = document.getElementById("select-all-cctv");
  if (masterCheckbox) {
    if (
      checkedBoxes.length === allCheckboxes.length &&
      allCheckboxes.length > 0
    ) {
      masterCheckbox.checked = true;
      masterCheckbox.indeterminate = false;
    } else if (checkedBoxes.length > 0) {
      masterCheckbox.checked = false;
      masterCheckbox.indeterminate = true; // Tanda minus (-)
    } else {
      masterCheckbox.checked = false;
      masterCheckbox.indeterminate = false;
    }
  }
}

/* =========================================
   LOGIKA PENGATURAN (SETTINGS)
   ========================================= */

function openSettingsModal() {
  const modal = document.getElementById("modal-settings");
  const toggle = document.getElementById("toggle-setting-autologin");

  // Baris ini yang sebelumnya tertinggal, wajib ada agar tidak error:
  const toggleSuara = document.getElementById("toggle-setting-suara");

  const TRUSTED_TOKEN = "DEVICE_RIYAN_TERVERIFIKASI_2026";
  const savedToken = localStorage.getItem("my_trusted_device_token");

  // Cek dan setel status toggle Suara Azan
  if (toggleSuara) {
    const savedSuara = localStorage.getItem("suaraAzanState");
    toggleSuara.checked = savedSuara !== "OFF"; // Defaultnya ON jika belum pernah disetting
  }

  // Cek dan setel status toggle Auto Login
  if (toggle) {
    toggle.checked = savedToken === TRUSTED_TOKEN;
  }

  // Tampilkan modal
  if (modal) {
    modal.classList.remove("hidden");
  }
}

// 2. Tutup Modal
function closeSettingsModal() {
  const modal = document.getElementById("modal-settings");
  if (modal) modal.classList.add("hidden");
}

// 3. Fungsi Eksekusi Toggle (Dipanggil saat switch digeser)
function toggleAutoLoginSetting(isChecked) {
  const TRUSTED_TOKEN = "DEVICE_RIYAN_TERVERIFIKASI_2026";

  if (isChecked) {
    localStorage.setItem("my_trusted_device_token", TRUSTED_TOKEN);
    console.log("✅ Pengaturan: Auto Login Diaktifkan");
    showInfoModal(
      "Berhasil",
      "Login otomatis aktif untuk perangkat ini.",
      "success",
    );
  } else {
    localStorage.removeItem("my_trusted_device_token");
    console.log("❌ Pengaturan: Auto Login Dinonaktifkan");
    showInfoModal("Berhasil", "Login otomatis dimatikan.", "info");
  }

  // (Opsional) Sinkronkan juga checkbox di halaman Lock Screen jika ada
  const lockScreenChk = document.getElementById("chk-auto-login");
  if (lockScreenChk) lockScreenChk.checked = isChecked;

  // SINKRONISASI DENGAN ANDROID NATIVE LOCKSCREEN
  if (window.AndroidApp) {
    window.AndroidApp.setAutoLogin(isChecked);
  }
}

// --- FUNGSI BARU: TOGGLE SUARA AZAN ---
function toggleSuaraAzan(isChecked) {
  const status = isChecked ? "ON" : "OFF";
  localStorage.setItem("suaraAzanState", status);
  console.log(`🔊 Pengaturan: Suara Azan/Imsak ${status}`);
  showInfoModal(
    "Berhasil",
    `Suara peringatan ${isChecked ? "diaktifkan" : "dimatikan"}.`,
    "info",
  );
  sinkronkanAlarmKeNative();
}

/* =========================================
   LOGIKA KELUAR APLIKASI (EXIT APP)
   ========================================= */

function openExitConfirmModal() {
  // Tutup modal pengaturan dulu agar tidak tumpang tindih
  closeSettingsModal();

  const modal = document.getElementById("modal-confirm-exit");
  const content = document.getElementById("modal-exit-content");

  if (modal) {
    modal.classList.remove("hidden");
    // Sedikit animasi scale up saat muncul
    setTimeout(() => {
      if (content) content.classList.replace("scale-95", "scale-100");
    }, 10);
  }
}

function closeExitConfirmModal() {
  const modal = document.getElementById("modal-confirm-exit");
  const content = document.getElementById("modal-exit-content");

  if (content) content.classList.replace("scale-100", "scale-95");

  // Beri jeda sedikit agar animasi scale down terlihat sebelum hidden
  setTimeout(() => {
    if (modal) modal.classList.add("hidden");
    // Buka kembali pengaturan jika user membatalkan (opsional, jika ingin balik ke pengaturan)
    openSettingsModal();
  }, 200);
}

// --- FUNGSI BARU: SIMPAN/LOAD STATUS TOGGLE PER JADWAL ---
function saveJadwalToggles() {
  const toggles = {
    sahur: document.getElementById("chk-auto-sahur")
      ? document.getElementById("chk-auto-sahur").checked
      : true, // [TAMBAHKAN BARIS INI]
    imsak: document.getElementById("chk-auto-imsak").checked,
    subuh: document.getElementById("chk-auto-subuh").checked,
    dzuhur: document.getElementById("chk-auto-dzuhur").checked,
    ashar: document.getElementById("chk-auto-ashar").checked,
    maghrib: document.getElementById("chk-auto-maghrib").checked,
    isya: document.getElementById("chk-auto-isya").checked,
  };
  localStorage.setItem("jadwalAutoToggles", JSON.stringify(toggles));
  console.log(
    "🔄 Toggle diubah, menyinkronkan ulang jadwal dengan lokasi terkini...",
  );
  cariJadwalLokasiTerkini();
}

function loadJadwalToggles() {
  const saved = JSON.parse(localStorage.getItem("jadwalAutoToggles"));
  if (saved) {
    // [TAMBAHKAN BARIS INI]
    if (document.getElementById("chk-auto-sahur"))
      document.getElementById("chk-auto-sahur").checked =
        saved.sahur !== undefined ? saved.sahur : true;

    if (document.getElementById("chk-auto-imsak"))
      document.getElementById("chk-auto-imsak").checked = saved.imsak;
    if (document.getElementById("chk-auto-subuh"))
      document.getElementById("chk-auto-subuh").checked = saved.subuh;
    if (document.getElementById("chk-auto-dzuhur"))
      document.getElementById("chk-auto-dzuhur").checked = saved.dzuhur;
    if (document.getElementById("chk-auto-ashar"))
      document.getElementById("chk-auto-ashar").checked = saved.ashar;
    if (document.getElementById("chk-auto-maghrib"))
      document.getElementById("chk-auto-maghrib").checked = saved.maghrib;
    if (document.getElementById("chk-auto-isya"))
      document.getElementById("chk-auto-isya").checked = saved.isya;
  } else {
    // Default semua ON jika belum ada settingan
    document
      .querySelectorAll("#manual-jadwal-form input[type=checkbox]")
      .forEach((c) => (c.checked = true));
  }
}

// --- FITUR 1: WIFI SCANNING ---
function requestWifiScan() {
  if (!mqttClient.isConnected())
    return showInfoModal("Gagal", "MQTT Terputus", "error");
  showInfoModal("Scanning", "Meminta ESP memindai jaringan...", "loading");

  // Kirim perintah scan ke ESP
  const message = new Paho.MQTT.Message("CMD_SCAN_WIFI");
  message.destinationName = "projek/belajar/perintah_kipas"; // Gunakan topik command yang ada
  mqttClient.send(message);
}
function connectToSelectedWifi() {
  const pass = document.getElementById("wifi-pass-input").value;
  if (!selectedSsidTarget) return alert("Pilih WiFi dulu!");

  // Kirim perintah konek format: CONNECT:SSID:PASSWORD
  const payload = `CONNECT:${selectedSsidTarget}:${pass}`;
  const message = new Paho.MQTT.Message(payload);
  message.destinationName = "projek/belajar/perintah_kipas";
  mqttClient.send(message);

  document.getElementById("modal-wifi-scan").classList.remove("active");
  showInfoModal("Terkirim", "ESP mencoba menghubungkan...", "info");
}

// --- FUNGSI FULLSCREEN MAP NATIVE (ANTI GAGAL) ---
function toggleMapFullscreen() {
  const mapContainer =
    document.getElementById("windyContainer") ||
    document.getElementById("mapContainer");
  const btnIcon = document.querySelector("#btn-fullscreen-map i");
  if (!mapContainer) return;

  // Jika layar BELUM fullscreen
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    if (mapContainer.requestFullscreen) {
      mapContainer.requestFullscreen(); // Standar HTML5
    } else if (mapContainer.webkitRequestFullscreen) {
      mapContainer.webkitRequestFullscreen(); // Safari/iOS
    } else if (mapContainer.msRequestFullscreen) {
      mapContainer.msRequestFullscreen(); // Edge/IE
    }

    // Ganti ikon jadi compress (perkecil)
    if (btnIcon) {
      btnIcon.classList.remove("fa-expand");
      btnIcon.classList.add("fa-compress");
    }
  }
  // Jika layar SUDAH fullscreen, maka keluarkan
  else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }

    // Ganti ikon kembali ke expand (perbesar)
    if (btnIcon) {
      btnIcon.classList.remove("fa-compress");
      btnIcon.classList.add("fa-expand");
    }
  }

  // Render ulang map cadangan jika Windy error
  if (typeof map !== "undefined" && map !== null) {
    setTimeout(() => {
      map.invalidateSize();
    }, 300);
  }
}

// ==========================================
// LOGIKA KONTROL BLE (MIGRASI DARI BLE.HTML)
// ==========================================
const bleServiceUuid = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const bleWriteCharacteristicUuid = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
let myBleCharacteristic;
let myBleDevice;

const bleConnectBtn = document.getElementById("bleConnectBtn");
const bleUnlockBtn = document.getElementById("bleUnlockBtn");
const bleLockBtn = document.getElementById("bleLockBtn");
const bleStatusText = document.getElementById("ble-status");

// --- LOGIKA TOMBOL BANGUNKAN BLE ---
const wakeUpBtn = document.getElementById("wakeUpBle");
if (wakeUpBtn) {
  wakeUpBtn.addEventListener("click", () => {
    let pesan = new Paho.MQTT.Message("BLE_WAKEUP");
    pesan.destinationName = "projek/belajar/perintah_kipas";
    mqttClient.send(pesan);

    // 1. Tampilkan di Console Inspect Element
    console.log(
      "✅ Perintah bangunkan BLE (BLE_WAKEUP) berhasil dikirim ke broker!",
    );

    // 2. Tampilkan Pop-up pemberitahuan di layar Web/HP kamu
    alert("Perintah menyalakan Bluetooth telah dikirim ke ESP32!");

    wakeUpBtn.innerHTML =
      '<i class="fa-solid fa-hourglass-half"></i> Membangunkan...';
    wakeUpBtn.classList.replace("bg-amber-600", "bg-slate-600");
    wakeUpBtn.classList.replace("hover:bg-amber-500", "hover:bg-slate-500");

    setTimeout(() => {
      wakeUpBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> BANGUNKAN BLE';
      wakeUpBtn.classList.replace("bg-slate-600", "bg-amber-600");
      wakeUpBtn.classList.replace("hover:bg-slate-500", "hover:bg-amber-500");
    }, 3000);
  });
}

if (bleConnectBtn) {
  bleConnectBtn.addEventListener("click", async () => {
    // Logika Putuskan Koneksi jika sudah terhubung
    if (myBleDevice && myBleDevice.gatt.connected) {
      myBleDevice.gatt.disconnect();
      return;
    }

    try {
      bleStatusText.innerText = "Status: Mencari Perangkat...";
      bleStatusText.className = "text-xs font-mono text-blue-400 font-bold";

      // Filter perangkat berdasarkan file ble.html
      myBleDevice = await navigator.bluetooth.requestDevice({
        filters: [{ name: "ESP32-Keamanan" }],
        optionalServices: [bleServiceUuid],
      });

      myBleDevice.addEventListener("gattserverdisconnected", onBleDisconnected);

      const server = await myBleDevice.gatt.connect();
      const service = await server.getPrimaryService(bleServiceUuid);
      myBleCharacteristic = await service.getCharacteristic(
        bleWriteCharacteristicUuid,
      );

      // Update UI saat berhasil terhubung
      bleStatusText.innerText = "✅ Status: Terhubung ke ESP32!";
      bleStatusText.className = "text-xs font-mono text-emerald-400 font-bold";

      bleUnlockBtn.disabled = false;
      bleLockBtn.disabled = false;

      bleConnectBtn.innerHTML =
        '<i class="fa-solid fa-link-slash"></i> Putuskan Koneksi';
      bleConnectBtn.classList.replace("bg-blue-600", "bg-slate-700");
      bleConnectBtn.classList.replace(
        "hover:bg-blue-500",
        "hover:bg-slate-600",
      );
    } catch (error) {
      console.log("BLE Error: " + error);
      bleStatusText.innerText = "❌ Gagal Terhubung: " + error;
      bleStatusText.className = "text-xs font-mono text-red-500 font-bold";
    }
  });
}

// Fungsi pengiriman string teks yang sudah dioptimasi untuk Chrome Modern
async function sendBleCommand(cmd) {
  if (!myBleCharacteristic) {
    console.error("❌ BLE Characteristic belum terhubung!");
    return;
  }

  try {
    const encoder = new TextEncoder("utf-8");
    const data = encoder.encode(cmd);

    // LOGIKA PINTAR: Deteksi tipe pengiriman yang didukung Chrome saat ini
    if (myBleCharacteristic.properties.write) {
      await myBleCharacteristic.writeValueWithResponse(data);
      console.log("✅ BLE Sent (WithResponse):", cmd);
    } else if (myBleCharacteristic.properties.writeWithoutResponse) {
      await myBleCharacteristic.writeValueWithoutResponse(data);
      console.log("✅ BLE Sent (WithoutResponse):", cmd);
    } else {
      // Fallback untuk browser versi lama
      await myBleCharacteristic.writeValue(data);
      console.log("✅ BLE Sent (Legacy Write):", cmd);
    }

    if (typeof showInfoModal === "function") {
      showInfoModal(
        "BLE Sukses",
        `Perintah "${cmd}" berhasil terkirim!`,
        "success",
      );
      setTimeout(() => closeModalAndReset(), 3000);
    }
  } catch (error) {
    console.error("❌ Kirim BLE Error: ", error);
    if (typeof showInfoModal === "function") {
      showInfoModal(
        "BLE Error",
        "Gagal mengirim. Coba putuskan dan hubungkan ulang.",
        "error",
      );
    }
  }
}

// Event Listener Tombol Pintu
if (bleUnlockBtn) {
  bleUnlockBtn.addEventListener("click", () => sendBleCommand("UNLOCK"));
}
if (bleLockBtn) {
  bleLockBtn.addEventListener("click", () => sendBleCommand("LOCK"));
}

// Reset UI saat Bluetooth terputus
function onBleDisconnected(event) {
  if (bleStatusText) {
    bleStatusText.innerText = "❌ Status: Koneksi Terputus.";
    bleStatusText.className = "text-xs font-mono text-red-500 font-bold";
  }
  if (bleUnlockBtn) bleUnlockBtn.disabled = true;
  if (bleLockBtn) bleLockBtn.disabled = true;

  if (bleConnectBtn) {
    bleConnectBtn.innerHTML =
      '<i class="fa-solid fa-link"></i> Hubungkan ke ESP32';
    bleConnectBtn.classList.replace("bg-slate-700", "bg-blue-600");
    bleConnectBtn.classList.replace("hover:bg-slate-600", "hover:bg-blue-500");
  }
}

// Ganti dengan URL Web App Google Apps Script kamu yang sebenarnya
const scriptURLRemote =
  "https://script.google.com/macros/s/AKfycbwamKBiIgw8vREOcxNGE6hezQUzm-dl88RqApNaOOec33O7kssxb3w_yyhZK6zUCVFUNw/exec";
function loadRemoteFromDB() {
  fetch(scriptURLRemote + "?action=getRemote")
    .then((response) => response.json())
    .then((data) => {
      if (data && Array.isArray(data)) {
        // --- [PENGAMAN BARU] CEK FORMAT DATA ---
        // Pastikan datanya kosong ATAU memiliki struktur remote (punya type/brand/buttons)
        // Jika formatnya RFID (punya uid), tolak dan reset.
        const isDataValid =
          data.length === 0 ||
          data.every(
            (item) =>
              item.hasOwnProperty("type") || item.hasOwnProperty("buttons"),
          );

        if (isDataValid) {
          remoteDashboards = data;
        } else {
          console.warn(
            "⚠️ Data di Cloud korup (Berisi RFID). Mereset data remote ke awal.",
          );
          remoteDashboards = [];
          saveDashboards(); // Timpa data korup di Cloud dengan array kosong
        }
        // ---------------------------------------

        localStorage.setItem(
          "remoteDashboards",
          JSON.stringify(remoteDashboards),
        );
        renderDashboardList();

        if (typeof mqttClient !== "undefined" && mqttClient.isConnected()) {
          syncRemoteToESP();
        }
        console.log("✅ Database Remote tersinkronisasi dari Cloud!");
      }
    })
    .catch((error) =>
      console.error("Gagal sinkronisasi Remote dari DB:", error),
    );
}

// === FUNGSI BARU: SINKRONISASI NOTIFIKASI KE GOOGLE SHEET ===

function syncNotifToCloud(notifArray) {
  fetch(GAS_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain",
    },
    body: JSON.stringify({
      action: "saveNotif",
      data: notifArray,
    }),
  }).catch((e) => console.error("Gagal sync notifikasi ke Cloud:", e));
}

function loadNotifFromCloud() {
  fetch(GAS_URL + "?action=getNotif")
    .then((response) => response.json())
    .then((data) => {
      if (data && Array.isArray(data)) {
        localStorage.setItem("appNotifications", JSON.stringify(data));
        updateNotifBadge();

        // Refresh UI jika modal notif sedang terbuka
        const modalNotif = document.getElementById("modal-notif");
        if (modalNotif && modalNotif.classList.contains("active")) {
          renderNotificationList();
        }
        console.log("✅ Database Notifikasi berhasil disinkronkan dari Cloud!");
      }
    })
    .catch((error) =>
      console.error("❌ Gagal sinkronisasi Notifikasi dari DB:", error),
    );
}

// Sinkronisasi ulang jadwal dari Google Sheet setiap 60 detik
// untuk mencegah jadwal yang sudah dieksekusi ter-upload kembali
setInterval(() => {
  // Perbaikan nama pemanggilan fungsi menjadi loadJadwalFromDB
  if (typeof loadJadwalFromDB === "function") {
    console.log("🔄 Auto-sync jadwal dari Google Sheet...");
    loadJadwalFromDB();
  }
}, 60000);

// =======================================================
// FUNGSI OTOMATISASI CHECKBOX HARI (HANYA HARI INI)
// =======================================================
function handleOneTimeToggle(isChecked) {
  const today = new Date().getDay(); // 0 = Minggu, 1 = Senin, dst
  const checkboxes = document.querySelectorAll(".day-chk");

  checkboxes.forEach((cb) => {
    if (isChecked) {
      // Centang hari ini saja, dan kunci (disable) hari lain agar user tidak bingung
      cb.checked = parseInt(cb.value) === today;
      cb.parentElement.style.pointerEvents = "none";
      cb.parentElement.style.opacity =
        parseInt(cb.value) === today ? "1" : "0.3";
    } else {
      // Buka kembali kuncian jika dimatikan
      cb.checked = false;
      cb.parentElement.style.pointerEvents = "auto";
      cb.parentElement.style.opacity = "1";
    }
  });
}

function loadEspStatusFromCloud() {
  fetch(GAS_URL + "?action=get_esp_status")
    .then((res) => res.json())
    .then((data) => {
      if (data) {
        // Loop hasil dari database
        for (let id = 2; id <= 5; id++) {
          if (data[id] && data[id].status === "OFFLINE") {
            // Update UI merah dan tulis waktu disconnect-nya
            updateDeviceStatus(id, false, data[id].time);
          }
        }
        console.log("✅ Sinkronisasi Histori Offline ESP dari Cloud berhasil.");
      }
    })
    .catch((err) => console.error("Gagal ambil status ESP dari Cloud:", err));
}

// ==========================================================
// FUNGSI PENCARIAN SMART CONTROL (GLOBAL & JADWAL KIPAS)
// ==========================================================

// 1. Pencarian Keseluruhan (Global)
function filterGlobalControl() {
  const input = document
    .getElementById("global-search-control")
    .value.toLowerCase();

  // Menyeleksi semua 6 kartu utama di halaman Smart Control
  const cards = document.querySelectorAll(
    "#page-control .max-w-2xl > .bg-slate-800",
  );

  let firstMatch = null;

  cards.forEach((card) => {
    const text = card.innerText.toLowerCase();

    // Cek jika kata kunci cocok dengan isi teks di dalam kartu
    if (text.includes(input)) {
      card.style.display = ""; // Tampilkan kartu
      if (!firstMatch) firstMatch = card; // Tandai kartu pertama yang cocok
    } else {
      card.style.display = "none"; // Sembunyikan kartu jika tidak relevan
    }
  });

  // Otomatis men-scroll/mengarahkan layar tepat ke tengah kartu yang dicari
  // Aktif hanya jika user mengetik minimal 2 huruf agar layar tidak "lompat" mendadak
  if (input.length >= 2 && firstMatch) {
    firstMatch.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// 2. Pencarian Detail Jadwal Kipas
function filterJadwal() {
  const input = document.getElementById("search-jadwal").value.toLowerCase();
  const items = document.querySelectorAll("#schedule-list li");

  items.forEach((item) => {
    // Abaikan filter jika elemen hanya teks "Memuat" atau "Belum ada jadwal"
    if (
      item.innerText.includes("Memuat") ||
      item.innerText.includes("Belum ada")
    )
      return;

    const text = item.innerText.toLowerCase();
    if (text.includes(input)) {
      item.style.display = ""; // Tampilkan jadwal
    } else {
      item.style.display = "none"; // Sembunyikan jadwal
    }
  });
}

// Fungsi ini mengubah jam "04:30" menjadi hitungan milidetik untuk dikirim ke Android
function aturAlarmKeAndroid(tipe, timeString, isAktif) {
  if (typeof AndroidApp !== "undefined" && AndroidApp.setPrayerAlarm) {
    if (isAktif) {
      let now = new Date();
      let [jam, menit] = timeString.split(":");
      let waktuAlarm = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        parseInt(jam),
        parseInt(menit),
        0,
      );

      // Jika waktu salat hari ini sudah lewat, jadwalkan untuk besok harinya
      if (waktuAlarm.getTime() <= now.getTime()) {
        waktuAlarm.setDate(waktuAlarm.getDate() + 1);
      }

      // Tembakkan ke Android!
      AndroidApp.setPrayerAlarm(tipe, waktuAlarm.getTime());
      console.log(
        `Berhasil menyetel alarm ${tipe} untuk Android pada ${waktuAlarm}`,
      );
    } else {
      AndroidApp.cancelPrayerAlarm(tipe);
      console.log(`Alarm ${tipe} dibatalkan dari Android.`);
    }
  }
}

// --- JEMBATAN ALARM WEB KE ANDROID NATIVE ---
window.sinkronkanAlarmKeNative = function () {
  if (typeof AndroidApp !== "undefined" && AndroidApp.setPrayerAlarm) {
    const isSuaraOn = localStorage.getItem("suaraAzanState") !== "OFF";
    const jadwalStr = localStorage.getItem("myJadwalSholat");

    if (!jadwalStr) return;

    const jadwal = JSON.parse(jadwalStr);
    const daftarSholat = [
      "Imsak",
      "Sahur",
      "Subuh",
      "Dzuhur",
      "Ashar",
      "Maghrib",
      "Isya",
    ];

    daftarSholat.forEach((nama) => {
      if (!isSuaraOn) {
        AndroidApp.cancelPrayerAlarm(nama);
      } else if (jadwal[nama] && jadwal[nama] !== "--:--") {
        let now = new Date();
        let [jam, menit] = jadwal[nama].split(":");
        let waktuAlarm = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          parseInt(jam),
          parseInt(menit),
          0,
        );

        // Jika jam sholat ini sudah terlewat hari ini, pasang alarm untuk besok
        if (waktuAlarm.getTime() <= now.getTime()) {
          waktuAlarm.setDate(waktuAlarm.getDate() + 1);
        }

        // Kirim pesan jadwal ke sistem Android
        AndroidApp.setPrayerAlarm(nama, waktuAlarm.getTime());
        console.log(
          `⏰ [NATIVE ALARM] ${nama} disetel ke sistem HP: ${waktuAlarm.toLocaleString()}`,
        );
      }
    });
  }
};
