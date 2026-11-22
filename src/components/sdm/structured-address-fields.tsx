'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';

interface RegionItem {
  id: string;
  name: string;
}

export interface StructuredAddressValue {
  province: string;
  city: string;
  district: string;
  village: string;
  rt_rw: string;
  address: string;
}

const EMSIFA_BASE = 'https://www.emsifa.com/api-wilayah-indonesia/api';
const RT_RW_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(3, '0'));
const LAINNYA_VALUE = '__LAINNYA__';

function parseRtRw(rtRw: string): { rt: string; rw: string } {
  const cleaned = (rtRw || '').trim();
  if (!cleaned) return { rt: '', rw: '' };
  const parts = cleaned.split('/').map((s) => s.replace(/\D/g, '').slice(0, 3));
  return {
    rt: parts[0] || '',
    rw: parts[1] || '',
  };
}

function formatRtRw(rt: string, rw: string): string {
  const cleanRt = rt.replace(/\D/g, '').slice(0, 3);
  const cleanRw = rw.replace(/\D/g, '').slice(0, 3);
  if (!cleanRt && !cleanRw) return '';
  return `${cleanRt || '-'}/${cleanRw || '-'}`;
}

export function StructuredAddressFields({
  value,
  onChange,
  title = 'Alamat Domisili Lengkap',
  required = false,
}: {
  value: StructuredAddressValue;
  onChange: (next: StructuredAddressValue) => void;
  title?: string;
  required?: boolean;
}) {
  const [provinces, setProvinces] = useState<RegionItem[]>([]);
  const [regencies, setRegencies] = useState<RegionItem[]>([]);
  const [districts, setDistricts] = useState<RegionItem[]>([]);
  const [villages, setVillages] = useState<RegionItem[]>([]);

  const [provinceId, setProvinceId] = useState('');
  const [regencyId, setRegencyId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [villageId, setVillageId] = useState('');

  const parsed = parseRtRw(value.rt_rw);
  const [rtCustomMode, setRtCustomMode] = useState(
    () => Boolean(parsed.rt && !RT_RW_OPTIONS.includes(parsed.rt))
  );
  const [rwCustomMode, setRwCustomMode] = useState(
    () => Boolean(parsed.rw && !RT_RW_OPTIONS.includes(parsed.rw))
  );
  const isRtCustom = rtCustomMode || Boolean(parsed.rt && !RT_RW_OPTIONS.includes(parsed.rt));
  const isRwCustom = rwCustomMode || Boolean(parsed.rw && !RT_RW_OPTIONS.includes(parsed.rw));

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${EMSIFA_BASE}/provinces.json`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setProvinces(Array.isArray(data) ? data : []))
      .catch((err) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setProvinces([]);
      });
    return () => controller.abort();
  }, []);

  const activeProvinceId =
    provinceId ||
    (value.province
      ? provinces.find((p) => p.name.trim().toUpperCase() === value.province.trim().toUpperCase())?.id || ''
      : '');

  useEffect(() => {
    if (!activeProvinceId) return;
    const controller = new AbortController();
    fetch(`${EMSIFA_BASE}/regencies/${activeProvinceId}.json`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRegencies(Array.isArray(data) ? data : []))
      .catch((err) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setRegencies([]);
      });
    return () => controller.abort();
  }, [activeProvinceId]);

  const visibleRegencies = activeProvinceId ? regencies : [];
  const activeRegencyId =
    regencyId ||
    (value.city
      ? visibleRegencies.find((r) => r.name.trim().toUpperCase() === value.city.trim().toUpperCase())?.id || ''
      : '');

  useEffect(() => {
    if (!activeRegencyId) return;
    const controller = new AbortController();
    fetch(`${EMSIFA_BASE}/districts/${activeRegencyId}.json`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setDistricts(Array.isArray(data) ? data : []))
      .catch((err) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setDistricts([]);
      });
    return () => controller.abort();
  }, [activeRegencyId]);

  const visibleDistricts = activeRegencyId ? districts : [];
  const activeDistrictId =
    districtId ||
    (value.district
      ? visibleDistricts.find((d) => d.name.trim().toUpperCase() === value.district.trim().toUpperCase())?.id || ''
      : '');

  useEffect(() => {
    if (!activeDistrictId) return;
    const controller = new AbortController();
    fetch(`${EMSIFA_BASE}/villages/${activeDistrictId}.json`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setVillages(Array.isArray(data) ? data : []))
      .catch((err) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setVillages([]);
      });
    return () => controller.abort();
  }, [activeDistrictId]);

  const visibleVillages = activeDistrictId ? villages : [];
  const activeVillageId =
    villageId ||
    (value.village
      ? visibleVillages.find((v) => v.name.trim().toUpperCase() === value.village.trim().toUpperCase())?.id || ''
      : '');

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3 min-w-0">
      <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
        <span>{title}</span>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="min-w-0">
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Provinsi</label>
          <select
            required={required}
            value={activeProvinceId}
            onChange={(e) => {
              const id = e.target.value;
              const name = provinces.find((p) => p.id === id)?.name || '';
              setProvinceId(id);
              setRegencyId('');
              setDistrictId('');
              setVillageId('');
              setRegencies([]);
              setDistricts([]);
              setVillages([]);
              onChange({
                ...value,
                province: name,
                city: '',
                district: '',
                village: '',
              });
            }}
            className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
          >
            <option value="">
              {value.province && !activeProvinceId ? value.province : '-- Pilih Provinsi --'}
            </option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Kabupaten / Kota
          </label>
          <select
            required={required}
            disabled={!activeProvinceId}
            value={activeRegencyId}
            onChange={(e) => {
              const id = e.target.value;
              const name = visibleRegencies.find((r) => r.id === id)?.name || '';
              setRegencyId(id);
              setDistrictId('');
              setVillageId('');
              setDistricts([]);
              setVillages([]);
              onChange({
                ...value,
                city: name,
                district: '',
                village: '',
              });
            }}
            className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs disabled:bg-slate-100 disabled:border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
          >
            <option value="">
              {value.city && !activeRegencyId ? value.city : '-- Pilih Kabupaten / Kota --'}
            </option>
            {visibleRegencies.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kecamatan</label>
          <select
            required={required}
            disabled={!activeRegencyId}
            value={activeDistrictId}
            onChange={(e) => {
              const id = e.target.value;
              const name = visibleDistricts.find((d) => d.id === id)?.name || '';
              setDistrictId(id);
              setVillageId('');
              setVillages([]);
              onChange({
                ...value,
                district: name,
                village: '',
              });
            }}
            className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs disabled:bg-slate-100 disabled:border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
          >
            <option value="">
              {value.district && !activeDistrictId ? value.district : '-- Pilih Kecamatan --'}
            </option>
            {visibleDistricts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Kelurahan / Desa
          </label>
          <select
            required={required}
            disabled={!activeDistrictId}
            value={activeVillageId}
            onChange={(e) => {
              const id = e.target.value;
              const name = visibleVillages.find((v) => v.id === id)?.name || '';
              setVillageId(id);
              onChange({
                ...value,
                village: name,
              });
            }}
            className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs disabled:bg-slate-100 disabled:border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
          >
            <option value="">
              {value.village && !activeVillageId ? value.village : '-- Pilih Kelurahan / Desa --'}
            </option>
            {visibleVillages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2 min-w-0">
          <div className="min-w-0">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">RT</label>
            <select
              required={required}
              value={
                isRtCustom
                  ? LAINNYA_VALUE
                  : RT_RW_OPTIONS.includes(parsed.rt)
                    ? parsed.rt
                    : ''
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === LAINNYA_VALUE) {
                  setRtCustomMode(true);
                  onChange({
                    ...value,
                    rt_rw: formatRtRw('', parsed.rw),
                  });
                } else {
                  setRtCustomMode(false);
                  onChange({
                    ...value,
                    rt_rw: formatRtRw(v, parsed.rw),
                  });
                }
              }}
              className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            >
              <option value="">-- RT --</option>
              {RT_RW_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              <option value={LAINNYA_VALUE}>Lainnya</option>
            </select>
            {isRtCustom && (
              <input
                required={required}
                type="text"
                inputMode="numeric"
                maxLength={3}
                value={parsed.rt}
                onChange={(e) =>
                  onChange({
                    ...value,
                    rt_rw: formatRtRw(e.target.value, parsed.rw),
                  })
                }
                placeholder="Nomor RT (cth: 013)"
                className="mt-1.5 w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
            )}
          </div>
          <div className="min-w-0">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">RW</label>
            <select
              required={required}
              value={
                isRwCustom
                  ? LAINNYA_VALUE
                  : RT_RW_OPTIONS.includes(parsed.rw)
                    ? parsed.rw
                    : ''
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === LAINNYA_VALUE) {
                  setRwCustomMode(true);
                  onChange({
                    ...value,
                    rt_rw: formatRtRw(parsed.rt, ''),
                  });
                } else {
                  setRwCustomMode(false);
                  onChange({
                    ...value,
                    rt_rw: formatRtRw(parsed.rt, v),
                  });
                }
              }}
              className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            >
              <option value="">-- RW --</option>
              {RT_RW_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              <option value={LAINNYA_VALUE}>Lainnya</option>
            </select>
            {isRwCustom && (
              <input
                required={required}
                type="text"
                inputMode="numeric"
                maxLength={3}
                value={parsed.rw}
                onChange={(e) =>
                  onChange({
                    ...value,
                    rt_rw: formatRtRw(parsed.rt, e.target.value),
                  })
                }
                placeholder="Nomor RW (cth: 013)"
                className="mt-1.5 w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
            )}
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
          Alamat (Jalan / Dusun / Blok / Nomor Rumah)
        </label>
        <input
          required={required}
          type="text"
          value={value.address}
          onChange={(e) =>
            onChange({
              ...value,
              address: e.target.value,
            })
          }
          placeholder="Contoh: Jl. Merdeka No. 12, Dusun Krajan"
          className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
        />
      </div>
    </div>
  );
}
