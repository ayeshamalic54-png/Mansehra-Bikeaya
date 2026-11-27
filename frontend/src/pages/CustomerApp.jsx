import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Bike,
  Car,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  HelpCircle,
  LogOut,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Printer,
  ShieldCheck,
  ShoppingBag,
  Siren,
  Star,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../components/BrandLogo';
import { EmergencySosModal } from '../components/EmergencySosModal';
import { InteractiveRoutePicker } from '../components/InteractiveRoutePicker';
import { SafarGoMap } from '../components/SafarGoMap';
import { SafarGoPayBox } from '../components/SafarGoPayBox';
import { StatusBadge } from '../components/StatusBadge';
import { SUPPORT_CATEGORIES, getSupportCategoryMeta } from '../utils/supportCategories';
import {
  DIGITAL_PAYMENT_CHANNELS,
  PAYMENT_METHOD_OPTIONS,
  formatPaymentMethodLabel,
  getRidePaymentBadgeState,
} from '../utils/paymentAccounts';
import {
  playRideAlertChime,
  requestRideNotificationsPermission,
  showBrowserRideNotification,
  unlockRideAlertAudio,
} from '../utils/rideAlerts';

export function CustomerApp({ onOpenDownloads }) {
  const { user, bootstrap, logout } = useAuth();
  const [tab, setTab] = useState('book'); // book | rides | payments | support
  const [rideFilter, setRideFilter] = useState('active'); // active | completed | cancelled

  // Booking form state (pure InDrive Pickup & Drop + silent nearest-zone fare detection)
  const [serviceType, setServiceType] = useState('bike_ride');
  const [pickupZone, setPickupZone] = useState(bootstrap.zones?.[0]?.name || 'Main Bazar / Lari Adda');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState(34.3335);
  const [pickupLng, setPickupLng] = useState(73.1995);
  const [dropZone, setDropZone] = useState(bootstrap.zones?.[2]?.name || 'Ghazikot Township');
  const [dropAddress, setDropAddress] = useState('');
  const [dropLat, setDropLat] = useState(34.3168);
  const [dropLng, setDropLng] = useState(73.1920);
  const [nearbyCaptains, setNearbyCaptains] = useState([]);
  const [distanceKm, setDistanceKm] = useState(2.3);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [codAmount, setCodAmount] = useState(0);
  const [customerNotes, setCustomerNotes] = useState('');

  const [estimate, setEstimate] = useState(null);
  const [offerFareInput, setOfferFareInput] = useState('');
  const [promoError, setPromoError] = useState('');
  const [bookings, setBookings] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [payModalId, setPayModalId] = useState(null);
  const [payDraft, setPayDraft] = useState({ payment_method: 'easypaisa', payment_reference: '' });
  const [seenReplies, setSeenReplies] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`safargo_seen_replies_${user?.id || 'guest'}`) || '{}');
    } catch {
      return {};
    }
  });
  const [ticketForm, setTicketForm] = useState({
    category: 'feedback',
    booking_id: '',
    subject: '',
    message: '',
  });
  const [ticketSubmittedMsg, setTicketSubmittedMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Rating modal inline state
  const [ratingTargetId, setRatingTargetId] = useState(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [mySosHistory, setMySosHistory] = useState([]);
  const [alertsEnabled, setAlertsEnabled] = useState(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );
  const seenOfferKeysRef = useRef(null);

  const policeNumber = bootstrap?.settings?.emergency_police_number || '15';
  const rescueNumber = bootstrap?.settings?.emergency_rescue_number || '1122';

  useEffect(() => {
    if (!user?.id) return;
    try {
      setSeenReplies(JSON.parse(localStorage.getItem(`safargo_seen_replies_${user.id}`) || '{}'));
    } catch {
      setSeenReplies({});
    }
  }, [user?.id]);

  // Clear Support unread badge automatically as soon as Customer views Support tab
  useEffect(() => {
    if (tab !== 'support' || !user?.id || tickets.length === 0) return;
    const next = { ...seenReplies };
    let changed = false;
    for (const t of tickets) {
      if (t.admin_reply && next[String(t.id)] !== t.admin_reply) {
        next[String(t.id)] = t.admin_reply;
        changed = true;
      }
    }
    if (changed) {
      setSeenReplies(next);
      try {
        localStorage.setItem(`safargo_seen_replies_${user.id}`, JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
    }
  }, [tab, tickets, user?.id]);

  const loadBookings = async () => {
    try {
      const [data, sosRows] = await Promise.all([
        apiRequest('/api/bookings/my'),
        apiRequest('/api/sos/my').catch(() => []),
      ]);
      const list = data || [];
      setBookings(list);
      setMySosHistory(sosRows || []);

      const pendingOffersList = [];
      for (const bk of list) {
        if (bk.status === 'pending' && !bk.rider_id) {
          for (const o of bk.offers || []) {
            if (o.status === 'pending') {
              pendingOffersList.push({ booking: bk, offer: o });
            }
          }
        }
      }
      const nextKeys = new Set(
        pendingOffersList.map(({ offer }) => `${offer.id}:${offer.offered_fare}`)
      );
      if (seenOfferKeysRef.current === null) {
        seenOfferKeysRef.current = nextKeys;
      } else {
        const freshOffers = pendingOffersList.filter(
          ({ offer }) => !seenOfferKeysRef.current.has(`${offer.id}:${offer.offered_fare}`)
        );
        seenOfferKeysRef.current = nextKeys;
        if (freshOffers.length > 0) {
          const top = freshOffers[0];
          const captName = top.offer.rider?.full_name || 'Captain';
          playRideAlertChime('captain');
          showBrowserRideNotification(
            `Captain Offer: Rs. ${top.offer.offered_fare} (${top.booking.booking_code})`,
            `${captName} offered Rs. ${top.offer.offered_fare} (~${top.offer.eta_minutes} min away)`,
            `cust-offer-${top.offer.id}-${top.offer.offered_fare}`
          );
          setStatusMsg(
            `New Captain Counter-Offer: ${captName} offered Rs. ${top.offer.offered_fare} (${top.offer.eta_minutes} min away)!`
          );
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadTickets = async () => {
    try {
      const data = await apiRequest('/api/support/tickets/my');
      setTickets(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadBookings();
    loadTickets();
    const hasSearching = bookings.some((b) => b.status === 'pending');
    const timer = setInterval(() => {
      loadBookings();
      loadTickets();
    }, hasSearching ? 3000 : 6000);
    return () => clearInterval(timer);
  }, [bookings.some((b) => b.status === 'pending')]);

  useEffect(() => {
    if (bootstrap.zones?.length >= 2) {
      const p = bootstrap.zones.find((z) => z.name === pickupZone) || bootstrap.zones[0];
      const d = bootstrap.zones.find((z) => z.name === dropZone) || bootstrap.zones[2] || bootstrap.zones[1];
      if (p?.lat != null) {
        setPickupLat(p.lat);
        setPickupLng(p.lng);
      }
      if (d?.lat != null) {
        setDropLat(d.lat);
        setDropLng(d.lng);
      }
    }
  }, [bootstrap.zones]);

  useEffect(() => {
    let active = true;
    const loadNearby = async () => {
      try {
        const res = await apiRequest(
          `/api/public/nearby-captains?lat=${pickupLat}&lng=${pickupLng}&service_type=${serviceType}&radius_km=60`,
          { auth: false }
        );
        if (active) setNearbyCaptains(res || []);
      } catch {
        // ignore nearby error
      }
    };
    loadNearby();
    const timer = setInterval(loadNearby, 8000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pickupLat, pickupLng, serviceType]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setPromoError('');
        const res = await apiRequest('/api/public/estimate', {
          method: 'POST',
          auth: false,
          body: {
            service_type: serviceType,
            pickup_zone: pickupZone,
            drop_zone: dropZone,
            distance_km: Number(distanceKm) || 3,
            promo_code: promoCode.trim() || null,
          },
        });
        if (active) setEstimate(res);
      } catch (err) {
        if (active) setPromoError(err.message);
      }
    })();
    return () => {
      active = false;
    };
  }, [serviceType, pickupZone, dropZone, distanceKm, promoCode]);

  const handleBook = async (e) => {
    e.preventDefault();
    unlockRideAlertAudio();
    setErrMsg('');
    setStatusMsg('');
    if (!pickupAddress.trim() || !dropAddress.trim()) {
      setErrMsg('Please set Pickup (or tap GPS) and Drop destination (e.g. Pakhwal Chowk Mansehra).');
      return;
    }
    setBusy(true);
    try {
      const created = await apiRequest('/api/bookings', {
        method: 'POST',
        body: {
          service_type: serviceType,
          pickup_zone: pickupZone,
          pickup_address: pickupAddress,
          pickup_lat: pickupLat,
          pickup_lng: pickupLng,
          drop_zone: dropZone,
          drop_address: dropAddress,
          drop_lat: dropLat,
          drop_lng: dropLng,
          distance_km: Number(distanceKm),
          payment_method: paymentMethod,
          payment_reference: paymentMethod !== 'cash' ? (paymentReference.trim() || null) : null,
          promo_code: promoCode.trim() || null,
          receiver_name: serviceType === 'parcel' ? receiverName || null : null,
          receiver_phone: serviceType === 'parcel' ? receiverPhone || null : null,
          cod_amount: serviceType === 'parcel' ? Number(codAmount || 0) : 0,
          customer_notes: customerNotes || null,
          offer_fare: offerFareInput !== '' ? Number(offerFareInput) : null,
        },
      });
      setStatusMsg(
        `Booking ${created.booking_code} broadcasted directly to ${
          created.nearby_captains_notified > 0
            ? `${created.nearby_captains_notified} closest Captains (~${created.closest_captain_eta_min || 3} min away)`
            : 'nearby Captains'
        } & Admin!`
      );
      setPickupAddress('');
      setDropAddress('');
      setPaymentReference('');
      setPromoCode('');
      setCustomerNotes('');
      setOfferFareInput('');
      await loadBookings();
      setTab('rides');
      setRideFilter('active');
    } catch (err) {
      setErrMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRaiseFare = async (bookingId, newFare) => {
    setErrMsg('');
    try {
      await apiRequest(`/api/bookings/${bookingId}/raise-fare`, {
        method: 'POST',
        body: { new_fare: Number(newFare) },
      });
      setStatusMsg(`Offer fare updated to Rs. ${newFare}!`);
      await loadBookings();
    } catch (err) {
      setErrMsg(err.message);
    }
  };

  const handleAcceptOffer = async (bookingId, offerId) => {
    setErrMsg('');
    try {
      const updated = await apiRequest(`/api/bookings/${bookingId}/offers/${offerId}/accept`, {
        method: 'POST',
      });
      setStatusMsg(`Captain ${updated.rider?.full_name} matched at Rs. ${updated.final_fare}!`);
      await loadBookings();
    } catch (err) {
      setErrMsg(err.message);
    }
  };

  const handleDeclineOffer = async (bookingId, offerId) => {
    try {
      await apiRequest(`/api/bookings/${bookingId}/offers/${offerId}/decline`, {
        method: 'POST',
      });
      await loadBookings();
    } catch (err) {
      setErrMsg(err.message);
    }
  };

  const handleSubmitRidePayment = async (e) => {
    e.preventDefault();
    if (!payModalId) return;
    try {
      await apiRequest(`/api/bookings/${payModalId}/submit-payment`, {
        method: 'POST',
        body: {
          payment_method: payDraft.payment_method,
          payment_reference: payDraft.payment_reference,
        },
      });
      setPayModalId(null);
      setPayDraft({ payment_method: 'easypaisa', payment_reference: '' });
      setStatusMsg('Payment details sent to SafarGo! Status updates to Paid once confirmed.');
      await loadBookings();
    } catch (err) {
      setErrMsg(err.message);
    }
  };

  const handleCancel = async (bookingId) => {
    try {
      await apiRequest(`/api/bookings/${bookingId}/cancel?reason=Cancelled+by+customer`, {
        method: 'POST',
      });
      await loadBookings();
    } catch (err) {
      setErrMsg(err.message);
    }
  };

  const handleRate = async (e) => {
    e.preventDefault();
    if (!ratingTargetId) return;
    try {
      await apiRequest(`/api/bookings/${ratingTargetId}/rate`, {
        method: 'POST',
        body: { rating: ratingStars, feedback: ratingFeedback || null },
      });
      setRatingTargetId(null);
      setRatingFeedback('');
      await loadBookings();
    } catch (err) {
      setErrMsg(err.message);
    }
  };

  const openSupportForBooking = (booking) => {
    setTicketSubmittedMsg('');
    setTicketForm({
      category: booking.status === 'cancelled' ? 'ride_complaint' : 'feedback',
      booking_id: String(booking.id),
      subject: `Ride ${booking.booking_code}: ${booking.pickup_zone} -> ${booking.drop_zone}`,
      message: '',
    });
    setTab('support');
  };

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    setTicketSubmittedMsg('');
    try {
      await apiRequest('/api/support/tickets', {
        method: 'POST',
        body: {
          booking_id: ticketForm.booking_id ? Number(ticketForm.booking_id) : null,
          category: ticketForm.category || 'feedback',
          subject: ticketForm.subject,
          message: ticketForm.message,
        },
      });
      setTicketForm({ category: 'feedback', booking_id: '', subject: '', message: '' });
      const msg = 'Your feedback / complaint has been sent to SafarGo Admin Support.';
      setStatusMsg(msg);
      setTicketSubmittedMsg(msg);
      await loadTickets();
    } catch (err) {
      setErrMsg(err.message);
    }
  };

  const unreadRepliesCount = tickets.filter(
    (t) => Boolean(t.admin_reply) && seenReplies[String(t.id)] !== t.admin_reply
  ).length;

  const activeRides = bookings.filter((b) =>
    ['pending', 'assigned', 'arrived', 'in_progress'].includes(b.status)
  );
  const completedRides = bookings.filter((b) => b.status === 'completed');
  const cancelledRides = bookings.filter((b) => b.status === 'cancelled');

  const shownRides =
    rideFilter === 'active'
      ? activeRides
      : rideFilter === 'completed'
      ? completedRides
      : cancelledRides;

  const totalSpent = completedRides.reduce((acc, r) => acc + Number(r.final_fare || 0), 0);

  const activeRule = bootstrap.pricing_rules?.find((r) => r.service_type === serviceType);
  const pZoneObj = bootstrap.zones?.find((z) => z.name === pickupZone);
  const dZoneObj = bootstrap.zones?.find((z) => z.name === dropZone);
  const fallbackFare = activeRule
    ? Math.round(
        Math.max(
          activeRule.min_fare,
          (activeRule.base_fare +
            (Number(distanceKm) || 3) * activeRule.per_km_rate +
            (pZoneObj?.surcharge || 0) +
            (dZoneObj?.surcharge || 0)) *
            (activeRule.peak_multiplier || 1)
        )
      )
    : 160;

  const suggestedFare = estimate?.estimated_fare ?? fallbackFare;
  const minOfferFloor = Math.max(50, Math.round(suggestedFare * 0.5));
  const activeOfferFare = offerFareInput !== '' ? Number(offerFareInput) : suggestedFare;
  const topIncomingOffers = bookings
    .filter((b) => b.status === 'pending' && !b.rider_id)
    .flatMap((b) =>
      (b.offers || [])
        .filter((o) => o.status === 'pending')
        .map((o) => ({ booking: b, offer: o }))
    );

  return (
    <div className="min-h-screen pb-24">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200/80 no-print">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <BrandLogo subtitle={`Hi, ${user?.full_name?.split(' ')[0]}`} />
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={async () => {
                const perm = await requestRideNotificationsPermission();
                setAlertsEnabled(perm === 'granted');
                playRideAlertChime('captain');
              }}
              className={`p-2 rounded-xl border text-xs font-bold inline-flex items-center ${
                alertsEnabled
                  ? 'bg-emerald-50 border-emerald-200 text-[#008741]'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
              title="Enable Sound & Offer Alerts"
            >
              <Bell className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSosModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white inline-flex items-center gap-1 shadow-sm"
              title={`Emergency SOS · Police ${policeNumber} · Rescue ${rescueNumber}`}
            >
              <Siren className="w-3.5 h-3.5" />
              <span>SOS</span>
            </button>
            <button
              onClick={() => setTab('support')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 transition ${
                tab === 'support'
                  ? 'bg-[#009E4D] text-white border-[#009E4D]'
                  : 'bg-emerald-50 text-[#008741] border-emerald-200 hover:bg-emerald-100/70'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Support</span>
              {unreadRepliesCount > 0 && (
                <span className="px-1.5 py-0.5 leading-none rounded-full bg-white text-[#008741] text-[10px] font-extrabold mono-num">
                  {unreadRepliesCount}
                </span>
              )}
            </button>
            <button
              onClick={onOpenDownloads}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200 inline-flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              APK
            </button>
            <button
              onClick={logout}
              className="p-2 rounded-xl border border-slate-200/80 text-slate-600 hover:bg-slate-100"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {topIncomingOffers.length > 0 && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-900 via-[#007D3D] to-teal-900 text-white shadow-lg border border-emerald-400/50 space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-300 text-slate-950 text-[10px] font-extrabold">
                <Bell className="w-3 h-3" />
                INCOMING CAPTAIN COUNTER-OFFER ({topIncomingOffers.length})
              </div>
              {tab !== 'rides' && (
                <button
                  type="button"
                  onClick={() => {
                    setTab('rides');
                    setRideFilter('active');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 font-bold"
                >
                  Open My Rides →
                </button>
              )}
            </div>
            {topIncomingOffers.slice(0, 3).map(({ booking, offer }) => (
              <div
                key={offer.id}
                className="p-3 rounded-xl bg-white text-slate-900 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="font-extrabold flex flex-wrap items-center gap-1.5">
                    <span>{offer.rider?.full_name || 'SafarGo Captain'}</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-[#008741] text-[10px] mono-num">
                      ~{offer.eta_minutes} min away
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold mono-num">
                      Your Offer: Rs. {booking.final_fare} → Counter: Rs. {offer.offered_fare}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {booking.booking_code} · {offer.rider?.vehicle_type === 'car' ? 'AC Car' : 'Bike'}:{' '}
                    {offer.rider?.bike_model} ({offer.rider?.bike_plate}) · ★ {offer.rider?.rating_avg}
                    {offer.note ? ` · “${offer.note}”` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDeclineOffer(booking.id, offer.id)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-bold hover:bg-rose-50 hover:text-rose-600"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAcceptOffer(booking.id, offer.id)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#009E4D] hover:bg-[#008741] text-white font-extrabold mono-num"
                  >
                    Accept Rs. {offer.offered_fare}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {statusMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#008741] text-xs font-bold flex items-center justify-between">
            <span>{statusMsg}</span>
            <button onClick={() => setStatusMsg('')} className="underline ml-2">Dismiss</button>
          </div>
        )}
        {errMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-between">
            <span>{errMsg}</span>
            <button onClick={() => setErrMsg('')} className="underline ml-2">Dismiss</button>
          </div>
        )}

        {/* TAB 1: BOOK RIDE / PARCEL / ERRAND */}
        {tab === 'book' && (
          <form onSubmit={handleBook} className="space-y-4">
            {/* Bykea-style Service Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'bike_ride', label: 'Bike Ride', sub: 'Sawari', icon: Bike },
                { id: 'car_ride', label: 'Car Ride', sub: 'City & Intercity', icon: Car },
                { id: 'parcel', label: 'Parcel', sub: 'Delivery', icon: Package },
                { id: 'errand', label: 'Bazaar', sub: 'Errand', icon: ShoppingBag },
              ].map((s) => {
                const Icon = s.icon;
                const active = serviceType === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServiceType(s.id)}
                    className={`p-3.5 rounded-2xl border-2 text-left transition flex flex-col gap-1.5 ${
                      active
                        ? 'bg-white border-[#009E4D] shadow-sm'
                        : 'bg-white/70 border-slate-200/80 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <span
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        active ? 'bg-[#009E4D] text-white' : 'bg-slate-50/80 text-slate-600'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="text-xs sm:text-sm font-extrabold text-slate-900">{s.label}</div>
                    <div className="text-[11px] text-slate-500">{s.sub}</div>
                  </button>
                );
              })}
            </div>

            {/* Pure InDrive Map + Nearby Captains + GPS Pickup/Drop */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 space-y-3">
              <InteractiveRoutePicker
                zones={bootstrap.zones}
                pickupLat={pickupLat}
                pickupLng={pickupLng}
                pickupText={pickupAddress}
                dropLat={dropLat}
                dropLng={dropLng}
                dropText={dropAddress}
                nearbyCaptains={nearbyCaptains}
                heightClass="h-60 sm:h-72"
                autoLocate={!pickupAddress}
                onSelectPoint={({ type, lat, lng, address, nearestZoneName }) => {
                  if (type === 'pickup') {
                    setPickupLat(lat);
                    setPickupLng(lng);
                    if (nearestZoneName) setPickupZone(nearestZoneName);
                    if (address) setPickupAddress(address);
                  } else {
                    setDropLat(lat);
                    setDropLng(lng);
                    if (nearestZoneName) setDropZone(nearestZoneName);
                    if (address) setDropAddress(address);
                  }
                }}
                onTextChange={(type, val) => {
                  if (type === 'pickup') setPickupAddress(val);
                  else setDropAddress(val);
                }}
                onRouteResult={({ distanceKm: roadKm }) => {
                  if (roadKm) setDistanceKm(roadKm);
                }}
              />
            </div>

            {/* Clean Ride Options Card (Distance auto-computed from Map!) */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="font-bold text-slate-700">Calculated Road Distance</span>
                <span className="mono-num font-extrabold text-[#009E4D] text-sm">{distanceKm} km</span>
              </div>

              {serviceType === 'parcel' && (
                <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    placeholder="Receiver Name"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200/80 bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Receiver Phone"
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200/80 bg-white"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="COD Cash (Rs.)"
                    value={codAmount}
                    onChange={(e) => setCodAmount(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200/80 bg-white mono-num"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 font-semibold"
                  >
                    {PAYMENT_METHOD_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Promo Code (Optional)</label>
                  <input
                    type="text"
                    placeholder="Optional code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num uppercase"
                  />
                  {promoError && <div className="text-[11px] text-rose-600 mt-1">{promoError}</div>}
                </div>
              </div>

              {paymentMethod !== 'cash' && (
                <div className="space-y-2.5">
                  <SafarGoPayBox
                    settings={bootstrap.settings}
                    selectedChannel={paymentMethod}
                    amount={estimate?.estimated_fare ?? fallbackFare}
                  />
                  <input
                    type="text"
                    placeholder="Transaction Ref / TID (optional now — or submit later after sending)"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 mono-num"
                  />
                </div>
              )}

              <input
                type="text"
                placeholder="Instructions for captain (optional)"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
              />
            </div>

            {/* InDrive Fare Offer & Submit Box */}
            <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold mb-1.5">
                    DIRECT CAPTAIN BROADCAST · NO ADMIN APPROVAL WAIT
                  </div>
                  <div className="text-xs text-slate-400">
                    {estimate?.discount_amount > 0 ? 'Recommended Net Fare (After Discount)' : 'Recommended Tariff Fare'}
                  </div>
                  {estimate?.discount_amount > 0 && (
                    <div className="text-xs text-slate-400 line-through mono-num">
                      Original: Rs. {(Number(estimate.estimated_fare) + Number(estimate.discount_amount)).toFixed(0)}
                    </div>
                  )}
                  <div className="text-3xl font-extrabold mono-num text-[#009E4D]">
                    Rs. {activeOfferFare}
                  </div>
                  {offerFareInput !== '' && Number(offerFareInput) !== suggestedFare && (
                    <div className="text-[11px] text-amber-300 font-bold mono-num">
                      Your InDrive Offer (Recommended: Rs. {suggestedFare})
                    </div>
                  )}
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Wait Policy: First {estimate?.wait_free_minutes ?? activeRule?.wait_free_minutes ?? 5} min free, then Rs.{' '}
                    {estimate?.wait_charge_per_min ?? activeRule?.wait_charge_per_min ?? 10}/min
                  </div>
                  {estimate?.city_slab_applied && (
                    <div className="text-[11px] text-emerald-300 font-semibold mt-0.5">
                      Mansehra In-City Slab: Rs. {estimate.city_flat_fare} up to {estimate.city_flat_km} km, then Rs. {estimate.per_km_rate}/km
                    </div>
                  )}
                </div>

                {/* Offer Your Own Kiraya (InDrive Bargaining) */}
                <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3 space-y-2 sm:w-64">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-200">Your Offer Fare (InDrive)</span>
                    {offerFareInput !== '' && (
                      <button
                        type="button"
                        onClick={() => setOfferFareInput('')}
                        className="text-emerald-300 underline font-semibold"
                      >
                        Reset Rs.{suggestedFare}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOfferFareInput(String(Math.max(minOfferFloor, activeOfferFare - 20)))}
                      className="px-2.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-extrabold mono-num"
                    >
                      -20
                    </button>
                    <input
                      type="number"
                      min={minOfferFloor}
                      max="200000"
                      placeholder={String(suggestedFare)}
                      value={offerFareInput}
                      onChange={(e) => setOfferFareInput(e.target.value)}
                      className="flex-1 min-w-0 px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-600 text-white text-center font-extrabold mono-num text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setOfferFareInput(String(activeOfferFare + 20))}
                      className="px-2.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-extrabold mono-num"
                    >
                      +20
                    </button>
                    <button
                      type="button"
                      onClick={() => setOfferFareInput(String(activeOfferFare + 50))}
                      className="px-2.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-xs font-extrabold mono-num"
                    >
                      +50
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Min allowed: Rs. {minOfferFloor} · Captains can accept or send counter-offers
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full px-6 py-3.5 rounded-2xl text-sm font-extrabold bg-[#009E4D] hover:bg-[#008741] text-white shadow-lg transition disabled:opacity-60"
              >
                {busy ? 'Broadcasting to Nearby Captains...' : `Find ${serviceType === 'car_ride' ? 'AC Car' : 'Captain'} · Rs. ${activeOfferFare}`}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: MY RIDES */}
        {tab === 'rides' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 bg-white border border-slate-200/80 p-1 rounded-2xl text-xs font-bold">
              {[
                ['active', `Active (${activeRides.length})`],
                ['completed', `Completed (${completedRides.length})`],
                ['cancelled', `Cancelled (${cancelledRides.length})`],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setRideFilter(id)}
                  className={`py-2 rounded-xl transition ${
                    rideFilter === id ? 'bg-[#009E4D] text-white' : 'text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {shownRides.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-sm text-slate-500">
                No rides in this list yet.
              </div>
            ) : (
              shownRides.map((b) => (
                <div key={b.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold mono-num text-sm text-slate-900">{b.booking_code}</span>
                      <StatusBadge value={b.service_type} />
                    </div>
                    <StatusBadge value={b.status} />
                  </div>

                  <div className="space-y-1 text-slate-700">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#009E4D] shrink-0 mt-0.5" />
                      <span>
                        <strong>From:</strong> {b.pickup_zone} — {b.pickup_address}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>To:</strong> {b.drop_zone} — {b.drop_address}
                      </span>
                    </div>
                  </div>

                  {/* Direct InDrive Captain Counter-Offers & Waiting Controls (Top Priority above Map) */}
                  {!b.rider && b.status === 'pending' && (
                    <div className="space-y-2.5">
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 font-bold">
                          <Clock className="w-4 h-4 text-[#009E4D] animate-spin shrink-0" />
                          <span>
                            Searching {b.service_type === 'car_ride' ? 'AC Car' : 'Bike & Courier'} Captains directly (No Admin delay)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {[20, 50, 100].map((inc) => (
                            <button
                              key={inc}
                              type="button"
                              onClick={() => handleRaiseFare(b.id, Number(b.final_fare) + inc)}
                              className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-[#008741] font-extrabold mono-num hover:bg-emerald-100"
                            >
                              Raise +Rs.{inc}
                            </button>
                          ))}
                        </div>
                      </div>

                      {(() => {
                        const pendingOffers = (b.offers || []).filter((o) => o.status === 'pending');
                        if (pendingOffers.length === 0) return null;
                        return (
                          <div className="space-y-2">
                            <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 flex items-center justify-between gap-2">
                              <span>
                                Incoming Captain Offers ({pendingOffers.length}) — Choose Your Captain:
                              </span>
                              <span className="mono-num text-[10px] font-bold text-slate-600">
                                Your Offer: Rs. {b.final_fare}
                              </span>
                            </div>
                            {pendingOffers.map((o) => {
                              const isCounter = Number(o.offered_fare) !== Number(b.final_fare);
                              return (
                                <div
                                  key={o.id}
                                  className="p-3 rounded-2xl bg-white border-2 border-[#009E4D]/70 shadow-xs flex flex-wrap items-center justify-between gap-3"
                                >
                                  <div className="flex items-center gap-2.5">
                                    {o.rider?.rider_photo ? (
                                      <img
                                        src={o.rider.rider_photo}
                                        alt={o.rider.full_name}
                                        className="w-11 h-11 rounded-full object-cover border-2 border-[#009E4D]"
                                      />
                                    ) : (
                                      <div className="w-11 h-11 rounded-full bg-emerald-100 text-[#008741] font-extrabold flex items-center justify-center">
                                        {(o.rider?.full_name || 'C')[0]}
                                      </div>
                                    )}
                                    {o.rider?.vehicle_photo && (
                                      <img
                                        src={o.rider.vehicle_photo}
                                        alt={o.rider.bike_model}
                                        className="w-12 h-10 rounded-lg object-cover border border-slate-200"
                                      />
                                    )}
                                    <div>
                                      <div className="font-extrabold text-slate-900 flex flex-wrap items-center gap-1.5">
                                        <span>{o.rider?.full_name}</span>
                                        {o.rider?.is_verified && (
                                          <ShieldCheck className="w-3.5 h-3.5 text-[#009E4D]" />
                                        )}
                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                                          ~{o.eta_minutes} min away
                                        </span>
                                        <span
                                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold mono-num ${
                                            isCounter
                                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                              : 'bg-emerald-100 text-[#008741] border border-emerald-200'
                                          }`}
                                        >
                                          {isCounter
                                            ? `Counter: Rs. ${o.offered_fare} (Your Offer: Rs. ${b.final_fare})`
                                            : `Matches Rs. ${o.offered_fare}`}
                                        </span>
                                      </div>
                                      <div className="text-slate-500 mono-num text-[11px]">
                                        {o.rider?.vehicle_type === 'car' ? 'AC Car' : 'Bike'}: {o.rider?.bike_model} ({o.rider?.bike_plate}) · ★ {o.rider?.rating_avg} · {o.rider?.total_trips} trips
                                      </div>
                                      {o.note && <div className="text-[11px] text-teal-800 font-semibold mt-0.5">“{o.note}”</div>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleDeclineOffer(b.id, o.id)}
                                      className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-rose-50 hover:text-rose-600"
                                    >
                                      Decline
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAcceptOffer(b.id, o.id)}
                                      className="px-4 py-2 rounded-xl bg-[#009E4D] hover:bg-[#008741] text-white font-extrabold mono-num shadow-sm"
                                    >
                                      Accept Rs. {o.offered_fare}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {['pending', 'assigned', 'arrived', 'in_progress'].includes(b.status) &&
                    b.pickup_lat != null &&
                    b.drop_lat != null && (
                      <SafarGoMap
                        pickup={{ lat: b.pickup_lat, lng: b.pickup_lng, label: b.pickup_address || b.pickup_zone }}
                        drop={{ lat: b.drop_lat, lng: b.drop_lng, label: b.drop_address || b.drop_zone }}
                        captains={
                          b.rider?.current_lat != null
                            ? [
                                {
                                  id: b.rider.id,
                                  display_name: b.rider.full_name,
                                  vehicle_type: b.rider.vehicle_type,
                                  bike_model: b.rider.bike_model,
                                  bike_plate: b.rider.bike_plate,
                                  rider_photo: b.rider.rider_photo,
                                  vehicle_photo: b.rider.vehicle_photo,
                                  lat: b.rider.current_lat,
                                  lng: b.rider.current_lng,
                                  is_online: true,
                                },
                              ]
                            : b.status === 'pending'
                            ? nearbyCaptains
                            : []
                        }
                        heightClass="h-44"
                        fitSignature={`${b.id}-${b.status}-${b.rider?.current_lat}-${b.rider?.current_lng}`}
                      />
                    )}

                  {/* Assigned Captain Box */}
                  {b.rider ? (
                    <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {b.rider.rider_photo ? (
                          <img
                            src={b.rider.rider_photo}
                            alt={b.rider.full_name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-[#009E4D] shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-emerald-100 text-[#008741] font-extrabold text-base flex items-center justify-center shrink-0">
                            {(b.rider.full_name || 'C')[0]}
                          </div>
                        )}
                        {b.rider.vehicle_photo && (
                          <img
                            src={b.rider.vehicle_photo}
                            alt={b.rider.bike_model}
                            className="w-14 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                        )}
                        <div>
                          <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                            <span>{b.rider.full_name}</span>
                            {b.rider.is_verified && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-[#008741] text-[10px] font-extrabold">
                                <ShieldCheck className="w-3 h-3" /> Verified
                              </span>
                            )}
                          </div>
                          <div className="text-slate-600 mono-num">
                            {b.rider.vehicle_type === 'car' ? 'AC Car' : 'Bike'}: {b.rider.bike_model} · {b.rider.bike_plate} · ★ {b.rider.rating_avg}
                          </div>
                        </div>
                      </div>
                      <a
                        href={`tel:${b.rider.phone}`}
                        className="px-3.5 py-2 rounded-xl bg-[#009E4D] text-white font-bold inline-flex items-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Call
                      </a>
                    </div>
                  ) : null}

                  {['pending', 'assigned', 'arrived', 'in_progress'].includes(b.status) && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-extrabold text-rose-900 inline-flex items-center gap-1">
                        <Siren className="w-3.5 h-3.5 text-rose-600" />
                        Ride Safety: Police {policeNumber} · Rescue {rescueNumber}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <a href={`tel:${policeNumber}`} className="px-2 py-1 rounded-lg bg-rose-600 text-white font-bold">
                          Police {policeNumber}
                        </a>
                        <a href={`tel:${rescueNumber}`} className="px-2 py-1 rounded-lg bg-amber-600 text-white font-bold">
                          Rescue {rescueNumber}
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
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2 mono-num font-extrabold text-sm text-slate-900">
                        <span>Fare: Rs. {b.final_fare}</span>
                        <span className="font-normal text-xs text-slate-500">({formatPaymentMethodLabel(b.payment_method)})</span>
                        {b.status !== 'cancelled' && <StatusBadge value={getRidePaymentBadgeState(b)} />}
                      </div>
                      {Number(b.discount_amount || 0) > 0 && (
                        <div className="text-[11px] font-semibold text-[#008741] mono-num">
                          Original Rs. {(Number(b.final_fare) + Number(b.discount_amount)).toFixed(0)} · Discount -Rs. {b.discount_amount} → Net Rs. {b.final_fare}
                        </div>
                      )}
                      {b.payment_reference && (
                        <div className="text-[11px] text-slate-500 mono-num">TID / Ref: {b.payment_reference}</div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {b.status !== 'cancelled' && b.payment_status !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => {
                            setPayModalId(payModalId === b.id ? null : b.id);
                            setPayDraft({
                              payment_method: b.payment_method !== 'cash' ? b.payment_method : 'easypaisa',
                              payment_reference: b.payment_reference || '',
                            });
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[#008741] font-bold hover:bg-emerald-100"
                        >
                          {b.payment_status === 'submitted' ? 'Update Payment Ref' : 'Pay to SafarGo'}
                        </button>
                      )}
                      {['pending', 'assigned', 'arrived'].includes(b.status) && (
                        <button
                          onClick={() => handleCancel(b.id)}
                          className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 font-bold hover:bg-rose-50"
                        >
                          Cancel
                        </button>
                      )}
                      {b.status === 'completed' && !b.customer_rating && (
                        <button
                          onClick={() => setRatingTargetId(b.id)}
                          className="px-3 py-1.5 rounded-lg bg-teal-600 text-white font-bold"
                        >
                          Rate Captain ★
                        </button>
                      )}
                      {b.customer_rating && (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-500" />
                          {b.customer_rating}/5
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => openSupportForBooking(b)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-emerald-50 hover:text-[#008741] hover:border-emerald-200 inline-flex items-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Feedback / Issue
                      </button>
                    </div>
                  </div>

                  {payModalId === b.id && (
                    <form onSubmit={handleSubmitRidePayment} className="p-3.5 rounded-xl bg-slate-50 border border-emerald-200 space-y-2.5">
                      <SafarGoPayBox
                        settings={bootstrap.settings}
                        selectedChannel={payDraft.payment_method}
                        amount={b.final_fare}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={payDraft.payment_method}
                          onChange={(e) => setPayDraft({ ...payDraft, payment_method: e.target.value })}
                          className="px-3 py-2 rounded-lg border border-slate-200 bg-white font-bold"
                        >
                          {DIGITAL_PAYMENT_CHANNELS.map((ch) => (
                            <option key={ch.id} value={ch.id}>
                              {ch.shortLabel} → SafarGo
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          required
                          minLength={2}
                          placeholder="Transaction ID / Bank Ref #"
                          value={payDraft.payment_reference}
                          onChange={(e) => setPayDraft({ ...payDraft, payment_reference: e.target.value })}
                          className="px-3 py-2 rounded-lg border border-slate-200 bg-white mono-num"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" className="px-4 py-1.5 rounded-lg bg-[#009E4D] text-white font-bold">
                          Submit Payment Proof
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayModalId(null)}
                          className="px-3 py-1.5 rounded-lg bg-white border border-slate-200"
                        >
                          Close
                        </button>
                      </div>
                    </form>
                  )}

                  {ratingTargetId === b.id && (
                    <form onSubmit={handleRate} className="p-3 rounded-xl bg-teal-50 border border-teal-200 space-y-2">
                      <div className="font-bold text-teal-800">Rate Your Captain (1–5 Stars)</div>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setRatingStars(n)}
                            className={`px-3 py-1 rounded-lg font-bold ${
                              ratingStars >= n ? 'bg-amber-500 text-white' : 'bg-white border border-slate-200/80'
                            }`}
                          >
                            {n}★
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Short feedback (optional)"
                        value={ratingFeedback}
                        onChange={(e) => setRatingFeedback(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200/80 bg-white"
                      />
                      <div className="flex gap-2">
                        <button type="submit" className="px-4 py-1.5 rounded-lg bg-[#009E4D] text-white font-bold">
                          Submit Rating
                        </button>
                        <button
                          type="button"
                          onClick={() => setRatingTargetId(null)}
                          className="px-3 py-1.5 rounded-lg bg-white border border-slate-200/80"
                        >
                          Close
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: PAYMENTS & RECEIPTS */}
        {tab === 'payments' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-semibold">Total Completed Ride Spend</div>
                <div className="text-3xl font-extrabold mono-num text-slate-900">Rs. {totalSpent.toFixed(0)}</div>
                <div className="text-xs text-[#009E4D] font-semibold mt-0.5">
                  {completedRides.length} completed trips
                </div>
              </div>
              <button
                onClick={() => window.print()}
                className="no-print px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print Statement
              </button>
            </div>

            <SafarGoPayBox settings={bootstrap.settings} selectedChannel="easypaisa" />

            <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100">
              {completedRides.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">No completed receipts yet.</div>
              ) : (
                completedRides.map((b) => (
                  <div key={b.id} className="p-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-bold mono-num text-slate-900">{b.booking_code} · {b.service_type}</div>
                      <div className="text-slate-500">{b.pickup_zone} → {b.drop_zone}</div>
                      {Number(b.discount_amount || 0) > 0 && (
                        <div className="text-[11px] font-semibold text-[#008741] mono-num">
                          Subtotal Rs. {(Number(b.final_fare) + Number(b.discount_amount)).toFixed(0)} − Discount Rs. {b.discount_amount}
                        </div>
                      )}
                      {b.payment_reference && (
                        <div className="text-[11px] text-slate-400 mono-num">Ref: {b.payment_reference}</div>
                      )}
                    </div>
                    <div className="text-right space-y-1">
                      <div className="font-extrabold mono-num text-sm text-[#009E4D]">Rs. {b.final_fare}</div>
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-slate-500">{formatPaymentMethodLabel(b.payment_method)}</span>
                        <StatusBadge value={getRidePaymentBadgeState(b)} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: FEEDBACK, COMPLAINTS & SUPPORT */}
        {tab === 'support' && (() => {
          const activeCategoryMeta = getSupportCategoryMeta(ticketForm.category);
          return (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-base font-extrabold text-slate-900">{user?.full_name}</div>
                  <div className="text-xs text-slate-500 mono-num">{user?.phone} · Customer Account</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {bootstrap.settings?.support_phone && (
                    <a
                      href={`tel:${bootstrap.settings.support_phone}`}
                      className="px-3.5 py-2 rounded-xl bg-emerald-50 text-[#008741] border border-emerald-200 text-xs font-bold inline-flex items-center gap-1.5 mono-num"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Helpline
                    </a>
                  )}
                  <button
                    onClick={onOpenDownloads}
                    className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Get APK / EXE
                  </button>
                </div>
              </div>

              <form onSubmit={handleTicketSubmit} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3.5 text-xs">
                <div>
                  <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
                    <HelpCircle className="w-4 h-4 text-[#009E4D]" />
                    Customer Feedback, Complaints &amp; Support
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    Share your feedback, report a ride or fare issue, or message SafarGo Admin directly.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">Select Type</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SUPPORT_CATEGORIES.map((cat) => {
                      const active = ticketForm.category === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setTicketForm({ ...ticketForm, category: cat.id })}
                          className={`px-3 py-1.5 rounded-xl font-bold border transition ${
                            active
                              ? 'bg-[#009E4D] text-white border-[#009E4D]'
                              : 'bg-slate-50/80 text-slate-700 border-slate-200/80 hover:border-emerald-300'
                          }`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {bookings.length > 0 && (
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Related Ride (Optional)</label>
                    <select
                      value={ticketForm.booking_id}
                      onChange={(e) => setTicketForm({ ...ticketForm, booking_id: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 font-medium"
                    >
                      <option value="">General Feedback / Not tied to a ride</option>
                      {bookings.slice(0, 20).map((b) => (
                        <option key={b.id} value={String(b.id)}>
                          {b.booking_code} · {b.pickup_zone} → {b.drop_zone} (Rs. {b.final_fare})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Subject</label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    placeholder="Subject (e.g. App feedback, overcharge check, lost item)"
                    value={ticketForm.subject}
                    onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Your Feedback or Issue Details</label>
                  <textarea
                    rows={3}
                    required
                    minLength={5}
                    placeholder={activeCategoryMeta.placeholder || 'Write your feedback or complaint details...'}
                    value={ticketForm.message}
                    onChange={(e) => setTicketForm({ ...ticketForm, message: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
                  />
                </div>

                {ticketSubmittedMsg && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[#008741] font-bold">
                    {ticketSubmittedMsg}
                  </div>
                )}

                <button type="submit" className="px-4 py-2.5 rounded-xl bg-[#009E4D] hover:bg-[#008741] text-white font-bold transition">
                  Send Feedback / Complaint to Admin
                </button>
              </form>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">My Feedback &amp; Support History</span>
                  <span className="text-[11px] text-slate-500 mono-num">{tickets.length} submitted</span>
                </div>
                {tickets.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/60 text-center text-slate-500">
                    No feedback or complaints yet. Any message you send appears here with live Admin replies.
                  </div>
                ) : (
                  tickets.map((t) => {
                    const catMeta = getSupportCategoryMeta(t.category);
                    return (
                      <div key={t.id} className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${catMeta.badgeClass}`}>
                              {catMeta.label}
                            </span>
                            {t.booking_code && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white border border-slate-200 text-slate-700 mono-num">
                                {t.booking_code}
                              </span>
                            )}
                          </div>
                          <StatusBadge value={t.status} />
                        </div>
                        <div className="font-bold text-slate-900">{t.subject}</div>
                        <p className="text-slate-600">{t.message}</p>
                        {t.created_at && (
                          <div className="text-[11px] text-slate-400 mono-num">
                            Sent: {new Date(t.created_at).toLocaleString()}
                          </div>
                        )}
                        {t.admin_reply && (
                          <div className="mt-1 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200/80 text-[#008741] font-semibold">
                            SafarGo Admin Reply: {t.admin_reply}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}
      </main>

      <EmergencySosModal
        isOpen={sosModalOpen}
        onClose={() => setSosModalOpen(false)}
        role="customer"
        settings={bootstrap?.settings || {}}
        activeBooking={activeRides[0] || null}
        fallbackCoords={pickupLat != null ? { lat: pickupLat, lng: pickupLng, zone_name: pickupZone } : null}
        mySosHistory={mySosHistory}
        onTriggered={() => loadBookings()}
      />

      {/* Bottom Mobile Navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200/80 no-print">
        <div className="max-w-3xl mx-auto grid grid-cols-4">
          {[
            { id: 'book', label: 'Book', icon: Bike },
            { id: 'rides', label: 'My Rides', icon: CheckCircle2 },
            { id: 'payments', label: 'Payments', icon: CreditCard },
            { id: 'support', label: 'Support', icon: MessageSquare, badge: unreadRepliesCount },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`relative py-2.5 flex flex-col items-center gap-1 text-xs font-bold border-t-2 transition ${
                  active ? 'border-[#009E4D] text-[#009E4D]' : 'border-transparent text-slate-500'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className="absolute top-1.5 right-6 px-1.5 rounded-full bg-[#009E4D] text-white text-[10px] font-extrabold mono-num">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
