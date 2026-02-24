'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const CHECK_INTERVAL = 20000;

function checkViaWebSocket(url: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (result: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch {}
      resolve(result);
    };

    // تبدیل https به wss
    const wsUrl = url.replace(/^https/, 'wss').replace(/^http/, 'ws');

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      resolve(false);
      return;
    }

    // اگه WebSocket باز شد = سرور در دسترسه
    ws.onopen  = () => finish(true);
    // اگه error خورد = آفلاین یا سرور در دسترس نیست
    ws.onerror = () => finish(false);
    ws.onclose = (e) => {
      // کد 1006 = abnormal closure = network error
      // کدهای دیگه مثل 1000, 1001 = سرور جواب داد و بست = آنلاین
      finish(e.code !== 1006);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
  });
}

export function useNetworkStatus(realCheck: boolean) {
  const [isOnline, setIsOnline] = useState(true);
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkReal = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      // به realtime endpoint وصل میشیم — این endpoint همیشه WebSocket قبول میکنه
      const wsUrl = `${supabaseUrl}/realtime/v1/websocket?apikey=${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}&vsn=2.0.0`;
      const result = await checkViaWebSocket(wsUrl, 4000);
      setIsOnline(result);
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!realCheck) {
      const update = () => setIsOnline(navigator.onLine);
      update();
      window.addEventListener('online', update);
      window.addEventListener('offline', update);
      return () => {
        window.removeEventListener('online', update);
        window.removeEventListener('offline', update);
      };
    }

    checkReal();
    timerRef.current = setInterval(checkReal, CHECK_INTERVAL);

    const onOnline  = () => checkReal();
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [realCheck, checkReal]);

  return { isOnline, checkReal, checking };
}