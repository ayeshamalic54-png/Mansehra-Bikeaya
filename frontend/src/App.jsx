import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { DownloadsPage } from './pages/DownloadsPage';
import { CustomerApp } from './pages/CustomerApp';
import { RiderApp } from './pages/RiderApp';
import { AdminDashboard } from './pages/AdminDashboard';

function AppRouter() {
  const { user, loading } = useAuth();
  const [guestRoute, setGuestRoute] = useState('landing'); // landing | auth | downloads
  const [showDownloadsModal, setShowDownloadsModal] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-[#00A651] mx-auto animate-pulse" />
          <div className="text-sm font-bold text-slate-700">Loading Mansehra Bikeaya...</div>
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
