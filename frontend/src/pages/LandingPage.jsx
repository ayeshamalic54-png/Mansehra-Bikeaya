import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bike,
  Calculator,
  Car,
  Download,
  Monitor,
  Package,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../components/BrandLogo';
import { ZoneOptions } from '../components/ZoneOptions';
import { resolveSmartRoute } from '../utils/zones';

export function LandingPage({ onNavigate }) {
  const { bootstrap } = useAuth();
  const [serviceType, setServiceType] = useState('bike_ride');
  const [pickupZone, setPickupZone] = useState('Main Bazar / Lari Adda');
  const [dropZone, setDropZone] = useState('Ghazikot Township');
  const [distanceKm, setDistanceKm] = useState(4);
  const [estimate, setEstimate] = useState(null);

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
              onClick={() => onNavigate('downloads')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200/80 hover:bg-slate-200/70 transition"
            >
              <Download className="w-3.5 h-3.5 text-[#009E4D]" />
              Get APK / EXE
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
                <div className="font-extrabold text-slate-900 text-base mono-num">Rs. 80+</div>
                <div className="text-slate-500 mt-0.5">City Base Rides</div>
              </div>
              <div className="card-elevated rounded-2xl p-3.5">
                <div className="font-extrabold text-[#009E4D] text-base">Verified</div>
                <div className="text-slate-500 mt-0.5">CNIC &amp; Bike Plate</div>
              </div>
              <div className="card-elevated rounded-2xl p-3.5">
                <div className="font-extrabold text-teal-700 text-base">Live Hisab</div>
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
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Pickup City / Zone</label>
                  <select
                    value={pickupZone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPickupZone(val);
                      syncDistanceForZones(val, dropZone);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/80 font-semibold focus:bg-white focus:outline-none focus:border-[#009E4D]"
                  >
                    <ZoneOptions zones={bootstrap.zones} />
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Drop City / Zone</label>
                  <select
                    value={dropZone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDropZone(val);
                      syncDistanceForZones(pickupZone, val);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/80 font-semibold focus:bg-white focus:outline-none focus:border-[#009E4D]"
                  >
                    <ZoneOptions zones={bootstrap.zones} />
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
                    max="150"
                    step="1"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(Number(e.target.value))}
                    className="w-full accent-[#009E4D]"
                  />
                </div>
              </div>

              {estimate && (
                <div className="rounded-2xl bg-slate-900 text-white p-4 flex items-center justify-between">
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
            <h2 className="text-2xl font-extrabold">Take Bikeaya Everywhere</h2>
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
      </main>
    </div>
  );
}
