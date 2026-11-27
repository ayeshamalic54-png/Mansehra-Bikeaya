import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Bike,
  Car,
  CheckCircle2,
  Download,
  LocateFixed,
  LogOut,
  MapPin,
  Phone,
  Power,
  ShieldCheck,
  Siren,
  User,
  Wallet,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CaptainPhotoUploads } from '../components/CaptainPhotoUploads';
import { EmergencySosModal } from '../components/EmergencySosModal';
import { SafarGoMap } from '../components/SafarGoMap';
import { SafarGoPayBox } from '../components/SafarGoPayBox';
import { StatusBadge } from '../components/StatusBadge';
import {
  DIGITAL_PAYMENT_CHANNELS,
  formatPaymentMethodLabel,
  getRidePaymentBadgeState,
} from '../utils/paymentAccounts';
import {
  playRideAlertChime,
  requestRideNotificationsPermission,
  showBrowserRideNotification,
  unlockRideAlertAudio,
} from '../utils/rideAlerts';
import { getReliableDevicePosition, watchReliableDevicePosition } from '../utils/deviceGps';

export function RiderApp({ onOpenDownloads }) {
  const { user, bootstrap, refreshMe, logout } = useAuth();
  const [tab, setTab] = useState('duty'); // duty | active | ledger | profile
  const [availableJobs, setAvailableJobs] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [ledgerData, setLedgerData] = useState({ summary: {}, entries: [], settlement_requests: [], topup_requests: [] });
  const [commPayForm, setCommPayForm] = useState({
    amount: '',
    payment_channel: 'easypaisa',
    reference_no: '',
    note: '',
  });
  const [topupForm, setTopupForm] = useState({
    amount: '',
    payment_channel: 'easypaisa',
    reference_no: '',
    note: '',
  });
  const [showOptionalProofInput, setShowOptionalProofInput] = useState(false);
  const [proofDrafts, setProofDrafts] = useState({});
  const [showLegacySettlement, setShowLegacySettlement] = useState(false);
  const [submittingTopup, setSubmittingTopup] = useState(false);
  const [waitDrafts, setWaitDrafts] = useState({});
  const [offerDrafts, setOfferDrafts] = useState({}); // { [bookingId]: { fare, eta, note } }
  const [includeOtherVehicles, setIncludeOtherVehicles] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || '',
    vehicle_type: user?.rider_profile?.vehicle_type || 'bike',
    bike_model: user?.rider_profile?.bike_model || '',
    bike_plate: user?.rider_profile?.bike_plate || '',
    cnic_number: user?.rider_profile?.cnic_number || '',
    license_no: user?.rider_profile?.license_no || '',
    zone_name: user?.rider_profile?.zone_name || 'Main Bazar / Lari Adda',
    rider_photo: user?.rider_profile?.rider_photo || '',
    vehicle_photo: user?.rider_profile?.vehicle_photo || '',
    cnic_front_photo: user?.rider_profile?.cnic_front_photo || '',
    cnic_back_photo: user?.rider_profile?.cnic_back_photo || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(true);
  const [gpsBanner, setGpsBanner] = useState('');
  const [gpsState, setGpsState] = useState('idle'); // idle | syncing | live | denied | error
  const [liveRideAlert, setLiveRideAlert] = useState(null);
  const [alertsEnabled, setAlertsEnabled] = useState(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );
  const seenJobIdsRef = useRef(null);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [mySosHistory, setMySosHistory] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const policeNumber = bootstrap?.settings?.emergency_police_number || '15';
  const rescueNumber = bootstrap?.settings?.emergency_rescue_number || '1122';

  const rp = user?.rider_profile;
  const isCarCaptain = (rp?.vehicle_type || 'bike') === 'car';
  const topupRequired = String(bootstrap?.settings?.rider_topup_required ?? 'true').toLowerCase() === 'true';
  const topupRidesCount = Math.max(1, Number(bootstrap?.settings?.rider_topup_rides_count || 10));
  const topupCarFeeRaw = bootstrap?.settings?.rider_topup_car_package_fee;
  const topupPackageFee = Math.max(
    1,
    Number(
      isCarCaptain && topupCarFeeRaw !== undefined && String(topupCarFeeRaw).trim() !== ''
        ? topupCarFeeRaw
        : bootstrap?.settings?.rider_topup_package_fee || 100
    )
  );
  const topupPerRideFee = Number((topupPackageFee / topupRidesCount).toFixed(2));
  const remainingPaidRides = Number(ledgerData?.summary?.remaining_paid_rides ?? rp?.remaining_paid_rides ?? 0);
  const topupWalletBalance = Number(ledgerData?.summary?.topup_wallet_balance ?? rp?.topup_wallet_balance ?? 0);
  const topupRequests = ledgerData?.topup_requests || [];
  const pendingTopupRequests = topupRequests.filter((t) => t.status === 'pending');
  const needsTopup = topupRequired && remainingPaidRides <= 0;

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      full_name: user.full_name || '',
      vehicle_type: user.rider_profile?.vehicle_type || 'bike',
      bike_model: user.rider_profile?.bike_model || '',
      bike_plate: user.rider_profile?.bike_plate || '',
      cnic_number: user.rider_profile?.cnic_number || '',
      license_no: user.rider_profile?.license_no || '',
      zone_name: user.rider_profile?.zone_name || 'Main Bazar / Lari Adda',
      rider_photo: user.rider_profile?.rider_photo || '',
      vehicle_photo: user.rider_profile?.vehicle_photo || '',
      cnic_front_photo: user.rider_profile?.cnic_front_photo || '',
      cnic_back_photo: user.rider_profile?.cnic_back_photo || '',
    });
  }, [user?.id, user?.rider_profile?.updated_at, user?.rider_profile?.is_verified]);

  const loadAll = async (overrideOther = includeOtherVehicles) => {
    try {
      const [avail, mine, ledger, sosRows] = await Promise.all([
        apiRequest(`/api/riders/available-jobs?include_other_vehicles=${overrideOther ? 'true' : 'false'}`),
        apiRequest('/api/bookings/my'),
        apiRequest('/api/riders/ledger'),
        apiRequest('/api/sos/my').catch(() => []),
      ]);
      const list = avail || [];
      setAvailableJobs(list);
      setMyJobs(mine);
      setLedgerData(ledger);
      setMySosHistory(sosRows || []);

      if (seenJobIdsRef.current === null) {
        seenJobIdsRef.current = new Set(list.map((j) => j.id));
        const closestExisting = list.find((j) => j.is_closest_captain) || list[0];
        if (closestExisting) {
          setLiveRideAlert(closestExisting);
        }
      } else {
        const brandNew = list.filter((j) => !seenJobIdsRef.current.has(j.id));
        if (brandNew.length > 0) {
          brandNew.forEach((j) => seenJobIdsRef.current.add(j.id));
          const topNew = brandNew.find((j) => j.is_closest_captain) || brandNew[0];
          setLiveRideAlert(topNew);
          playRideAlertChime(topNew.is_closest_captain ? 'closest' : 'captain');
          showBrowserRideNotification(
            topNew.is_closest_captain
              ? `CLOSEST RIDE (${topNew.captain_distance_km ?? ''} km away)!`
              : `New SafarGo Request ${topNew.booking_code}`,
            `${topNew.pickup_zone} → ${topNew.drop_zone} · Offer Rs. ${topNew.final_fare}`,
            `rider-job-${topNew.id}`
          );
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadAll();
    const timer = setInterval(() => loadAll(), 3500);
    return () => clearInterval(timer);
  }, [includeOtherVehicles]);

  const pushRiderLocation = async (lat, lng, source = 'live') => {
    try {
      const res = await apiRequest('/api/riders/location', {
        method: 'POST',
        body: { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) },
      });
      await refreshMe();
      setGpsState('live');
      const resolvedLabel = res?.zone_name || 'Live GPS';
      const srcTag =
        source === 'manual'
          ? 'Location set'
          : source === 'cached_device'
          ? 'Recent GPS'
          : 'Live GPS synced';
      setGpsBanner(`${srcTag}: ${resolvedLabel} (${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)})`);
    } catch {
      // ignore background ping failures
    }
  };

  const detectAndSyncLiveGps = async (showErrorToast = false) => {
    setGpsState('syncing');
    try {
      const pos = await getReliableDevicePosition({
        timeoutMs: 14000,
        onRefine: (betterPos) => {
          pushRiderLocation(betterPos.lat, betterPos.lng, betterPos.source);
        },
      });
      await pushRiderLocation(pos.lat, pos.lng, pos.source);
    } catch (geoErr) {
      const denied = geoErr?.code === 'PERMISSION_DENIED' || geoErr?.code === 1;
      setGpsState(denied ? 'denied' : 'error');
      const notice =
        geoErr?.message ||
        (denied
          ? 'Location blocked! Browser / App settings mein Allow Location karein ya apna current Chowk choose karein.'
          : 'Mobile ki Location ON karein ya neeche apna current Chowk choose / map par tap karein.');
      setGpsBanner(notice);
      if (showErrorToast) setErr(notice);
    }
  };

  // Sync device GPS immediately on portal open AND when permission is granted or Captain goes Online
  useEffect(() => {
    if (!user?.id) return;
    detectAndSyncLiveGps(false);
    const onNativePerm = () => detectAndSyncLiveGps(false);
    window.addEventListener('safargo-location-ready', onNativePerm);

    if (!rp?.is_online) {
      return () => window.removeEventListener('safargo-location-ready', onNativePerm);
    }
    const stopWatch = watchReliableDevicePosition((pos) => {
      pushRiderLocation(pos.lat, pos.lng, pos.source);
    }, 15000);
    return () => {
      window.removeEventListener('safargo-location-ready', onNativePerm);
      stopWatch();
    };
  }, [user?.id, rp?.is_online]);

  const handleToggleOnline = async () => {
    unlockRideAlertAudio();
    setErr('');
    setMsg('');
    try {
      await apiRequest('/api/riders/toggle-online', { method: 'POST' });
      await refreshMe();
      detectAndSyncLiveGps(false);
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

  const handleSendOffer = async (job) => {
    setErr('');
    setMsg('');
    const draft = offerDrafts[job.id] || {};
    const offeredFare = Number(draft.fare !== undefined && draft.fare !== '' ? draft.fare : job.final_fare);
    const etaMinutes = Number(draft.eta || 5);
    try {
      await apiRequest(`/api/riders/jobs/${job.id}/offer`, {
        method: 'POST',
        body: {
          offered_fare: offeredFare,
          eta_minutes: etaMinutes,
          note: (draft.note || '').trim() || null,
        },
      });
      setMsg(`Counter-offer Rs. ${offeredFare} sent directly to Customer (${job.booking_code})!`);
      await loadAll();
    } catch (e) {
      setErr(e.message);
    }
  };

  const handleWithdrawOffer = async (bookingId) => {
    setErr('');
    try {
      await apiRequest(`/api/riders/jobs/${bookingId}/withdraw-offer`, { method: 'POST' });
      setMsg('Offer withdrawn.');
      await loadAll();
    } catch (e) {
      setErr(e.message);
    }
  };

  const handleSaveCaptainProfile = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    setSavingProfile(true);
    try {
      const updatedUser = await apiRequest('/api/riders/profile', {
        method: 'PATCH',
        body: {
          full_name: profileForm.full_name,
          vehicle_type: profileForm.vehicle_type,
          bike_model: profileForm.bike_model,
          bike_plate: profileForm.bike_plate,
          cnic_number: profileForm.cnic_number,
          license_no: profileForm.license_no,
          zone_name: profileForm.zone_name,
          rider_photo: profileForm.rider_photo || '',
          vehicle_photo: profileForm.vehicle_photo || '',
          cnic_front_photo: profileForm.cnic_front_photo || '',
          cnic_back_photo: profileForm.cnic_back_photo || '',
        },
      });
      await refreshMe();
      const missing = updatedUser?.rider_profile?.missing_required_docs || [];
      if (missing.length > 0) {
        setMsg(
          `Uploaded documents save ho gaye hain! Abhi yeh baqi documents complete karein: ${missing.join(', ')} — Jab tak tamam documents complete aur Admin khud verify na kare, verification nahi hogi.`
        );
      } else {
        setMsg('Tamam documents save aur submit ho gaye hain! Admin khud review karke verify karega tab ride active hogi.');
      }
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleStep = async (bookingId, nextStatus) => {
    setErr('');
    setMsg('');
    try {
      const draftWait = waitDrafts[bookingId];
      const body = { status: nextStatus };
      if ((nextStatus === 'in_progress' || nextStatus === 'completed') && draftWait !== undefined && draftWait !== '') {
        body.wait_minutes = Math.max(0, Number(draftWait) || 0);
      }
      const updated = await apiRequest(`/api/riders/jobs/${bookingId}/status`, {
        method: 'POST',
        body,
      });
      setMsg(
        `Ride ${updated.booking_code} updated to ${updated.status}${
          updated.wait_charge > 0 ? ` (Late fee Rs. ${updated.wait_charge} added)` : ''
        }.`
      );
      await refreshMe();
      await loadAll();
    } catch (e) {
      setErr(e.message);
    }
  };

  const handleSubmitTopupRequest = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    setSubmittingTopup(true);
    const reqAmount = Math.max(1, Number(topupForm.amount || topupPackageFee));
    const reqRides = Math.max(1, Math.round((reqAmount / topupPackageFee) * topupRidesCount));
    try {
      const res = await apiRequest('/api/riders/topup-requests', {
        method: 'POST',
        body: {
          amount: reqAmount,
          rides_requested: reqRides,
          payment_channel: topupForm.payment_channel,
          reference_no: topupForm.reference_no.trim() || null,
          note: topupForm.note.trim() || null,
        },
      });
      setTopupForm((prev) => ({ ...prev, amount: '', reference_no: '', note: '' }));
      setShowOptionalProofInput(false);
      setMsg(
        `Top-Up request Rs. ${res.amount} (${res.rides_requested} rides) bhej di gayi hai! Admin confirm karke approve kar dega.`
      );
      await Promise.all([refreshMe(), loadAll()]);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSubmittingTopup(false);
    }
  };

  const handleAttachTopupProof = async (reqId) => {
    const tid = (proofDrafts[reqId] || '').trim();
    if (!tid) {
      setErr('Meherbani payment TID / Reference # darj karein.');
      return;
    }
    setErr('');
    setMsg('');
    try {
      await apiRequest(`/api/riders/topup-requests/${reqId}/proof`, {
        method: 'POST',
        body: { reference_no: tid },
      });
      setProofDrafts((prev) => ({ ...prev, [reqId]: '' }));
      setMsg('Payment TID / Proof submit ho gaya hai! Admin ab verify karke approve kar dega.');
      await loadAll();
    } catch (e2) {
      setErr(e2.message);
    }
  };

  const activeJobs = myJobs.filter((j) => ['assigned', 'arrived', 'in_progress'].includes(j.status));
  const summary = ledgerData.summary || {};

  const renderTopupPackageCard = ({ compact = false } = {}) => {
    if (!topupRequired && topupRequests.length === 0 && remainingPaidRides <= 0) {
      return null;
    }
    const reqAmount = Math.max(1, Number(topupForm.amount || topupPackageFee));
    const reqRides = Math.max(1, Math.round((reqAmount / topupPackageFee) * topupRidesCount));

    return (
      <div
        className={`rounded-2xl p-4 sm:p-5 space-y-3 text-xs border-2 ${
          needsTopup
            ? 'bg-gradient-to-br from-amber-50 via-white to-emerald-50 border-amber-400 shadow-sm'
            : 'bg-white border-emerald-200/90'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-sm text-slate-900 inline-flex items-center gap-1.5">
                <Wallet className={`w-4 h-4 ${needsTopup ? 'text-amber-600' : 'text-[#009E4D]'}`} />
                {needsTopup ? 'App Fee / Top-Up Required to Start' : 'Pre-Paid App Fee & Top-Up Wallet'}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold mono-num ${
                  remainingPaidRides > 0
                    ? 'bg-emerald-100 text-[#008741]'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {remainingPaidRides} Rides Remaining
              </span>
            </div>
            <p className="text-slate-600 mt-1">
              {needsTopup ? (
                <>
                  Yeh <strong className="text-slate-900">100% SafarGo App Fee</strong> hai (is mein ride commission nahi hai).{' '}
                  <strong className="text-slate-900">
                    {topupRidesCount} Rides = Rs. {topupPackageFee}
                  </strong>{' '}
                  bhej kar neeche sirf Top-Up Request send karein — TID/saboot tab hi dein agar payment confirm na mile.
                </>
              ) : (
                <>
                  Pre-paid App Fee active hai — har ride par <strong>1 Paid Ride (Rs. {topupPerRideFee} App Fee)</strong> adjust hoti hai,{' '}
                  <strong className="text-[#008741]">0 Ride Commission</strong> aur poora fare aapka!
                </>
              )}
            </p>
          </div>
          {compact && (
            <button
              type="button"
              onClick={() => setTab('ledger')}
              className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold shrink-0"
            >
              Open Hisab Wallet →
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mono-num">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] text-slate-500">Rides Left</div>
            <div className={`text-base font-extrabold ${remainingPaidRides > 0 ? 'text-[#009E4D]' : 'text-rose-600'}`}>
              {remainingPaidRides}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] text-slate-500">App Fee Balance</div>
            <div className="text-base font-extrabold text-slate-900">Rs. {topupWalletBalance.toFixed(0)}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] text-slate-500">Package Rate</div>
            <div className="text-sm font-extrabold text-slate-900">
              {topupRidesCount} Rides · Rs. {topupPackageFee}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] text-slate-500">App Fee Paid</div>
            <div className="text-sm font-extrabold text-[#008741]">
              Rs. {Number(summary.total_topups_paid || rp?.total_topups_paid || 0).toFixed(0)}
            </div>
          </div>
        </div>

        {pendingTopupRequests.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-100/80 border border-amber-300 text-amber-950 space-y-2">
            <div className="font-bold flex flex-wrap items-center justify-between gap-2">
              <span>
                Pending Request: Rs. {pendingTopupRequests[0].amount} ({pendingTopupRequests[0].rides_requested} rides ·{' '}
                {formatPaymentMethodLabel(pendingTopupRequests[0].payment_channel)}
                {pendingTopupRequests[0].reference_no ? ` · TID: ${pendingTopupRequests[0].reference_no}` : ''})
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold uppercase">
                Waiting Admin Approval
              </span>
            </div>
            {pendingTopupRequests[0].admin_note && (
              <div className="p-2 rounded-lg bg-white/90 border border-amber-400 text-rose-800 font-bold">
                Admin Message: {pendingTopupRequests[0].admin_note}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <input
                type="text"
                placeholder="Payment nahi mili? Yahan TID / Proof submit karein"
                value={proofDrafts[pendingTopupRequests[0].id] ?? ''}
                onChange={(e) =>
                  setProofDrafts((prev) => ({ ...prev, [pendingTopupRequests[0].id]: e.target.value }))
                }
                className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-lg border border-amber-400 bg-white text-slate-900 font-semibold"
              />
              <button
                type="button"
                onClick={() => handleAttachTopupProof(pendingTopupRequests[0].id)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold"
              >
                {pendingTopupRequests[0].reference_no ? 'Update Proof' : 'Attach Proof (If Needed)'}
              </button>
            </div>
          </div>
        )}

        <SafarGoPayBox
          settings={bootstrap?.settings}
          selectedChannel={topupForm.payment_channel}
          amount={reqAmount}
          showAllChannels={true}
          onSelectChannel={(ch) => setTopupForm((prev) => ({ ...prev, payment_channel: ch }))}
        />

        <form onSubmit={handleSubmitTopupRequest} className="space-y-2 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={topupForm.payment_channel}
              onChange={(e) => setTopupForm((prev) => ({ ...prev, payment_channel: e.target.value }))}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold"
            >
              {DIGITAL_PAYMENT_CHANNELS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              placeholder={`Amount Rs. (${topupPackageFee})`}
              value={topupForm.amount}
              onChange={(e) => setTopupForm((prev) => ({ ...prev, amount: e.target.value }))}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-bold mono-num"
            />
            <button
              type="submit"
              disabled={submittingTopup}
              className="py-2.5 px-4 rounded-xl bg-[#009E4D] hover:bg-[#008741] disabled:opacity-60 text-white font-extrabold"
            >
              {submittingTopup ? 'Sending...' : `Send Top-Up (Rs. ${reqAmount} · ${reqRides} Rides)`}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowOptionalProofInput((v) => !v)}
              className="text-[11px] font-bold text-[#008741] hover:underline"
            >
              {showOptionalProofInput
                ? 'Hide Optional TID / Note'
                : '+ Optional: TID ya Note saath likhna ho (lazmi nahi)'}
            </button>
            <span className="text-[11px] text-slate-500">Approval ke liye TID lazmi nahi hai</span>
          </div>
          {showOptionalProofInput && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Optional TID / Reference #"
                value={topupForm.reference_no}
                onChange={(e) => setTopupForm((prev) => ({ ...prev, reference_no: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold"
              />
              <input
                type="text"
                placeholder="Optional note (e.g. Sent from 03xx...)"
                value={topupForm.note}
                onChange={(e) => setTopupForm((prev) => ({ ...prev, note: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
              />
            </div>
          )}
        </form>

        {topupRequests.length > 0 && (
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <div className="font-bold text-slate-700">Top-Up Requests History</div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {topupRequests.map((tr) => (
                <div
                  key={tr.id}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-slate-900 mono-num">
                      Rs. {tr.amount} · {tr.rides_requested} Rides · {formatPaymentMethodLabel(tr.payment_channel)}
                      {tr.reference_no ? ` · TID: ${tr.reference_no}` : ' · Direct Request'}
                    </div>
                    {tr.admin_note && <div className="text-[11px] text-amber-800 font-semibold">Admin: {tr.admin_note}</div>}
                  </div>
                  <StatusBadge value={tr.status === 'approved' ? 'paid' : tr.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Dark Captain Header */}
      <header className="sticky top-0 z-20 bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {rp?.rider_photo ? (
              <img src={rp.rider_photo} alt={user?.full_name} className="w-10 h-10 rounded-full object-cover border-2 border-[#009E4D] shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-emerald-600/30 border border-emerald-400/50 flex items-center justify-center font-extrabold text-emerald-300 shrink-0">
                {isCarCaptain ? <Car className="w-5 h-5" /> : <Bike className="w-5 h-5" />}
              </div>
            )}
            <div>
              <div className="text-[11px] text-slate-400">
                {isCarCaptain ? 'AC Car Captain' : 'Bike Captain'} · {rp?.bike_model} ({rp?.bike_plate})
              </div>
              <div className="text-base font-extrabold">{user?.full_name}</div>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                <div className="text-[10px] text-emerald-300 font-semibold inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {rp?.zone_name || 'Syncing GPS...'}
                </div>
                {topupRequired && (
                  <button
                    type="button"
                    onClick={() => setTab('ledger')}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold mono-num border ${
                      remainingPaidRides > 0
                        ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                        : 'bg-amber-400 border-amber-300 text-slate-950 animate-pulse'
                    }`}
                  >
                    {remainingPaidRides > 0
                      ? `${remainingPaidRides} Rides Left · Rs. ${topupWalletBalance.toFixed(0)}`
                      : '0 Rides · Top-Up Required'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                unlockRideAlertAudio();
                setSosModalOpen(true);
              }}
              className="px-2.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold inline-flex items-center gap-1 shadow-sm animate-pulse-once"
              title={`Emergency SOS · Police ${policeNumber} · Rescue ${rescueNumber}`}
            >
              <Siren className="w-3.5 h-3.5" />
              <span>SOS</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                const perm = await requestRideNotificationsPermission();
                setAlertsEnabled(perm === 'granted');
                playRideAlertChime('captain');
              }}
              className={`p-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1 ${
                alertsEnabled
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
              title="Enable Ride Sound & Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>
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
        {liveRideAlert && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#009E4D] to-emerald-700 text-white shadow-lg border border-emerald-300/40 flex flex-wrap items-center justify-between gap-3 animate-pulse-once">
            <div className="space-y-0.5 text-xs">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-300 text-slate-950 text-[10px] font-extrabold">
                <Bell className="w-3 h-3" />
                {liveRideAlert.is_closest_captain
                  ? `CLOSEST RIDE ALERT · ${liveRideAlert.captain_distance_km ?? ''} km away`
                  : `NEW RIDE REQUEST · ${liveRideAlert.booking_code}`}
              </div>
              <div className="font-extrabold text-sm">
                {liveRideAlert.pickup_zone} → {liveRideAlert.drop_zone}
              </div>
              <div className="text-emerald-100">
                Pickup: {liveRideAlert.pickup_address} · Offer: <strong>Rs. {liveRideAlert.final_fare}</strong>
                {liveRideAlert.captain_eta_min ? ` (~${liveRideAlert.captain_eta_min} min to pickup)` : ''}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  unlockRideAlertAudio();
                  setTab('duty');
                  handleAccept(liveRideAlert.id);
                  setLiveRideAlert(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-white text-[#008741] font-extrabold text-xs hover:bg-emerald-50"
              >
                Accept Rs. {liveRideAlert.final_fare}
              </button>
              <button
                type="button"
                onClick={() => setLiveRideAlert(null)}
                className="px-2.5 py-2 rounded-xl bg-emerald-950/30 text-white text-xs font-bold"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {!rp?.is_verified && (
          <div
            className={`p-4 rounded-2xl border text-xs font-bold flex flex-wrap items-center justify-between gap-3 ${
              rp?.verification_status === 'rejected'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-start gap-2 max-w-xl">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {rp?.verification_status === 'rejected'
                  ? `Docs Returned: ${rp.verification_note || 'Please upload clearer Selfie, Vehicle & CNIC photos in Profile.'}`
                  : !rp?.has_required_docs
                  ? `Apnay baqi documents complete karein (${(rp?.missing_required_docs || ['Selfie', isCarCaptain ? 'Car Photo' : 'Bike Photo', 'CNIC Front', 'CNIC Back / License', 'CNIC #']).join(', ')}) — jab tak tamam documents complete aur Admin khud verify na kare, verification nahi hogi.`
                  : `Tamam ${isCarCaptain ? 'AC Car' : 'Bike'} Captain documents complete hain — ab Admin manual review & verification ka intezar karein.`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTab('profile')}
              className="px-3.5 py-2 rounded-xl bg-slate-900 text-white font-extrabold shrink-0"
            >
              {rp?.has_required_docs ? 'View Docs in Profile' : 'Upload Photos Now →'}
            </button>
          </div>
        )}

        {rp?.is_verified && !rp?.is_online && tab === 'duty' && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold">
              You are currently <strong>OFFLINE</strong>. Go Online to appear on Customer GPS &amp; take InDrive rides directly!
            </span>
            <button
              type="button"
              onClick={handleToggleOnline}
              className="px-4 py-2 rounded-xl bg-[#009E4D] text-white font-extrabold"
            >
              Go ONLINE Now
            </button>
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
                <div className="text-[11px] text-slate-500">
                  {topupRequired && Number(summary.balance_due_to_admin || 0) <= 0 ? 'Rides Left' : 'Admin Due'}
                </div>
                <div
                  className={`text-base font-extrabold mono-num ${
                    topupRequired && Number(summary.balance_due_to_admin || 0) <= 0
                      ? remainingPaidRides > 0
                        ? 'text-[#009E4D]'
                        : 'text-rose-600'
                      : Number(summary.balance_due_to_admin || 0) > 0
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {topupRequired && Number(summary.balance_due_to_admin || 0) <= 0
                    ? `${remainingPaidRides} Rides`
                    : `Rs. ${Number(summary.balance_due_to_admin || 0).toFixed(0)}`}
                </div>
              </div>
            </div>

            {/* Emergency Police 15 · Rescue 1122 · Quick SOS Bar */}
            <div className="rounded-2xl bg-rose-50/80 border border-rose-200 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-extrabold text-rose-900">
                <Siren className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Emergency Helpline · Police {policeNumber} · Rescue {rescueNumber}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <a
                  href={`tel:${policeNumber}`}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold inline-flex items-center gap-1"
                >
                  <Phone className="w-3 h-3" />
                  Police {policeNumber}
                </a>
                <a
                  href={`tel:${rescueNumber}`}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-extrabold inline-flex items-center gap-1"
                >
                  <Phone className="w-3 h-3" />
                  Rescue {rescueNumber}
                </a>
                <button
                  type="button"
                  onClick={() => setSosModalOpen(true)}
                  className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-extrabold"
                >
                  Send SOS
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold text-slate-900">
                Direct Open Market Requests ({availableJobs.length})
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIncludeOtherVehicles((v) => !v)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                    includeOtherVehicles
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  {includeOtherVehicles ? 'Showing All Vehicles' : `Filter: ${isCarCaptain ? 'Car & Parcel' : 'Bike & Parcel'}`}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLocationPicker((v) => !v)}
                  className="text-xs font-bold text-teal-700 inline-flex items-center gap-1 underline"
                >
                  <LocateFixed className="w-3.5 h-3.5" />
                  {showLocationPicker ? 'Hide My Map Pin' : 'Update My Map Location'}
                </button>
                <button onClick={() => loadAll()} className="text-xs font-bold text-[#009E4D] underline">
                  Refresh
                </button>
              </div>
            </div>

            {showLocationPicker && (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                      <LocateFixed className="w-4 h-4 text-[#009E4D]" />
                      Live GPS Pin: <span className="text-[#008741]">{rp?.zone_name || 'Syncing...'}</span>
                    </div>
                    <div className={`text-[11px] mt-0.5 font-semibold ${gpsState === 'denied' || gpsState === 'error' ? 'text-amber-700' : 'text-slate-500'}`}>
                      {gpsBanner || (rp?.current_lat != null ? `GPS: ${Number(rp.current_lat).toFixed(5)}, ${Number(rp.current_lng).toFixed(5)}` : 'Waiting for GPS...')}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        unlockRideAlertAudio();
                        detectAndSyncLiveGps(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#009E4D] hover:bg-[#008741] text-white font-extrabold inline-flex items-center gap-1"
                    >
                      <LocateFixed className="w-3.5 h-3.5" />
                      {gpsState === 'syncing' ? 'Detecting GPS...' : 'Detect My Live GPS'}
                    </button>
                    {typeof window !== 'undefined' &&
                      window.SafarGoNative?.openLocationSettings &&
                      (gpsState === 'error' || gpsState === 'denied') && (
                        <button
                          type="button"
                          onClick={() => window.SafarGoNative.openLocationSettings()}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold inline-flex items-center gap-1"
                        >
                          Turn On Phone GPS
                        </button>
                      )}
                    <select
                      value=""
                      onChange={(e) => {
                        const chosen = (bootstrap.zones || []).find((z) => z.name === e.target.value);
                        if (chosen?.lat != null && chosen?.lng != null) {
                          pushRiderLocation(chosen.lat, chosen.lng, 'manual');
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700"
                    >
                      <option value="">Set Current Chowk Manually...</option>
                      {(bootstrap.zones || [])
                        .filter((z) => z.lat != null && z.lng != null)
                        .map((z) => (
                          <option key={z.id} value={z.name}>
                            {z.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                {(() => {
                  const zoneMatch = (bootstrap.zones || []).find((z) => z.name === rp?.zone_name);
                  const fallbackLat = rp?.current_lat ?? zoneMatch?.lat ?? 34.3335;
                  const fallbackLng = rp?.current_lng ?? zoneMatch?.lng ?? 73.1995;
                  return (
                    <SafarGoMap
                      pickup={
                        rp?.current_lat == null
                          ? {
                              lat: fallbackLat,
                              lng: fallbackLng,
                              label: `${rp?.zone_name || 'Mansehra'} (Syncing live GPS...)`,
                            }
                          : null
                      }
                      captains={
                        rp?.current_lat != null
                          ? [
                              {
                                id: user?.id,
                                display_name: user?.full_name,
                                vehicle_type: rp?.vehicle_type || 'bike',
                                bike_model: rp?.bike_model,
                                bike_plate: rp?.bike_plate,
                                zone_name: rp?.zone_name,
                                rider_photo: rp?.rider_photo,
                                vehicle_photo: rp?.vehicle_photo,
                                lat: rp.current_lat,
                                lng: rp.current_lng,
                                is_online: rp.is_online,
                              },
                            ]
                          : []
                      }
                      interactive={true}
                      activePinMode="pickup"
                      onMapPick={(_which, lat, lng) => pushRiderLocation(lat, lng, 'manual')}
                      heightClass="h-56 sm:h-64"
                      fitSignature={`${fallbackLat}-${fallbackLng}`}
                    />
                  );
                })()}
              </div>
            )}

            {needsTopup && renderTopupPackageCard({ compact: true })}

            {availableJobs.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-xs sm:text-sm text-slate-500">
                No pending ride requests right now. Keep Duty ONLINE to receive new city &amp; intercity bookings!
              </div>
            ) : (
              availableJobs.map((job) => (
                <div
                  key={job.id}
                  className={`bg-white rounded-2xl p-4 space-y-3 text-xs shadow-xs border-2 ${
                    job.is_closest_captain ? 'border-[#009E4D] ring-2 ring-emerald-200/60' : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {job.is_closest_captain ? (
                        <span className="px-2 py-0.5 rounded-lg bg-[#009E4D] text-white font-extrabold">
                          CLOSEST TO YOU
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg bg-teal-600 text-white font-bold">NEW JOB</span>
                      )}
                      <span className="mono-num font-bold">{job.booking_code}</span>
                      <StatusBadge value={job.service_type} />
                      {job.captain_distance_km != null && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#008741] border border-emerald-200 font-bold">
                          {job.captain_distance_km} km away (~{job.captain_eta_min} min)
                        </span>
                      )}
                    </div>
                    <span className="mono-num font-bold text-slate-600">Trip {job.distance_km} km</span>
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

                  {job.pickup_lat != null && job.drop_lat != null && (
                    <SafarGoMap
                      pickup={{ lat: job.pickup_lat, lng: job.pickup_lng, label: job.pickup_address || job.pickup_zone }}
                      drop={{ lat: job.drop_lat, lng: job.drop_lng, label: job.drop_address || job.drop_zone }}
                      captains={
                        rp?.current_lat != null
                          ? [
                              {
                                id: user?.id,
                                display_name: 'You',
                                vehicle_type: rp?.vehicle_type || 'bike',
                                bike_model: rp?.bike_model,
                                zone_name: rp?.zone_name,
                                rider_photo: rp?.rider_photo,
                                vehicle_photo: rp?.vehicle_photo,
                                lat: rp.current_lat,
                                lng: rp.current_lng,
                                is_online: rp?.is_online,
                              },
                            ]
                          : []
                      }
                      heightClass="h-40"
                      showCaptainSidebar={false}
                      fitSignature={`avail-${job.id}-${rp?.current_lat}`}
                    />
                  )}

                  <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70 grid grid-cols-3 gap-2 mono-num">
                    <div>
                      <div className="text-[11px] text-slate-500">Customer Offer</div>
                      <div className="text-sm font-extrabold text-slate-900">Rs. {job.final_fare}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[11px] text-slate-500">
                        {job.fee_mode === 'app_fee_topup' ? 'Top-Up Package' : 'Less Commission'}
                      </div>
                      <div className="text-sm font-bold text-[#008741]">
                        {job.fee_mode === 'app_fee_topup'
                          ? '-1 Ride (0 Comm.)'
                          : `-Rs. ${job.commission_amount}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500">Your Actual Net</div>
                      <div className="text-base font-extrabold text-[#009E4D]">Rs. {job.rider_earning}</div>
                    </div>
                  </div>

                  {/* InDrive Dual Path: Instant 1-Tap Accept OR Custom Counter-Offer */}
                  <div className="space-y-2.5 pt-1">
                    <button
                      onClick={() => handleAccept(job.id)}
                      className="w-full py-3 rounded-xl text-sm font-extrabold text-white bg-[#009E4D] hover:bg-[#008741] transition shadow-sm"
                    >
                      Accept Rs. {job.final_fare} Immediately
                    </button>

                    {job.my_offer && job.my_offer.status === 'pending' && (
                      <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-teal-900 mono-num">
                          Offer Sent: Rs. {job.my_offer.offered_fare} ({job.my_offer.eta_minutes} min ETA) · Net Rs.{' '}
                          {job.my_offer.rider_earning ?? '—'} — Waiting Customer
                        </span>
                        <button
                          type="button"
                          onClick={() => handleWithdrawOffer(job.id)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-600 font-bold"
                        >
                          Withdraw Offer
                        </button>
                      </div>
                    )}

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                        <span>Or Send InDrive Counter-Offer</span>
                        <div className="flex gap-1">
                          {[20, 50, 100].map((bump) => (
                            <button
                              key={bump}
                              type="button"
                              onClick={() =>
                                setOfferDrafts((prev) => ({
                                  ...prev,
                                  [job.id]: {
                                    ...(prev[job.id] || {}),
                                    fare: String(Number(job.final_fare) + bump),
                                  },
                                }))
                              }
                              className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800 hover:border-emerald-400 mono-num"
                            >
                              +{bump}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          min="50"
                          placeholder={`Rs. ${Number(job.final_fare) + 30}`}
                          value={offerDrafts[job.id]?.fare ?? ''}
                          onChange={(e) =>
                            setOfferDrafts((prev) => ({
                              ...prev,
                              [job.id]: { ...(prev[job.id] || {}), fare: e.target.value },
                            }))
                          }
                          className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white font-bold mono-num"
                        />
                        <select
                          value={offerDrafts[job.id]?.eta ?? '5'}
                          onChange={(e) =>
                            setOfferDrafts((prev) => ({
                              ...prev,
                              [job.id]: { ...(prev[job.id] || {}), eta: e.target.value },
                            }))
                          }
                          className="px-2 py-2 rounded-lg border border-slate-200 bg-white font-bold"
                        >
                          <option value="3">3 min away</option>
                          <option value="5">5 min away</option>
                          <option value="8">8 min away</option>
                          <option value="12">12 min away</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleSendOffer(job)}
                          className="py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-extrabold"
                        >
                          Send Offer
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Optional note to customer (e.g. Near Pakhwal Chowk)"
                        value={offerDrafts[job.id]?.note ?? ''}
                        onChange={(e) =>
                          setOfferDrafts((prev) => ({
                            ...prev,
                            [job.id]: { ...(prev[job.id] || {}), note: e.target.value },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                      />
                    </div>
                  </div>
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

                  {job.pickup_lat != null && job.drop_lat != null && (
                    <SafarGoMap
                      pickup={{ lat: job.pickup_lat, lng: job.pickup_lng, label: job.pickup_address || job.pickup_zone }}
                      drop={{ lat: job.drop_lat, lng: job.drop_lng, label: job.drop_address || job.drop_zone }}
                      captains={
                        rp?.current_lat != null
                          ? [
                              {
                                id: user?.id,
                                display_name: 'You',
                                vehicle_type: rp?.vehicle_type || 'bike',
                                bike_model: rp?.bike_model,
                                lat: rp.current_lat,
                                lng: rp.current_lng,
                                is_online: rp?.is_online,
                              },
                            ]
                          : []
                      }
                      heightClass="h-44"
                      showCaptainSidebar={false}
                      fitSignature={`active-${job.id}-${job.status}-${rp?.current_lat}`}
                    />
                  )}

                  {job.customer && (
                    <div className="p-3 rounded-xl bg-slate-50/80 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900">Customer: {job.customer.full_name}</div>
                        <div className="mono-num text-slate-600">{job.customer.phone}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {job.pickup_lat != null && (
                          <a
                            href={
                              job.status === 'assigned'
                                ? `https://www.google.com/maps/dir/?api=1&destination=${job.pickup_lat},${job.pickup_lng}&travelmode=driving`
                                : `https://www.google.com/maps/dir/?api=1&origin=${job.pickup_lat},${job.pickup_lng}&destination=${job.drop_lat ?? job.pickup_lat},${job.drop_lng ?? job.pickup_lng}&travelmode=driving`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 rounded-xl bg-[#009E4D] text-white font-bold inline-flex items-center gap-1"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            Google Maps ↗
                          </a>
                        )}
                        <a
                          href={`tel:${job.customer.phone}`}
                          className="px-3 py-2 rounded-xl bg-slate-900 text-white font-bold inline-flex items-center gap-1"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          Call
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5 mono-num font-bold">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Fare ({formatPaymentMethodLabel(job.payment_method)}): Rs. {job.final_fare}
                        {job.wait_charge > 0 && ` (incl. Rs. ${job.wait_charge} wait)`}
                      </span>
                      <StatusBadge value={getRidePaymentBadgeState(job)} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-200/70 text-[11px]">
                      <span className="text-amber-800">Less SafarGo Commission: -Rs. {job.commission_amount}</span>
                      <span className="text-sm font-extrabold text-[#008741]">Your Actual Net: Rs. {job.rider_earning}</span>
                    </div>
                    {Number(job.discount_amount || 0) > 0 && (
                      <div className="text-[11px] font-semibold text-teal-800">
                        Original Rs. {(Number(job.final_fare) + Number(job.discount_amount)).toFixed(0)} · Customer Discount -Rs. {job.discount_amount}
                      </div>
                    )}
                  </div>

                  {(job.status === 'assigned' || job.status === 'arrived') && (() => {
                    const jRule = bootstrap.pricing_rules?.find((r) => r.service_type === job.service_type);
                    const fMin = jRule?.wait_free_minutes ?? 5;
                    const cPerMin = jRule?.wait_charge_per_min ?? 10;
                    return (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold text-amber-900">
                          Customer Wait (min) · Free {fMin}m, then Rs. {cPerMin}/m
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="300"
                          placeholder="Auto timer"
                          value={waitDrafts[job.id] ?? ''}
                          onChange={(e) => setWaitDrafts((prev) => ({ ...prev, [job.id]: e.target.value }))}
                          className="w-24 px-2 py-1 rounded-lg border border-amber-300 bg-white text-slate-900 mono-num font-bold text-right"
                        />
                      </div>
                    );
                  })()}

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

                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="font-extrabold text-rose-900 inline-flex items-center gap-1">
                      <Siren className="w-3.5 h-3.5 text-rose-600" />
                      Emergency Ride Safety: Police {policeNumber} · Rescue {rescueNumber}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <a href={`tel:${policeNumber}`} className="px-2 py-1 rounded-lg bg-rose-600 text-white font-bold">
                        Call {policeNumber}
                      </a>
                      <a href={`tel:${rescueNumber}`} className="px-2 py-1 rounded-lg bg-amber-600 text-white font-bold">
                        Call {rescueNumber}
                      </a>
                      <button
                        type="button"
                        onClick={() => setSosModalOpen(true)}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-bold"
                      >
                        SOS Alert
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: HISAB / LEDGER */}
        {tab === 'ledger' && (
          <div className="space-y-4">
            {renderTopupPackageCard({ compact: false })}

            {topupRequired ? (
              <div className="bg-slate-900 text-white rounded-3xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-300 font-bold">
                    Trip Earnings &amp; App Fee Summary (0% Commission on Pre-Paid Rides)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-extrabold">
                    Pre-Paid Mode Active ✓
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs mono-num">
                  <div>
                    <div className="text-slate-400">Completed Trips</div>
                    <div className="text-base font-extrabold">{summary.total_trips || 0}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Gross Fare</div>
                    <div className="text-base font-bold">Rs. {Number(summary.total_gross_collected || 0).toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Your Take-Home</div>
                    <div className="text-base font-extrabold text-emerald-400">Rs. {Number(summary.total_net_earned || 0).toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">App Fee Paid</div>
                    <div className="text-base font-bold text-amber-300">Rs. {Number(summary.total_topups_paid || rp?.total_topups_paid || 0).toFixed(0)}</div>
                  </div>
                </div>

                {Number(summary.balance_due_to_admin || 0) !== 0 && (
                  <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-amber-300 font-bold mono-num">
                      {Number(summary.balance_due_to_admin || 0) > 0
                        ? `Previous Settlement Due: Rs. ${Number(summary.balance_due_to_admin).toFixed(0)}`
                        : `SafarGo Digital Payout Credit: Rs. ${Math.abs(Number(summary.balance_due_to_admin)).toFixed(0)}`}
                    </span>
                    {Number(summary.balance_due_to_admin || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowLegacySettlement((v) => !v)}
                        className="px-3 py-1 rounded-lg bg-amber-400 text-slate-950 font-extrabold"
                      >
                        {showLegacySettlement ? 'Hide Old Due Form' : 'Clear Past Due'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-900 text-white rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">Post-Paid Ride Commission Balance (Top-Up OFF)</span>
                  {Number(summary.balance_due_to_admin || 0) <= 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-extrabold">
                      All Paid ✓
                    </span>
                  )}
                </div>
                <div className="text-3xl font-extrabold mono-num text-amber-400">
                  {Number(summary.balance_due_to_admin || 0) >= 0
                    ? `Rs. ${Number(summary.balance_due_to_admin || 0).toFixed(0)} Payable to SafarGo`
                    : `Rs. ${Math.abs(Number(summary.balance_due_to_admin || 0)).toFixed(0)} SafarGo Owes You`}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-xs mono-num">
                  <div>
                    <div className="text-slate-400">Gross Fare</div>
                    <div className="font-bold">Rs. {Number(summary.total_gross_collected || 0).toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Ride Commission</div>
                    <div className="font-bold text-amber-300">-Rs. {Number(summary.total_commission_generated || 0).toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Your Actual Net</div>
                    <div className="font-extrabold text-emerald-400">Rs. {Number(summary.total_net_earned || 0).toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Settled / Paid</div>
                    <div className="font-bold text-[#009E4D]">Rs. {Number(summary.total_settled_to_admin || 0).toFixed(0)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Settlement form ONLY shown when Top-Up Mode is OFF OR Captain explicitly expands past-due settlement */}
            {(!topupRequired || (showLegacySettlement && Number(summary.balance_due_to_admin || 0) > 0)) && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setMsg('');
                  setErr('');
                  try {
                    await apiRequest('/api/riders/settlement-requests', {
                      method: 'POST',
                      body: {
                        amount: Number(commPayForm.amount || summary.balance_due_to_admin || 0),
                        payment_channel: commPayForm.payment_channel,
                        reference_no: commPayForm.reference_no.trim() || null,
                        note: commPayForm.note.trim() || null,
                      },
                    });
                    setCommPayForm({ amount: '', payment_channel: commPayForm.payment_channel, reference_no: '', note: '' });
                    setShowLegacySettlement(false);
                    setMsg('Payment settlement sent to SafarGo! It will mark Paid once confirmed.');
                    await loadAll();
                  } catch (e2) {
                    setErr(e2.message);
                  }
                }}
                className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3 text-xs"
              >
                <div className="font-extrabold text-sm text-slate-900">
                  {topupRequired ? 'Clear Past Ride Settlement Balance' : 'Send Ride Commission Payment to SafarGo'}
                </div>
                <SafarGoPayBox
                  settings={bootstrap.settings}
                  selectedChannel={commPayForm.payment_channel}
                  showAllChannels={true}
                  amount={commPayForm.amount || (Number(summary.balance_due_to_admin || 0) > 0 ? Number(summary.balance_due_to_admin) : null)}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={commPayForm.payment_channel}
                    onChange={(e) => setCommPayForm({ ...commPayForm, payment_channel: e.target.value })}
                    className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 font-bold"
                  >
                    {DIGITAL_PAYMENT_CHANNELS.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.shortLabel} → SafarGo
                      </option>
                    ))}
                    <option value="cash">Cash Office Handover</option>
                  </select>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder={Number(summary.balance_due_to_admin || 0) > 0 ? `Amount (Due Rs.${summary.balance_due_to_admin})` : 'Amount (Rs.)'}
                    value={commPayForm.amount}
                    onChange={(e) => setCommPayForm({ ...commPayForm, amount: e.target.value })}
                    className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Optional TID / Bank Ref #"
                    value={commPayForm.reference_no}
                    onChange={(e) => setCommPayForm({ ...commPayForm, reference_no: e.target.value })}
                    className="px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#009E4D] hover:bg-[#008741] text-white font-bold"
                >
                  Send Settlement Payment
                </button>
              </form>
            )}

            {(ledgerData.settlement_requests || []).length > 0 && (
              <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100 text-xs">
                <div className="p-4 font-extrabold text-slate-900">Submitted Commission Transfers</div>
                {ledgerData.settlement_requests.map((r) => (
                  <div key={r.id} className="p-3.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900">
                        Rs. {r.amount} via <span className="uppercase">{r.payment_channel}</span> → {r.account_title || 'SafarGo'}
                      </div>
                      <div className="text-[11px] text-slate-500 mono-num">
                        {new Date(r.created_at).toLocaleString()} {r.reference_no ? `· Ref: ${r.reference_no}` : ''}
                      </div>
                    </div>
                    <StatusBadge value={r.status} />
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100 text-xs">
              <div className="p-4 font-extrabold text-slate-900">Hisab-Kitab Transaction Log</div>
              {(ledgerData.entries || []).length === 0 ? (
                <div className="p-6 text-center text-slate-500">No ledger entries yet.</div>
              ) : (
                ledgerData.entries.map((e) => (
                  <div key={e.id} className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 font-bold text-slate-800">
                        <span>{e.note}</span>
                        {(e.entry_type === 'settlement_to_admin' || e.entry_type === 'payout_to_rider') && (
                          <StatusBadge value="paid" />
                        )}
                      </div>
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

        {/* TAB 4: PROFILE & UNIFIED VERIFICATION DOCUMENTS (BIKE & CAR) */}
        {tab === 'profile' && (
          <form onSubmit={handleSaveCaptainProfile} className="space-y-4 text-xs">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <span>{user?.full_name}</span>
                    {rp?.is_verified && <ShieldCheck className="w-4 h-4 text-[#009E4D]" />}
                  </div>
                  <div className="text-slate-500 mono-num">
                    {user?.phone} · Credit Cap Rs. {rp?.credit_limit} · Rating ★ {rp?.rating_avg}
                  </div>
                </div>
                <StatusBadge value={rp?.is_verified ? 'verified' : rp?.verification_status || 'incomplete'} />
              </div>

              {rp?.verification_status === 'rejected' && rp?.verification_note && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold">
                  Verification Note: {rp.verification_note}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Captain Vehicle Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setProfileForm({ ...profileForm, vehicle_type: 'bike' })}
                      className={`py-2.5 rounded-xl font-bold border inline-flex items-center justify-center gap-1.5 ${
                        profileForm.vehicle_type === 'bike'
                          ? 'bg-[#009E4D] text-white border-[#009E4D]'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      <Bike className="w-4 h-4" />
                      Motorbike
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileForm({ ...profileForm, vehicle_type: 'car' })}
                      className={`py-2.5 rounded-xl font-bold border inline-flex items-center justify-center gap-1.5 ${
                        profileForm.vehicle_type === 'car'
                          ? 'bg-[#009E4D] text-white border-[#009E4D]'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      <Car className="w-4 h-4" />
                      AC Car
                    </button>
                  </div>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {profileForm.vehicle_type === 'car' ? 'Car Model' : 'Bike Model'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={profileForm.vehicle_type === 'car' ? 'Suzuki Alto / Toyota Corolla' : 'Honda CD-70 / CG-125'}
                    value={profileForm.bike_model}
                    onChange={(e) => setProfileForm({ ...profileForm, bike_model: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {profileForm.vehicle_type === 'car' ? 'Car Number Plate' : 'Bike Number Plate'}
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.bike_plate}
                    onChange={(e) => setProfileForm({ ...profileForm, bike_plate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 uppercase mono-num"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">CNIC Number</label>
                  <input
                    type="text"
                    placeholder="13503-XXXXXXX-X"
                    value={profileForm.cnic_number}
                    onChange={(e) => setProfileForm({ ...profileForm, cnic_number: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 mono-num"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Driving License #</label>
                  <input
                    type="text"
                    placeholder="License #"
                    value={profileForm.license_no}
                    onChange={(e) => setProfileForm({ ...profileForm, license_no: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Primary Hub / Zone</label>
                <select
                  value={profileForm.zone_name}
                  onChange={(e) => setProfileForm({ ...profileForm, zone_name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 font-semibold"
                >
                  {bootstrap.zones.map((z) => (
                    <option key={z.id} value={z.name}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
              <div>
                <div className="text-sm font-extrabold text-slate-900">
                  Captain Verification Documents ({profileForm.vehicle_type === 'car' ? 'AC Car Captain' : 'Bike Captain'})
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Apnay 4 documents (Selfie, {profileForm.vehicle_type === 'car' ? 'AC Car' : 'Bike'} Photo, CNIC Front, CNIC Back / License) + CNIC number upload karke Save dabayein. Jo photos abhi lagayenge woh save ho jayengi; verification tab hogi jab tamam documents complete honge aur Admin khud approve karega.
                </p>
              </div>

              {(() => {
                const draftMissing = [
                  !profileForm.rider_photo && 'Captain Selfie / Photo',
                  !profileForm.vehicle_photo && (profileForm.vehicle_type === 'car' ? 'Car Photo' : 'Bike Photo'),
                  !profileForm.cnic_front_photo && 'CNIC Front Photo',
                  !profileForm.cnic_back_photo && 'CNIC Back / Driving License',
                  !(profileForm.cnic_number || '').trim() && 'CNIC Number',
                  !(profileForm.bike_model || '').trim() && 'Vehicle Model',
                  !(profileForm.bike_plate || '').trim() && 'Number Plate',
                ].filter(Boolean);
                if (draftMissing.length > 0) {
                  return (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-[11px] font-bold">
                      Baqi Documents Complete Karein ({4 - [profileForm.rider_photo, profileForm.vehicle_photo, profileForm.cnic_front_photo, profileForm.cnic_back_photo].filter(Boolean).length} photos missing):{' '}
                      <span className="text-rose-700">{draftMissing.join(' · ')}</span>
                      <div className="text-[10px] text-amber-800 mt-1">
                        Aap abhi jo kuch upload kar chuke hain woh Save click karne par safe save ho jayega, lekin verification aur online duty sab documents complete hone aur Admin ke khud verify karne par hi khulegi.
                      </div>
                    </div>
                  );
                }
                if (!rp?.is_verified) {
                  return (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[#008741] text-[11px] font-bold">
                      Tamam 4 documents complete hain — Save button dabakar Admin manual approval ka intezar karein.
                    </div>
                  );
                }
                return null;
              })()}

              <CaptainPhotoUploads
                vehicleType={profileForm.vehicle_type}
                photos={profileForm}
                onChangePhoto={(k, val) => setProfileForm((prev) => ({ ...prev, [k]: val }))}
              />

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full py-3 rounded-xl bg-[#009E4D] hover:bg-[#008741] text-white font-extrabold text-sm transition disabled:opacity-60"
              >
                {savingProfile ? 'Saving & Uploading Photos...' : 'Save Profile & Submit Verification Docs'}
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenDownloads}
              className="w-full py-3 rounded-xl bg-teal-600 text-white font-bold inline-flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Open SafarGo App Download Center
            </button>
          </form>
        )}
      </main>

      <EmergencySosModal
        isOpen={sosModalOpen}
        onClose={() => setSosModalOpen(false)}
        role="rider"
        settings={bootstrap?.settings || {}}
        activeBooking={activeJobs[0] || null}
        fallbackCoords={
          rp?.current_lat != null
            ? { lat: rp.current_lat, lng: rp.current_lng, zone_name: rp.zone_name }
            : null
        }
        mySosHistory={mySosHistory}
        onTriggered={() => loadAll()}
      />

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200/80">
        <div className="max-w-3xl mx-auto grid grid-cols-4">
          {[
            { id: 'duty', label: 'Duty', icon: isCarCaptain ? Car : Bike },
            { id: 'active', label: `Active (${activeJobs.length})`, icon: CheckCircle2 },
            { id: 'ledger', label: 'Hisab', icon: Wallet },
            { id: 'profile', label: rp?.is_verified ? 'Profile' : 'Profile (!)', icon: User },
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
