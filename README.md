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
