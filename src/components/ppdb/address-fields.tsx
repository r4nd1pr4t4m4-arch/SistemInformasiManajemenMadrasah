'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, MapPin, RefreshCw } from 'lucide-react';

interface RegionItem {
  id: string;
  name: string;
}

const EMSIFA_BASE = 'https://www.emsifa.com/api-wilayah-indonesia/api';
const RT_RW_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(3, '0'));
const LAINNYA_VALUE = '__LAINNYA__';

interface IndonesianAddressFieldsProps {
  onAddressChange: (fullAddress: string, isComplete: boolean) => void;
}

const SELECT_CLASS =
  'w-full min-h-[42px] rounded-xl border border-slate-300/90 bg-white px-3 py-2 text-sm text-slate-800 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed';

const INPUT_CLASS =
  'w-full min-h-[42px] rounded-xl border border-slate-300/90 bg-white px-3 py-2 text-sm text-slate-800 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600';

export function IndonesianAddressFields({ onAddressChange }: IndonesianAddressFieldsProps) {
  const [provinces, setProvinces] = useState<RegionItem[]>([]);
  const [regencies, setRegencies] = useState<RegionItem[]>([]);
  const [districts, setDistricts] = useState<RegionItem[]>([]);
  const [villages, setVillages] = useState<RegionItem[]>([]);

  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadingRegencies, setLoadingRegencies] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);
  const [regionError, setRegionError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const [provinceId, setProvinceId] = useState('');
  const [regencyId, setRegencyId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [villageId, setVillageId] = useState('');

  const [rt, setRt] = useState('');
  const [rw, setRw] = useState('');
  const [rtCustomMode, setRtCustomMode] = useState(false);
  const [rwCustomMode, setRwCustomMode] = useState(false);
  const [street, setStreet] = useState('');

  const onAddressChangeRef = useRef(onAddressChange);
  useEffect(() => {
    onAddressChangeRef.current = onAddressChange;
  }, [onAddressChange]);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${EMSIFA_BASE}/provinces.json`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('Gagal memuat daftar provinsi');
        return r.json();
      })
      .then((data) => {
        setProvinces(Array.isArray(data) ? data : []);
        setRegionError(null);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setProvinces([]);
        setRegionError('Gagal memuat data wilayah Indonesia. Periksa koneksi internet Anda.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingProvinces(false);
      });

    return () => controller.abort();
  }, [retryTick]);

  useEffect(() => {
    if (!provinceId) return;

    const controller = new AbortController();

    fetch(`${EMSIFA_BASE}/regencies/${provinceId}.json`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('Gagal memuat daftar kabupaten/kota');
        return r.json();
      })
      .then((data) => {
        setRegencies(Array.isArray(data) ? data : []);
        setRegionError(null);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setRegencies([]);
        setRegionError('Gagal memuat daftar Kabupaten/Kota. Silakan coba lagi.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingRegencies(false);
      });

    return () => controller.abort();
  }, [provinceId, retryTick]);

  useEffect(() => {
    if (!regencyId) return;

    const controller = new AbortController();

    fetch(`${EMSIFA_BASE}/districts/${regencyId}.json`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('Gagal memuat daftar kecamatan');
        return r.json();
      })
      .then((data) => {
        setDistricts(Array.isArray(data) ? data : []);
        setRegionError(null);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setDistricts([]);
        setRegionError('Gagal memuat daftar Kecamatan. Silakan coba lagi.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingDistricts(false);
      });

    return () => controller.abort();
  }, [regencyId, retryTick]);

  useEffect(() => {
    if (!districtId) return;

    const controller = new AbortController();

    fetch(`${EMSIFA_BASE}/villages/${districtId}.json`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('Gagal memuat daftar kelurahan/desa');
        return r.json();
      })
      .then((data) => {
        setVillages(Array.isArray(data) ? data : []);
        setRegionError(null);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setVillages([]);
        setRegionError('Gagal memuat daftar Kelurahan/Desa. Silakan coba lagi.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingVillages(false);
      });

    return () => controller.abort();
  }, [districtId, retryTick]);

  const provName = provinces.find((p) => p.id === provinceId)?.name || '';
  const regName = regencies.find((r) => r.id === regencyId)?.name || '';
  const distName = districts.find((d) => d.id === districtId)?.name || '';
  const vilName = villages.find((v) => v.id === villageId)?.name || '';

  const isAddressComplete = Boolean(
    provName && regName && distName && vilName && rt.trim() && rw.trim() && street.trim()
  );

  useEffect(() => {
    const parts = [
      street.trim(),
      rt.trim() || rw.trim() ? `RT ${rt.trim() || '-'}/RW ${rw.trim() || '-'}` : '',
      vilName ? `Kel./Desa ${vilName}` : '',
      distName ? `Kec. ${distName}` : '',
      regName,
      provName ? `Prov. ${provName}` : '',
    ].filter(Boolean);

    onAddressChangeRef.current(parts.join(', '), isAddressComplete);
  }, [provName, regName, distName, vilName, rt, rw, street, isAddressComplete]);

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-emerald-700 shrink-0" /> Alamat Domisili Lengkap
        </p>
        {isAddressComplete ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" /> Alamat Lengkap
          </span>
        ) : (
          <span className="text-[11px] font-medium text-slate-500">Wajib diisi lengkap</span>
        )}
      </div>

      {regionError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{regionError}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setRegionError(null);
              if (provinces.length === 0) setLoadingProvinces(true);
              if (provinceId) setLoadingRegencies(true);
              if (regencyId) setLoadingDistricts(true);
              if (districtId) setLoadingVillages(true);
              setRetryTick((t) => t + 1);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 font-semibold hover:bg-rose-100/60 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="min-w-0">
          <label className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
            <span>
              Provinsi <span className="text-rose-600">*</span>
            </span>
            {loadingProvinces && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />}
          </label>
          <select
            required
            disabled={loadingProvinces}
            value={provinceId}
            onChange={(e) => {
              const nextProvinceId = e.target.value;
              setProvinceId(nextProvinceId);
              setRegencyId('');
              setDistrictId('');
              setVillageId('');
              setRegencies([]);
              setDistricts([]);
              setVillages([]);
              setRegionError(null);
              setLoadingRegencies(Boolean(nextProvinceId));
              setLoadingDistricts(false);
              setLoadingVillages(false);
            }}
            className={SELECT_CLASS}
          >
            <option value="">
              {loadingProvinces ? 'Memuat provinsi...' : '-- Pilih Provinsi --'}
            </option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
            <span>
              Kabupaten / Kota <span className="text-rose-600">*</span>
            </span>
            {loadingRegencies && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />}
          </label>
          <select
            required
            disabled={!provinceId || loadingRegencies}
            value={regencyId}
            onChange={(e) => {
              const nextRegencyId = e.target.value;
              setRegencyId(nextRegencyId);
              setDistrictId('');
              setVillageId('');
              setDistricts([]);
              setVillages([]);
              setRegionError(null);
              setLoadingDistricts(Boolean(nextRegencyId));
              setLoadingVillages(false);
            }}
            className={SELECT_CLASS}
          >
            <option value="">
              {loadingRegencies ? 'Memuat kabupaten/kota...' : '-- Pilih Kabupaten / Kota --'}
            </option>
            {regencies.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
            <span>
              Kecamatan <span className="text-rose-600">*</span>
            </span>
            {loadingDistricts && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />}
          </label>
          <select
            required
            disabled={!regencyId || loadingDistricts}
            value={districtId}
            onChange={(e) => {
              const nextDistrictId = e.target.value;
              setDistrictId(nextDistrictId);
              setVillageId('');
              setVillages([]);
              setRegionError(null);
              setLoadingVillages(Boolean(nextDistrictId));
            }}
            className={SELECT_CLASS}
          >
            <option value="">
              {loadingDistricts ? 'Memuat kecamatan...' : '-- Pilih Kecamatan --'}
            </option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
            <span>
              Kelurahan / Desa <span className="text-rose-600">*</span>
            </span>
            {loadingVillages && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />}
          </label>
          <select
            required
            disabled={!districtId || loadingVillages}
            value={villageId}
            onChange={(e) => setVillageId(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">
              {loadingVillages ? 'Memuat kelurahan/desa...' : '-- Pilih Kelurahan / Desa --'}
            </option>
            {villages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            RT <span className="text-rose-600">*</span>
          </label>
          <select
            required
            value={rtCustomMode ? LAINNYA_VALUE : rt}
            onChange={(e) => {
              const v = e.target.value;
              if (v === LAINNYA_VALUE) {
                setRtCustomMode(true);
                setRt('');
              } else {
                setRtCustomMode(false);
                setRt(v);
              }
            }}
            className={`${SELECT_CLASS} font-mono`}
          >
            <option value="">-- Pilih RT --</option>
            {RT_RW_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            <option value={LAINNYA_VALUE}>Lainnya</option>
          </select>
          {rtCustomMode && (
            <input
              required
              type="text"
              inputMode="numeric"
              maxLength={3}
              value={rt}
              onChange={(e) => setRt(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="Nomor RT (cth: 013)"
              className={`${INPUT_CLASS} mt-2 font-mono`}
            />
          )}
        </div>

        <div className="min-w-0">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            RW <span className="text-rose-600">*</span>
          </label>
          <select
            required
            value={rwCustomMode ? LAINNYA_VALUE : rw}
            onChange={(e) => {
              const v = e.target.value;
              if (v === LAINNYA_VALUE) {
                setRwCustomMode(true);
                setRw('');
              } else {
                setRwCustomMode(false);
                setRw(v);
              }
            }}
            className={`${SELECT_CLASS} font-mono`}
          >
            <option value="">-- Pilih RW --</option>
            {RT_RW_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            <option value={LAINNYA_VALUE}>Lainnya</option>
          </select>
          {rwCustomMode && (
            <input
              required
              type="text"
              inputMode="numeric"
              maxLength={3}
              value={rw}
              onChange={(e) => setRw(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="Nomor RW (cth: 013)"
              className={`${INPUT_CLASS} mt-2 font-mono`}
            />
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          Alamat Lengkap (Jalan / Dusun / Blok / Nomor Rumah) <span className="text-rose-600">*</span>
        </label>
        <input
          required
          type="text"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          placeholder="Contoh: Jl. Merdeka No. 12, Dusun Krajan"
          className={INPUT_CLASS}
        />
      </div>
    </div>
  );
}
