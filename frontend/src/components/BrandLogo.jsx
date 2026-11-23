import React from 'react';
import { Bike } from 'lucide-react';

export function BrandLogo({ dark = false, subtitle = 'Mansehra Network' }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="relative w-10 h-10 rounded-xl bg-[#00A651] flex items-center justify-center shadow-sm shadow-[#00A651]/30">
        <Bike className="w-5 h-5 text-white" strokeWidth={2.4} />
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#EC1FA8] ring-2 ring-white" />
      </div>
      <div>
        <div className={`text-base font-extrabold tracking-tight leading-none ${dark ? 'text-white' : 'text-slate-900'}`}>
          Mansehra <span className="text-[#00A651]">Bikeaya</span>
        </div>
        {subtitle && (
          <div className={`text-[11px] font-medium mt-0.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
