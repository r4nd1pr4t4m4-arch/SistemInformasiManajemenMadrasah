'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_INSTITUTION_SETTINGS } from '@/lib/data/demo-seed';
import type { InstitutionSettings } from '@/types/database';

const EMPTY_LOADING_SETTINGS: InstitutionSettings = {
  ...DEFAULT_INSTITUTION_SETTINGS,
  name: '',
  short_name: '',
  npsn: '',
  nsm: '',
  accreditation: '',
  headmaster_name: '',
  headmaster_greeting: '',
  history: '',
  vision: '',
  mission: [],
  address: '',
  phone: '',
  email: '',
  social_links: {},
};

let cachedSettings: InstitutionSettings | null = null;
let inflightPromise: Promise<InstitutionSettings> | null = null;

export function invalidateInstitutionSettingsCache() {
  cachedSettings = null;
  inflightPromise = null;
}

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
    () => cachedSettings || EMPTY_LOADING_SETTINGS
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
