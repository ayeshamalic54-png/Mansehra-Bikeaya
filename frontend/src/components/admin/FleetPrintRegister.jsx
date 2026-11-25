import React, { useMemo, useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { BrandLogo } from '../BrandLogo';

export function FleetPrintRegister({ riders = [], settings = {}, onClose }) {
  const [filterMode, setFilterMode] = useState('all'); // all | verified | pending | bike | car
  const [showPhotos, setShowPhotos] = useState(true);
  const [showSignCol, setShowSignCol] = useState(true);

  const filteredRiders = useMemo(() => {
    return riders.filter((r) => {
      if (filterMode === 'verified') return Boolean(r.is_verified);
      if (filterMode === 'pending') return !r.is_verified;
      if (filterMode === 'bike') return (r.vehicle_type || 'bike') === 'bike';
      if (filterMode === 'car') return r.vehicle_type === 'car';
      return true;
    });
  }, [riders, filterMode]);

  const stats = useMemo(() => {
    const total = filteredRiders.length;
    const verified = filteredRiders.filter((r) => r.is_verified).length;
    const pending = total - verified;
    const bikes = filteredRiders.filter((r) => (r.vehicle_type || 'bike') === 'bike').length;
    const cars = filteredRiders.filter((r) => r.vehicle_type === 'car').length;
    const totalKm = filteredRiders.reduce((acc, r) => acc + Number(r.total_distance_km || 0), 0);
    const totalDue = filteredRiders.reduce((acc, r) => acc + Math.max(0, Number(r.balance_due_to_admin || 0)), 0);
    return {
      total,
      verified,
      pending,
      bikes,
      cars,
      totalKm: totalKm.toFixed(1),
      totalDue: totalDue.toFixed(0),
    };
  }, [filteredRiders]);

  const nowPkt = new Date().toLocaleString('en-PK', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

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
            Back to Fleet Table
          </button>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: `All (${riders.length})` },
              { id: 'verified', label: 'Verified' },
              { id: 'pending', label: 'Pending' },
              { id: 'bike', label: 'Bike Only' },
              { id: 'car', label: 'AC Car Only' },
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
            <input type="checkbox" checked={showPhotos} onChange={(e) => setShowPhotos(e.target.checked)} />
            Show Photos
          </label>
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

      {/* Printable Official SafarGo Fleet Sheet */}
      <section className="bg-white border border-slate-300 rounded-2xl p-4 sm:p-6 print:border-0 print:rounded-none print:p-0 space-y-4">
        {/* Attractive Top Header with SafarGo Brand Logo */}
        <header className="rounded-2xl bg-gradient-to-r from-[#042F1E] via-[#064E3B] to-[#0F172A] text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-b-4 border-amber-400">
          <div className="flex items-center gap-3">
            <BrandLogo dark size="md" subtitle="Official Fleet & Dispatch Register" />
          </div>
          <div className="text-left sm:text-right text-[11px] space-y-0.5">
            <div className="text-sm sm:text-base font-extrabold tracking-wide text-amber-300 uppercase">
              Captain Directory &amp; Office Record Sheet
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
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Total Captains</div>
            <div className="text-xl font-extrabold mono-num mt-0.5">{stats.total}</div>
            <div className="text-[10px] text-slate-300">Listed in sheet</div>
          </div>
          <div className="rounded-xl bg-[#007A3D] text-white p-3 border border-emerald-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Verified Active</div>
            <div className="text-xl font-extrabold mono-num mt-0.5">{stats.verified}</div>
            <div className="text-[10px] text-emerald-100">Approved by Admin</div>
          </div>
          <div className="rounded-xl bg-[#B45309] text-white p-3 border border-amber-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-100">Pending Review</div>
            <div className="text-xl font-extrabold mono-num mt-0.5">{stats.pending}</div>
            <div className="text-[10px] text-amber-100">Awaiting Docs / Verify</div>
          </div>
          <div className="rounded-xl bg-[#0369A1] text-white p-3 border border-sky-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-sky-100">Bike vs AC Car</div>
            <div className="text-lg font-extrabold mono-num mt-0.5">
              {stats.bikes} Bike · {stats.cars} Car
            </div>
            <div className="text-[10px] text-sky-100">Fleet Mix</div>
          </div>
          <div className="rounded-xl bg-[#4338CA] text-white p-3 border border-indigo-800 col-span-2 sm:col-span-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-100">Trips KM &amp; Dues</div>
            <div className="text-base font-extrabold mono-num mt-0.5">
              {stats.totalKm} km
            </div>
            <div className="text-[10px] text-indigo-100 mono-num">Due: Rs. {stats.totalDue}</div>
          </div>
        </div>

        {/* Simple Written-Work Friendly Office Table (Adjusts cleanly to every print page size) */}
        <div
          className="overflow-x-auto print:overflow-visible"
          style={{ fontFamily: 'Georgia, "Times New Roman", Arial, sans-serif' }}
        >
          <table className="print-fleet-table w-full border-collapse border border-slate-500 text-[11px] text-slate-900 bg-white">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold">
                <th className="border border-slate-400 px-2 py-2 text-center w-8">Sr#</th>
                {showPhotos && <th className="border border-slate-400 px-2 py-2 text-center w-12">Photo</th>}
                <th className="border border-slate-400 px-2.5 py-2 text-left">Captain Name &amp; Mobile</th>
                <th className="border border-slate-400 px-2.5 py-2 text-left">CNIC &amp; License #</th>
                <th className="border border-slate-400 px-2.5 py-2 text-left">Bike / AC Car &amp; Plate</th>
                <th className="border border-slate-400 px-2.5 py-2 text-left">Area / Chowk</th>
                <th className="border border-slate-400 px-2 py-2 text-center">Status &amp; Docs</th>
                <th className="border border-slate-400 px-2 py-2 text-right">Trips / KM / Due</th>
                {showSignCol && (
                  <th className="border border-slate-400 px-2.5 py-2 text-left min-w-[130px]">
                    Written Notes / Sign
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRiders.length === 0 ? (
                <tr>
                  <td
                    colSpan={7 + (showPhotos ? 1 : 0) + (showSignCol ? 1 : 0)}
                    className="border border-slate-400 p-6 text-center text-slate-600"
                  >
                    No captains match the selected print filter.
                  </td>
                </tr>
              ) : (
                filteredRiders.map((r, idx) => {
                  const docCount = [
                    r.rider_photo,
                    r.vehicle_photo,
                    r.cnic_front_photo,
                    r.cnic_back_photo,
                  ].filter(Boolean).length;
                  return (
                    <tr key={r.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="border border-slate-400 px-2 py-2.5 text-center font-bold mono-num">
                        {idx + 1}
                      </td>
                      {showPhotos && (
                        <td className="border border-slate-400 px-1.5 py-1.5 text-center">
                          {r.rider_photo ? (
                            <img
                              src={r.rider_photo}
                              alt={r.full_name}
                              className="w-9 h-9 rounded-md object-cover border border-slate-400 mx-auto"
                            />
                          ) : (
                            <span className="inline-block w-8 h-8 leading-8 rounded-md border border-slate-300 text-[10px] font-bold text-slate-500">
                              N/A
                            </span>
                          )}
                        </td>
                      )}
                      <td className="border border-slate-400 px-2.5 py-2">
                        <div className="font-bold text-xs text-slate-950">{r.full_name}</div>
                        <div className="mono-num text-[11px] font-semibold text-slate-800">{r.phone}</div>
                        {r.email && <div className="text-[10px] text-slate-600">{r.email}</div>}
                      </td>
                      <td className="border border-slate-400 px-2.5 py-2 mono-num text-[10.5px]">
                        <div>
                          <span className="font-semibold">CNIC:</span> {r.cnic_number || '___________'}
                        </div>
                        <div>
                          <span className="font-semibold">Lic:</span> {r.license_no || '___________'}
                        </div>
                      </td>
                      <td className="border border-slate-400 px-2.5 py-2">
                        <div className="font-bold">
                          [{(r.vehicle_type || 'bike').toUpperCase()}] {r.bike_model || '-'}
                        </div>
                        <div className="mono-num font-bold text-slate-800">{r.bike_plate || '-'}</div>
                      </td>
                      <td className="border border-slate-400 px-2.5 py-2">{r.zone_name || '-'}</td>
                      <td className="border border-slate-400 px-2 py-2 text-center">
                        <div className="font-bold">
                          {r.is_verified ? 'Verified' : r.verification_status === 'rejected' ? 'Rejected' : 'Pending'}
                        </div>
                        <div className="text-[10px] text-slate-700">
                          Docs: {docCount}/4 · {r.is_active ? 'Active' : 'Suspended'}
                        </div>
                      </td>
                      <td className="border border-slate-400 px-2 py-2 text-right mono-num text-[10.5px]">
                        <div>
                          {r.total_trips} trips · <strong>{r.total_distance_km ?? 0} km</strong>
                        </div>
                        <div>
                          Due: <strong>Rs. {r.balance_due_to_admin}</strong> / {r.credit_limit}
                        </div>
                      </td>
                      {showSignCol && (
                        <td className="border border-slate-400 px-2 py-3 align-bottom text-[9px] text-slate-400">
                          &nbsp;
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Clean Office Footer Sign-Off */}
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
