import React, { useEffect, useRef, useState } from 'react';
import { LocateFixed, MapPin, Navigation, X } from 'lucide-react';
import { SafarGoMap } from './SafarGoMap';
import {
  TOP_MANSEHRA_QUICK_SPOTS,
  fetchRoadRoute,
  findNearestZone,
  reverseGeocode,
  searchPakistanPlaces,
} from '../utils/geo';
import { getReliableDevicePosition } from '../utils/deviceGps';

/**
 * Pure InDrive-style Pickup & Drop Map Widget:
 * - Zero unwanted GPS jumps on load: GPS pins only when user taps "Use GPS".
 * - Instant Mansehra Chowks & Roads autocomplete + explicit Tap-Map mode switcher.
 */
export function InteractiveRoutePicker({
  zones = [],
  pickupLat,
  pickupLng,
  pickupText = '',
  dropLat,
  dropLng,
  dropText = '',
  nearbyCaptains = [],
  onSelectPoint,
  onTextChange,
  onRouteResult,
  heightClass = 'h-60 sm:h-64',
  autoLocate = false,
}) {
  const [activeField, setActiveField] = useState('drop'); // 'pickup' | 'drop' (tapping map sets active field!)
  const [pickupQuery, setPickupQuery] = useState(pickupText);
  const [dropQuery, setDropQuery] = useState(dropText);
  const [focusedField, setFocusedField] = useState(null); // 'pickup' | 'drop' | null
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('');
  const [routeCoords, setRouteCoords] = useState(null);
  const [routeSource, setRouteSource] = useState('estimate');
  const [routeDuration, setRouteDuration] = useState(null);
  const autoLocatedOnce = useRef(false);
  const pickerBoxRef = useRef(null);

  useEffect(() => {
    const onDocDown = (ev) => {
      if (pickerBoxRef.current && !pickerBoxRef.current.contains(ev.target)) {
        setFocusedField(null);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  // Sync external address updates (e.g., when GPS resolves or pin is dragged)
  useEffect(() => {
    setPickupQuery(pickupText);
  }, [pickupText]);

  useEffect(() => {
    setDropQuery(dropText);
  }, [dropText]);

  // Calculate driving route & km whenever Pickup or Drop coordinates move
  useEffect(() => {
    if (pickupLat == null || pickupLng == null || dropLat == null || dropLng == null) return;
    const controller = new AbortController();
    (async () => {
      const res = await fetchRoadRoute(pickupLat, pickupLng, dropLat, dropLng, controller.signal);
      if (controller.signal.aborted) return;
      setRouteCoords(res.coords);
      setRouteSource(res.source);
      setRouteDuration(res.durationMin);
      onRouteResult?.(res);
    })();
    return () => controller.abort();
  }, [pickupLat, pickupLng, dropLat, dropLng]);

  const handlePinPick = async (which, lat, lng) => {
    const nearest = findNearestZone(lat, lng, zones);
    const rev = await reverseGeocode(lat, lng);
    const label = rev || nearest?.name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    onSelectPoint?.({
      type: which,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      address: label,
      nearestZoneName: nearest?.name || null,
    });
  };

  const locateCurrentCustomer = async (silentIfDenied = false) => {
    setLocating(true);
    if (!silentIfDenied) setGpsStatus('Detecting location...');
    try {
      const pos = await getReliableDevicePosition({
        timeoutMs: 14000,
        onRefine: async (betterPos) => {
          await handlePinPick('pickup', betterPos.lat, betterPos.lng);
          setGpsStatus('Live GPS pinned');
        },
      });
      await handlePinPick('pickup', pos.lat, pos.lng);
      setGpsStatus(pos.source === 'cached_device' ? 'Recent GPS pinned' : 'Live GPS pinned');
    } catch (err) {
      if (!silentIfDenied) {
        setGpsStatus(err?.message || 'Allow location permission or tap map to pin your pickup.');
      }
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    const onNativeReady = () => {
      if (autoLocate && !pickupText) {
        locateCurrentCustomer(true);
      }
    };
    window.addEventListener('safargo-location-ready', onNativeReady);
    return () => window.removeEventListener('safargo-location-ready', onNativeReady);
  }, [autoLocate, pickupText]);

  useEffect(() => {
    if (!autoLocate || autoLocatedOnce.current || zones.length === 0) return;
    autoLocatedOnce.current = true;
    locateCurrentCustomer(true);
  }, [autoLocate, zones.length]);

  // Autocomplete search when user types in either Pickup or Drop input (or shows top Chowks/Roads when empty)
  useEffect(() => {
    if (!focusedField) {
      setSuggestions([]);
      return;
    }
    const raw = focusedField === 'pickup' ? pickupQuery : dropQuery;
    const q = (raw || '').trim();
    if (q.length < 2) {
      setSuggestions(
        TOP_MANSEHRA_QUICK_SPOTS.map((lm) => ({
          id: lm.id,
          label: lm.name,
          shortName: lm.shortName,
          lat: lm.lat,
          lng: lm.lng,
          zoneName: lm.zone,
          badge: lm.badge,
        }))
      );
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await searchPakistanPlaces(q, zones, pickupLat ?? 34.3335, pickupLng ?? 73.1995);
      setSuggestions(res);
      setSearching(false);
    }, 180);
    return () => clearTimeout(timer);
  }, [focusedField, pickupQuery, dropQuery, zones, pickupLat, pickupLng]);

  const pickSuggestion = (which, item) => {
    const nearest = findNearestZone(item.lat, item.lng, zones);
    const label = item.shortName || item.label;
    if (which === 'pickup') setPickupQuery(label);
    else setDropQuery(label);
    setSuggestions([]);
    setFocusedField(null);
    onSelectPoint?.({
      type: which,
      lat: Number(item.lat.toFixed(6)),
      lng: Number(item.lng.toFixed(6)),
      address: label,
      nearestZoneName: item.zoneName || nearest?.name || null,
    });
    setGpsStatus(`${which === 'drop' ? 'Drop' : 'Pickup'}: ${label}`);
  };

  const handleEnterSearch = async (which) => {
    const q = (which === 'pickup' ? pickupQuery : dropQuery).trim();
    if (q.length < 2) return;
    setSearching(true);
    const res =
      suggestions.length > 0 && q.length >= 2
        ? suggestions
        : await searchPakistanPlaces(q, zones, pickupLat ?? 34.3335, pickupLng ?? 73.1995);
    setSearching(false);
    if (res.length > 0) {
      pickSuggestion(which, res[0]);
    } else {
      setGpsStatus('Place not found — select on map directly.');
    }
  };

  return (
    <div className="space-y-3">
      {/* 1. InDrive Map Canvas */}
      <SafarGoMap
        pickup={pickupLat != null && pickupLng != null ? { lat: pickupLat, lng: pickupLng, label: pickupQuery || 'Pickup' } : null}
        drop={dropLat != null && dropLng != null ? { lat: dropLat, lng: dropLng, label: dropQuery || 'Destination' } : null}
        routeCoords={routeCoords}
        routeSource={routeSource}
        captains={nearbyCaptains}
        interactive={true}
        activePinMode={activeField}
        onMapPick={(which, lat, lng) => handlePinPick(which, lat, lng)}
        onPinDrag={(which, lat, lng) => handlePinPick(which, lat, lng)}
        heightClass={heightClass}
      />

      {/* Route, Nearby Captains & Explicit Tap-Pin Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#008741] font-bold">
            {nearbyCaptains.length > 0
              ? `${nearbyCaptains.length} Captain${nearbyCaptains.length > 1 ? 's' : ''} nearby (~${nearbyCaptains[0].eta_min}m)`
              : 'Live map ready'}
          </span>
          {routeDuration && (
            <span className="text-slate-500">
              · ~{routeDuration} min drive
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {gpsStatus && <span className="text-[#008741] font-semibold mr-1">{gpsStatus}</span>}
          <span className="text-slate-400 hidden sm:inline">Tap map:</span>
          <button
            type="button"
            onClick={() => setActiveField('pickup')}
            className={`px-2 py-0.5 rounded-md font-bold border transition ${
              activeField === 'pickup'
                ? 'bg-[#009E4D] text-white border-[#009E4D]'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            Pickup
          </button>
          <button
            type="button"
            onClick={() => setActiveField('drop')}
            className={`px-2 py-0.5 rounded-md font-bold border transition ${
              activeField === 'drop'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            Drop
          </button>
        </div>
      </div>

      {/* 2. Pure InDrive Two-Input Box (From & To — No Giant Dropdown Lists!) */}
      <div ref={pickerBoxRef} className="relative rounded-2xl border border-slate-200 bg-slate-50/70 p-2.5 space-y-2 text-xs">
        {/* FROM / PICKUP */}
        <div className="relative flex items-center gap-2 bg-white rounded-xl border border-slate-200/90 px-3 py-2 focus-within:border-[#009E4D]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#009E4D] ring-4 ring-emerald-100 shrink-0" />
          <input
            type="text"
            value={pickupQuery}
            onFocus={() => {
              setActiveField('pickup');
              setFocusedField('pickup');
            }}
            onChange={(e) => {
              setPickupQuery(e.target.value);
              setActiveField('pickup');
              setFocusedField('pickup');
              onTextChange?.('pickup', e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleEnterSearch('pickup');
              }
            }}
            placeholder="Pickup location (tap My GPS or search)..."
            className="flex-1 bg-transparent font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none min-w-0"
          />
          {pickupQuery && (
            <button
              type="button"
              onClick={() => {
                setPickupQuery('');
                setFocusedField('pickup');
                onTextChange?.('pickup', '');
              }}
              className="text-slate-400 hover:text-slate-700 p-0.5"
              title="Clear pickup"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => locateCurrentCustomer(false)}
            disabled={locating}
            className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#008741] font-bold inline-flex items-center gap-1 shrink-0 transition"
            title="Use My Current GPS Location"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            {locating ? '...' : 'Use GPS'}
          </button>
        </div>

        {/* TO / DROP */}
        <div className="relative flex items-center gap-2 bg-white rounded-xl border border-slate-200/90 px-3 py-2 focus-within:border-slate-900">
          <Navigation className="w-3.5 h-3.5 text-slate-900 shrink-0" />
          <input
            type="text"
            value={dropQuery}
            onFocus={() => {
              setActiveField('drop');
              setFocusedField('drop');
            }}
            onChange={(e) => {
              setDropQuery(e.target.value);
              setActiveField('drop');
              setFocusedField('drop');
              onTextChange?.('drop', e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleEnterSearch('drop');
              }
            }}
            placeholder="Where to? e.g. Baidra Chowk, Baidra Road, Safdar Road..."
            className="flex-1 bg-transparent font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none min-w-0"
          />
          {dropQuery && (
            <button
              type="button"
              onClick={() => {
                setDropQuery('');
                setFocusedField('drop');
                onTextChange?.('drop', '');
              }}
              className="text-slate-400 hover:text-slate-700 p-0.5"
              title="Clear drop"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => handleEnterSearch('drop')}
            disabled={searching}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold shrink-0 transition"
          >
            {searching ? '...' : 'Find'}
          </button>
        </div>

        {/* Autocomplete Dropdown */}
        {focusedField && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 z-[500] mt-1 bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100 max-h-56 overflow-y-auto text-xs">
            {suggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => pickSuggestion(focusedField, item)}
                className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 text-slate-800 font-medium flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-[#009E4D] shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#008741] text-[10px] font-bold shrink-0">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
