const LAST_GPS_KEY = 'safargo_last_device_gps_v1';

export function getCachedDevicePosition(maxAgeMs = 45 * 60 * 1000) {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(LAST_GPS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lat = Number(parsed?.lat);
    const lng = Number(parsed?.lng);
    const ts = Number(parsed?.ts || 0);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Date.now() - ts > maxAgeMs) return null;
    return {
      lat,
      lng,
      accuracy: Number(parsed?.accuracy || 100),
      source: 'cached_device',
    };
  } catch {
    return null;
  }
}

export function saveCachedDevicePosition(pos) {
  if (typeof window === 'undefined' || !window.localStorage || !pos) return;
  try {
    window.localStorage.setItem(
      LAST_GPS_KEY,
      JSON.stringify({
        lat: Number(pos.lat),
        lng: Number(pos.lng),
        accuracy: Number(pos.accuracy || 50),
        ts: Date.now(),
      })
    );
  } catch {
    // ignore storage quota errors
  }
}

export function readNativeAndroidLocation() {
  if (typeof window === 'undefined') return null;
  const bridge = window.SafarGoNative;
  if (!bridge || typeof bridge.getLastLocation !== 'function') return null;
  try {
    const raw = bridge.getLastLocation();
    if (!raw) return null;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const lat = Number(parsed?.lat);
    const lng = Number(parsed?.lng);
    return {
      ok: Boolean(parsed?.ok && Number.isFinite(lat) && Number.isFinite(lng)),
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      accuracy: Number(parsed?.accuracy || 50),
      provider: parsed?.provider || 'android',
      locationEnabled: parsed?.locationEnabled !== false,
      permissionGranted: parsed?.permissionGranted !== false,
    };
  } catch {
    return null;
  }
}

/**
 * Reliable mobile/desktop GPS fetcher:
 * 1) Uses SafarGo APK native LocationManager bridge when running inside the Android app (< 50ms).
 * 2) Races fast network/cached fix with satellite high-accuracy GPS + watchPosition fallback so mobile
 *    never hangs or throws false GPS timeout errors indoors or on cellular networks.
 * 3) Upgrades pin via onRefine() if a sharper satellite fix arrives a few seconds later.
 */
