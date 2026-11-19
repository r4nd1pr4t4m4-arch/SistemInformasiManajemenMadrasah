import { z } from 'zod';

/** Hanya digit, maksimal 16 (NIK / No. KK). */
export const NIK_MAX = 16;
/** Hanya digit, maksimal 12 (No. HP / WhatsApp). */
export const PHONE_MAX = 12;
/** Jeda perubahan Nama Lengkap (hari). */
export const NAME_CHANGE_COOLDOWN_DAYS = 30;

export function digitsOnly(value: string, max: number): string {
  return (value || '').replace(/\D/g, '').slice(0, max);
}

const optionalDigits = (max: number, label: string) =>
  z
    .string()
    .regex(new RegExp(`^\\d{0,${max}}$`), `${label} hanya boleh berisi angka (maksimal ${max} digit).`)
    .optional()
    .nullable();

export const nikSchema = optionalDigits(NIK_MAX, 'NIK');
export const kkSchema = optionalDigits(NIK_MAX, 'Nomor KK');
export const phoneSchema = optionalDigits(PHONE_MAX, 'Nomor HP');

export const RELIGION_OPTIONS = [
  'Islam',
  'Kristen Katolik',
  'Kristen Protestan',
  'Hindu',
  'Buddha',
  'Konghucu',
] as const;

export const COUNT_OPTIONS_1_TO_12 = Array.from({ length: 12 }, (_, i) => String(i + 1));
