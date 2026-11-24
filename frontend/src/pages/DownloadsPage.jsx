import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, Monitor, Smartphone } from 'lucide-react';
import { apiRequest } from '../api/client';
import { BrandLogo } from '../components/BrandLogo';

export function DownloadsPage({ onBack }) {
  const [releases, setReleases] = useState([]);
  const [notice, setNotice] = useState('');

  const loadReleases = async () => {
    try {
      const rows = await apiRequest('/api/public/releases', { auth: false });
      setReleases(rows);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadReleases();
  }, []);

  const latestApk = releases.find((r) => r.platform === 'android_apk' && r.is_latest) || releases.find((r) => r.platform === 'android_apk');
  const latestExe = releases.find((r) => r.platform === 'windows_exe' && r.is_latest) || releases.find((r) => r.platform === 'windows_exe');

  const handleDownload = async (rel) => {
    if (!rel) return;
    try {
      await apiRequest(`/api/public/releases/${rel.id}/track-download`, { method: 'POST', auth: false });
      await loadReleases();
    } catch {
      // ignore tracking error
    }
    if (!rel.download_url || rel.download_url.startsWith('#')) {
      setNotice(
        `${rel.file_name} (${rel.version}) packaging is in progress. Meanwhile, you can use Chrome → "Add to Home Screen" / "Install App" right now!`
      );
      return;
    }
    const a = document.createElement('a');
    a.href = rel.download_url;
    a.download = rel.file_name;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <BrandLogo subtitle="Official App Download Center" />
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200/80 bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to App
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="space-y-1.5">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-[#008741] border border-emerald-200/80">
            Mobile &amp; Desktop Installers
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 pt-2">
            Download Bikeaya (.APK &amp; .EXE)
          </h1>
          <p className="text-sm text-slate-600">
            Get the Android mobile installer for Customers, Bike &amp; Car Captains, or the Windows Desktop application for Admin Dispatch.
          </p>
        </div>

        {notice && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm font-medium">
            {notice}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Android APK Card */}
          <div className="card-elevated rounded-3xl p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-white bg-[#009E4D]">
                  <Smartphone className="w-3.5 h-3.5" />
                  ANDROID (.APK)
                </span>
                <span className="text-xs mono-num text-slate-500">
                  {latestApk ? `v${latestApk.version} · ${latestApk.file_size_mb} MB` : 'v1.0.0'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">Mobile Customer &amp; Rider App</h2>
              <p className="text-xs sm:text-sm text-slate-600">
                {latestApk?.release_notes || 'Android installer for booking bike rides, intercity cars, parcel delivery, and captain earnings tracking.'}
              </p>
              <div className="text-xs text-slate-500 mono-num">
                Downloads: {latestApk?.download_count ?? 0}
              </div>
            </div>
            <button
              onClick={() => handleDownload(latestApk)}
              className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-[#009E4D] hover:bg-[#008741] inline-flex items-center justify-center gap-2 transition"
            >
              <Download className="w-4 h-4" />
              Download Android APK
            </button>
          </div>

          {/* Windows EXE Card */}
          <div className="card-elevated rounded-3xl p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-white bg-slate-900">
                  <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                  WINDOWS (.EXE)
                </span>
                <span className="text-xs mono-num text-slate-500">
                  {latestExe ? `v${latestExe.version} · ${latestExe.file_size_mb} MB` : 'v1.0.0'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">Windows Admin Dispatch Desk</h2>
              <p className="text-xs sm:text-sm text-slate-600">
                {latestExe?.release_notes || 'Desktop application for live ride management, rider cash settlements, and P&L reporting.'}
              </p>
              <div className="text-xs text-slate-500 mono-num">
                Downloads: {latestExe?.download_count ?? 0}
              </div>
            </div>
            <button
              onClick={() => handleDownload(latestExe)}
              className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 inline-flex items-center justify-center gap-2 transition"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Download Windows EXE
            </button>
          </div>
        </div>

        {/* PWA Instant Install Tip */}
        <div className="card-elevated rounded-2xl p-5 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#009E4D] shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-slate-600 space-y-1">
            <div className="font-bold text-slate-900">Instant Mobile &amp; Desktop Install (PWA Ready Now)</div>
            <p>
              You can also install directly from Chrome/Edge via <strong>Add to Home Screen</strong> or <strong>Install App</strong>, or download the standalone <code>.apk</code> / <code>.exe</code> above.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
