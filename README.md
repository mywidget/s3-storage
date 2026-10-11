# CloudVault Encrypted Object Storage & Sync

Aplikasi Cloud Object Storage & Sinkronisasi terenkripsi otomatis client-side/server (**AES-256-GCM**) dengan dukungan multi-endpoint untuk **Cloudflare R2** dan **AWS S3**.

---

## 🚀 Panduan Menjalankan dengan PM2 (Production)

Panduan ini ditujukan untuk men-deploy dan menjalankan aplikasi **CloudVault** di server Linux / VPS (Ubuntu, Debian, AlmaLinux, CentOS) menggunakan **PM2** sebagai process manager agar aplikasi terus berjalan di latar belakang (*background*), otomatis restart jika terjadi crash, dan otomatis menyala saat server reboot.

---

### 1. Prasyarat Sistem

Pastikan server Anda telah terpasang:
- **Node.js** versi 18.x atau 20.x+ (LTS disarankan)
- **NPM** atau **Bun**
- **PM2** (instal secara global jika belum ada):
  ```bash
  sudo npm install -g pm2
  ```

---

### 2. Kloning / Unduh Proyek & Setup Environment

1. Masuk ke direktori aplikasi:
   ```bash
   cd /path/ke/folder/cloudvault
   ```

2. Salin file template environment `.env.example` ke `.env`:
   ```bash
   cp .env.example .env
   ```

3. Sesuaikan konfigurasi di file `.env` menggunakan editor teks (misal: `nano .env`):
   ```env
   NODE_ENV="production"
   PORT=3000
   VAULT_MASTER_KEY="kunci-enkripsi-rahasia-anda"

   # Endpoint R2 / S3 Aktif
   ACTIVE_STORAGE_ENDPOINT_ID="printpro"

   # ENDPOINT 1 (Primary R2 Storage)
   ENDPOINT_1_ID="printpro"
   ENDPOINT_1_NAME="Cloudflare R2 - PrintPro"
   ENDPOINT_1_URL="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
   ENDPOINT_1_REGION="auto"
   ENDPOINT_1_BUCKET="nama-bucket-anda"
   ENDPOINT_1_KEY_ID="access-key-id-anda"
   ENDPOINT_1_SECRET="secret-access-key-anda"
   ENDPOINT_1_PUBLIC_URL="https://storage.domain-anda.com"
   ```

---

### 3. Instalasi Dependensi & Build Frontend

Sebelum menjalankan di production, instal dependensi dan build aset frontend:

```bash
# 1. Instal seluruh dependensi
npm install

# 2. Build aplikasi web ke folder dist/
npm run build
```

> **Catatan Penting:** 
> Perintah `npm run build` akan membuat bundle statis di folder `dist/`. Pada mode produksi (`NODE_ENV=production`), server Express secara otomatis akan menyajikan file dari `dist/` dan tidak menjalankan Vite dev server.

---

### 4. Menjalankan Aplikasi Menggunakan PM2

Tersedia beberapa cara untuk menjalankan CloudVault dengan PM2:

#### Cara A: Menggunakan File Konfigurasi `ecosystem.config.cjs` (Direkomendasikan)

File `ecosystem.config.cjs` sudah tersedia di dalam proyek ini:

```bash
pm2 start ecosystem.config.cjs
```

#### Cara B: Menggunakan NPM Script

```bash
pm2 start npm --name "cloudvault" -- run start
```

#### Cara C: Perintah Langsung CLI

```bash
pm2 start "npx tsx server.ts" --name "cloudvault" --env NODE_ENV=production
```

---

### 5. Memeriksa Status & Log Aplikasi

- **Melihat status aplikasi yang berjalan:**
  ```bash
  pm2 status
  # atau
  pm2 list
  ```

- **Melihat log real-time (console output & error):**
  ```bash
  pm2 logs cloudvault
  ```

- **Melihat log dengan baris terbatas (contoh 50 baris terakhir):**
  ```bash
  pm2 logs cloudvault --lines 50
  ```

- **Monitoring penggunaan CPU & Memori secara live:**
  ```bash
  pm2 monit
  ```

---

### 6. Perintah Pengelolaan Siklus Hidup PM2

- **Merestart aplikasi:**
  ```bash
  pm2 restart cloudvault
  ```

- **Menghentikan aplikasi:**
  ```bash
  pm2 stop cloudvault
  ```

- **Menghapus aplikasi dari daftar PM2:**
  ```bash
  pm2 delete cloudvault
  ```

