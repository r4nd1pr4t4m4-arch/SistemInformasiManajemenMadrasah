import { NextResponse } from 'next/server';

interface PostgresErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

const POSTGRES_CODE_MESSAGES: Record<string, string> = {
  '23505': 'Data yang Anda masukkan sudah terdaftar (duplikat).',
  '23503': 'Operasi tidak dapat dilakukan karena data masih terhubung dengan data lain atau referensi tidak ditemukan.',
  '23502': 'Beberapa data wajib belum terisi lengkap.',
  '22P02': 'Format parameter atau identitas data tidak valid.',
  '22001': 'Panjang teks melebihi batas maksimum yang diizinkan.',
  '22003': 'Nilai angka berada di luar batas yang diizinkan.',
  '42501': 'Akses ditolak oleh kebijakan keamanan database.',
  PGRST116: 'Data yang diminta tidak ditemukan.',
};

/**
 * Mencatat detail error asli hanya di log server dan mengembalikan pesan aman
 * untuk client tanpa membocorkan nama tabel, kolom, atau constraint internal.
 */
export function sanitizeApiError(
  err: unknown,
  fallback = 'Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.',
  context?: string
): string {
  if (context) {
    console.error(`[SIMMS API Error] ${context}:`, err);
  } else {
    console.error('[SIMMS API Error]:', err);
  }

  if (err && typeof err === 'object') {
    const pgErr = err as PostgresErrorLike;
    if (pgErr.code && POSTGRES_CODE_MESSAGES[pgErr.code]) {
      return POSTGRES_CODE_MESSAGES[pgErr.code];
    }
  }

  return fallback;
}

export function apiErrorResponse(
  err: unknown,
  fallback = 'Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.',
  status = 500,
  context?: string
): NextResponse {
  const safeMessage = sanitizeApiError(err, fallback, context);
  const resolvedStatus =
    err && typeof err === 'object' && (err as PostgresErrorLike).code === '23505'
      ? 409
      : err && typeof err === 'object' && (err as PostgresErrorLike).code === '22P02'
      ? 400
      : status;

  return NextResponse.json({ error: safeMessage }, { status: resolvedStatus });
}
