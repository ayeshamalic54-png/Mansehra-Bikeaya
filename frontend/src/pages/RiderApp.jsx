import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  Download,
  LogOut,
  MapPin,
  Phone,
  Power,
  User,
  Wallet,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';

export function RiderApp({ onOpenDownloads }) {
  const { user, refreshMe, logout } = useAuth();
  const [tab, setTab] = useState('duty'); // duty | active | ledger | profile
  const [availableJobs, setAvailableJobs] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [ledgerData, setLedgerData] = useState({ summary: {}, entries: [] });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const rp = user?.rider_profile;

  const loadAll = async () => {
    try {
      const [avail, mine, ledger] = await Promise.all([
        apiRequest('/api/riders/available-jobs'),
        apiRequest('/api/bookings/my'),
        apiRequest('/api/riders/ledger'),
      ]);
      setAvailableJobs(avail);
      setMyJobs(mine);
      setLedgerData(ledger);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadAll();
    const timer = setInterval(loadAll, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleOnline = async () => {
    setErr('');
    setMsg('');
    try {
      await apiRequest('/api/riders/toggle-online', { method: 'POST' });
      await refreshMe();
      await loadAll();
    } catch (e) {
      setErr(e.message);
    }
  };

  const handleAccept = async (bookingId) => {
    setErr('');
    setMsg('');
    try {
      const accepted = await apiRequest(`/api/riders/jobs/${bookingId}/accept`, { method: 'POST' });
      setMsg(`Accepted ${accepted.booking_code}! Head to pickup.`);
      await refreshMe();
      await loadAll();
      setTab('active');
    } catch (e) {
      setErr(e.message);
    }
  };

  const handleStep = async (bookingId, nextStatus) => {
    setErr('');
    setMsg('');
    try {
      const updated = await apiRequest(`/api/riders/jobs/${bookingId}/status`, {
        method: 'POST',
        body: { status: nextStatus },
      });
      setMsg(`Ride ${updated.booking_code} updated to ${updated.status}.`);
      await refreshMe();
      await loadAll();
    } catch (e) {
      setErr(e.message);
    }
  };

  const activeJobs = myJobs.filter((j) => ['assigned', 'arrived', 'in_progress'].includes(j.status));
  const summary = ledgerData.summary || {};

  return (
    <div className="min-h-screen pb-24">
      {/* Dark Captain Header */}
      <header className="sticky top-0 z-20 bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] text-slate-400">
              Captain · {rp?.bike_model} ({rp?.bike_plate})
            </div>
            <div className="text-base font-extrabold">{user?.full_name}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleOnline}
              className={`px-3.5 py-2 rounded-full text-xs font-extrabold inline-flex items-center gap-1.5 transition ${
                rp?.is_online ? 'bg-[#009E4D] text-white' : 'bg-slate-700 text-slate-300'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              {rp?.is_online ? 'ONLINE' : 'OFFLINE'}
            </button>
            <button
              onClick={logout}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {!rp?.is_verified && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Your Captain account is pending Admin verification. Once Admin verifies your CNIC &amp; Bike Plate, you can go online and accept rides.
            </span>
          </div>
        )}

        {summary.is_over_limit && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Commission due (Rs. {summary.balance_due_to_admin}) exceeds your credit limit (Rs. {summary.credit_limit}). Please pay Admin to continue receiving rides.
            </span>
          </div>
        )}

        {msg && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#008741] text-xs font-bold">
            {msg}
          </div>
        )}
        {err && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
            {err}
          </div>
        )}

        {/* TAB 1: DUTY & AVAILABLE JOBS */}
        {tab === 'duty' && (
          <div className="space-y-4">
            {/* Captain Ledger Strip */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3">
                <div className="text-[11px] text-slate-500">Collected</div>
                <div className="text-base font-extrabold mono-num text-slate-900">
                  Rs. {Number(summary.total_gross_collected || 0).toFixed(0)}
                </div>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3">
                <div className="text-[11px] text-slate-500">My Share</div>
                <div className="text-base font-extrabold mono-num text-[#009E4D]">
                  Rs. {Number(summary.total_net_earned || 0).toFixed(0)}
                </div>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3">
                <div className="text-[11px] text-slate-500">Admin Due</div>
                <div className={`text-base font-extrabold mono-num ${Number(summary.balance_due_to_admin || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  Rs. {Number(summary.balance_due_to_admin || 0).toFixed(0)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-900">
                Available Ride &amp; Parcel Requests ({availableJobs.length})
              </h2>
              <button onClick={loadAll} className="text-xs font-bold text-[#009E4D] underline">
                Refresh
              </button>
            </div>

            {availableJobs.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-xs sm:text-sm text-slate-500">
                No pending ride requests right now. Keep Duty ONLINE to receive new city &amp; intercity bookings!
              </div>
            ) : (
              availableJobs.map((job) => (
                <div key={job.id} className="bg-white border-2 border-[#009E4D]/40 rounded-2xl p-4 space-y-3 text-xs shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-teal-600 text-white font-bold">NEW JOB</span>
                      <span className="mono-num font-bold">{job.booking_code}</span>
                      <StatusBadge value={job.service_type} />
                    </div>
                    <span className="mono-num font-bold text-slate-600">{job.distance_km} km</span>
                  </div>

                  <div className="space-y-1 text-slate-800">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#009E4D] shrink-0 mt-0.5" />
                      <span><strong>Pickup:</strong> {job.pickup_zone} — {job.pickup_address}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <span><strong>Drop:</strong> {job.drop_zone} — {job.drop_address}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50/80 flex items-center justify-between mono-num">
                    <div>
                      <div className="text-slate-500">Customer Fare</div>
                      <div className="text-base font-extrabold text-slate-900">Rs. {job.final_fare}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-500">Your Net Earning</div>
                      <div className="text-base font-extrabold text-[#009E4D]">Rs. {job.rider_earning}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAccept(job.id)}
                    className="w-full py-3 rounded-xl text-sm font-extrabold text-white bg-[#009E4D] hover:bg-[#008741] transition"
                  >
                    Accept Ride Now
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: ACTIVE JOBS */}
        {tab === 'active' && (
          <div className="space-y-4">
            <h2 className="text-sm font-extrabold text-slate-900">Active Assigned Trips ({activeJobs.length})</h2>
            {activeJobs.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-xs sm:text-sm text-slate-500">
                No active trip in progress. Check the Duty tab to accept a request.
              </div>
            ) : (
              activeJobs.map((job) => (
                <div key={job.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="mono-num font-extrabold text-sm">{job.booking_code}</span>
                    <StatusBadge value={job.status} />
                  </div>

                  <div className="space-y-1">
                    <div><strong>Pickup:</strong> {job.pickup_zone} ({job.pickup_address})</div>
                    <div><strong>Drop:</strong> {job.drop_zone} ({job.drop_address})</div>
                    {job.receiver_name && (
                      <div className="text-teal-800 font-semibold">
                        Parcel Receiver: {job.receiver_name} ({job.receiver_phone}) · COD: Rs. {job.cod_amount}
                      </div>
                    )}
                  </div>

                  {job.customer && (
                    <div className="p-3 rounded-xl bg-slate-50/80 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">Customer: {job.customer.full_name}</div>
                        <div className="mono-num text-slate-600">{job.customer.phone}</div>
                      </div>
                      <a
                        href={`tel:${job.customer.phone}`}
                        className="px-3 py-2 rounded-xl bg-slate-900 text-white font-bold inline-flex items-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Call
                      </a>
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex justify-between mono-num font-bold">
                    <span>Collect ({job.payment_method}): Rs. {job.final_fare}</span>
                    <span className="text-[#008741]">Net: Rs. {job.rider_earning}</span>
                  </div>

                  <div className="flex gap-2">
                    {job.status === 'assigned' && (
                      <button
                        onClick={() => handleStep(job.id, 'arrived')}
                        className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-extrabold"
                      >
                        Mark Arrived at Pickup
                      </button>
                    )}
                    {(job.status === 'assigned' || job.status === 'arrived') && (
                      <button
                        onClick={() => handleStep(job.id, 'in_progress')}
                        className="flex-1 py-3 rounded-xl bg-teal-600 text-white font-extrabold"
                      >
                        Start Ride
                      </button>
                    )}
                    <button
                      onClick={() => handleStep(job.id, 'completed')}
                      className="flex-1 py-3 rounded-xl bg-[#009E4D] text-white font-extrabold"
                    >
                      Complete Trip
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: HISAB / LEDGER */}
        {tab === 'ledger' && (
          <div className="space-y-4">
            <div className="bg-slate-900 text-white rounded-3xl p-5 space-y-3">
              <div className="text-xs text-slate-400">Net Commission Balance with Admin</div>
              <div className="text-3xl font-extrabold mono-num text-amber-400">
                {Number(summary.balance_due_to_admin || 0) >= 0
                  ? `Rs. ${Number(summary.balance_due_to_admin || 0).toFixed(0)} Payable to Admin`
                  : `Rs. ${Math.abs(Number(summary.balance_due_to_admin || 0)).toFixed(0)} Admin Owes You`}
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-xs mono-num">
                <div>
                  <div className="text-slate-400">Total Trips</div>
                  <div className="font-bold">{summary.total_trips ?? 0}</div>
                </div>
                <div>
                  <div className="text-slate-400">Commission</div>
                  <div className="font-bold">Rs. {Number(summary.total_commission_generated || 0).toFixed(0)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Settled</div>
                  <div className="font-bold text-[#009E4D]">Rs. {Number(summary.total_settled_to_admin || 0).toFixed(0)}</div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100 text-xs">
              <div className="p-4 font-extrabold text-slate-900">Hisab-Kitab Transaction Log</div>
              {(ledgerData.entries || []).length === 0 ? (
                <div className="p-6 text-center text-slate-500">No ledger entries yet.</div>
              ) : (
                ledgerData.entries.map((e) => (
                  <div key={e.id} className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-800">{e.note}</div>
                      <div className="text-[11px] text-slate-500 mono-num">
                        {new Date(e.created_at).toLocaleString()} · {e.payment_channel}
                      </div>
                    </div>
                    <div className="text-right mono-num shrink-0">
                      <div className={`font-extrabold ${e.signed_delta > 0 ? 'text-amber-600' : 'text-[#009E4D]'}`}>
                        {e.signed_delta > 0 ? `+Rs.${e.signed_delta}` : `-Rs.${Math.abs(e.signed_delta)}`}
                      </div>
                      <div className="text-[11px] text-slate-500">Bal: Rs.{e.balance_after}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PROFILE */}
        {tab === 'profile' && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 text-xs">
            <div className="text-base font-extrabold text-slate-900">{user?.full_name}</div>
            <div><strong>Phone:</strong> <span className="mono-num">{user?.phone}</span></div>
            <div><strong>Bike:</strong> {rp?.bike_model} (<span className="mono-num">{rp?.bike_plate}</span>)</div>
            <div><strong>CNIC:</strong> <span className="mono-num">{rp?.cnic_number || 'N/A'}</span></div>
            <div><strong>Zone:</strong> {rp?.zone_name}</div>
            <div><strong>Credit Limit:</strong> <span className="mono-num">Rs. {rp?.credit_limit}</span></div>
            <div><strong>Rating:</strong> ★ {rp?.rating_avg}</div>
            <button
              onClick={onOpenDownloads}
              className="mt-2 w-full py-3 rounded-xl bg-teal-600 text-white font-bold inline-flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Open APK / EXE Download Center
            </button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200/80">
        <div className="max-w-3xl mx-auto grid grid-cols-4">
          {[
            { id: 'duty', label: 'Duty', icon: Bike },
            { id: 'active', label: `Active (${activeJobs.length})`, icon: CheckCircle2 },
            { id: 'ledger', label: 'Hisab', icon: Wallet },
            { id: 'profile', label: 'Profile', icon: User },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`py-2.5 flex flex-col items-center gap-1 text-xs font-bold border-t-2 transition ${
                  active ? 'border-[#009E4D] text-[#009E4D]' : 'border-transparent text-slate-500'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
