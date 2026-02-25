'use client';

// ── BiometricToggle ────────────────────────────────────────────────────────
// این component رو داخل Profile tab قرار بده
// کاربر می‌تونه biometric رو فعال/غیرفعال کنه

import { useState, useEffect } from 'react';
import { Fingerprint, Loader2, ShieldOff } from 'lucide-react';
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
  T:         Record<string, string>;  // theme colors
}

export function BiometricToggle({ userId, userEmail, dark, T }: Props) {
  const [available, setAvailable] = useState(false);
  const [enabled,   setEnabled]   = useState(false);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(ok => {
      setAvailable(ok);
      if (ok) setEnabled(hasSavedCredential());
    });
  }, []);

  if (!available) return null;

  const toggle = async () => {
    setLoading(true);
    if (enabled) {
      removeBiometricCredential();
      setEnabled(false);
    } else {
      const ok = await registerBiometric(userId, userEmail);
      if (ok) setEnabled(true);
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-2xl"
      style={{ background: T.bgCard, border: `1px solid ${T.border}` }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: enabled ? 'rgba(79,70,229,0.12)' : 'rgba(255,255,255,0.06)' }}>
          {enabled
            ? <Fingerprint size={18} style={{ color: '#818cf8' }} />
            : <ShieldOff   size={18} style={{ color: T.textSub }} />
          }
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: T.text }}>Biometric Login</p>
          <p className="text-xs" style={{ color: T.textSub }}>
            {enabled ? 'Fingerprint / Face ID active' : 'Tap to enable quick unlock'}
          </p>
        </div>
      </div>

      <button onClick={toggle} disabled={loading}
        className="w-12 h-6 rounded-full relative shrink-0 transition-all disabled:opacity-50"
        style={{ background: enabled ? '#4f46e5' : (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)') }}>
        {loading
          ? <Loader2 size={12} className="animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white" />
          : <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
              style={{
                left:      enabled ? '26px' : '2px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
              }} />
        }
      </button>
    </div>
  );
}