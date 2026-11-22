# CATALYST STORE — Joki Game & Toko Akun

Platform joki game dan toko akun game. Pelanggan membuat akun, menghitung biaya joki
dengan kalkulator, membeli akun game, membayar lewat rekening/QRIS, mengunggah bukti
transfer, dan memantau riwayat pesanannya. Admin mengelola katalog, skema tarif, stok akun,
pesanan, refund, dan kontak CS.

## Fitur utama

- **Akun tersimpan di server** — daftar sekali, bisa masuk dari perangkat mana pun.
  Login wajib (tidak ada login tamu). Me-refresh halaman atau membuka di perangkat lain
  selalu dimulai dari layar masuk akun, lalu semua data dimuat ulang dari server.
- **Sinkron otomatis** — data diperbarui tiap beberapa detik dan saat tab kembali aktif,
  juga bisa disinkronkan manual lewat tombol ⟳ di header.
- **Peran**: 1 Super Admin (admin pertama yang mendaftar), Admin (perlu disetujui
  Super Admin dan hanya bisa mengontrol bagian yang diizinkan), dan Pelanggan (data &
  riwayat pesanan privat, hanya bisa diakses akun itu sendiri).
- **Checkpoint & Skema Tarif** — skema yang disimpan admin langsung menjadi pilihan
  Posisi Awal & Target Tujuan di Langkah 3 kalkulator; skema tersimpan bisa diedit/dihapus.
- **Jual Akun** — tambah, edit, atur stok (+/−), dan hapus akun. Stok berkurang saat
  dipesan dan kembali otomatis jika pesanan dibatalkan/kedaluwarsa/di-refund.
- **Riwayat pesanan** — pelanggan dan admin masing-masing bisa menghapus pesanan dari
  daftarnya sendiri tanpa memengaruhi pihak lain.
- Logo toko dipakai sebagai favicon (ikon tab browser).

## Teknologi

- React 19 + Vite + Tailwind CSS v4 (frontend, `src/`)
- Netlify Server dengan Hono (API di `/api/*`, `netlify/server/index.ts`)
- Netlify Database (Postgres) + Drizzle ORM (`db/schema.ts`)
- Netlify Blobs untuk gambar yang diunggah (bukti transfer, foto akun, QRIS)

## Menjalankan secara lokal

```bash
npm install
netlify dev
```

`netlify dev` menjalankan frontend, API server, database, dan blobs secara lokal.

Perubahan skema database: edit `db/schema.ts`, lalu jalankan
`npx drizzle-kit generate --name <nama_perubahan>`. Migrasi diterapkan otomatis saat deploy.
