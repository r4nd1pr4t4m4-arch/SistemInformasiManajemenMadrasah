import { z } from 'zod';
import { hasMaxDecimals } from './decimal';

export interface DecimalSchemaOptions {
  min?: number;
  max?: number;
  maxDecimals?: number;
  label?: string;
}

/**
 * Helper schema Zod untuk memvalidasi angka desimal secara konsisten di API,
 * selaras dengan presisi kolom NUMERIC(p, s) di PostgreSQL.
 */
export function decimalNumber(options: DecimalSchemaOptions = {}) {
  const { min, max, maxDecimals = 2, label = 'Nilai' } = options;

  let schema = z.number().finite(`${label} harus berupa angka yang valid.`);
  if (min !== undefined) {
    schema = schema.min(min, `${label} minimal ${min}.`);
  }
  if (max !== undefined) {
    schema = schema.max(max, `${label} maksimal ${max}.`);
  }

  return schema.refine((val) => hasMaxDecimals(val, maxDecimals), {
    message: `${label} maksimal ${maxDecimals} angka di belakang koma.`,
  });
}