---

### 7. Konfigurasi Autostart saat Server Reboot / Restart

Agar CloudVault otomatis menyala kembali setelah server VPS di-reboot atau restart listrik:

1. Simpan daftar proses PM2 yang sedang aktif:
   ```bash
   pm2 save
   ```

2. Daftarkan PM2 ke startup systemd:
   ```bash
   pm2 startup
   ```
   *(Salin dan jalankan perintah `sudo env PATH=...` yang dimunculkan oleh terminal).*

3. Verifikasi dengan mengecek status service systemd:
   ```bash
   systemctl status pm2-<user>
   ```

---

### 8. Konfigurasi Reverse Proxy Nginx & SSL (Opsional)

Jika ingin mengakses CloudVault menggunakan nama domain atau subdomain Anda dengan HTTPS (Port 80/443), buat file konfigurasi virtual host Nginx:

```nginx
# /etc/nginx/sites-available/cloudvault.conf
server {
    server_name storage-vault.domainanda.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Upload file berukuran besar
        client_max_body_size 500M;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```

Aktifkan konfigurasi dan pasang sertifikat SSL gratis Let's Encrypt:

```bash
sudo ln -s /etc/nginx/sites-available/cloudvault.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d storage-vault.domainanda.com
```

---

### 9. Ringkasan Perintah Update Aplikasi di Kemudian Hari

Ketika Anda melakukan update kode dari git:

```bash
git pull origin main
npm install
npm run build
pm2 restart cloudvault
```

---

### ⚠️ Solusi Masalah Umum (Troubleshooting)

#### Error: `Loading module from “.../src/main.tsx” was blocked because of a disallowed MIME type (“application/octet-stream”)`

Penyebab error ini terjadi:
1. **Frontend Belum Di-build**: File `/src/main.tsx` adalah file mentah TypeScript development yang ada di root `index.html`. Pada production, browser **harus** memuat file JavaScript terkompilasi dari folder `dist/` (contoh: `/assets/index-xxxx.js`), bukan `/src/main.tsx`.
   - **Solusi:** Jalankan `npm run build` di server VPS Anda:
     ```bash
     npm run build
     pm2 restart cloudvault
     ```
2. **Konfigurasi Nginx Salah Mengarahkan `root`**:
   Jika di konfigurasi Nginx Anda terdapat baris seperti:
   ```nginx
   # ❌ SALAH (Jangan arahkan ke root folder proyek):
   root /var/www/cloudvault;
   try_files $uri $uri/ /index.html;
   ```
   Nginx akan mengambil file mentah `/src/main.tsx` langsung dari disk dan menyajikannya sebagai `application/octet-stream` (karena Nginx tidak mengenal ekstensi `.tsx`).
   - **Solusi:** 
     Hapus baris `root` dan `try_files` tersebut, dan biarkan Nginx mem-*proxy pass* semua request ke Express di port 3000:
     ```nginx
     # ✅ BENAR:
     location / {
         proxy_pass http://127.0.0.1:3000;
         proxy_http_version 1.1;
         proxy_set_header Upgrade $http_upgrade;
         proxy_set_header Connection 'upgrade';
         proxy_set_header Host $host;
         proxy_set_header X-Real-IP $remote_addr;
         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
         proxy_set_header X-Forwarded-Proto $scheme;
     }
     ```
     Lalu jalankan `sudo nginx -t && sudo systemctl reload nginx`.


---

#### Error: `502 Bad Gateway` atau Halaman Blank (Jika Port 3000 Sudah Digunakan / Memakai Port 1008)

Jika di server VPS / aaPanel Anda **Port 3000 sudah digunakan** oleh aplikasi lain, Anda bisa menggunakan port lain (misalnya **`1008`**).

##### Mengapa muncul `502 Bad Gateway`?
- Di konfigurasi Nginx aaPanel, Anda mengatur `proxy_pass http://127.0.0.1:1008;`.
- Namun proses Node.js CloudVault di PM2 **belum mendengarkan (listen) di port 1008** (karena sebelumnya masih diset ke port 3000, atau PM2 crash karena port 3000 bentrok dengan aplikasi lain).
- Nginx mencoba menghubungi port 1008, namun tidak ada proses yang merespons, sehingga Nginx / Cloudflare melempar error **502 Bad Gateway**.

