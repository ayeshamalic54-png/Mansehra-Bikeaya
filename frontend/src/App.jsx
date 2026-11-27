import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { DownloadsPage } from './pages/DownloadsPage';
import { CustomerApp } from './pages/CustomerApp';
import { RiderApp } from './pages/RiderApp';
import { AdminDashboard } from './pages/AdminDashboard';

function AppRouter() {
  const { user, loading, serverWaking, dbError, refreshBootstrap } = useAuth();
  const [retryingDb, setRetryingDb] = useState(false);
  const [guestRoute, setGuestRoute] = useState(() =>
    typeof window !== 'undefined' && window.location.pathname === '/downloads' ? 'downloads' : 'landing'
  ); // landing | auth | downloads
  const [showDownloadsModal, setShowDownloadsModal] = useState(
    () => typeof window !== 'undefined' && window.location.pathname === '/downloads'
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2.5 max-w-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#009E4D] mx-auto animate-pulse flex items-center justify-center text-white font-extrabold text-lg">
            S
          </div>
          <div className="text-sm font-extrabold text-slate-900">
            {serverWaking ? 'Waking SafarGo Live Server...' : 'Loading SafarGo...'}
          </div>
          {serverWaking && (
            <div className="text-xs text-slate-500">
              Server is waking from sleep — auto-connecting (10–30s)...
            </div>
          )}
        </div>
      </div>
    );
  }

  if (dbError) {
    const isQuota = dbError.code === 'db_quota_exceeded';
    return (
      <div className="min-h-screen bg-[#F4F6FB] flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#009E4D] text-white font-extrabold text-lg flex items-center justify-center shrink-0">
              S
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900">
                {isQuota ? 'SafarGo Database Quota Reached' : 'SafarGo Database Maintenance'}
              </h1>
              <p className="text-xs font-semibold text-emerald-700">
                Render Web Server Online · Emergency Helplines Active
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-950 space-y-1.5">
            <div className="font-extrabold">
              {isQuota
                ? 'Neon PostgreSQL Free Plan quota exceeded — server is online, but the database cannot connect.'
                : 'PostgreSQL Database temporarily unreachable.'}
            </div>
            <div className="text-amber-900/90 break-words">{dbError.message}</div>
          </div>

          <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5">
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-red-700 mb-2">
              24/7 Emergency Helplines (Always Active)
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <a
                href="tel:15"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white py-2.5 px-3 text-xs font-extrabold text-center"
              >
                Police Help · 15
              </a>
              <a
                href="tel:1122"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white py-2.5 px-3 text-xs font-extrabold text-center"
              >
                Rescue · 1122
              </a>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-700 space-y-1">
            <div className="font-extrabold text-slate-900">Admin Quick Fix:</div>
            <p>1. Upgrade plan in Neon Console, OR create a new PostgreSQL DB and update <code className="bg-slate-200 px-1 rounded">DATABASE_URL</code> in Render Environment.</p>
            <p>2. Then upload your <code className="bg-slate-200 px-1 rounded">.json.gz</code> backup under Admin &rarr; Backup &amp; Restore to restore in 1 click.</p>
          </div>

          <button
            type="button"
            disabled={retryingDb}
            onClick={async () => {
              setRetryingDb(true);
              await refreshBootstrap({ retryOnWake: false });
              setRetryingDb(false);
            }}
            className="w-full rounded-2xl bg-[#009E4D] hover:bg-[#008540] disabled:opacity-60 text-white font-extrabold py-3 text-sm transition"
          >
            {retryingDb ? 'Checking Database...' : 'Retry Database Connection'}
          </button>
        </div>
      </div>
    );
  }

  if (showDownloadsModal) {
    return <DownloadsPage onBack={() => setShowDownloadsModal(false)} />;
  }

  if (!user) {
    if (guestRoute === 'downloads') {
      return <DownloadsPage onBack={() => setGuestRoute('landing')} />;
    }
    if (guestRoute === 'auth') {
      return <AuthPage onNavigate={setGuestRoute} />;
    }
    return <LandingPage onNavigate={setGuestRoute} />;
  }

  if (user.role === 'admin') {
    return <AdminDashboard onOpenDownloads={() => setShowDownloadsModal(true)} />;
  }
  if (user.role === 'rider') {
    return <RiderApp onOpenDownloads={() => setShowDownloadsModal(true)} />;
  }
  return <CustomerApp onOpenDownloads={() => setShowDownloadsModal(true)} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
