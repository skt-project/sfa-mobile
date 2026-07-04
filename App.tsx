import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "./src/store/authStore";
import { useOfflineStore } from "./src/store/offlineStore";
import RootNavigator from "./src/navigation";
import NetInfo from "@react-native-community/netinfo";
import { getDb } from "./src/db/schema";
import { getPendingSyncVisits } from "./src/db/visits";

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
  const { setOffline, setPendingCount } = useOfflineStore();

  useEffect(() => {
    // Initialize DB + rehydrate auth
    getDb().then(() => rehydrate());

    // Monitor network state
    const unsub = NetInfo.addEventListener((state) => {
      setOffline(!state.isConnected || !state.isInternetReachable);
    });

    // Count pending sync items on mount
    getPendingSyncVisits().then((items) => setPendingCount(items.length));

    return () => unsub();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RootNavigator />
    </QueryClientProvider>
  );
}