export function getReliableDevicePosition({ onRefine = null, timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const nativeInfo = readNativeAndroidLocation();
    try {
      window.SafarGoNative?.requestFreshLocation?.();
    } catch {
      // ignore bridge errors
    }

    if (nativeInfo?.ok) {
      const first = {
        lat: nativeInfo.lat,
        lng: nativeInfo.lng,
        accuracy: nativeInfo.accuracy,
        source: `native_${nativeInfo.provider}`,
      };
      saveCachedDevicePosition(first);
      if (onRefine && typeof window !== 'undefined') {
        const onNativeFresh = (ev) => {
          const d = ev?.detail;
          if (d && Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng))) {
            const refined = {
              lat: Number(d.lat),
              lng: Number(d.lng),
              accuracy: Number(d.accuracy || 20),
              source: 'native_live',
            };
            saveCachedDevicePosition(refined);
            onRefine(refined);
          }
        };
        window.addEventListener('safargo-native-location', onNativeFresh, { once: true });
        setTimeout(() => window.removeEventListener('safargo-native-location', onNativeFresh), 12000);
      }
      resolve(first);
      return;
    }

    if (nativeInfo && nativeInfo.locationEnabled === false) {
      const cached = getCachedDevicePosition();
      if (cached) {
        resolve(cached);
        return;
      }
      reject({
        code: 'LOCATION_OFF',
        message: 'Phone Location / GPS is turned off. Please enable Location in your mobile quick settings.',
      });
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const cached = getCachedDevicePosition();
      if (cached) {
        resolve(cached);
        return;
      }
      reject({
        code: 'UNAVAILABLE',
        message: 'Device GPS unavailable — please select your area below or tap the map.',
      });
      return;
    }

    let settled = false;
    let bestAccuracy = Infinity;
    let deniedCount = 0;
    let errorCount = 0;
    let watchId = null;
    let nativeListener = null;
    let hardTimer = null;

    const cleanupWatchers = () => {
      if (watchId != null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch {
          // ignore
        }
        watchId = null;
      }
      if (nativeListener && typeof window !== 'undefined') {
        window.removeEventListener('safargo-native-location', nativeListener);
        nativeListener = null;
      }
      if (hardTimer) {
        clearTimeout(hardTimer);
        hardTimer = null;
      }
    };

    const acceptPos = (lat, lng, accuracy, source, isFinalSource = false) => {
      const nLat = Number(lat);
      const nLng = Number(lng);
      const nAcc = Number(accuracy || 60);
      if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return;

      const payload = { lat: nLat, lng: nLng, accuracy: nAcc, source };
      saveCachedDevicePosition(payload);

      if (!settled) {
        settled = true;
        bestAccuracy = nAcc;
        resolve(payload);
        // Keep high-accuracy refinement alive briefly if initial fix came from coarse network/cache
        if (nAcc <= 35 || isFinalSource) {
          cleanupWatchers();
        } else {
          setTimeout(cleanupWatchers, 8000);
        }
      } else if (nAcc < bestAccuracy * 0.75 || isFinalSource) {
        bestAccuracy = nAcc;
        onRefine?.(payload);
        if (nAcc <= 35 || isFinalSource) {
          cleanupWatchers();
        }
      }
    };

    const failFinal = (errObj) => {
      if (settled) return;
      settled = true;
      cleanupWatchers();
      const cached = getCachedDevicePosition();
      if (cached && errObj?.code !== 'PERMISSION_DENIED') {
        resolve(cached);
        return;
      }
      reject(errObj);
    };

    const handleGeoErr = (geoErr) => {
      errorCount += 1;
      if (geoErr?.code === 1) {
        deniedCount += 1;
        failFinal({
          code: 'PERMISSION_DENIED',
          message: 'Location permission is blocked. Please allow Location in Browser / App Settings.',
        });
      }
    };

    if (typeof window !== 'undefined') {
      nativeListener = (ev) => {
        const d = ev?.detail;
        if (d) acceptPos(d.lat, d.lng, d.accuracy, 'native_live', true);
      };
      window.addEventListener('safargo-native-location', nativeListener);
    }

    // Race 1: Fast cached / Wi-Fi / cell location (resolves in 0.5-2s indoors)
    navigator.geolocation.getCurrentPosition(
      (pos) => acceptPos(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, 'network'),
      handleGeoErr,
      { enableHighAccuracy: false, maximumAge: 600000, timeout: Math.min(timeoutMs, 11000) }
    );

    // Race 2: High-accuracy GPS (refines the pin when satellite locks)
    navigator.geolocation.getCurrentPosition(
      (pos) => acceptPos(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, 'gps', true),
      handleGeoErr,
      { enableHighAccuracy: true, maximumAge: 60000, timeout: timeoutMs + 5000 }
    );

    // Race 3: Passive watch fallback for devices whose one-shot getCurrentPosition stalls
    watchId = navigator.geolocation.watchPosition(
      (pos) => acceptPos(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, 'watch', false),
      handleGeoErr,
      { enableHighAccuracy: false, maximumAge: 300000, timeout: timeoutMs }
    );

    hardTimer = setTimeout(() => {
      if (!settled) {
        failFinal({
          code: deniedCount > 0 ? 'PERMISSION_DENIED' : 'TIMEOUT',
          message:
            deniedCount > 0 || errorCount > 0
              ? 'GPS lock failed — please select your current area below or tap on the map.'
              : 'Live GPS timed out — enable Mobile Location and tap Detect again, or select your area below.',
        });
      } else {
        cleanupWatchers();
      }
    }, timeoutMs);
  });
}

export function watchReliableDevicePosition(onPosition, intervalMs = 15000) {
  if (typeof window === 'undefined') return () => {};
  let lastPushAt = 0;

  const emit = (lat, lng, accuracy, source) => {
    const now = Date.now();
    if (now - lastPushAt < 7000) return;
    lastPushAt = now;
    const pos = { lat: Number(lat), lng: Number(lng), accuracy: Number(accuracy || 50), source };
    saveCachedDevicePosition(pos);
    onPosition?.(pos);
  };

  const onNativeLoc = (ev) => {
    const d = ev?.detail;
    if (d && Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng))) {
      emit(d.lat, d.lng, d.accuracy, 'native_live');
    }
  };
  const onPermReady = () => {
    getReliableDevicePosition()
      .then((p) => emit(p.lat, p.lng, p.accuracy, p.source))
      .catch(() => {});
  };

  window.addEventListener('safargo-native-location', onNativeLoc);
  window.addEventListener('safargo-location-ready', onPermReady);

  let watchId = null;
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      (pos) => emit(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, 'watch'),
      () => {},
      { enableHighAccuracy: false, maximumAge: 15000, timeout: 20000 }
    );
  }

  const timer = setInterval(() => {
    try {
      window.SafarGoNative?.requestFreshLocation?.();
    } catch {
      // ignore
    }
    const nativeInfo = readNativeAndroidLocation();
    if (nativeInfo?.ok) {
      emit(nativeInfo.lat, nativeInfo.lng, nativeInfo.accuracy, 'native_poll');
    } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => emit(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, 'poll'),
        () => {},
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 12000 }
      );
    }
  }, intervalMs);

  return () => {
    window.removeEventListener('safargo-native-location', onNativeLoc);
    window.removeEventListener('safargo-location-ready', onPermReady);
    if (watchId != null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
    clearInterval(timer);
  };
}
