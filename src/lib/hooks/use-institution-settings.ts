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

function syncBrowserFavicon(logoUrl?: string | null) {
  if (typeof document === 'undefined') return;
  const href = logoUrl?.trim() || '/favicon.ico';
  const rels = ['icon', 'shortcut icon'];
  for (const rel of rels) {
    let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    if (link.href !== href && link.getAttribute('href') !== href) {
      link.setAttribute('href', href);
    }
  }
}

function invalidateInstitutionSettingsCache() {
  cachedSettings = null;
  inflightPromise = null;
}

export function notifyInstitutionSettingsUpdated() {
  invalidateInstitutionSettingsCache();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('institution-settings-updated'));
  }
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
    const load = () => {
      fetchInstitutionSettings().then((data) => {
        if (!mounted) return;
        setSchool(data);
        if (data.logo_url !== undefined) {
          syncBrowserFavicon(data.logo_url);
        }
      });
    };
    load();

    const onUpdated = () => {
      invalidateInstitutionSettingsCache();
      load();
    };
    window.addEventListener('institution-settings-updated', onUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('institution-settings-updated', onUpdated);
    };
  }, []);

  return school;
}
