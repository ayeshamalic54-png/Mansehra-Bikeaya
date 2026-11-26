import React, { useMemo, useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { BrandLogo } from '../BrandLogo';

export function CustomerPrintRegister({ customers = [], settings = {}, onClose }) {
  const [filterMode, setFilterMode] = useState('all'); // all | active | blocked
  const [showSignCol, setShowSignCol] = useState(true);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (filterMode === 'active') return Boolean(c.is_active);
      if (filterMode === 'blocked') return !c.is_active;
      return true;
    });
  }, [customers, filterMode]);

  const stats = useMemo(() => {
    const total = filteredCustomers.length;
    const active = filteredCustomers.filter((c) => c.is_active).length;
    const blocked = total - active;
    const totalBookings = filteredCustomers.reduce((acc, c) => acc + Number(c.total_bookings || 0), 0);
    const totalSpent = filteredCustomers.reduce((acc, c) => acc + Number(c.total_spent || 0), 0);
    return {
      total,
      active,
      blocked,
      totalBookings,
      totalSpent: totalSpent.toFixed(0),
    };
  }, [filteredCustomers]);

  const nowPkt = new Date().toLocaleString('en-PK', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const formatDatePkt = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-PK', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      });
    } catch {
      return String(iso).slice(0, 10);
    }
  };

  return (
    <div className="space-y-4">
      {/* Screen-only Print Controls */}
      <div className="no-print bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Customer Table
          </button>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: `All (${customers.length})` },
              { id: 'active', label: 'Active' },
              { id: 'blocked', label: 'Blocked' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterMode(f.id)}
                className={`px-2.5 py-1.5 rounded-xl font-bold border ${
                  filterMode === f.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={showSignCol} onChange={(e) => setShowSignCol(e.target.checked)} />
            Written Notes / Sign Col
          </label>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-5 py-2.5 rounded-xl bg-[#009E4D] hover:bg-[#008741] text-white font-extrabold inline-flex items-center gap-2 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF (Auto A4 · Letter · Legal)
          </button>
        </div>
      </div>

      {/* Printable Official SafarGo Customer Sheet */}
      <section className="bg-white border border-slate-300 rounded-2xl p-4 sm:p-6 print:border-0 print:rounded-none print:p-0 space-y-4">
        <header className="rounded-2xl bg-gradient-to-r from-[#042F1E] via-[#064E3B] to-[#0F172A] text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-b-4 border-amber-400">
          <div className="flex items-center gap-3">
            <BrandLogo dark size="md" subtitle="Official Customer & Office Register" />
          </div>
          <div className="text-left sm:text-right text-[11px] space-y-0.5">
            <div className="text-sm sm:text-base font-extrabold tracking-wide text-amber-300 uppercase">
              Customer Directory &amp; Office Record Sheet
            </div>
            <div className="text-emerald-100 font-semibold">
              {settings.office_address || 'Main Bazar / Shahrah-e-Resham, Mansehra, KPK'}
            </div>
            <div className="text-slate-300 mono-num">
              Helpline: {settings.support_phone || '+92 300 1111111'} · WhatsApp: {settings.support_whatsapp || '+92 300 1111111'}
            </div>
            <div className="text-amber-200 font-bold mono-num">Printed: {nowPkt} PKT</div>
          </div>
        </header>

        {/* Distinct High-Contrast Color Summary Boxes at Top */}
        <div className="grid grid-cols-2 sm:grid-cols-5 print:grid-cols-5 gap-2.5">
          <div className="rounded-xl bg-[#0F172A] text-white p-3 border border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Total Customers</div>
            <div className="text-xl font-extrabold mono-num mt-0.5">{stats.total}</div>
            <div className="text-[10px] text-slate-300">Listed in sheet</div>
          </div>
          <div className="rounded-xl bg-[#007A3D] text-white p-3 border border-emerald-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Active Accounts</div>
            <div className="text-xl font-extrabold mono-num mt-0.5">{stats.active}</div>
            <div className="text-[10px] text-emerald-100">Ready to Book</div>
          </div>
          <div className="rounded-xl bg-[#BE123C] text-white p-3 border border-rose-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-100">Blocked Accounts</div>
            <div className="text-xl font-extrabold mono-num mt-0.5">{stats.blocked}</div>
            <div className="text-[10px] text-rose-100">Suspended</div>
          </div>
          <div className="rounded-xl bg-[#0369A1] text-white p-3 border border-sky-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-sky-100">Total Bookings</div>
            <div className="text-xl font-extrabold mono-num mt-0.5">{stats.totalBookings}</div>
            <div className="text-[10px] text-sky-100">Rides &amp; Parcels</div>
          </div>
          <div className="rounded-xl bg-[#4338CA] text-white p-3 border border-indigo-800 col-span-2 sm:col-span-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-100">Total Spend</div>
            <div className="text-lg font-extrabold mono-num mt-0.5">Rs. {stats.totalSpent}</div>
            <div className="text-[10px] text-indigo-100">Completed Trips</div>
          </div>
        </div>

        {/* Simple Written-Work Friendly Customer Register Table */}
        <div
          className="overflow-x-auto print:overflow-visible"
          style={{ fontFamily: 'Georgia, "Times New Roman", Arial, sans-serif' }}
        >
          <table className="print-fleet-table w-full border-collapse border border-slate-500 text-[11px] text-slate-900 bg-white">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold">
                <th className="border border-slate-400 px-2 py-2 text-center w-8">Sr#</th>
                <th className="border border-slate-400 px-2.5 py-2 text-left">Customer Full Name</th>
                <th className="border border-slate-400 px-2.5 py-2 text-left">Mobile Phone</th>
                <th className="border border-slate-400 px-2.5 py-2 text-left">Email Address</th>
                <th className="border border-slate-400 px-2 py-2 text-center">Registered Date</th>
                <th className="border border-slate-400 px-2 py-2 text-right">Bookings</th>
                <th className="border border-slate-400 px-2 py-2 text-right">Total Spend (Rs.)</th>
                <th className="border border-slate-400 px-2 py-2 text-center">Status</th>
                {showSignCol && (
                  <th className="border border-slate-400 px-2.5 py-2 text-left min-w-[140px]">
                    Written Notes / Sign
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td
                    colSpan={8 + (showSignCol ? 1 : 0)}
                    className="border border-slate-400 p-6 text-center text-slate-600"
                  >
                    No customers match the selected print filter.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c, idx) => (
                  <tr key={c.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="border border-slate-400 px-2 py-2.5 text-center font-bold mono-num">
                      {idx + 1}
                    </td>
                    <td className="border border-slate-400 px-2.5 py-2 font-bold text-xs text-slate-950">
                      {c.full_name}
                    </td>
                    <td className="border border-slate-400 px-2.5 py-2 mono-num font-semibold text-slate-900">
                      {c.phone}
                    </td>
                    <td className="border border-slate-400 px-2.5 py-2 text-slate-700">
                      {c.email || '—'}
                    </td>
                    <td className="border border-slate-400 px-2 py-2 text-center mono-num text-slate-700">
                      {formatDatePkt(c.created_at)}
                    </td>
                    <td className="border border-slate-400 px-2 py-2 text-right mono-num font-bold">
                      {c.total_bookings ?? 0}
                    </td>
                    <td className="border border-slate-400 px-2 py-2 text-right mono-num font-bold text-[#007A3D]">
                      Rs. {Number(c.total_spent || 0).toFixed(0)}
                    </td>
                    <td className="border border-slate-400 px-2 py-2 text-center font-bold">
                      {c.is_active ? 'Active' : 'Blocked'}
                    </td>
                    {showSignCol && (
                      <td className="border border-slate-400 px-2 py-3 align-bottom text-[9px] text-slate-400">
                        &nbsp;
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="pt-4 grid grid-cols-3 gap-6 text-[11px] text-slate-700" style={{ fontFamily: 'Georgia, Arial, sans-serif' }}>
          <div className="border-t border-slate-500 pt-1.5 text-center font-semibold">
            Prepared By (Dispatch Desk)
          </div>
          <div className="border-t border-slate-500 pt-1.5 text-center font-semibold">
            SafarGo Office Stamp &amp; Date
          </div>
          <div className="border-t border-slate-500 pt-1.5 text-center font-semibold">
            Verified By Owner / Manager
          </div>
        </footer>
      </section>
    </div>
  );
}
