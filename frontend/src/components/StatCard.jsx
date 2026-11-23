import React from 'react';

export function StatCard({ label, value, subtext, accent = 'default', icon: Icon }) {
  const accentText =
    accent === 'green'
      ? 'text-[#009E4D]'
      : accent === 'magenta'
      ? 'text-teal-700'
      : accent === 'amber'
      ? 'text-amber-600'
      : accent === 'rose'
      ? 'text-rose-600'
      : 'text-slate-900';

  return (
    <div className="card-elevated rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-2 transition hover:border-slate-300/90">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        {Icon && (
          <span className="w-8 h-8 rounded-xl bg-slate-100/80 flex items-center justify-center text-slate-600">
            <Icon className="w-4 h-4" />
          </span>
        )}
      </div>
      <div className={`text-2xl font-extrabold mono-num tracking-tight ${accentText}`}>{value}</div>
      {subtext && <div className="text-xs text-slate-500">{subtext}</div>}
    </div>
  );
}
