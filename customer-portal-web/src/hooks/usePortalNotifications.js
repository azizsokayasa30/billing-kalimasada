import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client';

export const PORTAL_NOTIF_READ_AT_KEY = 'portal_notif_read_at';
const SEEN_IDS_KEY = 'portal_notif_seen_ids_v1';

function loadSeenIdSet() {
  try {
    const raw = sessionStorage.getItem(SEEN_IDS_KEY);
    const arr = JSON.parse(raw || '[]');
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function persistSeenIdSet(set) {
  try {
    const arr = [...set].slice(-400);
    sessionStorage.setItem(SEEN_IDS_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

/** Tandai semua notifikasi saat ini sudah dibaca (halaman Notifikasi). */
export function markNotificationsRead() {
  try {
    localStorage.setItem(PORTAL_NOTIF_READ_AT_KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

/**
 * Polling /notifications untuk badge lonceng + Web Notification (browser) untuk item baru.
 */
export function usePortalNotifications(enabled) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const seenIdsRef = useRef(null);

  const poll = useCallback(async () => {
    if (!enabled) return;
    try {
      const { data } = await api.get('/notifications');
      if (!data?.success) return;
      const items = data.items || [];

      const readAt = localStorage.getItem(PORTAL_NOTIF_READ_AT_KEY);
      const readTs = readAt ? new Date(readAt).getTime() : 0;
      setUnreadCount(items.filter((i) => new Date(i.created_at).getTime() > readTs).length);

      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        return;
      }

      if (seenIdsRef.current === null) {
        const merged = loadSeenIdSet();
        items.forEach((i) => merged.add(i.id));
        seenIdsRef.current = merged;
        persistSeenIdSet(merged);
        return;
      }

      for (const it of items) {
        if (seenIdsRef.current.has(it.id)) continue;
        seenIdsRef.current.add(it.id);
        try {
          const n = new Notification(it.title, {
            body: (it.body || '').slice(0, 240),
            tag: String(it.id),
          });
          void n;
        } catch {
          /* ignore */
        }
      }
      persistSeenIdSet(seenIdsRef.current);
    } catch {
      /* ignore */
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    poll();
    const t = setInterval(poll, 75_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled, poll]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof Notification === 'undefined') return;
    setPermission(Notification.permission);
  }, [enabled]);

  const requestBrowserPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'unsupported';
    try {
      const r = await Notification.requestPermission();
      setPermission(r);
      if (r === 'granted') poll();
      return r;
    } catch {
      return 'denied';
    }
  }, [poll]);

  return { unreadCount, poll, requestBrowserPermission, permission };
}
