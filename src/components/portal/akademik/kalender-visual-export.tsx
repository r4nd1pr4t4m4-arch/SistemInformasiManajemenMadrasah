'use client';

import { useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Download } from 'lucide-react';

export interface VisualCalendarEvent {
  id: string;
  event_date: string;
  title: string;
  category: string;
  description?: string | null;
}

export function exportCalendarToIcs(events: VisualCalendarEvent[], calendarName = 'Kalender Pendidikan SIMMS') {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SIMMS//Kalender Pendidikan//ID',
    `X-WR-CALNAME:${calendarName}`,
  ];
  for (const ev of events) {
    const dt = ev.event_date.replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.id}@simms.local`,
      `DTSTART;VALUE=DATE:${dt}`,
      `DTEND;VALUE=DATE:${dt}`,
      `SUMMARY:${ev.title.replace(/[\r\n,;]/g, ' ')}`,
      `DESCRIPTION:${(ev.description || ev.category).replace(/[\r\n,;]/g, ' ')}`,
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Kalender_Pendidikan_${new Date().toISOString().slice(0, 10)}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function KalenderVisualGrid({ events }: { events: VisualCalendarEvent[] }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const eventByDate = useMemo(() => {
    const map = new Map<string, VisualCalendarEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.event_date) || [];
      list.push(ev);
      map.set(ev.event_date, list);
    }
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: Array<{ dateStr: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < firstDay; i++) out.push({ dateStr: null, dayNum: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      out.push({ dateStr, dayNum: d });
    }
    return out;
  }, [year, month]);

  return (
    <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-700" />
          <h2 className="text-base font-bold text-slate-900 capitalize">{monthLabel}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exportCalendarToIcs(events)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5" /> Ekspor .ics
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold text-slate-500">
        {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell, idx) => {
          const dayEvents = cell.dateStr ? eventByDate.get(cell.dateStr) || [] : [];
          return (
            <div
              key={idx}
              className={`min-h-[72px] rounded-xl border p-1.5 text-left ${
                cell.dayNum
                  ? 'bg-white border-slate-200/80'
                  : 'bg-slate-50/40 border-transparent'
              }`}
            >
              {cell.dayNum && (
                <>
                  <p className="text-[11px] font-bold text-slate-700">{cell.dayNum}</p>
                  <div className="space-y-1 mt-1">
                    {dayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        title={`${ev.title} (${ev.category})`}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold truncate ${
                          ev.category === 'LIBUR_BERBAYAR'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ev.category === 'LIBUR_TIDAK_BERBAYAR'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {ev.title}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
