# Panduan Lengkap: Mengunggah Catalyst Store ke GitHub (Dari Nol)

Panduan ini ditulis untuk pemula. Ikuti langkahnya berurutan. Tanda `<...>` artinya
diganti dengan data Anda sendiri (tanpa tanda `<` dan `>`).

---

## Daftar isi

1. [Membuat akun GitHub](#1-membuat-akun-github)
2. [Mengunduh kode website dari Netlify](#2-mengunduh-kode-website-dari-netlify)
3. [Memilih cara unggah](#3-memilih-cara-unggah)
4. [Cara A — Lewat browser (paling mudah)](#cara-a--lewat-browser-paling-mudah)
5. [Cara B — Lewat GitHub Desktop (tanpa mengetik perintah)](#cara-b--lewat-github-desktop-tanpa-mengetik-perintah)
6. [Cara C — Lewat terminal / Git](#cara-c--lewat-terminal--git)
7. [Memeriksa hasil unggahan](#7-memeriksa-hasil-unggahan)
8. [Menghubungkan GitHub ke Netlify (manual)](#8-menghubungkan-github-ke-netlify)
9. [Memperbarui kode di kemudian hari](#9-memperbarui-kode-di-kemudian-hari)
10. [Mengatasi masalah umum](#10-mengatasi-masalah-umum)

---

## 1. Membuat akun GitHub

1. Buka https://github.com/signup.
2. Masukkan email, buat kata sandi, dan pilih **username** (misalnya `catalyststore`).
   Username ini akan muncul di alamat repo: `https://github.com/<username>/<nama-repo>`.
3. Selesaikan verifikasi (puzzle) lalu masukkan kode yang dikirim ke email.
4. Pilih paket **Free** — sudah cukup.
5. (Disarankan) Aktifkan **Two-factor authentication** di
   *Settings → Password and authentication* untuk keamanan akun.

Jika sudah punya akun GitHub, lewati langkah ini.

---

## 2. Mengunduh kode website dari Netlify

1. Masuk ke https://app.netlify.com dan buka proyek **catalyststr2**.
2. Buka menu **Deploys**, klik deploy paling atas (terbaru, status *Published*).
3. Klik tombol **Download** / **Download source code** — akan terunduh file `.zip`.
4. Ekstrak file zip tersebut (klik kanan → *Extract All* di Windows, atau klik dua kali di Mac).
5. Buka folder hasil ekstrak. Isinya harus mirip seperti ini:

   ```
   db/
   netlify/
   public/
   shared/
   src/
   .gitattributes
   .gitignore
   .nvmrc
   drizzle.config.ts
   index.html
   netlify.toml
   package.json
   package-lock.json
   PANDUAN-GITHUB.md
   README.md
   tsconfig.json
   vite.config.js
   ```

   > File yang diawali titik (`.gitignore`, `.gitattributes`, `.nvmrc`) sering
   > **tersembunyi**. Tampilkan dengan cara:
   > - **Windows**: File Explorer → tab *View* → centang **Hidden items**.
   > - **Mac**: di Finder tekan `Cmd + Shift + .` (titik).

6. Jika ada folder `node_modules`, `dist`, atau `.netlify`, **hapus** atau jangan ikut
   diunggah. Folder itu dibuat ulang otomatis dan ukurannya besar.

---

## 3. Memilih cara unggah

| Cara | Cocok untuk | Perlu instal |
| --- | --- | --- |
| **A. Browser** | Paling cepat, sekali unggah | Tidak |
| **B. GitHub Desktop** | Pemula yang ingin sering memperbarui | GitHub Desktop |
| **C. Terminal / Git** | Yang terbiasa dengan perintah | Git |

Pilih **salah satu** saja.

---

## Cara A — Lewat browser (paling mudah)

1. Buka https://github.com/new.
2. Isi:
   - **Repository name**: misalnya `catalyst-store`
   - **Visibility**: pilih **Private** (disarankan, agar kode tidak bisa dilihat orang lain)
     atau **Public**.
   - **Jangan** centang *Add a README file*, *.gitignore*, atau *license*.
3. Klik **Create repository**.
4. Di halaman berikutnya klik tautan **uploading an existing file**.
5. Buka folder proyek, **pilih semua isinya** (`Ctrl + A` / `Cmd + A`), lalu seret ke
   halaman GitHub. Seret **isi** folder, bukan folder induknya.
6. Tunggu semua file selesai terunggah, lalu di bawah tulis pesan, misalnya
   `Upload pertama Catalyst Store`, dan klik **Commit changes**.

> Batasan cara browser: maksimal 100 file sekali unggah dan 25 MB per file. Proyek ini
> jauh di bawah batas itu selama `node_modules` tidak ikut. Jika folder tidak ikut terunggah
> saat diseret (terjadi di beberapa browser), gunakan Cara B.

Lanjut ke [langkah 7](#7-memeriksa-hasil-unggahan).

---

## Cara B — Lewat GitHub Desktop (tanpa mengetik perintah)

1. Unduh dan pasang GitHub Desktop dari https://desktop.github.com.
2. Buka aplikasinya → **Sign in to GitHub.com** → masuk dengan akun Anda.
3. Menu **File → Add local repository…** → klik **Choose…** → pilih folder proyek.
4. Akan muncul pesan *"This directory does not appear to be a Git repository"*.
   Klik **create a repository**.
   - **Name**: `catalyst-store`
   - **Git ignore**: biarkan **None** (proyek sudah punya `.gitignore`)
   - **License**: None
   - Klik **Create repository**.
5. Di kiri bawah sudah terisi *Summary* "Initial commit" → klik **Commit to main**.
6. Klik **Publish repository** di bagian atas.
   - Centang **Keep this code private** jika ingin repo privat.
   - Klik **Publish repository**.

Selesai. Lanjut ke [langkah 7](#7-memeriksa-hasil-unggahan).

---

## Cara C — Lewat terminal / Git

### C1. Pasang Git

- **Windows**: unduh dari https://git-scm.com/download/win, pasang dengan pilihan bawaan.
  Setelah itu gunakan aplikasi **Git Bash**.
- **Mac**: buka Terminal lalu ketik `git --version`. Jika belum ada, Mac akan menawarkan
  pemasangan otomatis — klik **Install**.
- **Linux (Ubuntu/Debian)**: `sudo apt install git`

Cek berhasil:

```bash
git --version
```

### C2. Atur identitas (sekali saja)

```bash
git config --global user.name "<Nama Anda>"
git config --global user.email "<email-yang-dipakai-di-github>"
```

### C3. Buat repository kosong di GitHub

1. Buka https://github.com/new.
2. Isi nama repo (misalnya `catalyst-store`), pilih **Private** atau **Public**.
3. **Jangan** centang *Add a README*, *.gitignore*, atau *license*.
4. Klik **Create repository**, lalu salin alamatnya, contoh:
   `https://github.com/<username>/catalyst-store.git`

### C4. Buat token akses (pengganti kata sandi)

GitHub tidak menerima kata sandi akun saat `git push`. Buat token:

1. Buka https://github.com/settings/tokens → **Generate new token → Generate new token (classic)**.
2. **Note**: `laptop saya`, **Expiration**: sesuai kebutuhan, centang **repo**.
3. Klik **Generate token** dan **salin token** (hanya tampil sekali). Simpan di tempat aman,
   jangan dibagikan dan jangan ditaruh di dalam kode.

> Di Windows, Git biasanya membuka jendela login browser otomatis sehingga token tidak
> perlu dibuat manual.

### C5. Unggah kode

Buka terminal di folder proyek:

- **Windows**: buka folder proyek → klik kanan di area kosong → **Open Git Bash here**.
- **Mac/Linux**: ketik `cd ` (dengan spasi), seret folder proyek ke Terminal, tekan Enter.

Lalu jalankan satu per satu:

```bash
git init
git add .
git commit -m "Upload pertama Catalyst Store"
git branch -M main
git remote add origin https://github.com/<username>/catalyst-store.git
git push -u origin main
```

Saat diminta:
- **Username**: username GitHub Anda
- **Password**: tempel **token** dari langkah C4 (tulisan tidak terlihat saat ditempel — itu normal)

---

## 7. Memeriksa hasil unggahan

Buka `https://github.com/<username>/catalyst-store`. Pastikan:

- ✅ Ada folder `src`, `netlify`, `db`, `shared`, `public` dan file `package.json`, `netlify.toml`.
- ✅ Ada file `.gitignore` dan folder `netlify/database/migrations`.
- ❌ **Tidak ada** folder `node_modules`, `dist`, `.netlify`, maupun file `.env`.

Jika ada yang ikut terunggah padahal tidak boleh, lihat
[Mengatasi masalah umum](#10-mengatasi-masalah-umum).

---

## 8. Menghubungkan GitHub ke Netlify

Setelah kode ada di GitHub, sambungkan repo tersebut ke Netlify **secara manual** agar
setiap perubahan (push) di GitHub otomatis memperbarui website. Pilih **salah satu**:

| Pilihan | Hasil | Data lama (akun, pesanan, pengaturan toko) |
| --- | --- | --- |
| **8A. Sambungkan ke proyek lama `catalyststr2`** (disarankan) | Alamat website tetap `catalyststr2.netlify.app` | ✅ Tetap ada |
| **8B. Buat proyek Netlify baru** | Alamat website baru | ❌ Mulai dari kosong |

### 8A. Menyambungkan repo GitHub ke proyek yang sudah ada (disarankan)

1. Masuk ke https://app.netlify.com dan buka proyek **catalyststr2**.
2. Buka **Project configuration → Build & deploy → Continuous deployment**.
3. Di bagian **Repository**, klik **Manage repository → Link to a different repository**
   (jika belum ada repo yang tersambung, tombolnya bernama **Link repository**).
4. Pilih **GitHub**, lalu klik **Authorize Netlify** / izinkan Netlify mengakses akun GitHub.
   - Jika repo tidak muncul di daftar, klik **Configure the Netlify app on GitHub**, pilih
     akun Anda, lalu di *Repository access* pilih **Only select repositories** → centang
     repo `catalyst-store` → **Save**. Kembali ke Netlify dan muat ulang daftarnya.
5. Pilih repo `catalyst-store`.
6. Isi pengaturan berikut (biasanya sudah terisi otomatis dari `netlify.toml`):

   | Pengaturan | Isi |
   | --- | --- |
   | Branch to deploy | `main` |
   | Base directory | *(kosongkan)* |
   | Build command | `npm run build` |
   | Publish directory | `dist` |
   | Functions directory | *(biarkan bawaan)* |

7. Klik **Save** / **Link repository**.
8. Buka menu **Deploys** → **Trigger deploy → Deploy site** untuk deploy pertama dari GitHub.
   Tunggu sampai statusnya **Published**, lalu buka website dan pastikan bisa login seperti biasa.

Mulai sekarang setiap `git push` ke branch `main` otomatis men-deploy ulang website.

> **Jangan hapus folder `netlify/database/migrations`** atau mengubah isinya. Netlify
> mencocokkan migrasi di repo dengan yang sudah diterapkan di database; jika ada yang
> hilang atau berubah, deploy akan gagal.

### 8B. Membuat proyek Netlify baru dari repo GitHub

1. Masuk ke https://app.netlify.com.
2. Klik **Add new project → Import an existing project → GitHub**.
3. Izinkan Netlify mengakses GitHub, lalu pilih repo `catalyst-store`.
4. Pengaturan build terbaca otomatis dari `netlify.toml` (sama seperti tabel di 8A).
5. Klik **Deploy**. Netlify Database dan Netlify Blobs disiapkan otomatis, dan migrasi
   database diterapkan saat deploy.
6. Daftar lewat **Portal Admin** — admin pertama di proyek baru otomatis menjadi Super Admin.

> Proyek baru memiliki database **kosong**: akun, pesanan, foto, dan pengaturan toko dari
> `catalyststr2.netlify.app` tidak ikut pindah.

### Tidak perlu mengisi variabel lingkungan

Proyek ini tidak memakai kunci API atau file `.env`. Koneksi database dan penyimpanan file
disediakan otomatis oleh Netlify, jadi setelah repo tersambung tidak ada yang perlu diisi
di **Environment variables**.

---

## 9. Memperbarui kode di kemudian hari

- **Cara A (browser)**: buka repo → **Add file → Upload files** → seret file yang diubah →
  **Commit changes**.
- **Cara B (GitHub Desktop)**: perubahan muncul otomatis di aplikasi → isi *Summary* →
  **Commit to main** → **Push origin**.
- **Cara C (terminal)**:

  ```bash
  git add .
  git commit -m "Jelaskan perubahan di sini"
  git push
  ```

Jika repo sudah terhubung ke Netlify, website diperbarui otomatis beberapa menit setelah push.

---

## 10. Mengatasi masalah umum

**`node_modules` atau `dist` ikut terunggah**
Pastikan file `.gitignore` ada di folder utama proyek. Lalu hapus dari repo (file di komputer tetap aman):

```bash
git rm -r --cached node_modules dist
git commit -m "Hapus folder yang tidak perlu"
git push
```

**`error: remote origin already exists`**

```bash
git remote set-url origin https://github.com/<username>/catalyst-store.git
```

**`! [rejected] main -> main (fetch first)`**
Repo GitHub tidak kosong (misalnya tercentang *Add a README*). Gabungkan dulu:

```bash
git pull origin main --allow-unrelated-histories
git push -u origin main
```

**`Authentication failed` / `Support for password authentication was removed`**
Gunakan **token** (langkah C4) sebagai password, bukan kata sandi akun GitHub.

**`fatal: not a git repository`**
Terminal tidak berada di folder proyek. Pindah dulu dengan `cd <alamat-folder-proyek>`.

**File `.gitignore` tidak terlihat / tidak ikut terunggah lewat browser**
Tampilkan file tersembunyi (lihat langkah 2), atau gunakan Cara B / C yang otomatis
menyertakannya.

**Tidak sengaja mengunggah kata sandi / kunci rahasia**
Segera ganti (rotate) kunci tersebut di layanan asalnya — menghapus file saja tidak cukup
karena riwayat Git tetap menyimpannya.

---

## Menjalankan website di komputer sendiri (opsional)

Lihat bagian **Menjalankan di komputer sendiri** di [README.md](README.md).
