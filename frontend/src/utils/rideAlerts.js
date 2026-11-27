let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function unlockRideAlertAudio() {
  try {
    getAudioContext();
  } catch {
    // ignore audio unlock errors
  }
}

export async function requestRideNotificationsPermission() {
  unlockRideAlertAudio();
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'default') {
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }
  return Notification.permission;
}

export function playRideAlertChime(variant = 'captain') {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(
        variant === 'sos'
          ? [350, 90, 350, 90, 500]
          : variant === 'closest'
          ? [260, 90, 260, 90, 260]
          : [200, 90, 200]
      );
    }
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes =
      variant === 'sos'
        ? [987.77, 1318.51, 987.77, 1318.51]
        : variant === 'closest'
        ? [880, 1174.66, 1396.91]
        : variant === 'admin'
        ? [659.25, 880]
        : [783.99, 1046.5];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = variant === 'sos' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(variant === 'sos' ? 0.26 : 0.18, now + idx * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.3);
    });
  } catch {
    // ignore browser autoplay restriction until next user interaction
  }
}

export function showBrowserRideNotification(title, body, tag = 'safargo-alert') {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const n = new Notification(title, {
      body,
      icon: '/icon-192.png?v=2',
      badge: '/icon-192.png?v=2',
      tag,
      renotify: true,
    });
    setTimeout(() => {
      try {
        n.close();
      } catch {
        // ignore close failure
      }
    }, 9000);
  } catch {
    // ignore desktop/Android WebView Notification edge cases
  }
}
