'use client';

export function DashboardSkeleton() {
  return (
    <div
      className="max-w-7xl mx-auto space-y-6 animate-pulse"
      role="status"
      aria-label="Memuat ringkasan dashboard portal..."
    >
      {/* Hero Banner Skeleton */}
      <div className="glass-card rounded-3xl p-5 sm:p-7 space-y-5 border border-slate-200/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-6 w-32 rounded-full bg-emerald-100/80" />
              <div className="h-6 w-44 rounded-full bg-slate-200/80" />
              <div className="h-6 w-28 rounded-full bg-slate-200/70" />
            </div>
            <div className="h-7 sm:h-8 w-3/4 max-w-md rounded-xl bg-slate-200/90" />
            <div className="h-4 w-full max-w-xl rounded-lg bg-slate-200/70" />
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="h-10 w-28 rounded-xl bg-slate-200/80" />
            <div className="h-10 w-36 rounded-xl bg-emerald-200/70" />
          </div>
        </div>

        {/* Role & Duty Badges Skeleton */}
        <div className="pt-3 border-t border-slate-200/70 flex flex-wrap items-center gap-2">
          <div className="h-5 w-24 rounded-md bg-slate-200/70" />
          <div className="h-6 w-28 rounded-lg bg-emerald-100/80" />
          <div className="h-6 w-32 rounded-lg bg-sky-100/70" />
          <div className="h-6 w-36 rounded-lg bg-amber-100/70" />
        </div>
      </div>

      {/* KPI Metrics 4-Card Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="glass-card rounded-3xl p-5 space-y-3 border border-slate-200/80"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 rounded-md bg-slate-200/80" />
              <div className="w-10 h-10 rounded-2xl bg-slate-200/80" />
            </div>
            <div className="h-8 w-24 rounded-xl bg-slate-200/90" />
            <div className="h-3.5 w-40 rounded-md bg-slate-200/70" />
          </div>
        ))}
      </div>

      {/* 2-Column Content Section Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 glass-card rounded-3xl p-5 sm:p-6 space-y-4 border border-slate-200/80">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="h-5 w-48 rounded-lg bg-slate-200/90" />
              <div className="h-3.5 w-64 rounded-md bg-slate-200/70" />
            </div>
            <div className="h-8 w-24 rounded-xl bg-slate-200/80" />
          </div>
          <div className="space-y-2.5 pt-1">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="p-3.5 rounded-2xl bg-white/80 border border-slate-200/70 flex items-center justify-between gap-3"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-44 rounded-md bg-slate-200/90" />
                  <div className="h-3 w-56 rounded-md bg-slate-200/70" />
                </div>
                <div className="h-7 w-20 rounded-xl bg-slate-200/80" />
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 space-y-4 border border-slate-200/80">
          <div className="space-y-1.5">
            <div className="h-5 w-40 rounded-lg bg-slate-200/90" />
            <div className="h-3.5 w-52 rounded-md bg-slate-200/70" />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            {[0, 1, 2, 3].map((box) => (
              <div
                key={box}
                className="p-3.5 rounded-2xl bg-white/80 border border-slate-200/70 space-y-2"
              >
                <div className="h-3.5 w-20 rounded-md bg-slate-200/70" />
                <div className="h-6 w-16 rounded-lg bg-slate-200/90" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
