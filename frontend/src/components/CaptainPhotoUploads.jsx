import React, { useState } from 'react';
import { Camera, CheckCircle2, CreditCard, Trash2, Upload, UserCheck } from 'lucide-react';
import { compressImageFileToDataUrl } from '../utils/imageUpload';

export function CaptainPhotoUploads({
  vehicleType = 'bike',
  photos = {},
  onChangePhoto,
  compact = false,
  disabled = false,
}) {
  const [busySlot, setBusySlot] = useState(null);
  const [error, setError] = useState('');

  const isCar = vehicleType === 'car';
  const slots = [
    {
      key: 'rider_photo',
      label: 'Captain Selfie / Photo',
      sub: 'Clear face photo (shown to customers)',
      required: true,
      icon: UserCheck,
    },
    {
      key: 'vehicle_photo',
      label: isCar ? 'Car Photo (Front / Side)' : 'Bike Photo (Front / Side)',
      sub: isCar ? 'Clear AC Car photo with plate visible' : 'Clear Motorbike photo with plate visible',
      required: true,
      icon: Camera,
    },
    {
      key: 'cnic_front_photo',
      label: 'CNIC Front Photo',
      sub: 'Clear ID Card front side for verification',
      required: true,
      icon: CreditCard,
    },
    {
      key: 'cnic_back_photo',
      label: 'CNIC Back / Driving License',
      sub: 'Clear ID back or Driving License photo (required)',
      required: true,
      icon: CreditCard,
    },
  ];

  const handleFilePick = async (key, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setBusySlot(key);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 900, 0.78);
      onChangePhoto(key, dataUrl);
    } catch (err) {
      setError(err.message || 'Could not process selected photo.');
    } finally {
      setBusySlot(null);
    }
  };

  return (
    <div className="space-y-2.5">
      {error && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold">
          {error}
        </div>
      )}
      <div className={`grid grid-cols-1 ${compact ? 'sm:grid-cols-2 gap-2.5' : 'sm:grid-cols-2 gap-3.5'}`}>
        {slots.map((slot) => {
          const Icon = slot.icon;
          const preview = photos[slot.key];
          const isBusy = busySlot === slot.key;
          return (
            <div
              key={slot.key}
              className={`rounded-2xl border p-3 transition ${
                preview
                  ? 'bg-emerald-50/40 border-emerald-300'
                  : 'bg-slate-50/80 border-slate-200/80 hover:border-emerald-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-[#009E4D] shrink-0" />
                    <span className="truncate">{slot.label}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight mt-0.5">{slot.sub}</div>
                </div>
                {preview ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-[#008741] text-[10px] font-extrabold shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    Uploaded
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600 text-[10px] font-bold shrink-0">
                    {slot.required ? 'Required' : 'Optional'}
                  </span>
                )}
              </div>

              {preview ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white">
                  <img
                    src={preview}
                    alt={slot.label}
                    className={`w-full ${compact ? 'h-24' : 'h-32'} object-cover`}
                  />
                  {!disabled && (
                    <div className="p-2 bg-white/95 border-t border-slate-100 flex items-center justify-between gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-[#008741] border border-emerald-200 text-[11px] font-bold hover:bg-emerald-100">
                        <Upload className="w-3 h-3" />
                        Replace
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFilePick(slot.key, e)}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => onChangePhoto(slot.key, '')}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 text-[11px] font-bold"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <label
                  className={`flex flex-col items-center justify-center ${
                    compact ? 'h-20' : 'h-28'
                  } rounded-xl border-2 border-dashed border-slate-300 hover:border-[#009E4D] bg-white cursor-pointer transition text-center px-3`}
                >
                  <Upload className="w-5 h-5 text-[#009E4D] mb-1" />
                  <span className="text-[11px] font-bold text-slate-700">
                    {isBusy ? 'Processing Photo...' : 'Tap to Upload / Camera'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={disabled || isBusy}
                    className="hidden"
                    onChange={(e) => handleFilePick(slot.key, e)}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
