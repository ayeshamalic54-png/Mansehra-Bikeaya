import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, MapPin, Phone, ShieldAlert, X } from 'lucide-react';
import { apiRequest } from '../api/client';
import { getReliableDevicePosition } from '../utils/deviceGps';
import { playRideAlertChime, unlockRideAlertAudio } from '../utils/rideAlerts';

const SOS_TYPES = [
  { id: 'police_15', label: 'Police Emergency (15)' },
  { id: 'rescue_1122', label: 'Rescue / Medical (1122)' },
  { id: 'threat', label: 'Safety / Threat Alert' },
  { id: 'accident', label: 'Road Accident / Breakdown' },
];

export function EmergencySosModal({
  isOpen,
  onClose,
  role = 'rider',
  settings = {},
  activeBooking = null,
  fallbackCoords = null,
  mySosHistory = [],
  onTriggered = null,
}) {
  const [emergencyType, setEmergencyType] = useState('police_15');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sentAlert, setSentAlert] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const rescueNumber = (settings?.emergency_rescue_number || '1122').trim() || '1122';
  const policeNumber = (settings?.emergency_police_number || '15').trim() || '15';
  const officeNumber = (settings?.support_phone || '+92 300 1111111').trim();

  const handleSendSos = async (e) => {
    e?.preventDefault();
    unlockRideAlertAudio();
    setErrorMsg('');
    setSending(true);
    try {
      let lat = fallbackCoords?.lat ?? null;
      let lng = fallbackCoords?.lng ?? null;
      try {
        const quickPos = await getReliableDevicePosition({ timeoutMs: 3500 });
        if (quickPos?.lat != null && quickPos?.lng != null) {
          lat = Number(quickPos.lat.toFixed(6));
          lng = Number(quickPos.lng.toFixed(6));
        }
      } catch {
        // Proceed immediately with fallbackCoords so SOS broadcast never stalls!
      }

      const defaultNumber = emergencyType === 'rescue_1122' || emergencyType === 'accident' ? rescueNumber : policeNumber;
      const created = await apiRequest('/api/sos/trigger', {
        method: 'POST',
        body: {
          emergency_type: emergencyType,
          lat,
          lng,
          booking_id: activeBooking?.id || null,
          note: note.trim() || null,
          called_number: defaultNumber,
        },
      });
      playRideAlertChime('sos');
      setSentAlert(created);
      setNote('');
      onTriggered?.(created);
    } catch (err) {
      setErrorMsg(err.message || 'Could not send SOS alert');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border-2 border-rose-500 rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-4 my-auto">
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-rose-100">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Emergency SOS &amp; Police / Rescue Desk
              </h2>
              <p className="text-[11px] text-slate-500">
                1-Tap Emergency Call (Police {policeNumber} / Rescue {rescueNumber}) &amp; Live GPS SOS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Official Verified Pakistan / KPK Emergency Numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <a
            href={`tel:${policeNumber}`}
            className="p-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white flex flex-col justify-between gap-1 shadow-sm transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-100">Police Helpline</span>
              <Phone className="w-4 h-4" />
            </div>
            <div className="text-xl font-extrabold mono-num">Call {policeNumber}</div>
            <div className="text-[10px] text-rose-100">Security / Threat</div>
          </a>

          <a
            href={`tel:${rescueNumber}`}
            className="p-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white flex flex-col justify-between gap-1 shadow-sm transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-100">Rescue Service</span>
              <Phone className="w-4 h-4" />
            </div>
            <div className="text-xl font-extrabold mono-num">Call {rescueNumber}</div>
            <div className="text-[10px] text-amber-100">Medical / Accident</div>
          </a>

          <a
            href={`tel:${officeNumber}`}
            className="p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white flex flex-col justify-between gap-1 shadow-sm transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300">SafarGo Desk</span>
              <Phone className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-sm font-extrabold mono-num truncate">{officeNumber}</div>
            <div className="text-[10px] text-slate-300">24/7 Control Room</div>
          </a>
        </div>

        {/* Instant Live SOS Alert Form */}
        <form onSubmit={handleSendSos} className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3 text-xs">
          <div className="font-extrabold text-rose-900 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            {role === 'admin'
              ? 'Log & Broadcast Admin Emergency SOS Alert'
              : 'Send Live GPS SOS Alert to SafarGo Admin'}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {SOS_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setEmergencyType(t.id)}
                className={`px-2.5 py-2 rounded-xl border text-[11px] font-bold text-left transition ${
                  emergencyType === t.id
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white text-slate-700 border-rose-200 hover:border-rose-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Emergency details (optional — e.g. Need police 15 / ambulance 1122 near Baidra Chowk)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-rose-200 bg-white text-slate-900"
          />

          {activeBooking && (
            <div className="text-[11px] font-semibold text-slate-700 bg-white/90 px-3 py-2 rounded-xl border border-rose-200/70">
              Attached Active Trip: <strong>{activeBooking.booking_code}</strong> ({activeBooking.pickup_zone} → {activeBooking.drop_zone})
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 font-bold">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-md inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <ShieldAlert className="w-4 h-4" />
            {sending ? 'Sending Live GPS SOS Alert...' : 'TRIGGER EMERGENCY SOS NOW'}
          </button>
        </form>

        {sentAlert && (
          <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-[#009E4D] space-y-2 text-xs">
            <div className="font-extrabold text-[#008741] flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              SOS Emergency Alert Broadcasted ✓
            </div>
            <div className="text-slate-700">
              Location: <strong>{sentAlert.zone_name}</strong>
              {sentAlert.lat != null && ` (${Number(sentAlert.lat).toFixed(4)}, ${Number(sentAlert.lng).toFixed(4)})`}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {sentAlert.google_maps_url && (
                <a
                  href={sentAlert.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold inline-flex items-center gap-1"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  Open Pin on Google Maps ↗
                </a>
              )}
              <a
                href={`tel:${policeNumber}`}
                className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold inline-flex items-center gap-1"
              >
                <Phone className="w-3.5 h-3.5" />
                Dial Police {policeNumber}
              </a>
              <a
                href={`tel:${rescueNumber}`}
                className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold inline-flex items-center gap-1"
              >
                <Phone className="w-3.5 h-3.5" />
                Dial Rescue {rescueNumber}
              </a>
            </div>
          </div>
        )}

        {mySosHistory.length > 0 && (
          <div className="space-y-1.5 text-[11px] pt-1">
            <div className="font-extrabold text-slate-700 uppercase text-[10px] tracking-wider">
              Your Recent SOS Alerts
            </div>
            <div className="max-h-28 overflow-y-auto space-y-1">
              {mySosHistory.slice(0, 4).map((s) => (
                <div
                  key={s.id}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                >
                  <div className="truncate">
                    <span className="font-bold text-slate-900">{s.emergency_type.replace(/_/g, ' ')}</span> ·{' '}
                    <span className="text-slate-600">{s.zone_name}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] shrink-0 ${
                      s.status === 'resolved'
                        ? 'bg-emerald-100 text-[#008741]'
                        : s.status === 'acknowledged'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {s.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
