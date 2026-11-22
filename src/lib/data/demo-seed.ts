import type { InstitutionSettings, PostItem } from '@/types/database';

export const DEFAULT_INSTITUTION_SETTINGS: InstitutionSettings = {
  id: 'demo-institution',
  institution_type: 'MADRASAH',
  name: 'Madrasah Aliyah Negeri 1 Nusantara',
  short_name: 'MAN 1 Nusantara',
  npsn: '20109999',
  nsm: '131131710001',
  accreditation: 'A (Unggul)',
  accreditation_year: 2025,
  student_org_label: 'OSIM',
  head_title_label: 'Kepala Madrasah',
  logo_url: null,
  hero_image_url: null,
  history:
    'Berdiri sejak tahun 1998 sebagai lembaga pendidikan terpadu yang memadukan keunggulan akademik, penguasaan teknologi digital, dan pembinaan karakter berakhlak mulia.',
  vision:
    'Terwujudnya generasi beriman, berilmu, terampil digital, dan berdaya saing global.',
  mission: [
    'Menyelenggarakan pembelajaran aktif, kreatif, dan berbasis teknologi informasi.',
    'Membentuk karakter peserta didik yang disiplin, jujur, dan peduli sosial.',
    'Mengembangkan potensi akademik, riset, literasi, dan prestasi ekstrakurikuler.',
  ],
  org_structure_url: null,
  headmaster_name: 'Dr. H. Ahmad Fauzi, M.Pd.',
  headmaster_photo_url: null,
  headmaster_greeting:
    'Selamat datang di portal resmi dan sistem informasi terpadu kami. Melalui digitalisasi layanan website, akademik, keuangan, dan administrasi, kami berkomitmen menghadirkan layanan pendidikan yang transparan, cepat, dan akuntabel.',
  address: 'Jl. Pendidikan No. 45, Kec. Cendekia, Kota Nusantara',
  phone: '(021) 555-0192',
  whatsapp: '6281234567890',
  email: 'info@man1nusantara.sch.id',
  website_url: 'https://man1nusantara.sch.id',
  google_maps_embed_url: null,
  geofence_enabled: true,
  geofence_lat: -6.2,
  geofence_lng: 106.816666,
  geofence_radius_meters: 100,
  social_links: {
    youtube: 'https://youtube.com/@man1nusantara',
    instagram: 'https://instagram.com/man1nusantara',
  },
};

export const DEFAULT_POSTS: PostItem[] = [
  {
    id: 'post-1',
    title: 'Pembukaan PPDB Online Tahun Ajaran 2026/2027 Resmi Dibuka',
    slug: 'pembukaan-ppdb-online-2026-2027',
    category: 'PENGUMUMAN',
    excerpt:
      'Calon peserta didik baru kini dapat mendaftar secara daring, mengunggah berkas KK/Akta/SKL, dan memantau kelulusan langsung melalui portal.',
    content: '',
    cover_image_url: null,
    author_display_name: 'Panitia PPDB',
    status: 'PUBLISHED',
    published_at: '2026-11-10T08:00:00Z',
  },
  {
    id: 'post-2',
    title: 'Tim Riset Siswa Raih Medali Emas Olimpiade Sains Nasional',
    slug: 'tim-riset-raih-medali-emas-osn',
    category: 'BERITA',
    excerpt:
      'Prestasi membanggakan diraih tim riset bidang teknologi terapan pada ajang kompetisi tingkat nasional.',
    content: '',
    cover_image_url: null,
    author_display_name: 'Humas Lembaga',
    status: 'PUBLISHED',
    published_at: '2026-11-05T10:30:00Z',
  },
  {
    id: 'post-3',
    title: 'Esai Guru: Membangun Budaya Literasi Digital di Lingkungan Madrasah',
    slug: 'esai-guru-literasi-digital',
    category: 'KARYA_GURU',
    excerpt:
      'Refleksi pemanfaatan perpustakaan digital (e-library) untuk meningkatkan minat baca warga sekolah dan masyarakat.',
    content: '',
    cover_image_url: null,
    author_display_name: 'Siti Rahmawati, S.Pd.',
    status: 'PUBLISHED',
    published_at: '2026-11-01T09:00:00Z',
  },
];
