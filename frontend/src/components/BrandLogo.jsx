import React from 'react';

export function BrandLogo({ dark = false, subtitle = 'Bikes · Cars · Parcels', size = 'md' }) {
  const iconBox = size === 'sm' ? 'w-9 h-9 rounded-xl' : 'w-10 h-10 rounded-xl';
  return (
    <div className="flex items-center gap-3 select-none">
      <div
        className={`${iconBox} bg-gradient-to-br from-[#00B259] via-[#00964A] to-[#006B35] flex items-center justify-center shadow-md shadow-emerald-950/20 ring-1 ring-white/20 shrink-0`}
      >
        <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Precision architectural forward mobility chevrons */}
          <path
            d="M9 10.5H16L24 20L16 29.5H9L17 20L9 10.5Z"
            fill="#FFFFFF"
          />
          <path
            d="M19.5 10.5H24.5L32.5 20L24.5 29.5H19.5L27.5 20L19.5 10.5Z"
            fill="#A7F3D0"
          />
        </svg>
      </div>
      <div>
        <div className={`text-[18px] font-extrabold tracking-tight leading-none flex items-center ${dark ? 'text-white' : 'text-slate-900'}`}>
          <span>Safar</span>
          <span className={dark ? 'text-emerald-400' : 'text-[#009E4D]'}>Go</span>
        </div>
        {subtitle && (
          <div className={`text-[11px] font-medium mt-1 tracking-wide ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
