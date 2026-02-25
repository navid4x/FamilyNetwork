'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cache } from '@/lib/cache';
import {
  isBiometricAvailable,
  hasSavedCredential,
  registerBiometric,
  authenticateWithBiometric,
  removeBiometricCredential,
} from '@/lib/webauthn';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Loader2, WifiOff, Fingerprint, ShieldCheck, X } from 'lucide-react';

type Stage = 'checking' | 'biometric' | 'login' | 'register-bio';

export default function LoginPage() {
  const [stage, setStage]           = useState<Stage>('checking');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [isOnline, setIsOnline]     = useState(true);
  const [bioAvailable, setBioAvailable] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const up = () => setIsOnline(true);
    const dn = () => setIsOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', dn);

    const init = async () => {
      const [bioOk, hasCred] = await Promise.all([
        isBiometricAvailable(),
        hasSavedCredential(),
      ]);
      setBioAvailable(bioOk);
      // اگه credential ذخیره‌شده داریم → مستقیم صفحه بیومتریک
      setStage(bioOk && hasCred ? 'biometric' : 'login');
    };
    init();

    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', dn); };
  }, []);

  // ── ورود با بیومتریک ──────────────────────────────────────────────────────
  const handleBiometric = async () => {
    setBioLoading(true);
    setError(null);

    // پسورد decrypt میشه (بیومتریک تأیید لازمه)
    const password = await authenticateWithBiometric();

    if (!password) {
      setError('Biometric verification failed. Try password instead.');
      setBioLoading(false);
      return;
    }

    // email رو از cache می‌خونیم چون کاربر وارد نکرده
    const cachedSession = await cache.getSession().catch(() => null);
    const userEmail = cachedSession?.userData?.email ?? '';

    const { data: data2, error: authErr2 } = await supabase.auth.signInWithPassword({
      email:    userEmail,
      password: password,
    });

    if (authErr2 || !data2?.session) {
      // پسورد عوض شده یا session مشکل داره — credential رو پاک کن
      await removeBiometricCredential();
      setStage('login');
      setError('Session expired. Please login with your password.');
      setBioLoading(false);
      return;
    }

    await cache.saveSession(data2.user.id, data2.user).catch(() => {});
    router.push('/');
  };

  // ── ورود با ایمیل / پسورد ─────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) return;
    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !data.session) {
      setError('Incorrect email or password.');
      setLoading(false);
      return;
    }

    await cache.saveSession(data.user.id, data.user).catch(() => {});

    // اگه biometric موجوده ولی هنوز ثبت نشده → پیشنهاد بده
    const hasCred = await hasSavedCredential();
    if (bioAvailable && !hasCred) {
      setStage('register-bio');
    } else {
      router.push('/');
    }

    setLoading(false);
  };

  // ── ثبت بیومتریک بعد از لاگین موفق ──────────────────────────────────────
  const handleRegisterBio = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }

    setBioLoading(true);
    // password رو از فرم داریم — قبل از اینجا لاگین شده
    await registerBiometric(user.id, user.email ?? '', password);
    setBioLoading(false);
    router.push('/');
  };

  if (stage === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d14' }}>
        <Loader2 className="animate-spin text-indigo-400" size={28} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100">

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4">
            <img src="/icon-192.png" alt="FamilyChat" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">FamilyChat</h1>
          <p className="text-slate-500 mt-2 text-sm">
            {stage === 'biometric'    && 'Use biometrics to sign in'}
            {stage === 'login'        && 'Welcome back! Please login.'}
            {stage === 'register-bio' && 'Enable faster login'}
          </p>
        </div>

        {!isOnline && stage === 'login' && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 text-red-600 rounded-2xl px-4 py-3 mb-5">
            <WifiOff size={18} className="shrink-0" />
            <div>
              <p className="text-sm font-semibold">You're offline</p>
              <p className="text-xs text-red-400 mt-0.5">Check your connection and try again.</p>
            </div>
          </div>
        )}

        {/* ── بیومتریک ── */}
        {stage === 'biometric' && (
          <div className="flex flex-col items-center gap-5">
            <button onClick={handleBiometric} disabled={bioLoading}
              className="w-24 h-24 rounded-3xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 8px 32px rgba(79,70,229,0.4)' }}>
              {bioLoading
                ? <Loader2 size={36} className="text-white animate-spin" />
                : <Fingerprint size={36} className="text-white" />}
            </button>
            <div className="text-center">
              <p className="font-semibold text-slate-700">{bioLoading ? 'Verifying…' : 'Tap to sign in'}</p>
              <p className="text-xs text-slate-400 mt-1">Touch the fingerprint sensor or use Face ID</p>
            </div>
            {error && (
              <div className="w-full bg-red-50 text-red-600 p-3 rounded-xl text-sm text-center">{error}</div>
            )}
            <button onClick={() => { setStage('login'); setError(null); }}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors mt-2">
              Use password instead
            </button>
          </div>
        )}

        {/* ── فرم لاگین ── */}
        {stage === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                <input type="email" required disabled={!isOnline}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 disabled:opacity-50"
                  placeholder="Enter your email"
                  value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                <input type="password" required disabled={!isOnline}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 disabled:opacity-50"
                  placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            </div>
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">{error}</div>}
            <button type="submit" disabled={loading || !isOnline}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={20} />
                : !isOnline ? <><WifiOff size={18} /> No Connection</>
                : 'Login to Chat'}
            </button>
            {/* دکمه بیومتریک اگه credential قبلی داره */}
            {bioAvailable && (
              <BioSwitchButton onClick={async () => {
                const hasCred = await hasSavedCredential();
                if (hasCred) { setStage('biometric'); setError(null); }
              }} />
            )}
          </form>
        )}

        {/* ── پیشنهاد ثبت بیومتریک ── */}
        {stage === 'register-bio' && (
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)' }}>
              <ShieldCheck size={36} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Enable Biometric Login?</h2>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Next time, skip the password and sign in instantly with your fingerprint or Face ID.
              </p>
            </div>
            {error && <div className="w-full bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
            <button onClick={handleRegisterBio} disabled={bioLoading}
              className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              {bioLoading ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={18} />}
              {bioLoading ? 'Setting up…' : 'Enable Biometrics'}
            </button>
            <button onClick={() => router.push('/')}
              className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1">
              <X size={14} /> Not now
            </button>
          </div>
        )}

        <p className="text-center mt-8 text-xs text-slate-400 uppercase tracking-widest">
          Secured Family Network
        </p>
      </div>
    </div>
  );
}

function BioSwitchButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-indigo-600 border border-indigo-100 hover:bg-indigo-50 transition-colors">
      <Fingerprint size={16} />
      Use biometrics instead
    </button>
  );
}