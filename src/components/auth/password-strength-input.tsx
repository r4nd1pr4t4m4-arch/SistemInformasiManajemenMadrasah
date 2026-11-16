'use client';

import { useState } from 'react';
import { Check, Eye, EyeOff, Lock, X } from 'lucide-react';
import { validatePasswordStrength } from '@/lib/auth/password-policy';

interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  showStrength?: boolean;
  userName?: string;
}

export function PasswordInput({
  label,
  value,
  onChange,
  placeholder = 'Masukkan kata sandi',
  required = true,
  showStrength = false,
  userName,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const validation = showStrength ? validatePasswordStrength(value, userName) : null;

  const barPercent = validation ? Math.round((validation.score / 7) * 100) : 0;
  const barColor =
    !validation || value.length === 0
      ? 'bg-slate-200'
      : validation.score <= 2
      ? 'bg-rose-500'
      : validation.score <= 4
      ? 'bg-amber-500'
      : validation.score <= 5
      ? 'bg-yellow-500'
      : validation.score === 6
      ? 'bg-sky-500'
      : 'bg-emerald-600';

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-slate-700">{label}</label>
      <div className="relative">
        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          required={required}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-300/90 bg-white/95 pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-slate-700"
          aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {showStrength && validation && value.length > 0 && (
        <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Kekuatan Kata Sandi</span>
            <span
              className={`font-bold ${
                validation.isValid ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {validation.strengthLabel}
            </span>
          </div>

          <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${barColor}`}
              style={{ width: `${barPercent}%` }}
            />
          </div>

          <ul className="grid sm:grid-cols-2 gap-1 pt-0.5">
            {validation.rules.map((rule) => (
              <li
                key={rule.key}
                className={`flex items-center gap-1.5 text-[11px] ${
                  rule.passed ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                {rule.passed ? (
                  <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                ) : (
                  <X className="w-3 h-3 text-slate-400 shrink-0" />
                )}
                <span>{rule.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
