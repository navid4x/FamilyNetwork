// ── Background Prefetch ────────────────────────────────────────────────────
// بعد از login، همه پیام‌های همه مکالمات رو در پس‌زمینه کش می‌کنه

import { supabase } from './supabase';
import { cache } from './cache';

/**
 * همه پیام‌های direct و group رو برای یه کاربر کش می‌کنه
 * در پس‌زمینه اجرا میشه — UI رو block نمی‌کنه
 */
export async function prefetchAllMessages(userId: string, userIds: string[], groupIds: string[]) {
  try {
    // همه پیام‌های direct (یه query برای همه با هم)
    if (userIds.length > 0) {
      const { data: directMsgs, error } = await supabase
        .from('messages')
        .select('*')
        .is('group_id', null)
        .or(
          userIds
            .map(id =>
              `and(sender_id.eq.${userId},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${userId})`
            )
            .join(',')
        )
        .order('created_at', { ascending: true });

      if (!error && directMsgs && directMsgs.length > 0) {
        await cache.saveMessages(directMsgs);
        console.log(`[Prefetch] Cached ${directMsgs.length} direct messages`);
      }
    }

    // همه پیام‌های گروه‌ها
    if (groupIds.length > 0) {
      const { data: groupMsgs, error } = await supabase
        .from('messages')
        .select('*')
        .in('group_id', groupIds)
        .order('created_at', { ascending: true });

      if (!error && groupMsgs && groupMsgs.length > 0) {
        await cache.saveMessages(groupMsgs);
        console.log(`[Prefetch] Cached ${groupMsgs.length} group messages`);
      }
    }

    console.log('[Prefetch] All messages cached successfully');
  } catch (err) {
    // silent fail — آفلاین بودیم یا خطای دیگه
    console.warn('[Prefetch] Failed (will retry next session):', err);
  }
}

/**
 * عکس‌های پروفایل رو prefetch می‌کنه تا آفلاین نمایش داده بشن
 */
export async function prefetchAvatars(profiles: any[]) {
  const avatarUrls = profiles
    .map(p => p.avatar_url)
    .filter(Boolean) as string[];

  await Promise.allSettled(
    avatarUrls.map(url =>
      fetch(url, { mode: 'no-cors', cache: 'force-cache' }).catch(() => {})
    )
  );
}
