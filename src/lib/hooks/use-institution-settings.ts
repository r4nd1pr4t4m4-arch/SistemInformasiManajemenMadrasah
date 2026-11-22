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

function syncGlobalWebsiteUrl(url?: string | null) {
  if (typeof globalThis === 'undefined') return;
  const trimmed = url?.trim();
  if (!trimmed) return;
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  (globalThis as Record<string, unknown>).__simmsWebsiteUrl = normalized.replace(/\/$/, '');
}

export function invalidateInstitutionSettingsCache() {
  cachedSettings = null;
  inflightPromise = null;
}

export async function fetchInstitutionSettings(): Promise<InstitutionSettings> {
  if (cachedSettings) {
    syncGlobalWebsiteUrl(cachedSettings.website_url);
    return cachedSettings;
  }
  if (!inflightPromise) {
    inflightPromise = fetch('/api/cms/settings', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.settings) {
          cachedSettings = data.settings as InstitutionSettings;
          syncGlobalWebsiteUrl(cachedSettings.website_url);
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
