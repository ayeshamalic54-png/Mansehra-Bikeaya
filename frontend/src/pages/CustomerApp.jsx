import React, { useEffect, useState } from 'react';
import {
  Bike,
  Car,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  HelpCircle,
  LogOut,
  MapPin,
  Menu,
  Package,
  Phone,
  Printer,
  ShoppingBag,
  Star,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../components/BrandLogo';
import { StatusBadge } from '../components/StatusBadge';
import { ZoneOptions } from '../components/ZoneOptions';
import { resolveSmartRoute } from '../utils/zones';

export function CustomerApp({ onOpenDownloads }) {
  const { user, bootstrap, logout } = useAuth();
  const [tab, setTab] = useState('book'); // book | rides | payments | menu
  const [rideFilter, setRideFilter] = useState('active'); // active | completed | cancelled

  // Booking form state
  const [serviceType, setServiceType] = useState('bike_ride');
  const [pickupZone, setPickupZone] = useState(bootstrap.zones?.[0]?.name || 'Main Bazar / Lari Adda');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropZone, setDropZone] = useState(bootstrap.zones?.[2]?.name || 'Ghazikot Township');
  const [dropAddress, setDropAddress] = useState('');
  const [distanceKm, setDistanceKm] = useState(4.0);
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const syncDistanceForZones = (nextPickup, nextDrop) => {
    const { distanceKm: nextKm, suggestedService } = resolveSmartRoute(
      bootstrap.zones,
      nextPickup,
      nextDrop,
      distanceKm,
      serviceType
    );
    if (nextKm !== null) setDistanceKm(nextKm);
    if (suggestedService) setServiceType(suggestedService);
  };
  const [promoCode, setPromoCode] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [codAmount, setCodAmount] = useState(0);
  const [customerNotes, setCustomerNotes] = useState('');

  const [estimate, setEstimate] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [bookings, setBookings] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [ticketForm, setTicketForm] = useState({ subject: '', message: '' });
  const [statusMsg, setStatusMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Rating modal inline state
  const [ratingTargetId, setRatingTargetId] = useState(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState('');

  const loadBookings = async () => {
    try {
      const data = await apiRequest('/api/bookings/my');
      setBookings(data);
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
    const timer = setInterval(loadBookings, 6000);
    return () => clearInterval(timer);
  }, []);

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
    setErrMsg('');
    setStatusMsg('');
    setBusy(true);
    try {
      const created = await apiRequest('/api/bookings', {
        method: 'POST',
        body: {
          service_type: serviceType,
          pickup_zone: pickupZone,
          pickup_address: pickupAddress,
          drop_zone: dropZone,
          drop_address: dropAddress,
          distance_km: Number(distanceKm),
          payment_method: paymentMethod,
          promo_code: promoCode.trim() || null,
          receiver_name: serviceType === 'parcel' ? receiverName || null : null,
          receiver_phone: serviceType === 'parcel' ? receiverPhone || null : null,
          cod_amount: serviceType === 'parcel' ? Number(codAmount || 0) : 0,
          customer_notes: customerNotes || null,
        },
      });
      setStatusMsg(`Booking ${created.booking_code} confirmed! Finding nearest Bikeaya captain...`);
      setPickupAddress('');
      setDropAddress('');
      setPromoCode('');
      setCustomerNotes('');
      await loadBookings();
      setTab('rides');
      setRideFilter('active');
    } catch (err) {
      setErrMsg(err.message);
    } finally {
      setBusy(false);
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

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/support/tickets', {
        method: 'POST',
        body: { subject: ticketForm.subject, message: ticketForm.message, category: 'customer' },
      });
      setTicketForm({ subject: '', message: '' });
      setStatusMsg('Support ticket submitted to Bikeaya Admin.');
      await loadTickets();
    } catch (err) {
      setErrMsg(err.message);
    }
  };

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

  return (
    <div className="min-h-screen pb-24">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200/80 no-print">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <BrandLogo subtitle={`Hi, ${user?.full_name?.split(' ')[0]}`} />
          <div className="flex items-center gap-2">
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

            {/* Pickup & Drop Card */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Pickup City / Area</label>
                  <select
                    value={pickupZone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPickupZone(val);
                      syncDistanceForZones(val, dropZone);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 font-semibold"
                  >
                    <ZoneOptions zones={bootstrap.zones} />
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Pickup Landmark / Street</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Near Lari Adda Gate 1"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Drop City / Area</label>
                  <select
                    value={dropZone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDropZone(val);
                      syncDistanceForZones(pickupZone, val);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 font-semibold"
                  >
                    <ZoneOptions zones={bootstrap.zones} />
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Drop Exact Address</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sector B House 12"
                    value={dropAddress}
                    onChange={(e) => setDropAddress(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>Approximate Route Distance</span>
                  <span className="mono-num text-[#009E4D]">{distanceKm} km</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="150"
                  step="1"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(Number(e.target.value))}
                  className="w-full accent-[#009E4D]"
                />
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
                    <option value="cash">Cash to Motorbike Rider</option>
                    <option value="easypaisa">EasyPaisa (to Admin Source)</option>
                    <option value="jazzcash">JazzCash (to Admin Source)</option>
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

              <input
                type="text"
                placeholder="Instructions for captain (optional)"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
              />
            </div>

            {/* Fare & Submit Box */}
            <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="text-xs text-slate-400">Guaranteed Total Fare</div>
                <div className="text-3xl font-extrabold mono-num text-[#009E4D]">
                  Rs. {estimate?.estimated_fare ?? fallbackFare}
                </div>
                {estimate?.discount_amount > 0 && (
                  <div className="text-xs text-teal-600 font-semibold">
                    Promo saved Rs. {estimate.discount_amount}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={busy}
                className="px-6 py-3.5 rounded-2xl text-sm font-extrabold bg-[#009E4D] hover:bg-[#008741] text-white shadow-lg transition disabled:opacity-60"
              >
                {busy ? 'Dispatching...' : 'Confirm & Find Motorbike Rider'}
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

                  {/* Assigned Captain Box */}
                  {b.rider ? (
                    <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{b.rider.full_name}</div>
                        <div className="text-slate-500 mono-num">
                          {b.rider.bike_model} · {b.rider.bike_plate} · ★ {b.rider.rating_avg}
                        </div>
                      </div>
                      <a
                        href={`tel:${b.rider.phone}`}
                        className="px-3 py-2 rounded-xl bg-[#009E4D] text-white font-bold inline-flex items-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Call
                      </a>
                    </div>
                  ) : (
                    b.status === 'pending' && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-semibold flex items-center gap-2">
                        <Clock className="w-4 h-4 animate-spin" />
                        Broadcasting to nearby Bike &amp; Car captains...
                      </div>
                    )
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="mono-num font-extrabold text-sm text-slate-900">
                      Fare: Rs. {b.final_fare} <span className="font-normal text-slate-500">({b.payment_method})</span>
                    </div>
                    <div className="flex items-center gap-2">
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
                    </div>
                  </div>

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

            <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100">
              {completedRides.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">No completed receipts yet.</div>
              ) : (
                completedRides.map((b) => (
                  <div key={b.id} className="p-4 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold mono-num text-slate-900">{b.booking_code} · {b.service_type}</div>
                      <div className="text-slate-500">{b.pickup_zone} → {b.drop_zone}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold mono-num text-sm text-[#009E4D]">Rs. {b.final_fare}</div>
                      <div className="text-slate-500 uppercase">{b.payment_method}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: MENU & SUPPORT */}
        {tab === 'menu' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <div className="text-base font-extrabold text-slate-900">{user?.full_name}</div>
                <div className="text-xs text-slate-500 mono-num">{user?.phone} · Customer Account</div>
              </div>
              <button
                onClick={onOpenDownloads}
                className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Get APK / EXE
              </button>
            </div>

            <form onSubmit={handleTicketSubmit} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 text-xs">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <HelpCircle className="w-4 h-4 text-[#009E4D]" />
                Complaint &amp; Support Desk
              </div>
              <input
                type="text"
                required
                placeholder="Subject (e.g. Fare question or lost item)"
                value={ticketForm.subject}
                onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
              />
              <textarea
                rows={3}
                required
                placeholder="Describe your issue..."
                value={ticketForm.message}
                onChange={(e) => setTicketForm({ ...ticketForm, message: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80"
              />
              <button type="submit" className="px-4 py-2.5 rounded-xl bg-[#009E4D] text-white font-bold">
                Send to Admin Support
              </button>
            </form>

            {tickets.length > 0 && (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5 text-xs">
                <div className="font-bold text-slate-900">My Support Tickets</div>
                {tickets.map((t) => (
                  <div key={t.id} className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>{t.subject}</span>
                      <StatusBadge value={t.status} />
                    </div>
                    <p className="text-slate-600">{t.message}</p>
                    {t.admin_reply && (
                      <div className="mt-1 p-2 rounded-lg bg-emerald-50 text-[#008741] font-semibold">
                        Admin Reply: {t.admin_reply}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Mobile Navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200/80 no-print">
        <div className="max-w-3xl mx-auto grid grid-cols-4">
          {[
            { id: 'book', label: 'Book', icon: Bike },
            { id: 'rides', label: 'My Rides', icon: CheckCircle2 },
            { id: 'payments', label: 'Payments', icon: CreditCard },
            { id: 'menu', label: 'Menu', icon: Menu },
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
