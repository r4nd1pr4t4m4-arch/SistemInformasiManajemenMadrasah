'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_INSTITUTION_SETTINGS } from '@/lib/data/demo-seed';
import type { InstitutionSettings } from '@/types/database';

let cachedSettings: InstitutionSettings | null = null;
let inflightPromise: Promise<InstitutionSettings> | null = null;

async function fetchInstitutionSettings(): Promise<InstitutionSettings> {
  if (cachedSettings) return cachedSettings;
  if (!inflightPromise) {
    inflightPromise = fetch('/api/cms/settings', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.settings) {
          cachedSettings = data.settings as InstitutionSettings;
          return cachedSettings;
        }
        return DEFAULT_INSTITUTION_SETTINGS;
      })
      .catch(() => DEFAULT_INSTITUTION_SETTINGS)
      .finally(() => {
        inflightPromise = null;
      });
  }
  return inflightPromise;
}

export function useInstitutionSettings(): InstitutionSettings {
  const [school, setSchool] = useState<InstitutionSettings>(
    () => cachedSettings || DEFAULT_INSTITUTION_SETTINGS
  );

  useEffect(() => {
    let mounted = true;
    fetchInstitutionSettings().then((data) => {
      if (mounted) {
        setSchool(data);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return school;
}
