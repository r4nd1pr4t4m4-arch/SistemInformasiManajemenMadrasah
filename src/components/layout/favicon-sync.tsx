'use client';

import { useInstitutionSettings } from '@/lib/hooks/use-institution-settings';

export function InstitutionFaviconSync() {
  useInstitutionSettings();
  return null;
}
