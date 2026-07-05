import React, { useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "./src/store/authStore";
import { useOfflineStore } from "./src/store/offlineStore";
import RootNavigator from "./src/navigation";
import NetInfo from "@react-native-community/netinfo";
import { getDb } from "./src/db/schema";
import { getPendingSyncVisits } from "./src/db/visits";
import { flushPendingVisits } from "./src/sync/engine";
import { registerPushToken } from "./src/notifications";

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

  useEffect(() => {
    // Initialize DB + rehydrate auth
    getDb().then(() => rehydrate());

    // Count pending sync items on mount
    getPendingSyncVisits().then((items) => setPendingCount(items.length));

    // Monitor network state — auto-flush when coming back online
    const unsub = NetInfo.addEventListener((state) => {
      const isOnline = !!state.isConnected && !!state.isInternetReachable;
      setOffline(!isOnline);

      if (isOnline && wasOnlineRef.current === false) {
        // Just came back online — flush pending visits
        setSyncing(true);
        flushPendingVisits()
          .then(({ synced }) => {
            if (synced > 0) {
              getPendingSyncVisits().then((items) => setPendingCount(items.length));
            }
          })
          .finally(() => setSyncing(false));
      }
      wasOnlineRef.current = isOnline;
    });

    return () => unsub();
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
