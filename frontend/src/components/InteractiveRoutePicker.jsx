import React, { useEffect, useState } from 'react';
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
  compact = false,
}) {
  const [pinMode, setPinMode] = useState('pickup'); // pickup | drop
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('');
  const [routeCoords, setRouteCoords] = useState(null);
  const [routeSource, setRouteSource] = useState('estimate');
  const [routeDuration, setRouteDuration] = useState(null);

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
    onSelectPoint?.({
      type: which,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      address: rev || (nearest ? `Near ${nearest.name}` : `${lat.toFixed(4)}, ${lng.toFixed(4)}`),
      nearestZoneName: nearest?.name || null,
    });
  };

  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      setGpsStatus('GPS browser mein support nahi hai — map per tap kar ke pin lagayein.');
      return;
    }
    setLocating(true);
    setGpsStatus('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setPinMode('pickup');
        await handlePinPick('pickup', lat, lng);
        setGpsStatus('Current GPS location set!');
        setLocating(false);
      },
      () => {
        setGpsStatus('Location permission denied — aap map per tap kar ke ghar ki location mark kar sakte hain.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchText.trim()) return;
    setSearching(true);
    const results = await searchPakistanPlaces(searchText);
    setSearchResults(results);
    if (results.length === 0) {
      setGpsStatus('Is naam ki jagah map search mein nahi mili — nazdeeki area select karein ya map tap karein.');
    } else {
      setGpsStatus('');
    }
    setSearching(false);
  };

  const pickSearchResult = (item) => {
    const nearest = findNearestZone(item.lat, item.lng, zones);
    onSelectPoint?.({
      type: pinMode,
      lat: Number(item.lat.toFixed(6)),
      lng: Number(item.lng.toFixed(6)),
      address: item.shortName,
      nearestZoneName: nearest?.name || null,
    });
    setSearchResults([]);
    setSearchText(item.shortName);
  };

  return (
    <div className="space-y-2.5">
      {/* Toolbar: Pin Mode + Locate GPS + Nearby Captains Pill */}
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
            Set Pickup
          </button>
          <button
            type="button"
            onClick={() => setPinMode('drop')}
            className={`px-2.5 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 transition ${
              pinMode === 'drop' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            Set Drop
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
            onClick={handleUseGPS}
            disabled={locating}
            className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-[#009E4D] text-slate-800 font-bold inline-flex items-center gap-1 shadow-xs transition disabled:opacity-60"
          >
            <LocateFixed className="w-3.5 h-3.5 text-[#009E4D]" />
            {locating ? 'Locating...' : 'My GPS'}
          </button>
        </div>
      </div>

      {/* Place Search Bar (Search house/street/mohalla/city on map) */}
      {!compact && (
        <div className="relative">
          <form onSubmit={handleSearch} className="flex gap-1.5 text-xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={`Search ${pinMode === 'pickup' ? 'Pickup' : 'Drop'} street, plaza, or city (or tap map)...`}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200/90 bg-slate-50/80 focus:bg-white focus:outline-none focus:border-[#009E4D]"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-3 py-2 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition shrink-0"
            >
              {searching ? '...' : 'Find'}
            </button>
          </form>
          {searchResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100 max-h-44 overflow-y-auto text-xs">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pickSearchResult(item)}
                  className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-slate-700 font-medium"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Map Canvas */}
      <SafarGoMap
        pickup={pickupLat != null && pickupLng != null ? { lat: pickupLat, lng: pickupLng, label: pickupLabel } : null}
        drop={dropLat != null && dropLng != null ? { lat: dropLat, lng: dropLng, label: dropLabel } : null}
        routeCoords={routeCoords}
        routeSource={routeSource}
        captains={nearbyCaptains}
        interactive={true}
        activePinMode={pinMode}
        onMapPick={handlePinPick}
        onPinDrag={handlePinPick}
        heightClass={heightClass}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>
          Tap map or drag <strong>P</strong> / <strong>D</strong> pins to set exact house location.
          {routeDuration ? ` Est. drive: ~${routeDuration} min` : ''}
          {routeSource === 'osrm' ? ' (Road GPS route)' : ''}
        </span>
        {gpsStatus && <span className="text-amber-700 font-semibold">{gpsStatus}</span>}
      </div>
    </div>
  );
}
