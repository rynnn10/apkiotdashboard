# 📱 Smart Dashboard IoT - Android Native Wrapper

Aplikasi Android cerdas berbasis WebView (Native Wrapper) yang dirancang khusus untuk mengontrol perangkat IoT ESP8266 secara komprehensif. Aplikasi ini mendukung fungsionalitas tingkat lanjut seperti pemantauan sensor _real-time_, eksekusi sistem otomasi rumah pintar, notifikasi _native_, sinkronisasi Jadwal Sholat presisi berbasis koordinat satelit (GPS), dan penguncian Pintu Otomatis (Face API & RFID).

---

## 🛠️ 1. Inisialisasi & Kloning Project ke Lokal (VS Code)

Untuk memulai pengembangan atau sekadar memindahkan _project_ ini ke komputer baru, Anda perlu menarik (_pull/clone_) repositori ini dari GitHub. Pastikan Anda telah menginstal [Git](https://git-scm.com/) dan [Visual Studio Code](https://code.visualstudio.com/).

1. Buka _File Explorer_, buat atau pilih folder kosong sebagai tempat penyimpanan _project_ Anda.
2. Klik kanan pada area kosong di dalam folder tersebut, lalu pilih **Open in Terminal** (atau Git Bash Here).
3. Eksekusi perintah kloning berikut untuk mengunduh seluruh _source code_:

````powershell
   git clone [URL_GITHUB_PROJECT_KAMU]


4. Setelah proses unduhan selesai, masuk ke dalam direktori _project_ yang baru saja dibuat:

```powershell
   cd apkiotdashboard

````

5. Buka _project_ tersebut langsung di Visual Studio Code dengan perintah:

```powershell
   code .

```

---

## 🚀 2. Panduan Kompilasi (Build) APK & Instalasi Langsung ke Perangkat

Sistem ini telah dilengkapi dengan _script_ otomatis (`run.ps1`) yang merangkum proses kompilasi Gradle, instalasi ADB, serta pemanggilan _intent_ untuk membuka aplikasi secara otomatis di layar _smartphone_ Anda.

### A. Metode Standar: Menggunakan Kabel USB

1. Hubungkan _smartphone_ Android Anda ke PC/Laptop menggunakan kabel USB data yang mendukung transfer _file_.
2. Pastikan fitur **USB Debugging** telah diaktifkan melalui menu _Developer Options_ (Opsi Pengembang) di setelan HP Anda.
3. Buka Terminal terintegrasi di VS Code dengan menekan _shortcut_ `Ctrl + `` (atau *backtick* `~`).
4. Panggil _script runner_ otomatis:

```powershell
   .\run.ps1

```

> **Catatan Proses:** Gradle akan merakit kode Anda menjadi berkas APK. Jika berhasil, sistem akan membunyikan alarm _beep_ di PC, memberikan notifikasi suara robot pembaca teks, dan seketika aplikasi akan terbuka (diluncurkan) secara paksa di _smartphone_ Anda.

### B. Metode Jarak Jauh: Menggunakan Jaringan WiFi (Over-The-Air)

Sangat direkomendasikan jika Anda ingin meminimalisir kerusakan pada _port_ USB akibat cabut-pasang kabel secara terus-menerus. Syarat utamanya: **PC dan HP harus terhubung ke jaringan WiFi/Tethering lokal yang sama.**

1. Colokkan kabel USB ke HP **hanya untuk inisialisasi awal (pancingan)**.
2. Di Terminal VS Code, ketik perintah berikut untuk membuka gerbang _port_ ADB via TCP/IP di HP Anda:

```powershell
   adb tcpip 5555

```

3. Setelah muncul pesan _restarting in TCP mode_, **segera cabut kabel USB Anda.**
4. Periksa Alamat IP _smartphone_ Anda (Buka Pengaturan Android > Setelan WiFi > Ketuk info koneksi WiFi yang terhubung > Catat alamat IP, contoh: `192.168.1.15`).
5. Sambungkan jembatan ADB ke HP Anda melalui udara dengan perintah:

```powershell
   adb connect 192.168.1.15:5555

```

_(Sesuaikan susunan angka IP dengan IP perangkat HP Anda)._ 6. Setelah muncul tulisan `connected to...`, Anda kini bebas mengeksekusi perintah `.\run.ps1` kapan pun Anda mau, sepenuhnya tanpa menggunakan kabel sama sekali!

### C. PENTING: Modifikasi Application ID (Mencegah Penimpaan Aplikasi)

Secara arsitektur bawaan, OS Android mengenali identitas sebuah aplikasi berdasarkan ID paketnya (_Package Name_), bukan dari nama visual aplikasinya. Jika Anda ingin melakukan _build_ versi kedua dari _project_ ini tanpa menghapus aplikasi _project_ IoT yang pertama di HP Anda, **Application ID wajib dimodifikasi**.

1. Navigasikan ke panel _Explorer_ VS Code, buka _file_ konfigurasi Gradle berikut: `app/build.gradle.kts`.
2. Cari baris identifikasi paket aplikasi:

```kotlin
   applicationId = "com.aistudio.iotdashboard.lmnxqa"

```

3. Ubah _string_ tersebut menjadi ID baru yang benar-benar unik (disarankan menggunakan format domain terbalik untuk standar profesional), misalnya:

```kotlin
   applicationId = "com.riyan.projectkedua"

```

4. Simpan perubahan _file_ (`Ctrl + S`), lalu jalankan `.\run.ps1` kembali. Sistem Android akan menginstal dan mengisolasi ini sebagai aplikasi baru yang berdiri sendiri secara paralel.

---

## 🐛 3. Monitoring & Debugging Console (Melacak Error Real-Time)

Karena antarmuka HTML/JS aplikasi ini berjalan sepenuhnya di atas instans `WebView` (mesin Chromium internal Android), semua pesan `console.log()`, `console.error()`, maupun `console.warn()` dari _file_ `logic.js` tidak akan otomatis muncul di terminal biasa. Anda harus "menyadapnya" menggunakan filter antarmuka Logcat bawaan Android SDK.

1. Pastikan perangkat Anda terhubung sempurna (via USB atau status _connected_ di WiFi ADB).
2. Buka Terminal VS Code.
3. Jalankan perintah filter penyaring sintaks _log_ berikut:

```powershell
   adb logcat chromium:I *:S

```

> **Anatomi Perintah:** `adb logcat` membaca seluruh riwayat log sistem Android tingkat rendah. Flag `chromium:I` memfilter hanya saluran informasi spesifik yang dicetak oleh mesin peramban Chromium (WebView). Flag `*:S` (_Silent Priority_) membungkam dan membersihkan semua log sampah dari ribuan aplikasi latar belakang lainnya agar terminal Anda tetap bersih.

4. Anda kini akan melihat metrik aliran data sensor, siklus _callback_ status koneksi MQTT, dan indikator _error_ merah bergulir masuk secara _real-time_ seiring interaksi sentuhan Anda dengan antarmuka aplikasi di layar HP.
5. **Untuk Menghentikan Pemantauan Log:** Klik kiri mouse Anda pada area layar terminal aktif tersebut, kemudian tekan tombol kombinasi **`Ctrl + C`** di _keyboard_ Anda untuk mematikan proses inspeksi.

---

## 📂 4. Manajemen Direktori & Manipulasi File Melalui Terminal

Memahami manipulasi hierarki _file_ secara hierarkis melalui _Command Line Interface_ (CLI) PowerShell akan menghemat banyak waktu navigasi _development_ Anda dibandingkan dengan antarmuka grafis (GUI).

**Navigasi Dasar Lingkungan Operasi:**

- `dir` atau `ls` : Mengeksekusi pencetakan struktur daftar berkas (_file_) dan rincian metadata subdirektori di lokasi _path_ folder Anda saat ini.
- `cd nama_folder` : (_Change Directory_) Bergerak masuk lebih dalam ke sebuah _folder_ target secara spesifik (contoh penulisan: `cd app\src\main`).
- `cd ..` : Bergerak mundur secara parsial sebanyak satu lapisan/langkah ke luar ke arah direktori induk struktural sebelumnya.

**Operasi Massal Otomatis (Contoh Kasus: Menimpa Varian Asset Icon UI):**
Daripada menghabiskan waktu berulang kali membuka _File Explorer_ dan melakukan proses _Copy-Paste_ satu demi satu aset resolusi layar Android yang berbeda-beda (`mdpi`, `hdpi`, `xhdpi`, dll.), Anda cukup menempelkan blok _script_ PowerShell fungsional ini secara langsung di jendela terminal Anda. Otomatisasi ini akan menimpa seluruh klaster _icon_ standar bawaan sistem lama dengan struktur gambar utama Anda secara instan dan komprehensif.

```powershell
# 1. Definisikan secara absolut nama file sumber grafis dan bentuk daftar matriks array folder tujuan resolusi
$sumber = "logo_notif.png"
$targetFolders = @(
    "app\src\main\res\mipmap-mdpi",
    "app\src\main\res\mipmap-hdpi",
    "app\src\main\res\mipmap-xhdpi",
    "app\src\main\res\mipmap-xxhdpi",
    "app\src\main\res\mipmap-xxxhdpi",
    "app\src\main\res\mipmap-anydpi-v26"
)

# 2. Lakukan iterasi melingkar (looping logic) untuk menyalin dan mengeksekusi parameter timpa (force) ke dalam masing-masing hierarki
foreach ($folder in $targetFolders) {
    Copy-Item -Path $sumber -Destination "$folder\ic_launcher.png" -Force
    Write-Host "✅ Eksekusi File I/O: Berhasil memperbarui aset icon UI di dalam $folder" -ForegroundColor Green
}

```

---

## ☁️ 5. Sinkronisasi (Upload) Distribusi Pembaruan Kode ke Repositori GitHub

Sistem Kontrol Versi bawaan (Git engine) selalu beroperasi memindai dan melacak titik setiap modifikasi baris kode _syntax_, penambahan skema grafis baru, maupun manuver pergantian arsitektur basis data yang Anda kerjakan dalam ruang lingkup lokal. Untuk memproyeksikan kembali titik restorasi memori ini agar didistribusikan secara _online_ ke repositori ekosistem awan GitHub, jalankan kompilasi dari 3 tahapan eksekusi logis di bawah ini berturut-turut pada antarmuka terminal Anda:

1. **Tahap Indexing/Staging (Mengkatalogkan seluruh perubahan file ke dalam memori ruang persiapan Git secara komprehensif):**

```powershell
   git add .

```

2. **Tahap Archiving/Committing (Merekam snapshot statis kode secara hierarkis di perangkat lokal sekaligus menyematkan entitas label identifikasi yang deskriptif):**

```powershell
   git commit -m "Catatan perubahan logis komprehensif, misalnya: Finalisasi struktur Service Alarm Background Manager, Inject sinkronisasi Notifikasi Native Android 13, dan simplifikasi arsitektur routing pada logic.js"

```

3. **Tahap Distribution/Pushing (Melakukan proses unggah stream data enkripsi ke dalam infrastruktur repositori server awan GitHub):**

```powershell
   git push origin main

```

*(Catatan Kompatibilitas Penting: Apabila infrastruktur penamaan *branch* dasar repositori GitHub Anda masih menggunakan nomenklatur format inisialisasi Git gaya lama, modifikasi dan ganti parameter akhir leksikal `main` menjadi representasi `master` pada baris komando transmisi di atas).*