##### Mengapa saat `proxy_pass` dihapus halamannya menjadi Blank (Putih Kosong)?
- Ketika blok `proxy_pass` dihapus, Nginx aaPanel hanya menyajikan folder statis kosong tanpa terhubung ke backend Express CloudVault. Seluruh API backend terputus, sehingga browser menampilkan halaman kosong.

##### Solusi: Cara Mengubah Port ke 1008 dengan Benar

1. **Ubah `PORT` di file `.env` di folder proyek Anda:**
   ```bash
   nano .env
   ```
   Tambahkan atau ubah baris:
   ```env
   PORT=1008
   ```

2. **Jalankan / Restart PM2 agar membaca port 1008:**
   ```bash
   pm2 restart cloudvault --update-env
   ```
   *(Atau jika baru pertama kali: `pm2 start ecosystem.config.cjs`)*

3. **Uji apakah Node.js sudah aktif di port 1008:**
   ```bash
   curl http://127.0.0.1:1008/api/health
   ```
   Jika muncul respon JSON (misal `{"status":"connected"}` atau data profil), berarti Node.js **sudah berhasil aktif di port 1008**.

4. **Gunakan kembali konfigurasi Reverse Proxy di aaPanel Nginx:**
   ```nginx
   location / {
       proxy_pass http://127.0.0.1:1008;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_cache_bypass $http_upgrade;

       client_max_body_size 500M;
       proxy_read_timeout 600s;
       proxy_send_timeout 600s;
   }
   ```
   Simpan dan klik **Reload Nginx**. Buka kembali domain Anda, website akan langsung terbuka normal dan error 502 / Blank akan terselesaikan!

---

#### Error: `[vite] failed to connect to websocket (Error: WebSocket closed without opened.)`

##### Mengapa Error Ini Muncul?
- Pesan ini berasal dari script `/@vite/client` bawaan **Vite Development Server**.
- Script ini bertugas membuka koneksi WebSocket untuk fitur HMR (*Hot Module Replacement* / reload otomatis saat koding di komputer lokal).
- Jika pesan ini muncul di browser saat membuka domain VPS Anda (`https://s3.thm.my.id`), artinya:
  1. **Aplikasi di VPS Anda masih berjalan dalam Mode Development** (belum di-build ke mode Production), ATAU
  2. Perintah `npm run build` belum dijalankan di VPS sehingga folder `dist/` belum ada, menyebabkan server Node.js terpaksa menjalankan Vite Dev Server, ATAU
  3. Koneksi WebSocket dihalangi oleh **Cloudflare** (fitur WebSockets belum aktif) atau Nginx.

---

##### Solusi Utama (Rekomendasi Terbaik untuk Server / VPS):
Di server produksi, aplikasi **seharusnya tidak menjalankan Vite Dev Server**, melainkan menyajikan bundle statis yang sudah di-build (`dist/`). Bundle produksi tidak memuat WebSocket HMR sama sekali, sehingga loading jauh lebih cepat dan bebas error!

Jalankan langkah berikut di terminal VPS Anda:

1. **Jalankan Build Proyek:**
   ```bash
   npm run build
   ```
   *(Tunggu beberapa detik hingga folder `dist/` berhasil dibuat).*

2. **Restart PM2 dengan konfigurasi Production:**
   ```bash
   pm2 restart cloudvault --update-env
   ```
   *(Atau jika belum aktif: `pm2 start ecosystem.config.cjs`)*

3. **Cek Log PM2:**
   ```bash
   pm2 logs cloudvault --lines 20
   ```
   Anda akan melihat log:
   `[CloudVault] Serving static production build from dist/`
   
   Sekarang refresh browser Anda dengan `Ctrl + F5` (hard refresh). Error WebSocket akan hilang 100%!

---

##### Solusi Alternatif (Jika Memang Ingin Menjalankan Vite Dev Server di VPS):
Jika Anda sengaja ingin menjalankan dalam dev mode di domain publik:

1. **Aktifkan WebSockets di Cloudflare:**
   - Masuk ke [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Pilih domain Anda (`thm.my.id`)
   - Buka menu **Network** di sebelah kiri
   - Cari opsi **WebSockets** dan ubah menjadi **ON** (Enabled).

2. **Pastikan Header WebSocket di Nginx aaPanel sudah terpasang:**
   ```nginx
   proxy_http_version 1.1;
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection 'upgrade';
   ```

3. **Atau Matikan HMR di file `.env`:**
   Tambahkan baris berikut di `.env`:
   ```env
   DISABLE_HMR=true
   ```
   Lalu restart PM2: `pm2 restart cloudvault --update-env`.
