import React, { useEffect, useRef, useState } from 'react';
import { LocateFixed, MapPin, Navigation, Search } from 'lucide-react';
import { SafarGoMap } from './SafarGoMap';
import {
  fetchRoadRoute,
  findNearestZone,
  reverseGeocode,
  searchPakistanPlaces,
} from '../utils/geo';

export function InteractiveRoutePicker({
  zones = [],
  pickupLat,
  pickupLng,
  pickupLabel,
  dropLat,
  dropLng,
  dropLabel,
  nearbyCaptains = [],
  onSelectPoint,
  onRouteResult,
  heightClass = 'h-60 sm:h-72',
  autoLocate = true,
}) {
  const [pinMode, setPinMode] = useState('pickup'); // map-click / drag mode
  const [searchTarget, setSearchTarget] = useState('drop'); // defaults to Drop ("Where to? e.g. Safdar Road")
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('');
  const [routeCoords, setRouteCoords] = useState(null);
  const [routeSource, setRouteSource] = useState('estimate');
  const [routeDuration, setRouteDuration] = useState(null);
  const autoLocatedOnce = useRef(false);

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

  const handlePinPick = async (which, lat, lng, knownAddress = null, knownZone = null) => {
    const nearest = knownZone ? zones.find((z) => z.name === knownZone) : findNearestZone(lat, lng, zones);
    const rev = knownAddress || (await reverseGeocode(lat, lng));
    onSelectPoint?.({
      type: which,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      address: rev || (nearest ? `Near ${nearest.name}` : `${lat.toFixed(4)}, ${lng.toFixed(4)}`),
      nearestZoneName: knownZone || nearest?.name || null,
    });
  };

  const locateCurrentCustomer = (silentIfDenied = false) => {
    if (!navigator.geolocation) {
      if (!silentIfDenied) setGpsStatus('GPS browser mein support nahi hai — map per tap kar ke pin lagayein.');
      return;
    }
    setLocating(true);
    if (!silentIfDenied) setGpsStatus('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        await handlePinPick('pickup', lat, lng);
        setGpsStatus('Your live GPS location is pinned on the map!');
        setLocating(false);
      },
      () => {
        if (!silentIfDenied) {
          setGpsStatus('Location access allow karein ya map per apna ghar tap karein.');
        }
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  // Auto-detect customer's live GPS right when Customer / Landing map opens
  useEffect(() => {
    if (!autoLocate || autoLocatedOnce.current || zones.length === 0) return;
    autoLocatedOnce.current = true;
    locateCurrentCustomer(true);
  }, [autoLocate, zones.length]);

  // Live debounced autocomplete while Customer types Drop/Pickup (e.g. "safdar road")
  useEffect(() => {
    const q = searchText.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const results = await searchPakistanPlaces(q, zones, pickupLat ?? 34.3335, pickupLng ?? 73.1995);
      setSearchResults(results);
      setSearching(false);
    }, 220);
    return () => clearTimeout(timer);
  }, [searchText, zones, pickupLat, pickupLng]);

  const applySearchResult = (item) => {
    const nearest = findNearestZone(item.lat, item.lng, zones);
    onSelectPoint?.({
      type: searchTarget,
      lat: Number(item.lat.toFixed(6)),
      lng: Number(item.lng.toFixed(6)),
      address: item.shortName || item.label,
      nearestZoneName: item.zoneName || nearest?.name || null,
    });
    setSearchResults([]);
    setSearchText(item.shortName || item.label);
    setGpsStatus(
      `${searchTarget === 'drop' ? 'Drop' : 'Pickup'} set: ${item.shortName || item.label}`
    );
  };

  const handleFindClick = async () => {
    const q = searchText.trim();
    if (q.length < 2) return;
    setSearching(true);
    const results =
      searchResults.length > 0
        ? searchResults
        : await searchPakistanPlaces(q, zones, pickupLat ?? 34.3335, pickupLng ?? 73.1995);
    setSearching(false);
    if (results.length > 0) {
      applySearchResult(results[0]);
    } else {
      setGpsStatus('Is naam ki jagah nahi mili — nazdeeki area select karein ya map per pin tap karein.');
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Toolbar: Pin Mode + Nearby Captains Pill + Auto GPS */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
          <button
            type="button"
            onClick={() => setPinMode('pickup')}
            className={`px-2.5 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 transition ${
              pinMode === 'pickup' ? 'bg-[#009E4D] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Tap Pickup
          </button>
          <button
            type="button"
            onClick={() => setPinMode('drop')}
            className={`px-2.5 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 transition ${
              pinMode === 'drop' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            Tap Drop
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#008741] font-bold">
            {nearbyCaptains.length > 0
              ? `${nearbyCaptains.length} Captain${nearbyCaptains.length > 1 ? 's' : ''} nearby (~${nearbyCaptains[0].eta_min}m)`
              : 'Searching captains nearby'}
          </span>
          <button
            type="button"
            onClick={() => locateCurrentCustomer(false)}
            disabled={locating}
            className="px-2.5 py-1.5 rounded-xl bg-[#009E4D] text-white hover:bg-[#008741] font-bold inline-flex items-center gap-1 shadow-xs transition disabled:opacity-60"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            {locating ? 'Locating...' : 'My GPS'}
          </button>
        </div>
      </div>

      {/* InDrive-Style Live Search Bar (No nested <form>, live autocomplete + Find) */}
      <div className="relative" role="search">
        <div className="flex items-center gap-1.5 text-xs">
          <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200/80 shrink-0">
            <button
              type="button"
              onClick={() => setSearchTarget('drop')}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition ${
                searchTarget === 'drop' ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              Drop
            </button>
            <button
              type="button"
              onClick={() => setSearchTarget('pickup')}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition ${
                searchTarget === 'pickup' ? 'bg-[#009E4D] text-white' : 'text-slate-600'
              }`}
            >
              Pickup
            </button>
          </div>
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleFindClick();
                }
              }}
              placeholder={
                searchTarget === 'drop'
                  ? 'Find Drop on map (e.g. Safdar Road, Mandian, Fawara Chowk)...'
                  : 'Find Pickup area or road...'
              }
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200/90 bg-slate-50/80 focus:bg-white focus:outline-none focus:border-[#009E4D]"
            />
          </div>
          <button
            type="button"
            onClick={handleFindClick}
            disabled={searching}
            className="px-3 py-2 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition shrink-0"
          >
            {searching ? '...' : 'Find'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="absolute z-[500] mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100 max-h-52 overflow-y-auto text-xs">
            {searchResults.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => applySearchResult(item)}
                className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-slate-700 font-medium flex items-center justify-between gap-2"
              >
                <span className="truncate">{item.label}</span>
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

      {/* Map Canvas */}
      <SafarGoMap
        pickup={pickupLat != null && pickupLng != null ? { lat: pickupLat, lng: pickupLng, label: pickupLabel } : null}
        drop={dropLat != null && dropLng != null ? { lat: dropLat, lng: dropLng, label: dropLabel } : null}
        routeCoords={routeCoords}
        routeSource={routeSource}
        captains={nearbyCaptains}
        interactive={true}
        activePinMode={pinMode}
        onMapPick={(which, lat, lng) => handlePinPick(which, lat, lng)}
        onPinDrag={(which, lat, lng) => handlePinPick(which, lat, lng)}
        heightClass={heightClass}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>
          Tap map or drag <strong>P</strong> / <strong>D</strong> pins to set exact house location.
          {routeDuration ? ` Est. drive: ~${routeDuration} min` : ''}
          {routeSource === 'osrm' ? ' (Road GPS route)' : ''}
        </span>
        {gpsStatus && <span className="text-[#008741] font-semibold">{gpsStatus}</span>}
      </div>
    </div>
  );
}
