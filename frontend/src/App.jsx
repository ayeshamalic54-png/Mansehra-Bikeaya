import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { DownloadsPage } from './pages/DownloadsPage';
import { CustomerApp } from './pages/CustomerApp';
import { RiderApp } from './pages/RiderApp';
import { AdminDashboard } from './pages/AdminDashboard';

function AppRouter() {
  const { user, loading, serverWaking } = useAuth();
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
              Server sleep se start ho raha hai — auto-connect ho raha hai (10–30s)...
            </div>
          )}
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
