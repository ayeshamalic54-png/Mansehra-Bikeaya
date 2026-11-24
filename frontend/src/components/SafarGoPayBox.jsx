import React, { useState } from 'react';
import { Check, Copy, Landmark } from 'lucide-react';
import { getSafarGoAccounts } from '../utils/paymentAccounts';

export function SafarGoPayBox({ settings = {}, selectedChannel = 'easypaisa', amount = null }) {
  const [copiedId, setCopiedId] = useState('');
  const { title, channels } = getSafarGoAccounts(settings);
  const current = channels[selectedChannel] || channels.easypaisa;
  const configuredList = Object.values(channels).filter((c) => Boolean(c.accountNumber));

  const copyValue = (id, text) => {
    if (!text || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(''), 1500);
    });
  };

  return (
    <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-extrabold text-slate-900">
          <Landmark className="w-4 h-4 text-[#009E4D]" />
          <span>Pay to {title}</span>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-white border border-emerald-200 text-[#008741] font-extrabold">
          Account Title: {title}
        </span>
      </div>

      {current?.accountNumber ? (
        <div className="p-2.5 rounded-xl bg-white border border-emerald-200/80 flex items-center justify-between gap-2">
          <div>
            <div className="font-bold text-slate-800">{current.label} · {title}</div>
            <div className="mono-num font-extrabold text-sm text-[#008741]">{current.accountNumber}</div>
          </div>
          <button
            type="button"
            onClick={() => copyValue(current.id, current.accountNumber)}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#008741] font-bold inline-flex items-center gap-1"
          >
            {copiedId === current.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedId === current.id ? 'Copied' : 'Copy'}
          </button>
        </div>
      ) : configuredList.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-[11px] text-slate-600 font-medium">
            Send to any active <strong>{title}</strong> account below:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {configuredList.map((ch) => (
              <div key={ch.id} className="p-2 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 truncate">{ch.label} ({title})</div>
                  <div className="mono-num font-extrabold text-[#008741] truncate">{ch.accountNumber}</div>
                </div>
                <button
                  type="button"
                  onClick={() => copyValue(ch.id, ch.accountNumber)}
                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-700 font-bold shrink-0"
                >
                  {copiedId === ch.id ? 'OK' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-slate-600">
          Account Title: <strong className="text-[#008741]">{title}</strong> — Send via {current?.label} and enter Transaction ID / TID below{settings?.support_phone ? ` (Helpline: ${settings.support_phone})` : ''}.
        </div>
      )}

      {amount !== null && Number(amount) > 0 && (
        <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between pt-1">
          <span>Amount Payable ({title}):</span>
          <span className="mono-num text-sm text-[#009E4D]">Rs. {Number(amount).toFixed(0)}</span>
        </div>
      )}
    </div>
  );
}
