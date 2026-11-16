# Arsitektur Sistem SIMMS (Sistem Informasi Manajemen Madrasah / Sekolah)

## 1. Ringkasan Stack Teknologi
- **Frontend & Backend (Fullstack)**: Next.js (App Router, TypeScript, Tailwind CSS)
- **Database & Auth**: Supabase (PostgreSQL + Row Level Security + Auth)
- **Object Storage**: Cloudflare R2 (S3-compatible API) untuk berkas PPDB (KK, Akta, Ijazah/SKL), foto galeri, e-book PDF, dan arsip surat digital
- **Deployment**: Vercel

---

## 2. Tiga Pilar Fungsi Utama

### Pilar 1: Website Resmi & CMS (`/` & `/portal/cms`)
1. **Profil Lembaga** (Fleksibel Madrasah / Sekolah via `institution_settings`): Sejarah, Visi & Misi, Struktur Organisasi, Akreditasi, Sarana Prasarana, Sambutan Kepala Madrasah/Sekolah.
2. **Berita & Artikel (Blog)**: Berita, Artikel, Pengumuman (libur/ujian), Karya Tulis Guru & Siswa.
3. **Galeri & Multimedia**: Foto kegiatan, Video profil, tautan YouTube & media sosial.
4. **Direktori GTK & Siswa**: Profil GTK publik & halaman Prestasi Siswa.
5. **PPDB Online**: Formulir pendaftaran daring, unggah berkas persyaratan ke R2 (KK, Akta, Ijazah/SKL), cek status seleksi & pengumuman kelulusan mandiri dengan nomor pendaftaran.
6. **Layanan Informasi & Kontak**: Formulir pengaduan/aspirasi, Google Maps, kontak resmi, dan FAQ.

### Pilar 2: Portal Akademik (`/portal/akademik`)
1. **Buku Induk Digital**:
   - Siswa: NIS, NISN, NIK, data orang tua, status aktif/mutasi/lulus, QR Kartu Pelajar.
   - GTK: NUPTK, NIP, NIK, status kepegawaian, riwayat jabatan (`employment_histories`).
2. **Manajemen Kelas & Jadwal**: Rombongan belajar (rombel), Wali Kelas, jadwal pelajaran (dengan jumlah JTM), jadwal piket guru.
3. **Presensi / Absensi Digital**:
   - Presensi siswa (harian atau per jam pelajaran).
   - Presensi guru berbasis **GPS / Geofencing** (menghitung jarak Haversine terhadap titik koordinat & radius lembaga).
   - **Delegasi Guru Pengganti**: Mengajar atau piket saat berhalangan, mencatat pengalihan JTM ke guru pengganti.
4. **Presensi & Jadwal Periode Ujian**:
   - Presensi siswa per ruang & sesi ujian.
   - Penugasan **Pengawas Ruang Ujian** & **Panitia Ujian** dengan alokasi JTM yang diatur oleh Admin/Operator.

### Pilar 3: Administrasi, Keuangan & Layanan Pendukung (`/portal/keuangan`, `/portal/layanan`)
1. **Keuangan & Pembayaran**:
   - **SPP / Iuran Komite / Uang Gedung**: Tagihan, pembayaran, laporan tunggakan. Dikelola oleh **Bendahara Komite**.
   - **Tabungan Digital**: Rekening & buku tabungan untuk **Siswa, Guru, TU, dan Masyarakat Umum**. Dikelola oleh **Pengelola Tabungan**.
   - *Aturan Bisnis*: `BENDAHARA_KOMITE` dan `PENGELOLA_TABUNGAN` memiliki `receives_allowance = false` (tidak mendapat tambahan tunjangan honorarium).
2. **Manajemen Honorarium Guru**:
   - Formula: `(JTM Mengajar + JTM Pengganti + JTM Pengawas Ujian + JTM Panitia Ujian) × Tarif per JTM + Total Tunjangan Tugas Tambahan`.
   - Tarif per JTM dan nominal bulanan masing-masing tugas tambahan (Wali Kelas, Guru Wali, Kepala Madrasah/Sekolah, Operator, Bendahara, Kepala TU, Pembina OSIM/OSIS, Pembina Ekstrakurikuler, Waka Kesiswaan/Kurikulum/Humas/Sarpras) dapat diatur langsung oleh Admin.
3. **Persuratan & Arsip Digital**: Surat Keterangan Siswa Aktif, Surat Mutasi, Surat Tugas Guru, Surat Masuk/Keluar, serta cetak **Kartu Pelajar Digital**.
4. **Perpustakaan Digital (E-Library)**: Katalog buku fisik & e-book, peminjaman/pengembalian/denda. Warga sekolah otomatis terdaftar sebagai anggota beserta kartu anggota; masyarakat umum mendaftar terlebih dahulu untuk mengakses e-book.
5. **Bimbingan Konseling (BK) & Poin**: Rekam jejak pelanggaran, poin prestasi, dan riwayat konsultasi rahasia dengan Guru BK.
6. **Manajemen Guru Wali**: Rekam jejak bimbingan personal siswa bersama Guru Wali (terpisah dari BK).
7. **Tracer Study / Portal Alumni**: Pendataan sebaran alumni di perguruan tinggi maupun dunia kerja.

---

## 3. Rencana Pembangunan Bertahap
- **Tahap 1 (Fondasi — Selesai/Berjalan)**: Next.js TypeScript + Tailwind, Skema Database PostgreSQL lengkap (`supabase/migrations/0001_initial_schema.sql`), Tipe TypeScript, Utilitas Supabase & Cloudflare R2, Utilitas Geofencing & Kalkulasi Honorarium, Layout Website Publik + Shell Portal Terpadu.
- **Tahap 2 (Website Resmi, CMS & PPDB Online)**: CRUD Pengaturan Lembaga, Berita/Blog, Galeri, Direktori GTK & Prestasi, Formulir PPDB + Upload R2 + Cek Kelulusan.
- **Tahap 3 (Portal Akademik)**: Buku Induk Siswa & GTK, Kelas/Rombel & Jadwal, Presensi Siswa, Presensi Guru + GPS Geofencing + Delegasi Pengganti, Modul Ujian (Pengawas & Panitia JTM).
- **Tahap 4 (Keuangan & Honorarium)**: Tagihan & Pembayaran SPP/Komite, Tabungan Multi-segmen (Siswa/Guru/TU/Umum), Mesin Hitung Honorarium Guru & Pengaturan Tarif/Tunjangan.
- **Tahap 5 (Layanan Pendukung)**: Persuratan & Kartu Pelajar, E-Library, BK & Poin, Guru Wali, Tracer Study Alumni.
