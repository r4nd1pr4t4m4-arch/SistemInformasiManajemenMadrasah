'use client';

import type { InputHTMLAttributes } from 'react';
import { normalizeDecimalInput } from '@/lib/validation/decimal';

export interface DecimalInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'inputMode' | 'value' | 'onChange'
  > {
  value: string;
  onValueChange: (normalizedValue: string) => void;
  allowNegative?: boolean;
  maxDecimals?: number;
}

/**
 * Komponen input angka desimal terpusat yang menerima pemisah koma (',') maupun titik ('.')
 * secara konsisten lintas browser & locale, dengan keyboard numerik desimal di perangkat mobile.
 */
export function DecimalInput({
  value,
  onValueChange,
  allowNegative = false,
  maxDecimals,
  ...rest
}: DecimalInputProps) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) =>
        onValueChange(
          normalizeDecimalInput(e.target.value, {
            allowNegative,
            maxDecimals,
          })
        )
      }
    />
  );
}
