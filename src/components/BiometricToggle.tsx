'use client';

import { useState, useEffect } from 'react';
import { Fingerprint, Loader2, ShieldOff, Eye, EyeOff } from 'lucide-react';
import {
  isBiometricAvailable,
  hasSavedCredential,
  registerBiometric,
  removeBiometricCredential,
} from '@/lib/webauthn';

interface Props {
  userId:    string;
  userEmail: string;
  dark:      boolean;
  T:         Record<string, string>;
}

export function BiometricToggle({ userId, userEmail, dark, T }: Props) {
  const [available, setAvailable] = useState(false);
  const [enabled,   setEnabled]   = useState(false);
  const [loading,   setLoading]   = useState(false);

  // برای prompt رمز عبور
  const [showPrompt, setShowPrompt] = useState(false);
  const [inputPassword, setInputPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);

  // ── init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const ok = await isBiometricAvailable();
      setAvailable(ok);
      if (ok) {
        const has = await hasSavedCredential();
        setEnabled(has);
      }
    })();
  }, []);

  if (!available) return null;

  // ── toggle handler ─────────────────────────────────────────────────────
  const toggle = async () => {
    if (enabled) {
      // غیرفعال کردن
      setLoading(true);
      await removeBiometricCredential();
      setEnabled(false);
      setLoading(false);
      return;
    }

    // فعال کردن → نمایش prompt رمز عبور
    setShowPrompt(true);
    setInputPassword('');
    setShowPass(false);
  };

  const handleEnableWithPassword = async () => {
    if (!inputPassword.trim()) return;

    setPromptLoading(true);
    const ok = await registerBiometric(userId, userEmail, inputPassword.trim());

    if (ok) {
      setEnabled(true);
      setShowPrompt(false);
      setInputPassword('');
    } else {
      alert('ثبت بیومتریک با شکست مواجه شد. رمز عبور را بررسی کنید.');
    }
    setPromptLoading(false);
  };

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex items-center justify-between p-4 rounded-2xl"
        style={{ background: T.bgCard, border: `1px solid ${T.border}` }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: enabled ? 'rgba(79,70,229,0.12)' : 'rgba(255,255,255,0.06)' }}>
            {enabled
              ? <Fingerprint size={18} style={{ color: '#818cf8' }} />
              : <ShieldOff size={18} style={{ color: T.textSub }} />
            }
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: T.text }}>ورود با اثر انگشت / Face ID</p>
            <p className="text-xs" style={{ color: T.textSub }}>
              {enabled ? 'فعال است' : 'برای ورود سریع‌تر فعال کنید'}
            </p>
          </div>
        </div>

        <button onClick={toggle} disabled={loading}
          className="w-12 h-6 rounded-full relative shrink-0 transition-all disabled:opacity-50"
          style={{ background: enabled ? '#4f46e5' : (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)') }}>
          {loading ? (
            <Loader2 size={12} className="animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white" />
          ) : (
            <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
              style={{
                left: enabled ? '26px' : '2px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
              }} />
          )}
        </button>
      </div>

      {/* Prompt رمز عبور */}
      {showPrompt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-sm">
            <p className="text-lg font-semibold mb-4">رمز عبور خود را وارد کنید</p>
            <p className="text-sm text-zinc-500 mb-4">برای فعال کردن بیومتریک، رمز عبور فعلی خود را وارد کنید.</p>

            <div className="relative mb-6">
              <input
                type={showPass ? 'text' : 'password'}
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyDown={(e) => e.key === 'Enter' && handleEnableWithPassword()}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPrompt(false)}
                className="flex-1 py-3 rounded-2xl font-medium border border-zinc-300 dark:border-zinc-700"
              >
                انصراف
              </button>
              <button
                onClick={handleEnableWithPassword}
                disabled={promptLoading || !inputPassword.trim()}
                className="flex-1 py-3 rounded-2xl font-medium bg-indigo-600 text-white disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {promptLoading ? <Loader2 size={18} className="animate-spin" /> : 'فعال کردن'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}