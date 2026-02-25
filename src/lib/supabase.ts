import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ── Disconnect event bus ──────────────────────────────────────────────────
type Listener = () => void;
const disconnectListeners = new Set<Listener>();

export function onWsDisconnect(fn: Listener): () => void {
  disconnectListeners.add(fn);
  return () => disconnectListeners.delete(fn);
}

// ── Custom WebSocket با dead-man timer ───────────────────────────────────
// Supabase هر 3 ثانیه heartbeat میفرسته.
// اگه 6 ثانیه هیچ پیامی نیومد یعنی اینترنت قطعه.
function makeTrackedWs(url: string, protocols?: string | string[]): WebSocket {

   const ws = protocols ? new WebSocket(url, protocols) : new WebSocket(url);
   let aliveTimer: ReturnType<typeof setTimeout> | null = null;
  let dead = false;

  function markDead() {
    if (dead) return;
    dead = true;
    if (aliveTimer) { clearTimeout(aliveTimer); aliveTimer = null; }
    disconnectListeners.forEach(fn => fn());
  }

  function resetTimer() {
    if (dead) return;
    if (aliveTimer) clearTimeout(aliveTimer);
    aliveTimer = setTimeout(markDead, 6000);
  }

  ws.addEventListener('open',    resetTimer);
  ws.addEventListener('message', resetTimer);
  ws.addEventListener('close',   markDead);
  ws.addEventListener('error',   markDead);

  return ws;
}

const TrackedWebSocket = function(
  this: unknown,
  url: string,
  protocols?: string | string[]
) {
  return makeTrackedWs(url, protocols);
} as unknown as typeof WebSocket;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    heartbeatIntervalMs: 3000,
    transport: TrackedWebSocket,
  },
});