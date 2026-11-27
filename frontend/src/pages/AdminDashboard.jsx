import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bike,
  ChevronRight,
  ClipboardList,
  Coins,
  Download,
  HelpCircle,
  HardDrive,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  PackagePlus,
  Pencil,
  Phone,
  PhoneCall,
  Settings,
  ShieldCheck,
  Siren,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../components/BrandLogo';
import { EmergencySosModal } from '../components/EmergencySosModal';
import { InteractiveRoutePicker } from '../components/InteractiveRoutePicker';
import { SafarGoMap } from '../components/SafarGoMap';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { AdminFinancePanel } from '../components/admin/AdminFinancePanel';
import { AdminOperationsPanel } from '../components/admin/AdminOperationsPanel';
import { AdminPeoplePanel } from '../components/admin/AdminPeoplePanel';
import { AdminReportsPanel } from '../components/admin/AdminReportsPanel';
import { formatPaymentMethodLabel, getRidePaymentBadgeState } from '../utils/paymentAccounts';
import {
  playRideAlertChime,
  requestRideNotificationsPermission,
  showBrowserRideNotification,
  unlockRideAlertAudio,
} from '../utils/rideAlerts';

const NAV_GROUPS = [
  {
    group: 'Overview',
    items: [
      { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard, badgeCls: 'bg-emerald-500/15 text-emerald-400' },
      { id: 'livemap', label: 'Live Fleet & Customer Map', icon: MapPin, badgeCls: 'bg-teal-500/15 text-teal-400' },
    ],
  },
  {
    group: 'Dispatch & Rides',
    items: [
      { id: 'dispatch', label: 'Live Rides Queue', icon: ClipboardList, badgeCls: 'bg-sky-500/15 text-sky-400' },
      { id: 'manual_booking', label: 'Phone / Manual Booking', icon: PhoneCall, badgeCls: 'bg-teal-500/15 text-teal-400' },
    ],
  },
  {
    group: 'Fleet & Users',
    items: [
      { id: 'riders', label: 'Fleet Captains', icon: Bike, badgeCls: 'bg-emerald-500/15 text-emerald-300' },
      { id: 'customers', label: 'Customers Directory', icon: Users, badgeCls: 'bg-indigo-500/15 text-indigo-400' },
    ],
  },
  {
    group: 'Finance & Lain-Dain',
    items: [
      { id: 'settlements', label: 'Rider Dues & Settlements', icon: Wallet, badgeCls: 'bg-amber-500/15 text-amber-400' },
      { id: 'pricing', label: 'Fare & Commission %', icon: Coins, badgeCls: 'bg-cyan-500/15 text-cyan-400' },
      { id: 'expenses', label: 'Owner Expenses', icon: Settings, badgeCls: 'bg-rose-500/15 text-rose-400' },
    ],
  },
  {
    group: 'Analytics & Releases',
    items: [
      { id: 'reports', label: 'Profit & Loss (P&L)', icon: BarChart3, badgeCls: 'bg-violet-500/15 text-violet-400' },
      { id: 'releases', label: 'APK / EXE Releases', icon: PackagePlus, badgeCls: 'bg-teal-500/15 text-teal-300' },
    ],
  },
  {
    group: 'Operations & Security',
    items: [
      { id: 'sos', label: 'Emergency SOS (15 / 1122)', icon: Siren, badgeCls: 'bg-rose-500/20 text-rose-400' },
      { id: 'tickets', label: 'Complaints & Support', icon: HelpCircle, badgeCls: 'bg-orange-500/15 text-orange-400' },
      { id: 'zones', label: 'Cities, Zones & Promos', icon: MapPin, badgeCls: 'bg-sky-500/15 text-sky-300' },
      { id: 'backups', label: 'Backup & Restore (4 AM)', icon: HardDrive, badgeCls: 'bg-cyan-500/15 text-cyan-300' },
      { id: 'settings', label: 'Passwords & Settings', icon: ShieldCheck, badgeCls: 'bg-emerald-500/15 text-emerald-400' },
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
  const [liveMap, setLiveMap] = useState({ captains: [], active_bookings: [] });
  const [editingBooking, setEditingBooking] = useState(null);
  const [toast, setToast] = useState(null);
  const [liveBookingAlert, setLiveBookingAlert] = useState(null);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );
  const seenPendingIdsRef = useRef(null);
  const seenSosIdsRef = useRef(null);

  const policeNumber = bootstrap?.settings?.emergency_police_number || '15';
  const rescueNumber = bootstrap?.settings?.emergency_rescue_number || '1122';

  const [manualForm, setManualForm] = useState({
    customer_phone: '',
    customer_name: '',
    service_type: 'bike_ride',
    pickup_zone: bootstrap.zones?.[0]?.name || 'Main Bazar / Lari Adda',
    pickup_address: '',
    pickup_lat: 34.3335,
    pickup_lng: 73.1995,
    drop_zone: bootstrap.zones?.[2]?.name || 'Ghazikot Township',
    drop_address: '',
    drop_lat: 34.3168,
    drop_lng: 73.1920,
    distance_km: 3,
    payment_method: 'cash',
    rider_id: '',
    custom_fare: '',
    discount_amount: '',
    customer_notes: '',
  });

  const notify = (text, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 4500);
  };

  const handleOverviewPayload = (ov) => {
    setOverview(ov);
    const pendingList = (ov?.recent_bookings || []).filter((b) => b.status === 'pending');
    if (seenPendingIdsRef.current === null) {
      seenPendingIdsRef.current = new Set(pendingList.map((b) => b.id));
    } else {
      const freshPending = pendingList.filter((b) => !seenPendingIdsRef.current.has(b.id));
      if (freshPending.length > 0) {
        freshPending.forEach((b) => seenPendingIdsRef.current.add(b.id));
        const top = freshPending[0];
        setLiveBookingAlert(top);
        playRideAlertChime('admin');
        const closest = top.nearest_captains?.[0];
        const capHint = closest
          ? `Nearest Captain: ${closest.full_name} (${closest.distance_km} km · ${closest.zone_name})`
          : 'No verified online captain nearby';
        showBrowserRideNotification(
          `New SafarGo Booking ${top.booking_code}`,
          `${top.customer?.full_name || 'Customer'}: ${top.pickup_zone} → ${top.drop_zone} · Rs. ${top.final_fare} · ${capHint}`,
          `admin-booking-${top.id}`
        );
      }
    }

    const activeSos = (ov?.active_sos_alerts || []).filter((s) => s.status === 'active');
    if (seenSosIdsRef.current === null) {
      seenSosIdsRef.current = new Set(activeSos.map((s) => s.id));
    } else {
      const freshSos = activeSos.filter((s) => !seenSosIdsRef.current.has(s.id));
      if (freshSos.length > 0) {
        freshSos.forEach((s) => seenSosIdsRef.current.add(s.id));
        const topSos = freshSos[0];
        playRideAlertChime('sos');
        showBrowserRideNotification(
          `EMERGENCY SOS: ${topSos.user_name}`,
          `${topSos.user_phone} · ${topSos.zone_name} · Police ${policeNumber} / Rescue ${rescueNumber}`,
          `admin-sos-${topSos.id}`
        );
      }
    }
  };

  const loadOverviewAndRiders = async () => {
    try {
      const [ov, rd] = await Promise.all([
        apiRequest('/api/admin/overview'),
        apiRequest('/api/admin/riders'),
      ]);
      handleOverviewPayload(ov);
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

  const loadLiveMap = async () => {
    try {
      setLiveMap(await apiRequest('/api/admin/live-map'));
    } catch {
      // ignore transient poll errors
    }
  };

  const loadSosAlerts = async () => {
    try {
      setSosAlerts(await apiRequest('/api/admin/sos'));
    } catch {
      // ignore transient poll errors
    }
  };

  const handleSosStatus = async (sosId, nextStatus, resolutionNote = '') => {
    try {
      await apiRequest(`/api/admin/sos/${sosId}/status`, {
        method: 'POST',
        body: { status: nextStatus, resolution_note: resolutionNote || null },
      });
      notify(`SOS alert marked ${nextStatus}.`);
      await Promise.all([loadOverviewAndRiders(), loadSosAlerts()]);
    } catch (e) {
      notify(e.message, true);
    }
  };

  useEffect(() => {
    loadOverviewAndRiders();
    if (subpage === 'dispatch') loadBookings();
    if (subpage === 'customers') loadCustomers();
    if (subpage === 'sos') loadSosAlerts();
    if (subpage === 'livemap' || subpage === 'overview' || subpage === 'sos') {
      loadLiveMap();
    }
  }, [subpage, bookingStatusFilter]);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const ov = await apiRequest('/api/admin/overview');
        handleOverviewPayload(ov);
      } catch {
        // ignore transient poll errors
      }
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (subpage !== 'livemap' && subpage !== 'overview') return;
    const timer = setInterval(loadLiveMap, 4500);
    return () => clearInterval(timer);
  }, [subpage]);

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

  const handleMarkBookingPaid = async (b) => {
    try {
      await apiRequest(`/api/admin/bookings/${b.id}/mark-paid`, { method: 'POST', body: {} });
      notify(`Payment marked PAID for ${b.booking_code}!`);
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
          discount_amount: Number(editingBooking.discount_amount || 0),
          final_fare: Number(editingBooking.final_fare),
          payment_method: editingBooking.payment_method,
          payment_collector: editingBooking.payment_collector,
          payment_status: editingBooking.payment_status,
          payment_reference: editingBooking.payment_reference || null,
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
          discount_amount: Number(manualForm.discount_amount || 0),
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
        discount_amount: '',
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
    <div className="min-h-screen flex">
      {/* Sidebar Desktop + Mobile Drawer */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-72 bg-gradient-to-b from-slate-950 via-[#0D1526] to-slate-950 border-r border-slate-800/80 text-slate-100 flex flex-col justify-between p-3.5 transition-transform duration-200 no-print shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="space-y-3.5 overflow-y-auto no-scrollbar">
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
            <BrandLogo dark size="sm" subtitle="Admin Command" />
            <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-3">
            {NAV_GROUPS.map((grp) => (
              <div key={grp.group} className="rounded-2xl bg-slate-900/45 border border-slate-800/60 p-2 space-y-1.5">
                <div className="px-2 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
                      className={`group w-full flex items-center justify-between px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all duration-200 ${
                        active
                          ? 'bg-gradient-to-r from-[#009E4D] to-[#007D3D] border-emerald-400/50 text-white shadow-md shadow-emerald-950/50'
                          : 'bg-slate-900/75 border-slate-800/80 text-slate-300 hover:bg-slate-800/95 hover:border-emerald-500/40 hover:text-white hover:translate-x-1 hover:shadow-md hover:shadow-black/30'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                            active ? 'bg-white/20 text-white' : item.badgeCls
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        {item.id === 'dispatch' && kpis.pending_dispatch_count > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px] mono-num">
                            {kpis.pending_dispatch_count}
                          </span>
                        )}
                        {item.id === 'settlements' &&
                          (kpis.pending_topup_count || 0) + (kpis.pending_settlement_count || 0) > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-extrabold text-[10px] mono-num">
                              {(kpis.pending_topup_count || 0) + (kpis.pending_settlement_count || 0)}
                            </span>
                          )}
                        {item.id === 'sos' && (overview?.active_sos_alerts?.length || 0) > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white font-extrabold text-[10px] mono-num animate-pulse">
                            {overview.active_sos_alerts.length}
                          </span>
                        )}
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-all duration-200 ${
                            active
                              ? 'opacity-90 translate-x-0 text-white'
                              : 'opacity-0 -translate-x-1 group-hover:opacity-80 group-hover:translate-x-0 text-emerald-400'
                          }`}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="pt-3 mt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
          <button
            onClick={onOpenDownloads}
            className="py-2.5 px-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-800 text-slate-200 font-bold flex items-center justify-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            APK / EXE
          </button>
          <button
            onClick={logout}
            className="py-2.5 px-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/40 text-rose-300 font-bold flex items-center justify-center gap-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 h-16 flex items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200/80 text-slate-700"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Fleet Operations
              </div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 capitalize">
                {subpage.replace(/_/g, ' ')}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                unlockRideAlertAudio();
                setSosModalOpen(true);
              }}
              className="px-3 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white inline-flex items-center gap-1.5 shadow-sm"
              title={`Emergency SOS · Police ${policeNumber} · Rescue ${rescueNumber}`}
            >
              <Siren className="w-3.5 h-3.5" />
              <span>SOS · {policeNumber}/{rescueNumber}</span>
              {(overview?.active_sos_alerts?.length || 0) > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-white text-rose-700 text-[10px] font-extrabold mono-num">
                  {overview.active_sos_alerts.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={async () => {
                const perm = await requestRideNotificationsPermission();
                setAlertsEnabled(perm === 'granted');
                playRideAlertChime('admin');
                notify('Admin booking alert sound & notifications active!');
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 ${
                alertsEnabled
                  ? 'bg-emerald-50 border-emerald-200 text-[#008741]'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
              title="Enable New Booking Sound & Alerts"
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{alertsEnabled ? 'Alerts On' : 'Enable Alerts'}</span>
            </button>
            <button
              onClick={() => {
                unlockRideAlertAudio();
                setSubpage('manual_booking');
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#009E4D] hover:bg-[#008741]"
            >
              + Manual Booking
            </button>
            <button
              onClick={() => setSubpage('settlements')}
              className="hidden sm:inline-flex px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200/80 bg-slate-50/80 hover:bg-slate-200"
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
          {(overview?.active_sos_alerts || []).length > 0 && (
            <div className="rounded-2xl bg-gradient-to-r from-rose-700 via-red-700 to-rose-900 text-white p-4 shadow-lg border-2 border-rose-300 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-extrabold text-sm">
                  <Siren className="w-5 h-5 text-amber-300 animate-bounce" />
                  <span>
                    LIVE EMERGENCY SOS ALERTS ({overview.active_sos_alerts.length}) — Police {policeNumber} · Rescue {rescueNumber}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <a
                    href={`tel:${policeNumber}`}
                    className="px-3 py-1.5 rounded-xl bg-white text-rose-700 font-extrabold inline-flex items-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Police {policeNumber}
                  </a>
                  <a
                    href={`tel:${rescueNumber}`}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-extrabold inline-flex items-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Rescue {rescueNumber}
                  </a>
                  <button
                    type="button"
                    onClick={() => setSubpage('sos')}
                    className="px-3 py-1.5 rounded-xl bg-slate-950/60 border border-white/30 text-white font-bold"
                  >
                    Open SOS Center
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {overview.active_sos_alerts.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl bg-slate-950/45 border border-rose-300/40 p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-extrabold">
                        [{s.status.toUpperCase()}] {s.user_name} ({s.user_phone}){' '}
                        {s.bike_plate ? `· ${s.bike_model || ''} (${s.bike_plate})` : ''}
                      </div>
                      <div className="text-rose-100">
                        Type: <strong>{s.emergency_type.replace(/_/g, ' ')}</strong> · Location: <strong>{s.zone_name}</strong>
                        {s.booking_code
                          ? ` · ${(s.service_type || 'ride').replace(/_/g, ' ').toUpperCase()} ${s.booking_code}${
                              s.customer_phone ? ` (Cust: ${s.customer_name || ''} ${s.customer_phone})` : ''
                            }${s.assigned_rider_phone ? ` (Capt: ${s.assigned_rider_name || ''} ${s.assigned_rider_phone})` : ''}`
                          : ''}
                      </div>
                      {s.note && <div className="text-amber-200 font-semibold">Note: {s.note}</div>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <a
                        href={`tel:${s.user_phone}`}
                        className="px-2.5 py-1.5 rounded-lg bg-white text-slate-950 font-extrabold inline-flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" />
                        Call
                      </a>
                      {s.google_maps_url && (
                        <a
                          href={s.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-extrabold"
                        >
                          GPS Map ↗
                        </a>
                      )}
                      {s.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => handleSosStatus(s.id, 'acknowledged', 'Admin dispatch responding')}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-extrabold"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSosStatus(s.id, 'resolved', 'Situation resolved by Admin')}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-400 text-slate-950 font-extrabold"
                      >
                        Mark Resolved
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {liveBookingAlert && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-950 text-white shadow-lg border border-emerald-400/40 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1 text-xs">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-300 text-slate-950 text-[10px] font-extrabold">
                  <Bell className="w-3 h-3" />
                  LIVE NEW CUSTOMER BOOKING · {liveBookingAlert.booking_code}
                </div>
                <div className="text-sm font-extrabold">
                  {liveBookingAlert.customer?.full_name || 'Customer'} ({liveBookingAlert.customer?.phone || ''}) — {liveBookingAlert.pickup_zone} → {liveBookingAlert.drop_zone}
                </div>
                <div className="text-emerald-200">
                  Offer: <strong>Rs. {liveBookingAlert.final_fare}</strong> ({liveBookingAlert.distance_km} km) ·{' '}
                  {liveBookingAlert.nearest_captains?.[0] ? (
                    <span>
                      Closest Online Captain:{' '}
                      <strong className="text-amber-300">
                        {liveBookingAlert.nearest_captains[0].full_name} ({liveBookingAlert.nearest_captains[0].distance_km} km · {liveBookingAlert.nearest_captains[0].zone_name})
                      </strong>
                    </span>
                  ) : (
                    <span className="text-amber-300 font-bold">No online verified captain near pickup</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    unlockRideAlertAudio();
                    setSubpage('livemap');
                    loadLiveMap();
                  }}
                  className="px-3 py-2 rounded-xl bg-[#009E4D] hover:bg-[#008741] text-white font-extrabold text-xs"
                >
                  Open Live Map
                </button>
                <button
                  type="button"
                  onClick={() => {
                    unlockRideAlertAudio();
                    setSubpage('dispatch');
                    loadBookings();
                  }}
                  className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs"
                >
                  Open Queue
                </button>
                <button
                  type="button"
                  onClick={() => setLiveBookingAlert(null)}
                  className="px-2.5 py-2 rounded-xl bg-white/10 text-slate-300 text-xs font-bold"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {toast && (
            <div
              className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                toast.isError
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-emerald-50 border-emerald-200 text-[#008741]'
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
                className="bg-white border border-slate-200/80 rounded-2xl p-5 w-full max-w-lg space-y-3 text-xs shadow-xl"
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
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-0.5">Service</label>
                    <select
                      value={editingBooking.service_type}
                      onChange={(e) => setEditingBooking({ ...editingBooking, service_type: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80"
                    >
                      <option value="bike_ride">Bike Ride</option>
                      <option value="car_ride">Car Ride (Intercity)</option>
                      <option value="parcel">Parcel Delivery</option>
                      <option value="errand">Bazaar Errand</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-0.5">
                      Customer Discount (Rs.) — Less from Total
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Discount (Rs.)"
                      value={editingBooking.discount_amount ?? 0}
                      onChange={(e) => {
                        const newDisc = Math.max(0, Number(e.target.value || 0));
                        const oldDisc = Number(editingBooking.discount_amount || 0);
                        const gross = Number(editingBooking.final_fare || 0) + oldDisc;
                        const netFare = Math.max(10, Math.round(gross - newDisc));
                        setEditingBooking({
                          ...editingBooking,
                          discount_amount: e.target.value,
                          final_fare: netFare,
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50/60 mono-num font-bold text-[#008741]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-0.5">
                      Total Payable Fare (After Discount Rs.)
                    </label>
                    <input
                      type="number"
                      required
                      min="10"
                      placeholder="Final Fare (Rs.)"
                      value={editingBooking.final_fare}
                      onChange={(e) => setEditingBooking({ ...editingBooking, final_fare: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-0.5">Payment Status</label>
                    <select
                      value={editingBooking.payment_status || 'pending'}
                      onChange={(e) => setEditingBooking({ ...editingBooking, payment_status: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 font-bold"
                    >
                      <option value="pending">Payment Pending</option>
                      <option value="submitted">Payment Sent (Verifying)</option>
                      <option value="paid">Paid ✓</option>
                    </select>
                  </div>
                  <select
                    value={editingBooking.pickup_zone}
                    onChange={(e) => setEditingBooking({ ...editingBooking, pickup_zone: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80"
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
                    className="px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80"
                  />
                  <select
                    value={editingBooking.drop_zone}
                    onChange={(e) => setEditingBooking({ ...editingBooking, drop_zone: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80"
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
                    className="px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80"
                  />
                  <select
                    value={editingBooking.payment_method}
                    onChange={(e) => setEditingBooking({ ...editingBooking, payment_method: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80"
                  >
                    <option value="cash">Cash</option>
                    <option value="easypaisa">EasyPaisa (SafarGo)</option>
                    <option value="upaisa">UPaisa (SafarGo)</option>
                    <option value="jazzcash">JazzCash (SafarGo)</option>
                    <option value="bank">Bank Transfer (SafarGo)</option>
                  </select>
                  <select
                    value={editingBooking.payment_collector}
                    onChange={(e) => setEditingBooking({ ...editingBooking, payment_collector: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80"
                  >
                    <option value="rider">Collected by Captain (Cash)</option>
                    <option value="admin">Collected by SafarGo (Digital)</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="TID / Payment Reference #"
                  value={editingBooking.payment_reference || ''}
                  onChange={(e) => setEditingBooking({ ...editingBooking, payment_reference: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num"
                />
                <input
                  type="text"
                  placeholder="Notes"
                  value={editingBooking.customer_notes || ''}
                  onChange={(e) => setEditingBooking({ ...editingBooking, customer_notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80"
                />
                <div className="flex gap-2 pt-1">
                  <button type="submit" className="flex-1 py-2.5 rounded-xl bg-[#009E4D] text-white font-bold">
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
              {kpis.pending_topup_count > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-amber-900 font-bold">
                    <Bell className="w-4 h-4 text-amber-600" />
                    <span>
                      {kpis.pending_topup_count} Captain Top-Up approval request(s) waiting! Approve karein taake Bike/Car captains rides le sakein.
                    </span>
                  </div>
                  <button
                    onClick={() => setSubpage('settlements')}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
                  >
                    Approve Top-Ups Now →
                  </button>
                </div>
              )}

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
                  subtext={`${kpis.pending_dispatch_count} rides in open market`}
                  accent="magenta"
                />
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-extrabold text-sm text-slate-900">
                      Live GPS Operations Map (Customers + Bike &amp; Car Captains)
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      Tracking <strong>{liveMap.captains.filter((c) => c.is_online).length}</strong> online captains &amp;{' '}
                      <strong>{liveMap.active_bookings.length}</strong> active customer rides live.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={loadLiveMap}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold"
                    >
                      Refresh GPS
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubpage('livemap')}
                      className="px-4 py-2 rounded-xl bg-[#009E4D] hover:bg-[#008741] text-white font-bold inline-flex items-center gap-1.5"
                    >
                      <MapPin className="w-4 h-4" />
                      Full Live Map →
                    </button>
                  </div>
                </div>
                <SafarGoMap
                  captains={liveMap.captains}
                  activeBookings={liveMap.active_bookings}
                  sosAlerts={overview?.active_sos_alerts || []}
                  heightClass="h-64 sm:h-72"
                  fitSignature={`overview-${liveMap.captains.length}-${liveMap.active_bookings.length}-${overview?.active_sos_alerts?.length || 0}`}
                />
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden text-xs">
                <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
                  <span className="font-extrabold text-sm text-slate-900">Recent Rides &amp; Commission Split</span>
                  <button onClick={() => setSubpage('dispatch')} className="font-bold text-[#009E4D] underline">
                    View Full Dispatch Queue →
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80">
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
                    <tbody className="divide-y divide-slate-100">
                      {overview.recent_bookings.map((b) => (
                        <tr key={b.id}>
                          <td className="p-3.5 mono-num font-bold">
                            <div>{b.booking_code}</div>
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-[10px] font-extrabold">
                              {b.distance_km} km
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold text-slate-900">{b.pickup_zone} → {b.drop_zone}</div>
                            <div className="text-[11px] text-slate-500">{b.customer?.full_name} ({b.customer?.phone})</div>
                          </td>
                          <td className="p-3.5">
                            {b.rider ? (
                              <span className="font-semibold">{b.rider.full_name} ({b.rider.bike_plate})</span>
                            ) : (
                              <div className="space-y-1">
                                {(b.offers || []).filter((o) => o.status === 'pending').length > 0 && (
                                  <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-[#008741] text-[10px] font-extrabold">
                                    {(b.offers || []).filter((o) => o.status === 'pending').length} Captain Offer(s)
                                  </span>
                                )}
                                <select
                                  defaultValue=""
                                  onChange={(e) => handleAssignRider(b.id, e.target.value)}
                                  className="block px-2 py-1 rounded-lg border border-slate-200/80 bg-slate-50/80 font-semibold"
                                >
                                  <option value="">Optional Manual Assign...</option>
                                  {verifiedRiders.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.vehicle_type === 'car' ? 'Car' : 'Bike'}: {r.full_name} ({r.bike_plate})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 mono-num">
                            <div className="font-bold">Rs. {b.final_fare}</div>
                            {Number(b.discount_amount || 0) > 0 && (
                              <div className="text-[11px] text-[#008741] font-semibold">
                                Disc: -Rs. {b.discount_amount}
                              </div>
                            )}
                            <div className="text-[11px] text-slate-500">{formatPaymentMethodLabel(b.payment_method)}</div>
                          </td>
                          <td className="p-3.5 mono-num font-extrabold text-[#009E4D]">Rs. {b.commission_amount}</td>
                          <td className="p-3.5 space-y-1">
                            <div><StatusBadge value={b.status} /></div>
                            {b.status !== 'cancelled' && (
                              <div><StatusBadge value={getRidePaymentBadgeState(b)} /></div>
                            )}
                          </td>
                          <td className="p-3.5 whitespace-nowrap space-x-1.5">
                            {b.rider_id && ['assigned', 'arrived', 'in_progress'].includes(b.status) && (
                              <button
                                onClick={() => handleAdminStatus(b.id, 'completed')}
                                className="px-2.5 py-1 rounded-lg bg-[#009E4D] text-white font-bold"
                              >
                                Complete
                              </button>
                            )}
                            {b.status !== 'cancelled' && b.payment_status !== 'paid' && (
                              <button
                                onClick={() => handleMarkBookingPaid(b)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[#008741] font-bold hover:bg-emerald-100"
                              >
                                Mark Paid
                              </button>
                            )}
                            <button
                              onClick={() => setEditingBooking(b)}
                              className="p-1.5 rounded-lg bg-slate-50/80 text-slate-700"
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

          {/* 1B. ADMIN LIVE FLEET & CUSTOMER GPS MAP */}
          {subpage === 'livemap' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900">
                      Live GPS Radar — All Customers &amp; All Bike/Car Captains
                    </h2>
                    <p className="text-slate-500">
                      Pin <strong>C</strong> = Active Customer Pickup · Pin <strong>BIKE/CAR</strong> = Live Captain Location · Auto-refreshes every 6s
                    </p>
                  </div>
                  <button
                    onClick={loadLiveMap}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold"
                  >
                    Refresh GPS
                  </button>
                </div>

                <SafarGoMap
                  captains={liveMap.captains}
                  activeBookings={liveMap.active_bookings}
                  sosAlerts={overview?.active_sos_alerts || []}
                  heightClass="h-[440px]"
                  fitSignature={`admin-${liveMap.captains.length}-${liveMap.active_bookings.length}-${overview?.active_sos_alerts?.length || 0}`}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5">
                  <div className="font-extrabold text-sm text-slate-900">
                    Active Customer Pickups ({liveMap.active_bookings.length})
                  </div>
                  <div className="max-h-80 overflow-y-auto pr-1 space-y-2">
                  {liveMap.active_bookings.length === 0 ? (
                    <div className="text-slate-500 py-4 text-center">No active customer trips right now.</div>
                  ) : (
                    liveMap.active_bookings.map((b) => (
                      <div key={b.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900">
                            {b.booking_code} · {b.customer_name} ({b.customer_phone})
                          </div>
                          <div className="text-slate-600">
                            {b.pickup_zone} ({b.pickup_address}) → {b.drop_zone}
                          </div>
                          <div className="text-[11px] text-slate-500 mono-num">
                            {b.distance_km} km · Rs. {b.final_fare} · {b.rider_name ? `Capt: ${b.rider_name}` : 'Waiting Captain'}
                          </div>
                        </div>
                        <StatusBadge value={b.status} />
                      </div>
                    ))
                  )}
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5">
                  <div className="font-extrabold text-sm text-slate-900">
                    Captain Fleet Locations ({liveMap.captains.length})
                  </div>
                  <div className="max-h-80 overflow-y-auto pr-1 space-y-2">
                  {liveMap.captains.map((c) => (
                    <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {c.rider_photo ? (
                          <img
                            src={c.rider_photo}
                            alt={c.full_name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-[#009E4D] shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 font-extrabold flex items-center justify-center shrink-0">
                            {(c.full_name || 'C')[0]}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                            <span>{c.full_name}</span>
                            <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">{c.vehicle_type}</span>
                            {!c.is_verified && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-extrabold">
                                Docs Pending
                              </span>
                            )}
                          </div>
                          <div className="text-slate-600 mono-num truncate">
                            {c.bike_model} ({c.bike_plate}) · {c.zone_name}
                          </div>
                          <div className="text-[11px] text-slate-500 mono-num">
                            GPS: {Number(c.lat).toFixed(4)}, {Number(c.lng).toFixed(4)}
                            {c.active_booking_code ? ` · Trip: ${c.active_booking_code}` : ''}
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full font-bold shrink-0 ${c.is_online ? 'bg-emerald-100 text-[#008741]' : 'bg-slate-200 text-slate-600'}`}>
                        {c.is_online ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. DISPATCH QUEUE */}
          {subpage === 'dispatch' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between text-xs">
                <div className="flex flex-wrap gap-1.5">
                  {['', 'pending', 'assigned', 'in_progress', 'completed', 'cancelled'].map((st) => (
                    <button
                      key={st || 'all'}
                      onClick={() => setBookingStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-xl font-bold capitalize ${
                        bookingStatusFilter === st
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-50/80 text-slate-600'
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
                    className="px-3 py-1.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
                  />
                  <button onClick={loadBookings} className="px-3 py-1.5 rounded-xl bg-[#009E4D] text-white font-bold">
                    Search
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80">
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
                  <tbody className="divide-y divide-slate-100">
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
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-[10px] font-extrabold mono-num">
                              {b.distance_km} km
                            </span>
                            {Number(b.wait_minutes || 0) > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold mono-num">
                                Wait: {b.wait_minutes}m
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5">
                          {b.status !== 'completed' && b.status !== 'cancelled' ? (
                            <div className="space-y-1">
                              {!b.rider_id && (b.offers || []).filter((o) => o.status === 'pending').length > 0 && (
                                <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-[#008741] text-[10px] font-extrabold">
                                  {(b.offers || []).filter((o) => o.status === 'pending').length} Captain Offer(s)
                                </span>
                              )}
                              <select
                                value={b.rider_id || ''}
                                onChange={(e) => handleAssignRider(b.id, e.target.value)}
                                className="block px-2 py-1.5 rounded-lg border border-slate-200/80 bg-slate-50/80 font-semibold"
                              >
                                <option value="">Optional Assign...</option>
                                {verifiedRiders.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.vehicle_type === 'car' ? 'Car' : 'Bike'}: {r.full_name} ({r.bike_plate})
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <span>{b.rider?.full_name || '—'}</span>
                          )}
                        </td>
                        <td className="p-3.5 mono-num">
                          <div className="font-bold">Rs. {b.final_fare}</div>
                          {Number(b.discount_amount || 0) > 0 && (
                            <div className="text-[11px] text-[#008741] font-semibold">
                              Original Rs. {(Number(b.final_fare) + Number(b.discount_amount)).toFixed(0)} · Disc -Rs. {b.discount_amount}
                            </div>
                          )}
                          <div className="text-[#009E4D] font-bold">Comm: Rs. {b.commission_amount}</div>
                          <div className="text-[11px] text-slate-500">{formatPaymentMethodLabel(b.payment_method)}</div>
                        </td>
                        <td className="p-3.5 space-y-1">
                          <div><StatusBadge value={b.status} /></div>
                          {b.status !== 'cancelled' && (
                            <div><StatusBadge value={getRidePaymentBadgeState(b)} /></div>
                          )}
                        </td>
                        <td className="p-3.5 space-x-1.5 whitespace-nowrap">
                          {b.rider_id && !['completed', 'cancelled'].includes(b.status) && (
                            <button
                              onClick={() => handleAdminStatus(b.id, 'completed')}
                              className="px-2.5 py-1 rounded-lg bg-[#009E4D] text-white font-bold"
                            >
                              Complete
                            </button>
                          )}
                          {b.status !== 'cancelled' && b.payment_status !== 'paid' && (
                            <button
                              onClick={() => handleMarkBookingPaid(b)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[#008741] font-bold hover:bg-emerald-100"
                            >
                              Mark Paid
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
                            className="p-1.5 rounded-lg bg-slate-50/80 text-slate-700"
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
            <form onSubmit={handleCreateManualBooking} className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 text-xs max-w-3xl">
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
                  className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
                />
                <input
                  type="text"
                  placeholder="Customer Name"
                  value={manualForm.customer_name}
                  onChange={(e) => setManualForm({ ...manualForm, customer_name: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
                />
                <select
                  value={manualForm.service_type}
                  onChange={(e) => setManualForm({ ...manualForm, service_type: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 font-bold"
                >
                  <option value="bike_ride">Bike Ride</option>
                  <option value="car_ride">Car Ride (Intercity)</option>
                  <option value="parcel">Parcel Delivery</option>
                  <option value="errand">Bazaar Errand</option>
                </select>
              </div>
              <InteractiveRoutePicker
                zones={bootstrap.zones}
                pickupLat={manualForm.pickup_lat}
                pickupLng={manualForm.pickup_lng}
                pickupText={manualForm.pickup_address}
                dropLat={manualForm.drop_lat}
                dropLng={manualForm.drop_lng}
                dropText={manualForm.drop_address}
                nearbyCaptains={liveMap.captains.filter((c) => c.is_online)}
                heightClass="h-56"
                autoLocate={false}
                onSelectPoint={({ type, lat, lng, address, nearestZoneName }) => {
                  setManualForm((prev) => ({
                    ...prev,
                    ...(type === 'pickup'
                      ? {
                          pickup_lat: lat,
                          pickup_lng: lng,
                          pickup_zone: nearestZoneName || prev.pickup_zone,
                          pickup_address: address || prev.pickup_address,
                        }
                      : {
                          drop_lat: lat,
                          drop_lng: lng,
                          drop_zone: nearestZoneName || prev.drop_zone,
                          drop_address: address || prev.drop_address,
                        }),
                  }));
                }}
                onTextChange={(type, val) => {
                  setManualForm((prev) => ({
                    ...prev,
                    ...(type === 'pickup' ? { pickup_address: val } : { drop_address: val }),
                  }));
                }}
                onRouteResult={({ distanceKm: roadKm }) => {
                  if (roadKm) setManualForm((prev) => ({ ...prev, distance_km: roadKm }));
                }}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  placeholder="Distance (km)"
                  value={manualForm.distance_km}
                  onChange={(e) => setManualForm({ ...manualForm, distance_km: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num"
                />
                <input
                  type="number"
                  placeholder="Base/Custom Fare Rs. (opt.)"
                  value={manualForm.custom_fare}
                  onChange={(e) => setManualForm({ ...manualForm, custom_fare: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Customer Discount (Rs.)"
                  value={manualForm.discount_amount}
                  onChange={(e) => setManualForm({ ...manualForm, discount_amount: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 mono-num font-bold text-[#008741]"
                />
                <select
                  value={manualForm.payment_method}
                  onChange={(e) => setManualForm({ ...manualForm, payment_method: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 font-semibold"
                >
                  <option value="cash">Cash to Captain</option>
                  <option value="easypaisa">EasyPaisa (SafarGo)</option>
                  <option value="upaisa">UPaisa (SafarGo)</option>
                  <option value="jazzcash">JazzCash (SafarGo)</option>
                  <option value="bank">Bank Transfer (SafarGo)</option>
                </select>
                <select
                  value={manualForm.rider_id}
                  onChange={(e) => setManualForm({ ...manualForm, rider_id: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 font-semibold"
                >
                  <option value="">Leave Open in Queue</option>
                  {verifiedRiders.map((r) => (
                    <option key={r.id} value={r.id}>Assign: {r.full_name} ({r.bike_plate})</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="px-6 py-3 rounded-xl bg-[#009E4D] text-white font-extrabold">
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
              settings={bootstrap?.settings || {}}
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

          {/* 8, 9, 10. RELEASES, TICKETS, ZONES/PROMOS, DB BACKUPS, PASSWORDS & SETTINGS */}
          {(subpage === 'releases' || subpage === 'tickets' || subpage === 'zones' || subpage === 'backups' || subpage === 'settings') && (
            <AdminOperationsPanel
              subpage={subpage}
              onNotify={notify}
              onRefreshBootstrap={refreshBootstrap}
            />
          )}

          {/* 11. EMERGENCY POLICE 15 / RESCUE 1122 & SOS DISPATCH CENTER */}
          {subpage === 'sos' && (
            <div className="space-y-4 text-xs">
              <div className="bg-gradient-to-r from-rose-900 via-red-900 to-slate-900 text-white rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/30 border border-rose-300/40 text-amber-300 font-extrabold text-[11px]">
                    <Siren className="w-3.5 h-3.5" />
                    24/7 Emergency Control Room · Mansehra &amp; KPK
                  </div>
                  <h2 className="text-base font-extrabold">Emergency Police ({policeNumber}), Rescue ({rescueNumber}) &amp; Live SOS Radar</h2>
                  <p className="text-rose-100">
                    Koi bhi Captain SOS press kare to yahan turant alarm + live GPS pin aata hai. Admin khud bhi 1-tap Call ya SOS trigger kar sakta hai.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`tel:${policeNumber}`}
                    className="px-4 py-2.5 rounded-xl bg-white text-rose-700 font-extrabold inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Phone className="w-4 h-4" />
                    Police {policeNumber}
                  </a>
                  <a
                    href={`tel:${rescueNumber}`}
                    className="px-4 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-extrabold inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Phone className="w-4 h-4" />
                    Rescue {rescueNumber}
                  </a>
                  <button
                    type="button"
                    onClick={() => setSosModalOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 border border-white/30 text-white font-extrabold inline-flex items-center gap-1.5"
                  >
                    <Siren className="w-4 h-4" />
                    Trigger Admin SOS
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5">
                <div className="font-extrabold text-sm text-slate-900">
                  Live SOS Location Radar Map ({sosAlerts.filter((a) => a.status !== 'resolved').length} Active)
                </div>
                <SafarGoMap
                  captains={liveMap.captains}
                  activeBookings={liveMap.active_bookings}
                  sosAlerts={sosAlerts.filter((a) => a.status !== 'resolved')}
                  heightClass="h-72"
                  fitSignature={`sos-${sosAlerts.filter((a) => a.status !== 'resolved').length}-${liveMap.captains.length}`}
                />
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-x-auto">
                <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
                  <span className="font-extrabold text-sm text-slate-900">SOS Alerts Log ({sosAlerts.length})</span>
                  <button type="button" onClick={loadSosAlerts} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold">
                    Refresh SOS
                  </button>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80">
                    <tr>
                      <th className="p-3.5">Reporter &amp; Vehicle</th>
                      <th className="p-3.5">Emergency Type &amp; Note</th>
                      <th className="p-3.5">Live GPS Location</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Dispatch Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sosAlerts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-500">
                          No SOS emergency alerts logged yet — safe operations.
                        </td>
                      </tr>
                    ) : (
                      sosAlerts.map((s) => (
                        <tr key={s.id}>
                          <td className="p-3.5">
                            <div className="font-extrabold text-slate-900">
                              {s.user_name} <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-100">{s.user_role}</span>
                            </div>
                            <div className="mono-num text-slate-600">{s.user_phone}</div>
                            {s.bike_plate && <div className="text-[11px] text-slate-500">{s.bike_model} ({s.bike_plate})</div>}
                            {s.booking_code && (
                              <div className="text-[11px] text-sky-700 font-bold">
                                Trip {s.booking_code} · Cust: {s.customer_name} ({s.customer_phone})
                              </div>
                            )}
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-rose-700">{s.emergency_type.replace(/_/g, ' ').toUpperCase()}</div>
                            {s.note && <div className="text-slate-700 mt-0.5">{s.note}</div>}
                            <div className="text-[10px] text-slate-400 mono-num mt-0.5">
                              {s.created_at ? new Date(s.created_at).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }) : ''}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">{s.zone_name}</div>
                            {s.lat != null && (
                              <div className="mono-num text-[11px] text-slate-500">
                                {Number(s.lat).toFixed(4)}, {Number(s.lng).toFixed(4)}
                              </div>
                            )}
                            {s.google_maps_url && (
                              <a
                                href={s.google_maps_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block mt-1 text-[#008741] font-extrabold underline"
                              >
                                Open Google Maps ↗
                              </a>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                s.status === 'resolved'
                                  ? 'bg-emerald-100 text-[#008741]'
                                  : s.status === 'acknowledged'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {s.status.toUpperCase()}
                            </span>
                            {s.resolution_note && <div className="text-[10px] text-slate-500 mt-1">{s.resolution_note}</div>}
                          </td>
                          <td className="p-3.5 whitespace-nowrap space-x-1.5">
                            <a
                              href={`tel:${s.user_phone}`}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-bold inline-flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3" />
                              Call
                            </a>
                            {s.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => handleSosStatus(s.id, 'acknowledged', 'Admin dispatch responding')}
                                className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold"
                              >
                                Acknowledge
                              </button>
                            )}
                            {s.status !== 'resolved' && (
                              <button
                                type="button"
                                onClick={() => handleSosStatus(s.id, 'resolved', 'Resolved by Admin')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-100 text-[#008741] font-bold"
                              >
                                Resolve
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      <EmergencySosModal
        isOpen={sosModalOpen}
        onClose={() => setSosModalOpen(false)}
        role="admin"
        settings={bootstrap?.settings || {}}
        mySosHistory={sosAlerts.filter((a) => a.user_id === user?.id)}
        onTriggered={async () => {
          await Promise.all([loadOverviewAndRiders(), loadSosAlerts()]);
        }}
      />
    </div>
  );
}
