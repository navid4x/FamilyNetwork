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

type Stage =
  | 'checking'       // در حال بررسی وضعیت
  | 'biometric'      // صفحه اثر انگشت
  | 'login'          // فرم لاگین معمولی
  | 'register-bio';  // پیشنهاد ثبت اثر انگشت بعد از لاگین

export default function LoginPage() {
  const [stage, setStage]       = useState<Stage>('checking');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [bioAvailable, setBioAvailable] = useState(false);
  const router = useRouter();

  // ── بررسی اولیه: آیا session کش‌شده + credential داریم؟ ──────────────────
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    const init = async () => {
      const [bioOk, hasSession] = await Promise.all([
        isBiometricAvailable(),
        cache.getSession().then(s => !!s).catch(() => false),
      ]);

      setBioAvailable(bioOk);

      if (bioOk && hasSavedCredential() && hasSession) {
        // شرایط ایده‌آل: اثر انگشت بخواد
        setStage('biometric');
      } else {
        // فرم معمولی
        setStage('login');
      }
    };

    init();

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── ورود با اثر انگشت ─────────────────────────────────────────────────────
  const handleBiometric = async () => {
    setBioLoading(true);
    setError(null);

    const ok = await authenticateWithBiometric();

    if (ok) {
      // session از کش بخونیم — supabase session هنوز معتبره
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/');
        return;
      }
      // session expire شده — برو لاگین معمولی
      removeBiometricCredential();
      setStage('login');
      setError('Session expired. Please login again.');
    } else {
      setError('Biometric verification failed. Try again or use password.');
    }

    setBioLoading(false);
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

    // session رو cache کن
    await cache.saveSession(data.user.id, data.user).catch(() => {});

    // اگه biometric موجوده ولی هنوز ثبت نشده → پیشنهاد بده
    if (bioAvailable && !hasSavedCredential()) {
      setStage('register-bio');
    } else {
      router.push('/');
    }

    setLoading(false);
  };

  // ── ثبت اثر انگشت ─────────────────────────────────────────────────────────
  const handleRegisterBio = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }

    setBioLoading(true);
    const ok = await registerBiometric(user.id, user.email || '');
    setBioLoading(false);

    router.push('/');
    // اگه ناموفق بود هم می‌ریم داخل — مشکلی نیست
  };

  // ── Loading اولیه ──────────────────────────────────────────────────────────
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

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4">
            <img src="/icon-192.png" alt="FamilyChat" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">FamilyChat</h1>
          <p className="text-slate-500 mt-2 text-sm">
            {stage === 'biometric'     && 'Use biometrics to unlock'}
            {stage === 'login'         && 'Welcome back! Please login.'}
            {stage === 'register-bio'  && 'Enable faster login'}
          </p>
        </div>

        {/* Offline banner */}
        {!isOnline && stage === 'login' && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 text-red-600 rounded-2xl px-4 py-3 mb-5">
            <WifiOff size={18} className="shrink-0" />
            <div>
              <p className="text-sm font-semibold">You're offline</p>
              <p className="text-xs text-red-400 mt-0.5">Check your connection and try again.</p>
            </div>
          </div>
        )}

        {/* ── STAGE: biometric ── */}
        {stage === 'biometric' && (
          <div className="flex flex-col items-center gap-5">
            <button
              onClick={handleBiometric}
              disabled={bioLoading}
              className="w-24 h-24 rounded-3xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                boxShadow: '0 8px 32px rgba(79,70,229,0.4)',
              }}
            >
              {bioLoading
                ? <Loader2 size={36} className="text-white animate-spin" />
                : <Fingerprint size={36} className="text-white" />
              }
            </button>

            <div className="text-center">
              <p className="font-semibold text-slate-700">
                {bioLoading ? 'Verifying…' : 'Tap to unlock'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Touch the fingerprint sensor or use Face ID
              </p>
            </div>

            {error && (
              <div className="w-full bg-red-50 text-red-600 p-3 rounded-xl text-sm text-center">
                {error}
              </div>
            )}

            <button
              onClick={() => { setStage('login'); setError(null); }}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors mt-2"
            >
              Use password instead
            </button>
          </div>
        )}

        {/* ── STAGE: login (form) ── */}
        {stage === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                <input
                  type="email" required disabled={!isOnline}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter your email"
                  value={email} onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                <input
                  type="password" required disabled={!isOnline}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">{error}</div>
            )}

            <button
              type="submit" disabled={loading || !isOnline}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {loading
                ? <Loader2 className="animate-spin" size={20} />
                : !isOnline
                  ? <><WifiOff size={18} /> No Connection</>
                  : 'Login to Chat'
              }
            </button>

            {/* اگه credential قبلی داره ولی میخواد با پسورد وارد بشه */}
            {bioAvailable && hasSavedCredential() && (
              <button type="button"
                onClick={() => { setStage('biometric'); setError(null); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-indigo-600 border border-indigo-100 hover:bg-indigo-50 transition-colors"
              >
                <Fingerprint size={16} />
                Use biometrics instead
              </button>
            )}
          </form>
        )}

        {/* ── STAGE: پیشنهاد ثبت اثر انگشت ── */}
        {stage === 'register-bio' && (
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)' }}>
              <ShieldCheck size={36} className="text-emerald-500" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-800">Enable Biometric Login?</h2>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Next time, skip the password and unlock instantly with your fingerprint or Face ID.
              </p>
            </div>

            {error && (
              <div className="w-full bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>
            )}

            <button
              onClick={handleRegisterBio}
              disabled={bioLoading}
              className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            >
              {bioLoading
                ? <Loader2 size={18} className="animate-spin" />
                : <Fingerprint size={18} />
              }
              {bioLoading ? 'Setting up…' : 'Enable Biometrics'}
            </button>

            <button
              onClick={() => router.push('/')}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
            >
              <X size={14} />
              Not now
            </button>
          </div>
        )}

        <p className="text-center mt-8 text-xs text-slate-400 uppercase tracking-widest font-sans">
          Secured Family Network
        </p>
      </div>
    </div>
  );
}