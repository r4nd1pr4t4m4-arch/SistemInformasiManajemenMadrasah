'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';

interface RegionItem {
  id: string;
  name: string;
}

const EMSIFA_BASE = 'https://www.emsifa.com/api-wilayah-indonesia/api';

interface IndonesianAddressFieldsProps {
  onAddressChange: (fullAddress: string, isComplete: boolean) => void;
}

export function IndonesianAddressFields({ onAddressChange }: IndonesianAddressFieldsProps) {
  const [provinces, setProvinces] = useState<RegionItem[]>([]);
  const [regencies, setRegencies] = useState<RegionItem[]>([]);
  const [districts, setDistricts] = useState<RegionItem[]>([]);
  const [villages, setVillages] = useState<RegionItem[]>([]);

  const [provinceId, setProvinceId] = useState('');
  const [regencyId, setRegencyId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [villageId, setVillageId] = useState('');

  const [rt, setRt] = useState('');
  const [rw, setRw] = useState('');
  const [street, setStreet] = useState('');

  useEffect(() => {
    fetch(`${EMSIFA_BASE}/provinces.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setProvinces(Array.isArray(data) ? data : []))
      .catch(() => setProvinces([]));
  }, []);

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
    const provName = provinces.find((p) => p.id === provinceId)?.name || '';
    const regName = regencies.find((r) => r.id === regencyId)?.name || '';
    const distName = districts.find((d) => d.id === districtId)?.name || '';
    const vilName = villages.find((v) => v.id === villageId)?.name || '';

    const parts = [
      street.trim(),
      rt || rw ? `RT ${rt || '-'}/RW ${rw || '-'}` : '',
      vilName ? `Kel./Desa ${vilName}` : '',
      distName ? `Kec. ${distName}` : '',
      regName,
      provName ? `Prov. ${provName}` : '',
    ].filter(Boolean);

    const isComplete = Boolean(
      provName && regName && distName && vilName && rt.trim() && rw.trim() && street.trim()
    );

    onAddressChange(parts.join(', '), isComplete);
  }, [
    provinceId,
    regencyId,
    districtId,
    villageId,
    rt,
    rw,
    street,
    provinces,
    regencies,
    districts,
    villages,
    onAddressChange,
  ]);

  return (
    <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
      <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5 text-emerald-700" /> Alamat Domisili Lengkap
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Provinsi</label>
          <select
            required
            value={provinceId}
            onChange={(e) => {
              setProvinceId(e.target.value);
              setRegencyId('');
              setDistrictId('');
              setVillageId('');
            }}
            className="w-full rounded-xl border border-slate-300/90 bg-white px-3 py-2 text-xs"
          >
            <option value="">-- Pilih Provinsi --</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Kabupaten / Kota
          </label>
          <select
            required
            disabled={!provinceId}
            value={regencyId}
            onChange={(e) => {
              setRegencyId(e.target.value);
              setDistrictId('');
              setVillageId('');
            }}
            className="w-full rounded-xl border border-slate-300/90 bg-white px-3 py-2 text-xs disabled:bg-slate-100"
          >
            <option value="">-- Pilih Kabupaten / Kota --</option>
            {regencies.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Kecamatan</label>
          <select
            required
            disabled={!regencyId}
            value={districtId}
            onChange={(e) => {
              setDistrictId(e.target.value);
              setVillageId('');
            }}
            className="w-full rounded-xl border border-slate-300/90 bg-white px-3 py-2 text-xs disabled:bg-slate-100"
          >
            <option value="">-- Pilih Kecamatan --</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Kelurahan / Desa
          </label>
          <select
            required
            disabled={!districtId}
            value={villageId}
            onChange={(e) => setVillageId(e.target.value)}
            className="w-full rounded-xl border border-slate-300/90 bg-white px-3 py-2 text-xs disabled:bg-slate-100"
          >
            <option value="">-- Pilih Kelurahan / Desa --</option>
            {villages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">RT</label>
          <input
            required
            type="text"
            inputMode="numeric"
            maxLength={3}
            value={rt}
            onChange={(e) => setRt(e.target.value.replace(/\D/g, '').slice(0, 3))}
            placeholder="001"
            className="w-full rounded-xl border border-slate-300/90 bg-white px-3 py-2 text-xs font-mono"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">RW</label>
          <input
            required
            type="text"
            inputMode="numeric"
            maxLength={3}
            value={rw}
            onChange={(e) => setRw(e.target.value.replace(/\D/g, '').slice(0, 3))}
            placeholder="002"
            className="w-full rounded-xl border border-slate-300/90 bg-white px-3 py-2 text-xs font-mono"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
          Alamat (Jalan / Dusun / Blok / Nomor Rumah)
        </label>
        <input
          required
          type="text"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          placeholder="Contoh: Jl. Merdeka No. 12, Dusun Krajan"
          className="w-full rounded-xl border border-slate-300/90 bg-white px-3 py-2 text-xs"
        />
      </div>
    </div>
  );
}
