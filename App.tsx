import React, { useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "./src/store/authStore";
import { useOfflineStore } from "./src/store/offlineStore";
import RootNavigator from "./src/navigation";
import NetInfo from "@react-native-community/netinfo";
import { getDb } from "./src/db/schema";
import { getPendingSyncVisits, resetStuckSyncing } from "./src/db/visits";
import { flushPendingVisits } from "./src/sync/engine";
import { registerPushToken } from "./src/notifications";
import { setUnauthorizedHandler } from "./src/api/client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  const rehydrate = useAuthStore((s) => s.rehydrate);
  const user = useAuthStore((s) => s.user);
  const { setOffline, setSyncing, setPendingCount } = useOfflineStore();
  const wasOnlineRef = useRef<boolean | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // When the server returns 401, clear auth state so RootNavigator redirects to Login.
    setUnauthorizedHandler(() => useAuthStore.getState().logout());

    // Initialize DB, recover rows stuck in 'syncing' from a mid-flush crash,
    // then rehydrate auth and count what is still pending.
    getDb()
      .then(() => resetStuckSyncing())
      .then(() => rehydrate())
      .then(() => getPendingSyncVisits())
      .then((items) => setPendingCount(items.length));

    const runFlush = () => {
      setSyncing(true);
      flushPendingVisits()
        .then(({ synced }) => {
          getPendingSyncVisits().then((items) => setPendingCount(items.length));
          if (synced > 0) {
            // Server state changed — refresh every server-derived screen
            // (Home KPI, visit lists, team dashboards) without manual reload.
            queryClient.invalidateQueries();
          }
        })
        .finally(() => setSyncing(false));
    };

    // Monitor network state — auto-flush when coming back online.
    // Debounced 2s: rapid offline↔online flapping only triggers one flush
    // after the connection is stable (the engine's mutex dedupes the rest).
    const unsub = NetInfo.addEventListener((state) => {
      const isOnline = !!state.isConnected && !!state.isInternetReachable;
      setOffline(!isOnline);

      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (isOnline && wasOnlineRef.current === false) {
        flushTimerRef.current = setTimeout(runFlush, 2000);
      }
      wasOnlineRef.current = isOnline;
    });

    return () => {
      unsub();
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  // Register push token when user logs in
  useEffect(() => {
    if (user) {
      registerPushToken().catch(() => {
        // Non-fatal: push notifications are optional
      });
    }
  }, [user?.user_id]);

  return (
    <QueryClientProvider client={queryClient}>
      <RootNavigator />
    </QueryClientProvider>
  );
}
