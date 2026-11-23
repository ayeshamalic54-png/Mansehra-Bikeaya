import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bike,
  Calculator,
  CheckCircle2,
  Download,
  MapPin,
  Monitor,
  Package,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../components/BrandLogo';

export function LandingPage({ onNavigate }) {
  const { bootstrap } = useAuth();
  const [serviceType, setServiceType] = useState('bike_ride');
  const [pickupZone, setPickupZone] = useState('Main Bazar / Lari Adda');
  const [dropZone, setDropZone] = useState('Ghazikot Township');
  const [distanceKm, setDistanceKm] = useState(4);
  const [estimate, setEstimate] = useState(null);

  useEffect(() => {
    if (bootstrap.zones?.length >= 2) {
      setPickupZone((prev) => prev || bootstrap.zones[0].name);
      setDropZone((prev) => prev || bootstrap.zones[2]?.name || bootstrap.zones[1].name);
    }
  }, [bootstrap.zones]);

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
  }, [serviceType, pickupZone, dropZone, distanceKm]);

  const services = [
    {
      id: 'bike_ride',
      title: 'Bike Ride (Sawari)',
      desc: 'Beat Mansehra traffic with verified local motorbike captains in minutes.',
      icon: Bike,
    },
    {
      id: 'parcel',
      title: 'Parcel & COD Delivery',
      desc: 'Send documents, shop parcels, or medicines anywhere from Lari Adda to Baffa.',
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
    <div className="min-h-screen flex flex-col bg-[#F4F6FB]">
      {/* Sticky Navbar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#E6E9F2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <BrandLogo subtitle="Mansehra Ride & Parcel Network" />
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => onNavigate('downloads')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[#9C1794] bg-fuchsia-50 border border-fuchsia-200 hover:bg-fuchsia-100 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Get APK / EXE
            </button>
            <button
              onClick={() => onNavigate('auth')}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#00A651] hover:bg-[#008E46] shadow-sm transition"
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
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#008E46] text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-[#00A651] animate-pulse" />
              Live in Mansehra · Ghazikot · Shinkiari Rd · Hazara University
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
              Fast Motorbike Rides &amp; Parcels Across{' '}
              <span className="text-[#00A651]">Mansehra</span>.
            </h1>

            <p className="text-base sm:text-lg text-slate-600 max-w-2xl">
              Book verified local bike riders in seconds, track every parcel delivery, and manage transparent rider settlements &amp; profit reports from one unified command platform.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => onNavigate('auth')}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold text-white bg-[#00A651] hover:bg-[#008E46] shadow-lg shadow-[#00A651]/20 transition"
              >
                Book Motorbike Now
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onNavigate('auth')}
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-bold text-slate-800 bg-white border border-[#E6E9F2] hover:bg-slate-50 transition"
              >
                Captain / Admin Login
              </button>
              <button
                onClick={() => onNavigate('downloads')}
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition"
              >
                <Download className="w-4 h-4 text-[#EC1FA8]" />
                Download App (.apk / .exe)
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 max-w-lg text-xs">
              <div className="bg-white border border-[#E6E9F2] rounded-xl p-3">
                <div className="font-extrabold text-slate-900 text-base mono-num">Rs. 80+</div>
                <div className="text-slate-500 mt-0.5">City Base Rides</div>
              </div>
              <div className="bg-white border border-[#E6E9F2] rounded-xl p-3">
                <div className="font-extrabold text-[#00A651] text-base">Verified</div>
                <div className="text-slate-500 mt-0.5">CNIC &amp; Bike Plate</div>
              </div>
              <div className="bg-white border border-[#E6E9F2] rounded-xl p-3">
                <div className="font-extrabold text-[#EC1FA8] text-base">Live Hisab</div>
                <div className="text-slate-500 mt-0.5">Transparent Ledger</div>
              </div>
            </div>
          </div>

          {/* Live Fare Calculator Card */}
          <div className="lg:col-span-5">
            <div className="bg-white border border-[#E6E9F2] rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-900/5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#EEF1F7] pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-emerald-50 text-[#00A651] flex items-center justify-center">
                    <Calculator className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="text-sm font-bold text-slate-900">Instant Fare Check</div>
                    <div className="text-xs text-slate-500">Live Mansehra tariff calculator</div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-fuchsia-50 text-[#9C1794]">
                  Promo: MANSEHRA20
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  ['bike_ride', 'Bike Ride'],
                  ['parcel', 'Parcel'],
                  ['errand', 'Errand'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setServiceType(id)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition ${
                      serviceType === id
                        ? 'bg-[#00A651] text-white border-[#00A651]'
                        : 'bg-[#F4F6FB] text-slate-700 border-[#E6E9F2] hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Pickup Zone</label>
                  <select
                    value={pickupZone}
                    onChange={(e) => setPickupZone(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB] font-semibold"
                  >
                    {bootstrap.zones.map((z) => (
                      <option key={z.id} value={z.name}>
                        {z.name} ({z.area_tag})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Drop Zone</label>
                  <select
                    value={dropZone}
                    onChange={(e) => setDropZone(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB] font-semibold"
                  >
                    {bootstrap.zones.map((z) => (
                      <option key={z.id} value={z.name}>
                        {z.name} ({z.area_tag})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between font-semibold text-slate-600 mb-1">
                    <span>Estimated Distance</span>
                    <span className="mono-num text-slate-900">{distanceKm} km</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="25"
                    step="0.5"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(Number(e.target.value))}
                    className="w-full accent-[#00A651]"
                  />
                </div>
              </div>

              {estimate && (
                <div className="rounded-2xl bg-slate-900 text-white p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Estimated Total Fare</div>
                    <div className="text-2xl font-extrabold mono-num text-[#00A651]">
                      Rs. {estimate.estimated_fare}
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate('auth')}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#00A651] hover:bg-[#008E46] text-white transition"
                  >
                    Book This Ride →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Service Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {services.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.id} className="bg-white border border-[#E6E9F2] rounded-2xl p-6 space-y-3 hover:shadow-md transition">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#00A651] flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{s.title}</h3>
                <p className="text-sm text-slate-600">{s.desc}</p>
              </div>
            );
          })}
        </section>

        {/* Download App Strip */}
        <section className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#EC1FA8]">
              <ShieldCheck className="w-4 h-4" />
              Installable Web App + Upcoming APK &amp; EXE Packages
            </div>
            <h2 className="text-2xl font-extrabold">Take Mansehra Bikeaya Everywhere</h2>
            <p className="text-sm text-slate-300">
              Download the Android APK for customers &amp; captains or the Windows Desktop EXE for your central dispatch and accounting office.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('downloads')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold bg-[#00A651] hover:bg-[#008E46] text-white transition"
            >
              <Smartphone className="w-4 h-4" />
              Android (.apk)
            </button>
            <button
              onClick={() => onNavigate('downloads')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold bg-[#EC1FA8] hover:opacity-90 text-white transition"
            >
              <Monitor className="w-4 h-4" />
              Windows (.exe)
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
