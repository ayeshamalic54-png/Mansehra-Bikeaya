import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bike,
  ClipboardList,
  Coins,
  Download,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  PackagePlus,
  Pencil,
  PhoneCall,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../components/BrandLogo';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { AdminFinancePanel } from '../components/admin/AdminFinancePanel';
import { AdminOperationsPanel } from '../components/admin/AdminOperationsPanel';
import { AdminPeoplePanel } from '../components/admin/AdminPeoplePanel';
import { AdminReportsPanel } from '../components/admin/AdminReportsPanel';

const NAV_GROUPS = [
  {
    group: 'Overview',
    items: [{ id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard }],
  },
  {
    group: 'Dispatch & Rides',
    items: [
      { id: 'dispatch', label: 'Live Rides Queue', icon: ClipboardList },
      { id: 'manual_booking', label: 'Phone / Manual Booking', icon: PhoneCall },
    ],
  },
  {
    group: 'Fleet & Users',
    items: [
      { id: 'riders', label: 'Motorbike Riders', icon: Bike },
      { id: 'customers', label: 'Customers Directory', icon: Users },
    ],
  },
  {
    group: 'Finance & Lain-Dain',
    items: [
      { id: 'settlements', label: 'Rider Dues & Settlements', icon: Wallet },
      { id: 'pricing', label: 'Fare & Commission %', icon: Coins },
      { id: 'expenses', label: 'Owner Expenses', icon: Settings },
    ],
  },
  {
    group: 'Analytics & Releases',
    items: [
      { id: 'reports', label: 'Profit & Loss (P&L)', icon: BarChart3 },
      { id: 'releases', label: 'APK / EXE Releases', icon: PackagePlus },
    ],
  },
  {
    group: 'Operations & Security',
    items: [
      { id: 'tickets', label: 'Complaints & Support', icon: HelpCircle },
      { id: 'zones', label: 'Mansehra Zones & Promos', icon: MapPin },
      { id: 'settings', label: 'Passwords & Settings', icon: ShieldCheck },
    ],
  },
];

