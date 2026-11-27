import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, Monitor, Smartphone, Sparkles } from 'lucide-react';
import { apiRequest } from '../api/client';
import { BrandLogo } from '../components/BrandLogo';

export function DownloadsPage({ onBack }) {
  const [releases, setReleases] = useState([]);
  const [deferredPrompt, setDeferredPrompt] = useState(() =>
    typeof window !== 'undefined' ? window.__safargoDeferredPrompt || null : null
  );
  const [pwaInstalled, setPwaInstalled] = useState(() =>
    typeof window !== 'undefined'
      ? Boolean(
          window.__safargoPwaInstalled ||
            window.matchMedia?.('(display-mode: standalone)')?.matches ||
            window.SafarGoNative
        )
      : false
  );
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
    const syncGlobalPrompt = () => {
      if (window.__safargoDeferredPrompt) {
        setDeferredPrompt(window.__safargoDeferredPrompt);
      }
    };
    const onPrompt = (e) => {
      e.preventDefault();
      window.__safargoDeferredPrompt = e;
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setPwaInstalled(true);
      window.__safargoDeferredPrompt = null;
      setDeferredPrompt(null);
      setNotice('SafarGo verified Chrome App successfully installed — check your home screen / app drawer!');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('safargo-install-available', syncGlobalPrompt);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('safargo-app-installed', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('safargo-install-available', syncGlobalPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('safargo-app-installed', onInstalled);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (window.SafarGoNative) {
      setNotice('You are already using the SafarGo Android App ✓');
      return;
    }
    const promptObj = deferredPrompt || window.__safargoDeferredPrompt;
    if (promptObj) {
      promptObj.prompt();
      const choice = await promptObj.userChoice;
      if (choice?.outcome === 'accepted') {
        setNotice('Installing SafarGo App cleanly on your device ✓');
        setPwaInstalled(true);
      }
      window.__safargoDeferredPrompt = null;
      setDeferredPrompt(null);
      return;
    }
    if (window.matchMedia?.('(display-mode: standalone)')?.matches) {
      setPwaInstalled(true);
      setNotice('SafarGo Official App is already installed and active ✓');
      return;
    }
    setNotice(
      'For warning-free installation: Tap your browser menu (⋮ in Chrome or Share ⬆ in iOS Safari) and select "Install app" / "Add to Home screen".'
    );
  };

  const latestApk =
    releases.find((r) => r.platform === 'android_apk' && r.is_latest) ||
    releases.find((r) => r.platform === 'android_apk');
  const latestExe =
    releases.find((r) => r.platform === 'windows_exe' && r.is_latest) ||
    releases.find((r) => r.platform === 'windows_exe');

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
        `${rel.file_name} (${rel.version}) packaging is in progress. Meanwhile, click "Install SafarGo App Now" above!`
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
          <BrandLogo subtitle="SafarGo Download Center" />
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
            SafarGo Official Apps · Bikes, AC Cars &amp; Parcels
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 pt-2">
            Install or Download SafarGo App
          </h1>
          <p className="text-sm text-slate-600">
            Get the official SafarGo app for Customers, Bike &amp; AC Car Captains, and Admin Dispatch.
          </p>
        </div>

        {/* Instant One-Tap PWA Install Banner */}
        <div className="rounded-3xl p-5 sm:p-6 bg-gradient-to-r from-[#043A22] via-[#007D40] to-[#009E4D] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-4">
            <img
              src="/icon-192.png?v=2"
              alt="SafarGo App Icon"
              className="w-16 h-16 rounded-2xl shadow-md ring-2 ring-white/40 shrink-0 bg-emerald-800"
            />
            <div>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold mb-1">
                <Sparkles className="w-3 h-3" />
                ZERO VIRUS WARNINGS · GOOGLE CHROME VERIFIED INSTALL
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold">Install Official SafarGo App (1-Tap, No Warnings)</h2>
              <p className="text-xs text-emerald-100 mt-0.5">
                Install directly on your phone without &ldquo;Harmful app&rdquo; or &ldquo;Download anyway&rdquo; prompts — with live auto-updates, full GPS, and Camera access.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstallPwa}
            className="px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shrink-0 shadow-md transition"
          >
            <Download className="w-4 h-4" />
            {pwaInstalled ? 'SafarGo Installed ✓' : 'Install SafarGo App Now'}
          </button>
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
                  {latestApk ? `v${latestApk.version} · ${latestApk.file_size_mb} MB` : 'v1.2.0'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">SafarGo Android APK (Manual Sideload)</h2>
              <p className="text-xs sm:text-sm text-slate-600">
                {latestApk?.release_notes ||
                  'Standalone Android APK (SafarGo.apk) with Native Android GPS Bridge for Customers, Bike & AC Car Captains & Parcels.'}
              </p>
              <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-[11px] text-emerald-950 leading-relaxed">
                <strong>100% Virus-Free &amp; Safe:</strong> Outside Google Play Store, Android displays a standard <em>&ldquo;File might be harmful / Unknown app&rdquo;</em> prompt for direct <code>.apk</code> sideloads. Use <strong>Install SafarGo App Now</strong> above for instant warning-free installation.
              </div>
              <div className="text-xs text-slate-500 mono-num">
                File: <strong>{latestApk?.file_name || 'SafarGo.apk'}</strong> · Downloads: {latestApk?.download_count ?? 0}
              </div>
            </div>
            <button
              onClick={() => handleDownload(latestApk)}
              className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-[#009E4D] hover:bg-[#008741] inline-flex items-center justify-center gap-2 transition"
            >
              <Download className="w-4 h-4" />
              Download SafarGo APK (v{latestApk?.version || '1.2.0'})
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
                  {latestExe ? `v${latestExe.version} · ${latestExe.file_size_mb} MB` : 'v1.1.0'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">SafarGo Windows Dispatch Desk</h2>
              <p className="text-xs sm:text-sm text-slate-600">
                {latestExe?.release_notes ||
                  'Desktop application (SafarGoDesk.exe) for live ride monitoring, captain verification, settlements, and P&L reports.'}
              </p>
              <div className="text-xs text-slate-500 mono-num">
                File: <strong>{latestExe?.file_name || 'SafarGoDesk.exe'}</strong> · Downloads: {latestExe?.download_count ?? 0}
              </div>
            </div>
            <button
              onClick={() => handleDownload(latestExe)}
              className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 inline-flex items-center justify-center gap-2 transition"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Download SafarGo EXE
            </button>
          </div>
        </div>

        <div className="card-elevated rounded-2xl p-5 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#009E4D] shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-slate-600 space-y-1">
            <div className="font-bold text-slate-900">Camera &amp; GPS Ready</div>
            <p>
              Both the installed Chrome PWA and <strong>SafarGo.apk</strong> support direct camera/gallery uploads for Captain Selfie, Vehicle Photo, and CNIC verification.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
