import React from 'react';

export function BrandLogo({ dark = false, subtitle = 'Rides · Cars · Parcels', size = 'md' }) {
  const iconBox = size === 'sm' ? 'w-9 h-9 rounded-xl' : 'w-10 h-10 rounded-xl';
  return (
    <div className="flex items-center gap-3 select-none">
      <div
        className={`${iconBox} bg-gradient-to-br from-[#00B259] to-[#007D3D] flex items-center justify-center shadow-md shadow-emerald-900/15 ring-1 ring-white/20 shrink-0`}
      >
        <svg viewBox="0 0 36 36" className="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Speed lines */}
          <path d="M5 13H10M4 18H8" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" />
          {/* Rear & Front Wheels */}
          <circle cx="11" cy="24" r="4.5" stroke="#FFFFFF" strokeWidth="2.3" />
          <circle cx="26.5" cy="24" r="4.5" stroke="#FFFFFF" strokeWidth="2.3" />
          {/* Sleek Motorbike Frame */}
          <path
            d="M11 24L15.5 14.5H22.5L26.5 24M15.5 14.5L13 10.5H10M21.5 14.5L23.5 10.5H27.5"
            stroke="#FFFFFF"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="26.5" cy="24" r="1.2" fill="#A7F3D0" />
        </svg>
      </div>
      <div>
        <div className={`text-[17px] font-extrabold tracking-tight leading-none flex items-center ${dark ? 'text-white' : 'text-slate-900'}`}>
          <span>Bike</span>
          <span className={dark ? 'text-emerald-400' : 'text-[#009E4D]'}>aya</span>
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
