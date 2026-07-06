import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAuthStore } from "../../store/authStore";
import { useOfflineStore } from "../../store/offlineStore";
import { downloadWeekSchedule } from "../../api/schedule";
import { cacheSchedule, getCachedSchedule } from "../../db/schedule_cache";
import { isOnline } from "../../sync/engine";
import type { ScheduleStore } from "../../types";

interface Props {
  navigation: any;
}

export default function RouteListScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const { todayStores, localVisits, setTodayStores } = useOfflineStore();
  const [downloading, setDownloading] = useState(false);
  const salesmanSk = user?.salesman_sk ?? "";
  const today = format(new Date(), "yyyy-MM-dd");

  const loadStores = useCallback(async (): Promise<ScheduleStore[]> => {
    const isoYear = new Date().getFullYear();
    const isoWeek = getISOWeek(new Date());
    const week = `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;

    // Try cache first (works offline)
    const cached = await getCachedSchedule(salesmanSk, week);
    if (cached) {
      setTodayStores(filterToday(cached.stores));
      return cached.stores;
    }

    // Online fetch
    const data = await downloadWeekSchedule(salesmanSk, week);
    await cacheSchedule(data);
    const filtered = filterToday(data.stores);
    setTodayStores(filtered);
    return data.stores;
  }, [salesmanSk, setTodayStores]);

  const { data: allStores, isLoading, refetch } = useQuery<ScheduleStore[]>({
    queryKey: ["route", salesmanSk, today],
    queryFn: loadStores,
    enabled: !!salesmanSk,
    staleTime: 60 * 60 * 1000,
  });

  const handleDownload = async () => {
    const online = await isOnline();
    if (!online) {
      Alert.alert("Offline", "Tidak ada koneksi. Gunakan data cache yang sudah ada.");
      return;
    }
    setDownloading(true);
    try {
      const data = await downloadWeekSchedule(salesmanSk);
      await cacheSchedule(data);
      setTodayStores(filterToday(data.stores));
      await refetch();
      Alert.alert("Berhasil", `${data.total} toko diunduh untuk minggu ini.`);
    } catch (e) {
      Alert.alert("Gagal", "Gagal mengunduh rute. Coba lagi.");
    } finally {
      setDownloading(false);
    }
  };

  // A store is only "visited" (checked ✓) when the full flow is complete:
  // check-in + demand entry + check-out. Partial visits (check-in only) stay pending.
  const isStoreVisited = (store: ScheduleStore) => {
    const completedLocally = localVisits.some(
      (v) => v.outlet_sk === store.outlet_sk && !!v.checkout_time
    );
    return completedLocally || !!store.isVisited;
  };

  const todayDayName = getTodayDayName();
  const displayStores = (allStores || []).filter(
    (s) => !s.visit_day_of_week || s.visit_day_of_week === todayDayName
  );

  const renderItem = ({ item }: { item: ScheduleStore }) => {
    const visited = isStoreVisited(item);
    return (
      <TouchableOpacity
        style={[styles.storeCard, visited && styles.storeVisited]}
        onPress={() => navigation.navigate("VisitCheckin", { store: item })}
        testID={`store-${item.outlet_sk}`}
      >
        <View style={styles.storeRow}>
          <View style={styles.storeInfo}>
            <Text style={styles.storeName}>{item.store_name ?? item.source_outlet_code}</Text>
            <Text style={styles.storeAddress} numberOfLines={1}>{item.address ?? "-"}</Text>
            <View style={styles.storeTags}>
              {item.store_grade && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{item.store_grade}</Text>
                </View>
              )}
              {item.brand_group && (
                <View style={[styles.tag, item.brand_group === "SKT" ? styles.tagSkt : styles.tagG2g]}>
                  <Text style={styles.tagText}>{item.brand_group}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.visitStatus}>
            {visited ? (
              <Text style={styles.statusDone}>✓</Text>
            ) : (
              <Text style={styles.statusPending}>›</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Download Button */}
      <View style={styles.downloadBar}>
        <Text style={styles.downloadInfo}>
          {displayStores.length} toko hari ini
        </Text>
        <TouchableOpacity
          style={styles.downloadButton}
          onPress={handleDownload}
          disabled={downloading}
          testID="btn-download-route"
        >
          {downloading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.downloadButtonText}>⬇ Unduh Minggu Ini</Text>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={displayStores}
          keyExtractor={(item) => item.outlet_sk ?? item.route_plan_sk}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          ListEmptyComponent={
            <Text style={styles.empty}>Tidak ada toko untuk hari ini.</Text>
          }
          testID="store-list"
        />
      )}
    </View>
  );
}

function getISOWeek(d: Date): number {
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diffMs = d.getTime() - startOfWeek1.getTime();
  return Math.floor(diffMs / (7 * 24 * 3600 * 1000)) + 1;
}

function getTodayDayName(): string {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return days[new Date().getDay()];
}

function filterToday(stores: ScheduleStore[]): ScheduleStore[] {
  const today = getTodayDayName();
  return stores.filter(
    (s) => !s.visit_day_of_week || s.visit_day_of_week === today
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  downloadBar: { flexDirection: "row", backgroundColor: "#fff", padding: 12, alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#E2E8F0", justifyContent: "space-between" },
  downloadInfo: { fontSize: 14, color: "#475569" },
  downloadButton: { backgroundColor: "#2563EB", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center" },
  downloadButtonText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  storeCard: { backgroundColor: "#fff", marginHorizontal: 12, marginTop: 8, borderRadius: 10, padding: 14, elevation: 1 },
  storeVisited: { opacity: 0.6, backgroundColor: "#F0FDF4" },
  storeRow: { flexDirection: "row", alignItems: "center" },
  storeInfo: { flex: 1 },
  storeName: { fontSize: 15, fontWeight: "600", color: "#1E293B" },
  storeAddress: { fontSize: 13, color: "#64748B", marginTop: 2 },
  storeTags: { flexDirection: "row", gap: 6, marginTop: 6 },
  tag: { backgroundColor: "#E2E8F0", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tagSkt: { backgroundColor: "#DBEAFE" },
  tagG2g: { backgroundColor: "#FCE7F3" },
  tagText: { fontSize: 11, color: "#475569", fontWeight: "500" },
  visitStatus: { marginLeft: 12 },
  statusDone: { fontSize: 24, color: "#22C55E" },
  statusPending: { fontSize: 24, color: "#CBD5E1" },
  empty: { textAlign: "center", marginTop: 40, color: "#94A3B8", fontSize: 15 },
});
