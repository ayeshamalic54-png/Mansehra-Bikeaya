import React, { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { apiRequest, downloadAuthenticatedCsv } from '../../api/client';
import { StatCard } from '../StatCard';

export function AdminReportsPanel({ onNotify }) {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [report, setReport] = useState(null);

  const loadReport = async () => {
    try {
      const data = await apiRequest(`/api/reports/pnl?start_date=${startDate}&end_date=${endDate}`);
      setReport(data);
    } catch (e) {
      onNotify(e.message, true);
    }
  };

  useEffect(() => {
    loadReport();
  }, [startDate, endDate]);

  const handleExportCsv = async () => {
    try {
      await downloadAuthenticatedCsv(
        `/api/reports/export-csv?start_date=${startDate}&end_date=${endDate}`,
        `safargo_pnl_${startDate}_to_${endDate}.csv`
      );
      onNotify('CSV statement downloaded!');
    } catch (e) {
      onNotify(e.message, true);
    }
  };

  if (!report) {
    return <div className="p-6 bg-white rounded-2xl border border-slate-200/80 text-sm">Loading P&amp;L Analytics...</div>;
  }

  const s = report.summary;

  return (
    <div className="space-y-5">
      {/* Filter & Export Toolbar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 no-print text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <label className="font-bold text-slate-600">
            From:{' '}
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="ml-1 px-2.5 py-1.5 rounded-lg border border-slate-200/80 bg-slate-50/80 mono-num"
            />
          </label>
          <label className="font-bold text-slate-600">
            To:{' '}
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="ml-1 px-2.5 py-1.5 rounded-lg border border-slate-200/80 bg-slate-50/80 mono-num"
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 hover:bg-slate-200 font-bold inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-teal-600 text-white font-bold inline-flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Print PDF Statement
          </button>
        </div>
      </div>

      {/* P&L Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          label="Gross Fare Volume (GMV)"
          value={`Rs. ${s.gross_gmv}`}
          subtext={`${s.completed_trips} completed · ${s.cancelled_trips} cancelled`}
        />
        <StatCard
          label="App Fees + Commission"
          value={`Rs. ${Number((s.topup_collected || 0) + (s.admin_commission_earned || 0)).toFixed(0)}`}
          subtext={`App Fees: Rs. ${s.topup_collected ?? 0} · Ride Comm: Rs. ${s.admin_commission_earned}`}
          accent="green"
        />
        <StatCard
          label="Operating Expenses"
          value={`Rs. ${s.total_expenses}`}
          subtext="Logged office & promo costs"
          accent="rose"
        />
        <StatCard
          label="Net Business Profit"
          value={`Rs. ${s.net_profit ?? s.net_business_profit}`}
          subtext="App Fees + Commission minus expenses"
          accent="magenta"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
        {/* Service Breakdown */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
          <div className="font-extrabold text-sm text-slate-900">Service Breakdown</div>
          <table className="w-full text-left">
            <thead className="text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-2">Service</th>
                <th className="py-2">Trips</th>
                <th className="py-2">Gross</th>
                <th className="py-2">Admin Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.service_breakdown.map((row) => (
                <tr key={row.service_type}>
                  <td className="py-2.5 font-bold capitalize">{row.service_type.replace('_', ' ')}</td>
                  <td className="py-2.5 mono-num">{row.trips}</td>
                  <td className="py-2.5 mono-num">Rs. {row.gross_fare}</td>
                  <td className="py-2.5 mono-num font-bold text-[#009E4D]">Rs. {row.admin_profit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Daily Trend */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
          <div className="font-extrabold text-sm text-slate-900">Daily Revenue &amp; Profit Trend</div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {report.daily_trend.map((d) => (
              <div key={d.date} className="p-2.5 rounded-xl bg-slate-50/80 flex items-center justify-between mono-num">
                <div>
                  <div className="font-bold text-slate-900">{d.date}</div>
                  <div className="text-[11px] text-slate-500">{d.trips} trips</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-[#009E4D]">+Rs. {d.admin_commission} Comm.</div>
                  <div className="text-[11px] text-slate-500">Gross: Rs. {d.gross_fare} · Exp: Rs. {d.expenses}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rider-Wise Statement */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden text-xs">
        <div className="p-4 border-b border-slate-200/80 font-extrabold text-sm text-slate-900">
          Rider-Wise Performance &amp; Commission Report
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80">
              <tr>
                <th className="p-3.5">Captain</th>
                <th className="p-3.5">Trips</th>
                <th className="p-3.5">Gross Fare</th>
                <th className="p-3.5">Rider Net</th>
                <th className="p-3.5">Admin Profit</th>
                <th className="p-3.5">Live Balance Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.rider_performance.map((r) => (
                <tr key={r.rider_id}>
                  <td className="p-3.5 font-bold">{r.rider_name} ({r.bike_plate})</td>
                  <td className="p-3.5 mono-num">{r.trips}</td>
                  <td className="p-3.5 mono-num">Rs. {r.gross_fare}</td>
                  <td className="p-3.5 mono-num">Rs. {r.rider_earning}</td>
                  <td className="p-3.5 mono-num font-bold text-[#009E4D]">Rs. {r.commission}</td>
                  <td className="p-3.5 mono-num font-bold text-amber-600">Rs. {r.current_balance_due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
