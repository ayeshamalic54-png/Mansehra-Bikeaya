import React from 'react';

export function BrandLogo({ dark = false, subtitle = 'Bikes · AC Cars · Parcels', size = 'md' }) {
  const iconBox = size === 'sm' ? 'w-9 h-9 rounded-xl' : 'w-11 h-11 rounded-2xl';
  return (
    <div className="flex items-center gap-3 select-none">
      <div
        className={`${iconBox} bg-gradient-to-br from-[#00D46A] via-[#009E4D] to-[#044D2B] flex items-center justify-center shadow-md shadow-emerald-950/20 ring-1 ring-white/25 shrink-0 overflow-hidden`}
      >
        <svg viewBox="0 0 64 64" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Speed chevrons */}
          <circle cx="32" cy="14" r="9" fill="#042F1E" fillOpacity="0.4" stroke="#FBBF24" strokeWidth="1.5" />
          <path d="M26 9.5H30L34 14L30 18.5H26L30 14L26 9.5Z" fill="#FFFFFF" />
          <path d="M32 9.5H36L40 14L36 18.5H32L36 14L32 9.5Z" fill="#FBBF24" />
          {/* Road ribbon */}
          <path d="M7 53 Q32 47 57 53 L55 57 Q32 52 9 57 Z" fill="#022C22" opacity="0.85" />
          <path d="M15 54 Q32 50 49 54" stroke="#FBBF24" strokeWidth="1.4" strokeDasharray="4 3" strokeLinecap="round" />
          {/* Sleek AC Sedan Car */}
          <path d="M12 36 C14 29, 18 26, 23 26 C28 26, 32 29, 34 36 Z" fill="#FFFFFF" />
          <path d="M14.5 35 C15.8 30.5, 18.5 28.5, 23 28.5 C27.5 28.5, 30.2 30.5, 31.5 35 Z" fill="#0F172A" />
          <rect x="8.5" y="34.5" width="29" height="12.5" rx="4.5" fill="#FFFFFF" />
          <rect x="17" y="40.5" width="12" height="4" rx="1.5" fill="#0F172A" />
          <rect x="10" y="39" width="4.5" height="2.8" rx="1" fill="#FDE047" />
          <rect x="31.5" y="39" width="4.5" height="2.8" rx="1" fill="#FDE047" />
          {/* Sleek Fast Motorbike */}
          <circle cx="38" cy="46" r="4.8" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.5" />
          <circle cx="52.5" cy="46" r="4.8" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.5" />
          <path d="M38 46 L42.5 40 H49.5 L47 46 Z" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M41 37 C43.5 33.5, 48.5 33.5, 51.5 36.5 L49.5 40 H42 Z" fill="#FFFFFF" />
          <path d="M49 34.5 L52.5 46" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          <circle cx="53" cy="36.5" r="2" fill="#FDE047" />
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
