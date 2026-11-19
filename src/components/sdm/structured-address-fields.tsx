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

  useEffect(() => {
    if (parsed.rt && !RT_RW_OPTIONS.includes(parsed.rt)) {
      setRtCustomMode(true);
    }
  }, [parsed.rt]);

  useEffect(() => {
    if (parsed.rw && !RT_RW_OPTIONS.includes(parsed.rw)) {
      setRwCustomMode(true);
    }
  }, [parsed.rw]);

  useEffect(() => {
    fetch(`${EMSIFA_BASE}/provinces.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setProvinces(Array.isArray(data) ? data : []))
      .catch(() => setProvinces([]));
  }, []);

  // Pre-match saved province name when provinces finish loading
  useEffect(() => {
    if (!value.province || provinces.length === 0) return;
    const target = value.province.trim().toUpperCase();
    const matched = provinces.find((p) => p.name.trim().toUpperCase() === target);
    if (matched && matched.id !== provinceId) {
      setProvinceId(matched.id);
    }
  }, [value.province, provinces, provinceId]);

  useEffect(() => {
    if (!provinceId) {
      setRegencies([]);
      return;
    }
    fetch(`${EMSIFA_BASE}/regencies/${provinceId}.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRegencies(Array.isArray(data) ? data : []))
      .catch(() => setRegencies([]));
  }, [provinceId]);

  useEffect(() => {
    if (!value.city || regencies.length === 0) return;
    const target = value.city.trim().toUpperCase();
    const matched = regencies.find((r) => r.name.trim().toUpperCase() === target);
    if (matched && matched.id !== regencyId) {
      setRegencyId(matched.id);
    }
  }, [value.city, regencies, regencyId]);

  useEffect(() => {
    if (!regencyId) {
      setDistricts([]);
      return;
    }
    fetch(`${EMSIFA_BASE}/districts/${regencyId}.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setDistricts(Array.isArray(data) ? data : []))
      .catch(() => setDistricts([]));
  }, [regencyId]);

  useEffect(() => {
    if (!value.district || districts.length === 0) return;
    const target = value.district.trim().toUpperCase();
    const matched = districts.find((d) => d.name.trim().toUpperCase() === target);
    if (matched && matched.id !== districtId) {
      setDistrictId(matched.id);
    }
  }, [value.district, districts, districtId]);

  useEffect(() => {
    if (!districtId) {
      setVillages([]);
      return;
    }
    fetch(`${EMSIFA_BASE}/villages/${districtId}.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setVillages(Array.isArray(data) ? data : []))
      .catch(() => setVillages([]));
  }, [districtId]);

  useEffect(() => {
    if (!value.village || villages.length === 0) return;
    const target = value.village.trim().toUpperCase();
    const matched = villages.find((v) => v.name.trim().toUpperCase() === target);
    if (matched && matched.id !== villageId) {
      setVillageId(matched.id);
    }
  }, [value.village, villages, villageId]);

  return (
    <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
      <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5 text-emerald-700" /> {title}
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Provinsi</label>
          <select
            required={required}
            value={provinceId}
            onChange={(e) => {
              const id = e.target.value;
              const name = provinces.find((p) => p.id === id)?.name || '';
              setProvinceId(id);
              setRegencyId('');
              setDistrictId('');
              setVillageId('');
              onChange({
                ...value,
                province: name,
                city: '',
                district: '',
                village: '',
              });
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
          >
            <option value="">
              {value.province && !provinceId ? value.province : '-- Pilih Provinsi --'}
            </option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Kabupaten / Kota
          </label>
          <select
            required={required}
            disabled={!provinceId}
            value={regencyId}
            onChange={(e) => {
              const id = e.target.value;
              const name = regencies.find((r) => r.id === id)?.name || '';
              setRegencyId(id);
              setDistrictId('');
              setVillageId('');
              onChange({
                ...value,
                city: name,
                district: '',
                village: '',
              });
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs disabled:bg-slate-100"
          >
            <option value="">
              {value.city && !regencyId ? value.city : '-- Pilih Kabupaten / Kota --'}
            </option>
            {regencies.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kecamatan</label>
          <select
            required={required}
            disabled={!regencyId}
            value={districtId}
            onChange={(e) => {
              const id = e.target.value;
              const name = districts.find((d) => d.id === id)?.name || '';
              setDistrictId(id);
              setVillageId('');
              onChange({
                ...value,
                district: name,
                village: '',
              });
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs disabled:bg-slate-100"
          >
            <option value="">
              {value.district && !districtId ? value.district : '-- Pilih Kecamatan --'}
            </option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Kelurahan / Desa
          </label>
          <select
            required={required}
            disabled={!districtId}
            value={villageId}
            onChange={(e) => {
              const id = e.target.value;
              const name = villages.find((v) => v.id === id)?.name || '';
              setVillageId(id);
              onChange({
                ...value,
                village: name,
              });
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs disabled:bg-slate-100"
          >
            <option value="">
              {value.village && !villageId ? value.village : '-- Pilih Kelurahan / Desa --'}
            </option>
            {villages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">RT</label>
            <select
              required={required}
              value={
                rtCustomMode
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
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono"
            >
              <option value="">-- RT --</option>
              {RT_RW_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              <option value={LAINNYA_VALUE}>Lainnya</option>
            </select>
            {rtCustomMode && (
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
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono"
              />
            )}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">RW</label>
            <select
              required={required}
              value={
                rwCustomMode
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
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono"
            >
              <option value="">-- RW --</option>
              {RT_RW_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              <option value={LAINNYA_VALUE}>Lainnya</option>
            </select>
            {rwCustomMode && (
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
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono"
              />
            )}
          </div>
        </div>
      </div>

      <div>
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
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
        />
      </div>
    </div>
  );
}