export function AdminDashboard({ onOpenDownloads }) {
  const { user, bootstrap, logout, refreshBootstrap } = useAuth();
  const [subpage, setSubpage] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [overview, setOverview] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [bookingStatusFilter, setBookingStatusFilter] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [riders, setRiders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [editingBooking, setEditingBooking] = useState(null);
  const [toast, setToast] = useState(null);

  const [manualForm, setManualForm] = useState({
    customer_phone: '',
    customer_name: '',
    service_type: 'bike_ride',
    pickup_zone: bootstrap.zones?.[0]?.name || 'Main Bazar / Lari Adda',
    pickup_address: '',
    drop_zone: bootstrap.zones?.[2]?.name || 'Ghazikot Township',
    drop_address: '',
    distance_km: 4,
    payment_method: 'cash',
    rider_id: '',
    custom_fare: '',
    customer_notes: '',
  });

  const notify = (text, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 4500);
  };

  const loadOverviewAndRiders = async () => {
    try {
      const [ov, rd] = await Promise.all([
        apiRequest('/api/admin/overview'),
        apiRequest('/api/admin/riders'),
      ]);
      setOverview(ov);
      setRiders(rd);
    } catch (e) {
      notify(e.message, true);
    }
  };

  const loadBookings = async () => {
    try {
      const params = new URLSearchParams();
      if (bookingStatusFilter) params.set('status', bookingStatusFilter);
      if (bookingSearch.trim()) params.set('search', bookingSearch.trim());
      setBookings(await apiRequest(`/api/admin/bookings?${params.toString()}`));
    } catch (e) {
      notify(e.message, true);
    }
  };

  const loadCustomers = async () => {
    try {
      setCustomers(await apiRequest('/api/admin/customers'));
    } catch (e) {
      notify(e.message, true);
    }
  };

  useEffect(() => {
    loadOverviewAndRiders();
    if (subpage === 'dispatch') loadBookings();
    if (subpage === 'customers') loadCustomers();
  }, [subpage, bookingStatusFilter]);

  const handleAssignRider = async (bookingId, riderId) => {
    if (!riderId) return;
    try {
      await apiRequest(`/api/admin/bookings/${bookingId}/assign`, {
        method: 'POST',
        body: { rider_id: Number(riderId) },
      });
      notify('Captain assigned to booking!');
      loadOverviewAndRiders();
      if (subpage === 'dispatch') loadBookings();
    } catch (e) {
      notify(e.message, true);
    }
  };

  const handleAdminStatus = async (bookingId, status) => {
    try {
      await apiRequest(`/api/admin/bookings/${bookingId}/status`, {
        method: 'POST',
        body: { status },
      });
      notify(`Booking marked ${status}.`);
      loadOverviewAndRiders();
      if (subpage === 'dispatch') loadBookings();
    } catch (e) {
      notify(e.message, true);
    }
  };

  const handleDeleteBooking = async (b) => {
    if (!window.confirm(`Delete booking ${b.booking_code}? Any linked ledger entry will also be removed & recalculated.`)) return;
    try {
      await apiRequest(`/api/admin/bookings/${b.id}`, { method: 'DELETE' });
      notify(`Booking ${b.booking_code} deleted.`);
      loadOverviewAndRiders();
      if (subpage === 'dispatch') loadBookings();
    } catch (e) {
      notify(e.message, true);
    }
  };

  const handleSaveEditedBooking = async (e) => {
    e.preventDefault();
    if (!editingBooking) return;
    try {
      await apiRequest(`/api/admin/bookings/${editingBooking.id}`, {
        method: 'PATCH',
        body: {
          service_type: editingBooking.service_type,
          pickup_zone: editingBooking.pickup_zone,
          pickup_address: editingBooking.pickup_address,
          drop_zone: editingBooking.drop_zone,
          drop_address: editingBooking.drop_address,
          distance_km: Number(editingBooking.distance_km),
          final_fare: Number(editingBooking.final_fare),
          payment_method: editingBooking.payment_method,
          payment_collector: editingBooking.payment_collector,
          customer_notes: editingBooking.customer_notes || null,
        },
      });
      notify(`Booking ${editingBooking.booking_code} updated!`);
      setEditingBooking(null);
      loadOverviewAndRiders();
      if (subpage === 'dispatch') loadBookings();
    } catch (err) {
      notify(err.message, true);
    }
  };

  const handleCreateManualBooking = async (e) => {
    e.preventDefault();
    try {
      const created = await apiRequest('/api/admin/bookings/manual', {
        method: 'POST',
        body: {
          ...manualForm,
          distance_km: Number(manualForm.distance_km),
          rider_id: manualForm.rider_id ? Number(manualForm.rider_id) : null,
          custom_fare: manualForm.custom_fare ? Number(manualForm.custom_fare) : null,
        },
      });
      notify(`Manual booking ${created.booking_code} created!`);
      setManualForm({
        ...manualForm,
        customer_phone: '',
        customer_name: '',
        pickup_address: '',
        drop_address: '',
        custom_fare: '',
        customer_notes: '',
      });
      setSubpage('dispatch');
    } catch (err) {
      notify(err.message, true);
    }
  };

  const verifiedRiders = riders.filter((r) => r.is_verified && r.is_active);
  const kpis = overview?.kpis || {};

  return (
    <div className="min-h-screen bg-[#F4F6FB] flex">
      {/* Sidebar Desktop + Mobile Drawer */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-slate-950 text-slate-100 flex flex-col justify-between p-4 transition-transform duration-200 no-print ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <BrandLogo dark subtitle="Admin Command" />
            <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-4">
            {NAV_GROUPS.map((grp) => (
              <div key={grp.group} className="space-y-1">
                <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {grp.group}
                </div>
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  const active = subpage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSubpage(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                        active
                          ? 'bg-[#00A651] text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 shrink-0" />
                        {item.label}
                      </span>
                      {item.id === 'dispatch' && kpis.pending_dispatch_count > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-[#EC1FA8] text-white text-[10px] mono-num">
                          {kpis.pending_dispatch_count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
          <button
            onClick={onOpenDownloads}
            className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 font-bold flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-[#EC1FA8]" />
            APK / EXE Downloads
          </button>
          <button
            onClick={logout}
            className="w-full py-2 px-3 rounded-xl text-rose-400 hover:bg-slate-900 font-bold flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout ({user?.full_name?.split(' ')[0]})
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-white border-b border-[#E6E9F2] px-4 sm:px-6 h-16 flex items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-[#E6E9F2] text-slate-700"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Mansehra Operations
              </div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 capitalize">
                {subpage.replace(/_/g, ' ')}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSubpage('manual_booking')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#00A651] hover:bg-[#008E46]"
            >
              + Manual Booking
            </button>
            <button
              onClick={() => setSubpage('settlements')}
              className="hidden sm:inline-flex px-3.5 py-2 rounded-xl text-xs font-bold border border-[#E6E9F2] bg-[#F4F6FB] hover:bg-slate-200"
            >
              Collect Rider Cash
            </button>
            <button
              onClick={() => setSubpage('settings')}
              className="hidden md:inline-flex px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900"
            >
              Passwords &amp; Settings
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6 space-y-5 max-w-7xl w-full mx-auto">
          {toast && (
            <div
              className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                toast.isError
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-emerald-50 border-emerald-200 text-[#008E46]'
              }`}
            >
              <span>{toast.text}</span>
              <button onClick={() => setToast(null)} className="underline">Close</button>
            </div>
          )}

          {/* Edit Booking Modal */}
          {editingBooking && (
            <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
              <form
                onSubmit={handleSaveEditedBooking}
                className="bg-white border border-[#E6E9F2] rounded-2xl p-5 w-full max-w-lg space-y-3 text-xs shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-slate-900">
                    Edit Booking ({editingBooking.booking_code})
                  </span>
                  <button type="button" onClick={() => setEditingBooking(null)}>
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <select
                    value={editingBooking.service_type}
                    onChange={(e) => setEditingBooking({ ...editingBooking, service_type: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB]"
                  >
                    <option value="bike_ride">Bike Ride</option>
                    <option value="parcel">Parcel Delivery</option>
                    <option value="errand">Bazaar Errand</option>
                  </select>
                  <input
                    type="number"
                    required
                    min="10"
                    placeholder="Final Fare (Rs.)"
                    value={editingBooking.final_fare}
                    onChange={(e) => setEditingBooking({ ...editingBooking, final_fare: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB] mono-num font-bold"
                  />
                  <select
                    value={editingBooking.pickup_zone}
                    onChange={(e) => setEditingBooking({ ...editingBooking, pickup_zone: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB]"
                  >
                    {bootstrap.zones.map((z) => (
                      <option key={z.id} value={z.name}>{z.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    value={editingBooking.pickup_address}
                    onChange={(e) => setEditingBooking({ ...editingBooking, pickup_address: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB]"
                  />
                  <select
                    value={editingBooking.drop_zone}
                    onChange={(e) => setEditingBooking({ ...editingBooking, drop_zone: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB]"
                  >
                    {bootstrap.zones.map((z) => (
                      <option key={z.id} value={z.name}>{z.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    value={editingBooking.drop_address}
                    onChange={(e) => setEditingBooking({ ...editingBooking, drop_address: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB]"
                  />
                  <select
                    value={editingBooking.payment_method}
                    onChange={(e) => setEditingBooking({ ...editingBooking, payment_method: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB]"
                  >
                    <option value="cash">Cash</option>
                    <option value="easypaisa">EasyPaisa</option>
                    <option value="jazzcash">JazzCash</option>
                  </select>
                  <select
                    value={editingBooking.payment_collector}
                    onChange={(e) => setEditingBooking({ ...editingBooking, payment_collector: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB]"
                  >
                    <option value="rider">Collected by Rider</option>
                    <option value="admin">Collected by Admin</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Notes"
                  value={editingBooking.customer_notes || ''}
                  onChange={(e) => setEditingBooking({ ...editingBooking, customer_notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB]"
                />
                <div className="flex gap-2 pt-1">
                  <button type="submit" className="flex-1 py-2.5 rounded-xl bg-[#00A651] text-white font-bold">
                    Save Booking Changes
                  </button>
                  <button type="button" onClick={() => setEditingBooking(null)} className="px-4 py-2.5 rounded-xl border">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 1. OVERVIEW */}
          {subpage === 'overview' && overview && (
            <div className="space-y-5">
              {overview.over_limit_riders.length > 0 && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-rose-800 font-bold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>
                      {overview.over_limit_riders.length} rider(s) exceeded unpaid commission limit!
                    </span>
                  </div>
                  <button
                    onClick={() => setSubpage('settlements')}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold"
                  >
                    Settle Dues Now →
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <StatCard
                  label="Today's Gross Fare"
                  value={`Rs. ${kpis.today_gross_fare}`}
                  subtext={`${kpis.today_completed_rides} completed of ${kpis.today_total_rides} today`}
                />
                <StatCard
                  label="Today's Owner Profit"
                  value={`Rs. ${kpis.today_admin_profit}`}
                  subtext={`All-time Net Profit: Rs. ${kpis.all_time_net_profit}`}
                  accent="green"
                />
                <StatCard
                  label="Pending Rider Dues"
                  value={`Rs. ${kpis.receivable_from_riders}`}
                  subtext={`Payable to riders: Rs. ${kpis.payable_to_riders}`}
                  accent="amber"
                />
                <StatCard
                  label="Online Captains"
                  value={`${kpis.online_riders_count} / ${kpis.total_riders_count}`}
                  subtext={`${kpis.pending_dispatch_count} rides waiting rider`}
                  accent="magenta"
                />
              </div>

              <div className="bg-white border border-[#E6E9F2] rounded-2xl overflow-hidden text-xs">
                <div className="p-4 border-b border-[#E6E9F2] flex items-center justify-between">
                  <span className="font-extrabold text-sm text-slate-900">Recent Rides &amp; Commission Split</span>
                  <button onClick={() => setSubpage('dispatch')} className="font-bold text-[#00A651] underline">
                    View Full Dispatch Queue →
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#F4F6FB] text-slate-500 border-b border-[#E6E9F2]">
                      <tr>
                        <th className="p-3.5">Code</th>
                        <th className="p-3.5">Route</th>
                        <th className="p-3.5">Captain</th>
                        <th className="p-3.5">Fare</th>
                        <th className="p-3.5">Owner Share</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEF1F7]">
                      {overview.recent_bookings.map((b) => (
                        <tr key={b.id}>
                          <td className="p-3.5 mono-num font-bold">{b.booking_code}</td>
                          <td className="p-3.5">
                            <div className="font-semibold text-slate-900">{b.pickup_zone} → {b.drop_zone}</div>
                            <div className="text-[11px] text-slate-500">{b.customer?.full_name} ({b.customer?.phone})</div>
                          </td>
                          <td className="p-3.5">
                            {b.rider ? (
                              <span className="font-semibold">{b.rider.full_name} ({b.rider.bike_plate})</span>
                            ) : (
                              <select
                                defaultValue=""
                                onChange={(e) => handleAssignRider(b.id, e.target.value)}
                                className="px-2 py-1 rounded-lg border border-[#E6E9F2] bg-[#F4F6FB] font-semibold"
                              >
                                <option value="">Assign Captain...</option>
                                {verifiedRiders.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.full_name} ({r.bike_plate})
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="p-3.5 mono-num font-bold">Rs. {b.final_fare}</td>
                          <td className="p-3.5 mono-num font-extrabold text-[#00A651]">Rs. {b.commission_amount}</td>
                          <td className="p-3.5"><StatusBadge value={b.status} /></td>
                          <td className="p-3.5 whitespace-nowrap space-x-1.5">
                            {b.rider_id && ['assigned', 'arrived', 'in_progress'].includes(b.status) && (
                              <button
                                onClick={() => handleAdminStatus(b.id, 'completed')}
                                className="px-2.5 py-1 rounded-lg bg-[#00A651] text-white font-bold"
                              >
                                Complete
                              </button>
                            )}
                            <button
                              onClick={() => setEditingBooking(b)}
                              className="p-1.5 rounded-lg bg-[#F4F6FB] text-slate-700"
                              title="Edit Booking"
                            >
                              <Pencil className="w-3.5 h-3.5 inline" />
                            </button>
                            <button
                              onClick={() => handleDeleteBooking(b)}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600"
                              title="Delete Booking"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2. DISPATCH QUEUE */}
          {subpage === 'dispatch' && (
            <div className="space-y-4">
              <div className="bg-white border border-[#E6E9F2] rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between text-xs">
                <div className="flex flex-wrap gap-1.5">
                  {['', 'pending', 'assigned', 'in_progress', 'completed', 'cancelled'].map((st) => (
                    <button
                      key={st || 'all'}
                      onClick={() => setBookingStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-xl font-bold capitalize ${
                        bookingStatusFilter === st
                          ? 'bg-slate-900 text-white'
                          : 'bg-[#F4F6FB] text-slate-600'
                      }`}
                    >
                      {st ? st.replace('_', ' ') : 'All Rides'}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search code or address..."
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB]"
                  />
                  <button onClick={loadBookings} className="px-3 py-1.5 rounded-xl bg-[#00A651] text-white font-bold">
                    Search
                  </button>
                </div>
              </div>

              <div className="bg-white border border-[#E6E9F2] rounded-2xl overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-[#F4F6FB] text-slate-500 border-b border-[#E6E9F2]">
                    <tr>
                      <th className="p-3.5">Code / Service</th>
                      <th className="p-3.5">Customer</th>
                      <th className="p-3.5">Pickup → Drop</th>
                      <th className="p-3.5">Captain</th>
                      <th className="p-3.5">Fare / Comm</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF1F7]">
                    {bookings.map((b) => (
                      <tr key={b.id}>
                        <td className="p-3.5">
                          <div className="mono-num font-bold">{b.booking_code}</div>
                          <StatusBadge value={b.service_type} />
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold">{b.customer?.full_name}</div>
                          <div className="mono-num text-slate-500">{b.customer?.phone}</div>
                        </td>
                        <td className="p-3.5">
                          <div><strong>{b.pickup_zone}</strong> ({b.pickup_address})</div>
                          <div>→ <strong>{b.drop_zone}</strong> ({b.drop_address})</div>
                        </td>
                        <td className="p-3.5">
                          {b.status !== 'completed' && b.status !== 'cancelled' ? (
                            <select
                              value={b.rider_id || ''}
                              onChange={(e) => handleAssignRider(b.id, e.target.value)}
                              className="px-2 py-1.5 rounded-lg border border-[#E6E9F2] bg-[#F4F6FB] font-semibold"
                            >
                              <option value="">Select Rider...</option>
                              {verifiedRiders.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.full_name} ({r.bike_plate})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span>{b.rider?.full_name || '—'}</span>
                          )}
                        </td>
                        <td className="p-3.5 mono-num">
                          <div className="font-bold">Rs. {b.final_fare}</div>
                          <div className="text-[#00A651] font-bold">Comm: Rs. {b.commission_amount}</div>
                        </td>
                        <td className="p-3.5"><StatusBadge value={b.status} /></td>
                        <td className="p-3.5 space-x-1.5 whitespace-nowrap">
                          {b.rider_id && !['completed', 'cancelled'].includes(b.status) && (
                            <button
                              onClick={() => handleAdminStatus(b.id, 'completed')}
                              className="px-2.5 py-1 rounded-lg bg-[#00A651] text-white font-bold"
                            >
                              Complete
                            </button>
                          )}
                          {!['completed', 'cancelled'].includes(b.status) && (
                            <button
                              onClick={() => handleAdminStatus(b.id, 'cancelled')}
                              className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 font-bold"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            onClick={() => setEditingBooking(b)}
                            className="p-1.5 rounded-lg bg-[#F4F6FB] text-slate-700"
                            title="Edit Booking"
                          >
                            <Pencil className="w-3.5 h-3.5 inline" />
                          </button>
                          <button
                            onClick={() => handleDeleteBooking(b)}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600"
                            title="Delete Booking"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. MANUAL PHONE BOOKING */}
          {subpage === 'manual_booking' && (
            <form onSubmit={handleCreateManualBooking} className="bg-white border border-[#E6E9F2] rounded-2xl p-6 space-y-4 text-xs max-w-3xl">
              <div className="font-extrabold text-base text-slate-900">
                Create Phone / WhatsApp Dispatch Booking
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Customer Mobile (03...)"
                  value={manualForm.customer_phone}
                  onChange={(e) => setManualForm({ ...manualForm, customer_phone: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB]"
                />
                <input
                  type="text"
                  placeholder="Customer Name"
                  value={manualForm.customer_name}
                  onChange={(e) => setManualForm({ ...manualForm, customer_name: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB]"
                />
                <select
                  value={manualForm.service_type}
                  onChange={(e) => setManualForm({ ...manualForm, service_type: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB] font-bold"
                >
                  <option value="bike_ride">Bike Ride</option>
                  <option value="parcel">Parcel Delivery</option>
                  <option value="errand">Bazaar Errand</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={manualForm.pickup_zone}
                  onChange={(e) => setManualForm({ ...manualForm, pickup_zone: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB] font-semibold"
                >
                  {bootstrap.zones.map((z) => (
                    <option key={z.id} value={z.name}>Pickup: {z.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  placeholder="Pickup exact landmark"
                  value={manualForm.pickup_address}
                  onChange={(e) => setManualForm({ ...manualForm, pickup_address: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB]"
                />
                <select
                  value={manualForm.drop_zone}
                  onChange={(e) => setManualForm({ ...manualForm, drop_zone: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB] font-semibold"
                >
                  {bootstrap.zones.map((z) => (
                    <option key={z.id} value={z.name}>Drop: {z.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  placeholder="Drop exact landmark"
                  value={manualForm.drop_address}
                  onChange={(e) => setManualForm({ ...manualForm, drop_address: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  placeholder="Distance (km)"
                  value={manualForm.distance_km}
                  onChange={(e) => setManualForm({ ...manualForm, distance_km: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB] mono-num"
                />
                <input
                  type="number"
                  placeholder="Override Fare Rs. (optional)"
                  value={manualForm.custom_fare}
                  onChange={(e) => setManualForm({ ...manualForm, custom_fare: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB] mono-num"
                />
                <select
                  value={manualForm.rider_id}
                  onChange={(e) => setManualForm({ ...manualForm, rider_id: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB] font-semibold"
                >
                  <option value="">Leave Open in Queue</option>
                  {verifiedRiders.map((r) => (
                    <option key={r.id} value={r.id}>Assign: {r.full_name} ({r.bike_plate})</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="px-6 py-3 rounded-xl bg-[#00A651] text-white font-extrabold">
                Create &amp; Dispatch Ride
              </button>
            </form>
          )}

          {/* 4 & 5. RIDERS & CUSTOMERS CRUD + PASSWORDS */}
          {(subpage === 'riders' || subpage === 'customers') && (
            <AdminPeoplePanel
              mode={subpage}
              riders={riders}
              customers={customers}
              zones={bootstrap.zones || []}
              onReloadRiders={loadOverviewAndRiders}
              onReloadCustomers={loadCustomers}
              onNotify={notify}
            />
          )}

          {/* 6. FINANCE SUBPAGES */}
          {(subpage === 'settlements' || subpage === 'pricing' || subpage === 'expenses') && (
            <AdminFinancePanel
              subpage={subpage}
              onNotify={notify}
              onRefreshBootstrap={refreshBootstrap}
            />
          )}

          {/* 7. REPORTS */}
          {subpage === 'reports' && <AdminReportsPanel onNotify={notify} />}

          {/* 8, 9, 10. RELEASES, TICKETS, ZONES/PROMOS, PASSWORDS & SETTINGS */}
          {(subpage === 'releases' || subpage === 'tickets' || subpage === 'zones' || subpage === 'settings') && (
            <AdminOperationsPanel
              subpage={subpage}
              onNotify={notify}
              onRefreshBootstrap={refreshBootstrap}
            />
          )}
        </main>
      </div>
    </div>
  );
}
