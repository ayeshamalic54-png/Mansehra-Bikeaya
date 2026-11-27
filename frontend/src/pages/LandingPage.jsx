import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bike,
  Calculator,
  Car,
  Clock,
  Download,
  HelpCircle,
  MapPin,
  MessageSquare,
  Monitor,
  Package,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../components/BrandLogo';
import { InteractiveRoutePicker } from '../components/InteractiveRoutePicker';

export function LandingPage({ onNavigate }) {
  const { bootstrap } = useAuth();
  const [serviceType, setServiceType] = useState('bike_ride');
  const [pickupZone, setPickupZone] = useState('Mansehra — Punjab Chowk');
  const [dropZone, setDropZone] = useState('Mansehra — Pakhwal Chowk');
  const [pickupText, setPickupText] = useState('Punjab Chowk, Mansehra');
  const [dropText, setDropText] = useState('Pakhwal Chowk, Mansehra');
  const [pickupLat, setPickupLat] = useState(34.328548);
  const [pickupLng, setPickupLng] = useState(73.188513);
  const [dropLat, setDropLat] = useState(34.323885);
  const [dropLng, setDropLng] = useState(73.194572);
  const [nearbyCaptains, setNearbyCaptains] = useState([]);
  const [distanceKm, setDistanceKm] = useState(2.3);
  const [waitMinutes, setWaitMinutes] = useState(0);
  const [estimate, setEstimate] = useState(null);

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
        // ignore nearby fetch errors
      }
    };
    loadNearby();
    const timer = setInterval(loadNearby, 12000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pickupLat, pickupLng, serviceType]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiRequest('/api/public/estimate', {
          method: 'POST',
          auth: false,
          body: {
            service_type: serviceType,
            pickup_zone: pickupZone,
            drop_zone: dropZone,
            distance_km: Number(distanceKm) || 3,
            wait_minutes: Number(waitMinutes) || 0,
          },
        });
        if (active) setEstimate(res);
      } catch {
        // ignore preview fetch error before seed
      }
    })();
    return () => {
      active = false;
    };
  }, [serviceType, pickupZone, dropZone, distanceKm, waitMinutes]);

  const services = [
    {
      id: 'bike_ride',
      title: 'Bike Ride (Sawari)',
      desc: 'Beat daily traffic with verified motorbike captains in minutes.',
      icon: Bike,
    },
    {
      id: 'car_ride',
      title: 'Car Ride (Intercity)',
      desc: 'Comfortable AC cars for city travel, Abbottabad, Haripur, Battagram & Islamabad Airport.',
      icon: Car,
    },
    {
      id: 'parcel',
      title: 'Parcel & COD Delivery',
      desc: 'Send documents, shop parcels, or medicines quickly across city and intercity routes.',
      icon: Package,
    },
    {
      id: 'errand',
      title: 'Bazaar Errand',
      desc: 'Need groceries or pharmacy items picked up and delivered to your doorstep?',
      icon: ShoppingBag,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky Navbar */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <BrandLogo subtitle="Bikes · Cars · Parcels · Intercity" />
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => onNavigate('auth')}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100/70 transition"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#009E4D]" />
              Feedback &amp; Support
            </button>
            <button
              onClick={() => onNavigate('downloads')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200/80 hover:bg-slate-200/70 transition"
            >
              <Download className="w-3.5 h-3.5 text-[#009E4D]" />
              <span className="sm:hidden">App</span>
              <span className="hidden sm:inline">Install App / APK</span>
            </button>
            <button
              onClick={() => onNavigate('auth')}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#009E4D] hover:bg-[#008741] shadow-sm transition"
            >
              Login / Book Ride
            </button>
          </div>
        </div>
      </header>

      {/* Hero + Interactive Fare Estimator */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-[#008741] text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-[#009E4D] animate-pulse" />
              Active Across Cities · Abbottabad · Mansehra · Haripur · Battagram · Islamabad Airport
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
              Fast Bikes,{' '}
              <span className="text-[#009E4D]">Comfortable Cars</span>{' '}
              &amp; Express Parcels.
            </h1>

            <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
              Book verified motorbike riders or AC cars in seconds for local &amp; intercity travel, send urgent parcels across hubs, and track transparent settlements from one platform.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => onNavigate('auth')}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold text-white bg-[#009E4D] hover:bg-[#008741] shadow-lg shadow-emerald-900/15 transition"
              >
                Book a Ride Now
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onNavigate('auth')}
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-bold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 transition"
              >
                Captain / Admin Login
              </button>
              <button
                onClick={() => onNavigate('downloads')}
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                Download App (.apk / .exe)
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 max-w-lg text-xs">
              <div className="card-elevated rounded-2xl p-3.5">
                <div className="font-extrabold text-slate-900 text-base mono-num">Rs. 100+</div>
                <div className="text-slate-500 mt-0.5">Bike Base · Car Rs.150+</div>
              </div>
              <div className="card-elevated rounded-2xl p-3.5">
                <div className="font-extrabold text-[#009E4D] text-base">Verified</div>
                <div className="text-slate-500 mt-0.5">CNIC &amp; Bike Plate</div>
              </div>
              <div className="card-elevated rounded-2xl p-3.5">
                <div className="font-extrabold text-teal-700 text-base">Live Ledger</div>
                <div className="text-slate-500 mt-0.5">Transparent Ledger</div>
              </div>
            </div>
          </div>

          {/* Live Fare Calculator Card */}
          <div className="lg:col-span-5">
            <div className="card-elevated rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl bg-emerald-50 text-[#009E4D] flex items-center justify-center">
                    <Calculator className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="text-sm font-bold text-slate-900">Instant Fare Check</div>
                    <div className="text-xs text-slate-500">Live city &amp; intercity tariff calculator</div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200/70">
                  City &amp; Intercity
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ['bike_ride', 'Bike Ride'],
                  ['car_ride', 'Car Ride'],
                  ['parcel', 'Parcel'],
                  ['errand', 'Errand'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setServiceType(id)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition ${
                      serviceType === id
                        ? 'bg-[#009E4D] text-white border-[#009E4D]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-3 text-xs">
                <InteractiveRoutePicker
                  zones={bootstrap.zones}
                  pickupLat={pickupLat}
                  pickupLng={pickupLng}
                  pickupText={pickupText}
                  dropLat={dropLat}
                  dropLng={dropLng}
                  dropText={dropText}
                  nearbyCaptains={nearbyCaptains}
                  heightClass="h-44 sm:h-48"
                  autoLocate={false}
                  onSelectPoint={({ type, lat, lng, address, nearestZoneName }) => {
                    if (type === 'pickup') {
                      setPickupLat(lat);
                      setPickupLng(lng);
                      if (address) setPickupText(address);
                      if (nearestZoneName) setPickupZone(nearestZoneName);
                    } else {
                      setDropLat(lat);
                      setDropLng(lng);
                      if (address) setDropText(address);
                      if (nearestZoneName) setDropZone(nearestZoneName);
                    }
                  }}
                  onTextChange={(type, val) => {
                    if (type === 'pickup') setPickupText(val);
                    else setDropText(val);
                  }}
                  onRouteResult={({ distanceKm: roadKm }) => {
                    if (roadKm) setDistanceKm(roadKm);
                  }}
                />

                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 font-semibold text-slate-700">
                  <span>Calculated Road Distance</span>
                  <span className="mono-num font-extrabold text-[#009E4D]">{distanceKm} km</span>
                </div>

                <div>
                  <div className="flex items-center justify-between font-semibold text-slate-600 mb-1">
                    <span>Customer Late Wait (Free {estimate?.wait_free_minutes ?? 5}m, then Rs.{estimate?.wait_charge_per_min ?? 10}/m)</span>
                    <span className="mono-num text-slate-900">{waitMinutes} min</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[0, 5, 8, 12].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setWaitMinutes(m)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                          Number(waitMinutes) === m
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {m === 0 ? 'On time' : `${m} min`}
                      </button>
                    ))}
                    <input
                      type="number"
                      min="0"
                      max="180"
                      value={waitMinutes}
                      onChange={(e) => setWaitMinutes(Math.max(0, Number(e.target.value) || 0))}
                      className="w-16 ml-auto px-2 py-1 rounded-lg border border-slate-200 bg-slate-50/80 text-right mono-num font-bold"
                    />
                  </div>
                </div>
              </div>

              {estimate && (
                <div className="rounded-2xl bg-slate-900 text-white p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-400">Estimated Total Fare</div>
                      <div className="text-2xl font-extrabold mono-num text-emerald-400">
                        Rs. {estimate.estimated_fare}
                      </div>
                    </div>
                    <button
                      onClick={() => onNavigate('auth')}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#009E4D] hover:bg-[#008741] text-white transition"
                    >
                      Book This Ride →
                    </button>
                  </div>
                  {(estimate.city_slab_applied || estimate.wait_charge > 0) && (
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800 text-[11px]">
                      {estimate.city_slab_applied && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                          Mansehra City Slab: Rs.{estimate.city_flat_fare} / {estimate.city_flat_km}km + Rs.{estimate.per_km_rate}/km
                        </span>
                      )}
                      {estimate.wait_charge > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                          +{estimate.billable_wait_minutes}m late wait fee: Rs.{estimate.wait_charge}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Service Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {services.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.id} className="card-elevated rounded-2xl p-6 space-y-3 hover:border-emerald-200 transition">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#009E4D] flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{s.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
              </div>
            );
          })}
        </section>

        {/* Download App Strip */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 shadow-xl shadow-slate-900/10">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              Official Android APK &amp; Windows Desktop Installer
            </div>
            <h2 className="text-2xl font-extrabold">Take SafarGo Everywhere</h2>
            <p className="text-sm text-slate-300">
              Download the Android APK for customers &amp; captains or the Windows Desktop EXE for your central dispatch and accounting office.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('downloads')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold bg-[#009E4D] hover:bg-[#008741] text-white transition"
            >
              <Smartphone className="w-4 h-4" />
              Android (.apk)
            </button>
            <button
              onClick={() => onNavigate('downloads')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold bg-white/10 hover:bg-white/20 border border-white/15 text-white transition"
            >
              <Monitor className="w-4 h-4 text-emerald-300" />
              Windows (.exe)
            </button>
          </div>
        </section>

        {/* Customer Complaint, Feedback & Support Section */}
        <section className="card-elevated rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 border border-emerald-200/70 bg-emerald-50/40">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#008741]">
              <HelpCircle className="w-4 h-4" />
              Customer Care, Feedback &amp; Complaints
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Share Feedback or Report a Ride Issue
            </h2>
            <p className="text-sm text-slate-600">
              Your feedback helps SafarGo improve across every city. Sign in to submit ride complaints, fare checks, lost-item reports, or suggestions directly to Admin Support and receive replies in your app.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {bootstrap.settings?.support_phone && (
              <a
                href={`tel:${bootstrap.settings.support_phone}`}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 transition mono-num"
              >
                <Phone className="w-4 h-4 text-[#009E4D]" />
                {bootstrap.settings.support_phone}
              </a>
            )}
            <button
              onClick={() => onNavigate('auth')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold bg-[#009E4D] hover:bg-[#008741] text-white transition shadow-sm"
            >
              <MessageSquare className="w-4 h-4" />
              Submit Feedback / Complaint
            </button>
          </div>
        </section>
      </main>

      {/* Branded Office Address, Phone, WhatsApp & Footer */}
      {(() => {
        const s = bootstrap.settings || {};
        const officeAddress = s.office_address || 'Main Bazar / Shahrah-e-Resham, Mansehra, KPK';
        const phoneNum = s.support_phone || '+92 300 1111111';
        const waRaw = s.support_whatsapp || phoneNum;
        const waDigits = waRaw.replace(/\D+/g, '').replace(/^0/, '92');
        const officeHours = s.office_hours || '24/7 Dispatch · 8:00 AM – 11:00 PM Office';
        const brandName = s.business_name || 'SafarGo';
        return (
          <footer className="mt-12 bg-slate-950 text-slate-300 border-t border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-4 space-y-2.5">
                  <BrandLogo dark={true} subtitle="Bikes · Cars · Parcels · Intercity" size="sm" />
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm">
                    Fast Motorbikes, Comfortable AC Cars &amp; Express Parcel Delivery across Mansehra, Abbottabad, Haripur, Battagram &amp; Islamabad Airport.
                  </p>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{officeHours}</span>
                  </div>
                </div>

                <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                  <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-1.5 hover:border-emerald-500/40 transition">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span>Head Office Address</span>
                    </div>
                    <div className="text-sm font-semibold text-white leading-snug">{officeAddress}</div>
                    <div className="text-[11px] text-slate-400">{s.city || 'Hazara & Intercity'}</div>
                  </div>

                  <a
                    href={`tel:${phoneNum}`}
                    className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-1.5 hover:border-emerald-500/40 transition block"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                      <Phone className="w-4 h-4 shrink-0" />
                      <span>Call Dispatch Helpline</span>
                    </div>
                    <div className="text-sm font-extrabold text-white mono-num">{phoneNum}</div>
                    <div className="text-[11px] text-slate-400">Tap to call directly</div>
                  </a>

                  <a
                    href={waDigits ? `https://wa.me/${waDigits}` : `tel:${phoneNum}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-1.5 hover:border-emerald-500/40 transition block"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                      <MessageSquare className="w-4 h-4 shrink-0" />
                      <span>WhatsApp Support &amp; Booking</span>
                    </div>
                    <div className="text-sm font-extrabold text-white mono-num">{waRaw}</div>
                    <div className="text-[11px] text-slate-400">Chat on WhatsApp anytime</div>
                  </a>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[11px] text-slate-400">
                <span>
                  &copy; {new Date().getFullYear()} {brandName}. All rights reserved.
                </span>
                <div className="flex flex-wrap items-center gap-4 font-semibold">
                  <button onClick={() => onNavigate('auth')} className="hover:text-emerald-400 transition">
                    Book Ride / Login
                  </button>
                  <button onClick={() => onNavigate('downloads')} className="hover:text-emerald-400 transition">
                    Download APK / EXE
                  </button>
                  <button onClick={() => onNavigate('auth')} className="hover:text-emerald-400 transition">
                    Customer Feedback &amp; Support
                  </button>
                </div>
              </div>
            </div>
          </footer>
        );
      })()}
    </div>
  );
}
