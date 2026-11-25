import React, { useState } from 'react';
import { ArrowLeft, Bike, Car, KeyRound, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../components/BrandLogo';
import { CaptainPhotoUploads } from '../components/CaptainPhotoUploads';

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
  const [vehicleType, setVehicleType] = useState('bike');
  const [bikeModel, setBikeModel] = useState('Honda CD-70');
  const [bikePlate, setBikePlate] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [zoneName, setZoneName] = useState('Main Bazar / Lari Adda');
  const [photos, setPhotos] = useState({
    rider_photo: '',
    vehicle_photo: '',
    cnic_front_photo: '',
    cnic_back_photo: '',
  });
  const [showDocUpload, setShowDocUpload] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handlePhotoChange = (key, dataUrl) => {
    setPhotos((prev) => ({ ...prev, [key]: dataUrl }));
  };

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
          vehicle_type: role === 'rider' ? vehicleType : null,
          bike_model: role === 'rider' ? bikeModel : null,
          bike_plate: role === 'rider' ? bikePlate : null,
          license_no: role === 'rider' ? licenseNo : null,
          zone_name: role === 'rider' ? zoneName : null,
          rider_photo: role === 'rider' && photos.rider_photo ? photos.rider_photo : null,
          vehicle_photo: role === 'rider' && photos.vehicle_photo ? photos.vehicle_photo : null,
          cnic_front_photo: role === 'rider' && photos.cnic_front_photo ? photos.cnic_front_photo : null,
          cnic_back_photo: role === 'rider' && photos.cnic_back_photo ? photos.cnic_back_photo : null,
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Structured Top Header */}
      <header className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <BrandLogo subtitle="Bike · AC Car · Parcel Portal" />
          <button
            onClick={() => onNavigate('landing')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Home
          </button>
        </div>
      </header>

      {/* Main Centered Auth Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className={`w-full ${mode === 'register' && role === 'rider' ? 'max-w-xl' : 'max-w-md'} card-elevated rounded-3xl overflow-hidden transition-all`}>
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 px-6 py-5 text-white">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-emerald-300 text-[11px] font-semibold mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              SafarGo Secure Account Access
            </div>
            <h1 className="text-lg font-extrabold tracking-tight">
              {mode === 'login' ? 'Sign In to Your Portal' : 'Create Your SafarGo Account'}
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Passengers, Bike &amp; AC Car Captains &amp; Admin access from one place.
            </p>
          </div>

          <div className="p-6 space-y-5">
            {/* Login / Register Switcher */}
            <div className="grid grid-cols-2 bg-slate-100/90 p-1 rounded-xl border border-slate-200/70">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 text-[#009E4D]" />
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 text-[#009E4D]" />
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
                    <label className="font-bold text-slate-700 block mb-1.5">Phone Number or Email</label>
                    <input
                      type="text"
                      required
                      placeholder="03XX-XXXXXXX or email"
                      value={phoneOrEmail}
                      onChange={(e) => setPhoneOrEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-[#009E4D] focus:ring-2 focus:ring-[#009E4D]/15 transition"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-[#009E4D] focus:ring-2 focus:ring-[#009E4D]/15 transition"
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
                          ? 'bg-emerald-50 border-[#009E4D] text-[#008741]'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      Customer (Book Ride)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('rider')}
                      className={`py-2.5 rounded-xl font-bold border transition flex items-center justify-center gap-1.5 ${
                        role === 'rider'
                          ? 'bg-teal-50 border-teal-600 text-teal-800'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <Bike className="w-3.5 h-3.5" />
                      <Car className="w-3.5 h-3.5" />
                      Bike / Car Captain
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
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-[#009E4D]"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Mobile Number</label>
                      <input
                        type="text"
                        required
                        placeholder="03XX-XXXXXXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-[#009E4D]"
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
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-[#009E4D]"
                      />
                    </div>
                  </div>

                  {role === 'rider' && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-bold text-teal-800">Captain Vehicle &amp; CNIC Details</div>
                        <div className="inline-flex rounded-xl bg-white border border-slate-200 p-0.5 text-[11px] font-bold">
                          <button
                            type="button"
                            onClick={() => {
                              setVehicleType('bike');
                              if (bikeModel === 'Suzuki Alto' || bikeModel === 'Toyota Corolla') {
                                setBikeModel('Honda CD-70');
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1 ${
                              vehicleType === 'bike' ? 'bg-[#009E4D] text-white' : 'text-slate-600'
                            }`}
                          >
                            <Bike className="w-3.5 h-3.5" />
                            Motorbike
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVehicleType('car');
                              if (bikeModel === 'Honda CD-70' || bikeModel === 'Honda CG-125') {
                                setBikeModel('Suzuki Alto');
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1 ${
                              vehicleType === 'car' ? 'bg-[#009E4D] text-white' : 'text-slate-600'
                            }`}
                          >
                            <Car className="w-3.5 h-3.5" />
                            AC Car
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          placeholder={vehicleType === 'car' ? 'Car Model (Alto / Corolla / Vitz)' : 'Bike Model (CD-70 / CG-125)'}
                          value={bikeModel}
                          onChange={(e) => setBikeModel(e.target.value)}
                          className="px-3 py-2 rounded-lg border border-slate-200 bg-white"
                        />
                        <input
                          type="text"
                          required
                          placeholder={vehicleType === 'car' ? 'Car Plate (MNC-2040)' : 'Bike Plate (MNA-1234)'}
                          value={bikePlate}
                          onChange={(e) => setBikePlate(e.target.value)}
                          className="px-3 py-2 rounded-lg border border-slate-200 bg-white uppercase"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="CNIC (13503-...)"
                          value={cnic}
                          onChange={(e) => setCnic(e.target.value)}
                          className="px-3 py-2 rounded-lg border border-slate-200 bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Driving License #"
                          value={licenseNo}
                          onChange={(e) => setLicenseNo(e.target.value)}
                          className="px-3 py-2 rounded-lg border border-slate-200 bg-white"
                        />
                      </div>
                      <select
                        value={zoneName}
                        onChange={(e) => setZoneName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-semibold"
                      >
                        {bootstrap.zones.map((z) => (
                          <option key={z.id} value={z.name}>
                            Primary Hub: {z.name}
                          </option>
                        ))}
                      </select>

                      <div className="pt-2 border-t border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-900">
                            Verification Photos ({vehicleType === 'car' ? 'Car Captain' : 'Bike Captain'})
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowDocUpload((v) => !v)}
                            className="text-[11px] font-bold text-[#009E4D] underline"
                          >
                            {showDocUpload ? 'Upload Later in Profile' : 'Show Photo Uploads'}
                          </button>
                        </div>
                        {showDocUpload && (
                          <CaptainPhotoUploads
                            vehicleType={vehicleType}
                            photos={photos}
                            onChangePhoto={handlePhotoChange}
                            compact={true}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-[#009E4D] hover:bg-[#008741] shadow-sm shadow-emerald-900/10 disabled:opacity-60 transition"
              >
                {busy ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
