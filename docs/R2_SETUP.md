# Panduan Konfigurasi Cloudflare R2 (Storage)

SIMMS menggunakan **Cloudflare R2** (S3-compatible) untuk menyimpan:
- Berkas pendaftaran PPDB Online (`ppdb/`) — KK, Akta Kelahiran, Ijazah/SKL
- Gambar artikel/berita CMS (`cms-posts/`)
- Foto galeri kegiatan (`gallery/`)
- File e-book PDF perpustakaan (`ebooks/`)
- Arsip surat digital (`letters/`)

## 1. Pastikan Variabel `.env.local` Lengkap
Pastikan ke-5 variabel berikut terisi di `.env.local` (dan nanti di **Vercel Environment Variables**):
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME` *(nama bucket R2 Anda, misal `simms-storage`)*
- `R2_PUBLIC_URL` *(URL publik bucket atau custom domain R2 Anda)*

## 2. Terapkan Aturan CORS Otomatis
Setelah `R2_BUCKET_NAME` diisi, jalankan perintah berikut untuk mengizinkan browser melakukan upload langsung (`PUT`) via presigned URL:

```bash
# Untuk pengembangan lokal (localhost:3000)
npm run r2:cors

# Untuk domain produksi Vercel / domain sekolah saat go-live
node scripts/configure-r2-cors.mjs https://simms-anda.vercel.app https://madrasahanda.sch.id
```

## 3. Verifikasi Akses Publik
Pastikan **Public Development URL** (`*.r2.dev`) atau **Custom Domain** diaktifkan pada pengaturan bucket R2 di Dashboard Cloudflare sehingga file yang sudah diunggah dapat diakses melalui `R2_PUBLIC_URL`.
