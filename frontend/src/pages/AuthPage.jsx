import React, { useState } from 'react';
import { ArrowLeft, Bike, KeyRound, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../components/BrandLogo';

export function AuthPage({ onNavigate }) {
  const { login, register, bootstrap } = useAuth();
  const [mode, setMode] = useState('login'); // login | register
  const [role, setRole] = useState('customer'); // customer | rider
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cnic, setCnic] = useState('');
  const [bikeModel, setBikeModel] = useState('Honda CD-70');
  const [bikePlate, setBikePlate] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [zoneName, setZoneName] = useState('Main Bazar / Lari Adda');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(phoneOrEmail, password);
      } else {
        await register({
          full_name: fullName,
          phone,
          email: email || null,
          password,
          role,
          cnic_number: role === 'rider' ? cnic : null,
          bike_model: role === 'rider' ? bikeModel : null,
          bike_plate: role === 'rider' ? bikePlate : null,
          license_no: role === 'rider' ? licenseNo : null,
          zone_name: role === 'rider' ? zoneName : null,
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const quickLogin = async (uPhone, uPass) => {
    setError('');
    setBusy(true);
    try {
      await login(uPhone, uPass);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6FB] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => onNavigate('landing')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
          <BrandLogo subtitle="" />
        </div>

        <div className="bg-white border border-[#E6E9F2] rounded-3xl p-6 shadow-sm space-y-5">
          {/* Login / Register Toggle */}
          <div className="grid grid-cols-2 bg-[#F4F6FB] p-1 rounded-xl border border-[#E6E9F2]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                mode === 'login' ? 'bg-[#00A651] text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                mode === 'register' ? 'bg-[#00A651] text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              New Account
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {mode === 'login' ? (
              <>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number or Email</label>
                  <input
                    type="text"
                    required
                    placeholder="03001111111"
                    value={phoneOrEmail}
                    onChange={(e) => setPhoneOrEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB] focus:outline-none focus:ring-2 focus:ring-[#00A651]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB] focus:outline-none focus:ring-2 focus:ring-[#00A651]"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('customer')}
                    className={`py-2.5 rounded-xl font-bold border transition ${
                      role === 'customer'
                        ? 'bg-emerald-50 border-[#00A651] text-[#008E46]'
                        : 'bg-[#F4F6FB] border-[#E6E9F2] text-slate-600'
                    }`}
                  >
                    Customer (Book Ride)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('rider')}
                    className={`py-2.5 rounded-xl font-bold border transition flex items-center justify-center gap-1 ${
                      role === 'rider'
                        ? 'bg-fuchsia-50 border-[#EC1FA8] text-[#9C1794]'
                        : 'bg-[#F4F6FB] border-[#E6E9F2] text-slate-600'
                    }`}
                  >
                    <Bike className="w-3.5 h-3.5" />
                    Bike Captain
                  </button>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Muhammad Ali"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Mobile Number</label>
                    <input
                      type="text"
                      required
                      placeholder="03011234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB]"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Password</label>
                    <input
                      type="password"
                      required
                      minLength={4}
                      placeholder="Min 4 chars"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] bg-[#F4F6FB]"
                    />
                  </div>
                </div>

                {role === 'rider' && (
                  <div className="p-3 rounded-2xl bg-[#F4F6FB] border border-[#E6E9F2] space-y-2.5">
                    <div className="font-bold text-[#9C1794]">Motorbike Captain Details</div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Bike Model (CD-70)"
                        value={bikeModel}
                        onChange={(e) => setBikeModel(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-[#E6E9F2] bg-white"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Plate (MNA-1234)"
                        value={bikePlate}
                        onChange={(e) => setBikePlate(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-[#E6E9F2] bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="CNIC (13503-...)"
                        value={cnic}
                        onChange={(e) => setCnic(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-[#E6E9F2] bg-white"
                      />
                      <input
                        type="text"
                        placeholder="License #"
                        value={licenseNo}
                        onChange={(e) => setLicenseNo(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-[#E6E9F2] bg-white"
                      />
                    </div>
                    <select
                      value={zoneName}
                      onChange={(e) => setZoneName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#E6E9F2] bg-white font-semibold"
                    >
                      {bootstrap.zones.map((z) => (
                        <option key={z.id} value={z.name}>
                          Primary Zone: {z.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-[#00A651] hover:bg-[#008E46] disabled:opacity-60 transition"
            >
              {busy ? 'Please wait...' : mode === 'login' ? 'Login to Dashboard' : 'Create Account'}
            </button>
          </form>

          {/* Demo Accounts Switcher */}
          <div className="pt-4 border-t border-[#EEF1F7] space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Quick Demo Access (Seeded Accounts)
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                disabled={busy}
                onClick={() => quickLogin('03001111111', 'admin123')}
                className="py-2 px-2 rounded-xl bg-slate-900 text-white font-bold hover:opacity-90 transition"
              >
                Admin Owner
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => quickLogin('03112222222', 'rider123')}
                className="py-2 px-2 rounded-xl bg-fuchsia-50 border border-fuchsia-200 text-[#9C1794] font-bold hover:bg-fuchsia-100 transition"
              >
                Bike Captain
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => quickLogin('03334444444', 'user123')}
                className="py-2 px-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[#008E46] font-bold hover:bg-emerald-100 transition"
              >
                Customer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
