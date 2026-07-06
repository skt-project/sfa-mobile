import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useAuthStore } from "../../store/authStore";
import { getAllLocalVisits, seedDemoVisitsIfNeeded } from "../../db/visits";
import { listVisits } from "../../api/visit";
import { isOnline } from "../../sync/engine";
import type { LocalVisit, Visit, EffectiveCall } from "../../types";

interface Props {
  navigation: any;
}

type HistoryItem = {
  id: string;
  outlet_name: string;
  visit_date: string;
  checkin_time?: string;
  checkout_time?: string;
  total_demand: number;
  effective_call: EffectiveCall;
  duration_min?: number;
  items_json?: string;
  source: "local" | "server";
  server_visit_id?: string;
  checkin_photo_path?: string;
};

function localToHistoryItem(v: LocalVisit): HistoryItem {
  const duration =
    v.checkin_time && v.checkout_time
      ? Math.round(
          (new Date(v.checkout_time).getTime() - new Date(v.checkin_time).getTime()) / 60000
        )
      : undefined;
  return {
    id: v.local_id,
    outlet_name: v.outlet_name ?? v.outlet_sk ?? "Toko",
    visit_date: v.visit_date,
    checkin_time: v.checkin_time,
    checkout_time: v.checkout_time,
    total_demand: v.total_demand,
    effective_call: v.effective_call,
    duration_min: duration,
    items_json: v.items_json,
    source: "local",
    server_visit_id: v.server_visit_id,
    checkin_photo_path: v.checkin_photo_path,
  };
}

function serverToHistoryItem(v: Visit): HistoryItem {
  return {
    id: v.visit_id,
    outlet_name: v.outlet_sk ?? "Toko",
    visit_date: v.visit_date,
    checkin_time: v.checkin_time,
    checkout_time: v.checkout_time,
    total_demand: v.total_demand ?? 0,
    effective_call: v.effective_call ?? "NO",
    duration_min: v.duration_minutes,
    items_json: v.items ? JSON.stringify(v.items) : undefined,
    source: "server",
    server_visit_id: v.visit_id,
  };
}

function formatTime(iso?: string): string {
  if (!iso) return "-";
  try { return format(parseISO(iso), "HH:mm"); } catch { return "-"; }
}

function formatDate(dateStr: string): string {
  try { return format(parseISO(dateStr), "EEE, d MMM yyyy", { locale: idLocale }); } catch { return dateStr; }
}

export default function VisitHistoryScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    const salesmanSk = user?.salesman_sk ?? user?.user_id ?? "";
    const isDemoUser = user?.username === "demo";

    if (isDemoUser) {
      await seedDemoVisitsIfNeeded(salesmanSk);
    }

    try {
      const online = await isOnline();
      if (online && user?.salesman_sk) {
        // Prefer server data when online
        const result = await listVisits({ salesman_sk: user.salesman_sk, page_size: 50 });
        const serverItems = (result.items ?? []).map(serverToHistoryItem);
        if (serverItems.length > 0) {
          setItems(serverItems);
          return;
        }
      }
    } catch {
      // Fall through to local
    }

    // Offline or no server data: use local SQLite
    const local = await getAllLocalVisits(50);
    const filtered = local.filter((v) => v.salesman_sk === salesmanSk);
    setItems(filtered.map(localToHistoryItem));
  }, [user]);

  useEffect(() => {
    loadHistory().finally(() => setLoading(false));
  }, [loadHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  }, [loadHistory]);

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const isComplete = !!item.checkout_time;
    const itemCount = item.items_json
      ? (() => { try { return JSON.parse(item.items_json).length; } catch { return 0; } })()
      : 0;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("VisitDetail", { item })}
        testID={`history-${item.id}`}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.storeName} numberOfLines={1}>{item.outlet_name}</Text>
          <View style={[styles.statusBadge, isComplete ? styles.statusComplete : styles.statusPartial]}>
            <Text style={styles.statusText}>{isComplete ? "Selesai" : "Parsial"}</Text>
          </View>
        </View>

        <Text style={styles.dateText}>{formatDate(item.visit_date)}</Text>

        <View style={styles.cardMeta}>
          <Text style={styles.metaItem}>🕐 {formatTime(item.checkin_time)}</Text>
          {item.checkout_time && (
            <Text style={styles.metaItem}>→ {formatTime(item.checkout_time)}</Text>
          )}
          {item.duration_min != null && (
            <Text style={styles.metaItem}>⏱ {item.duration_min} mnt</Text>
          )}
        </View>

        <View style={styles.cardFooter}>
          <View style={[styles.ecTag, item.effective_call === "YES" ? styles.ecYes : styles.ecNo]}>
            <Text style={styles.ecTagText}>
              {item.effective_call === "YES" ? "✓ Efektif" : "✗ Tidak Efektif"}
            </Text>
          </View>
          <Text style={styles.demandText}>
            Rp {item.total_demand.toLocaleString("id-ID")}
          </Text>
          {itemCount > 0 && (
            <Text style={styles.skuCount}>{itemCount} SKU</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Memuat riwayat...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>Belum Ada Kunjungan</Text>
            <Text style={styles.emptySubtitle}>
              Riwayat kunjungan akan muncul setelah Anda menyelesaikan check-in dan check-out.
            </Text>
          </View>
        }
        testID="visit-history-list"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#64748B", fontSize: 14 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  storeName: { fontSize: 15, fontWeight: "700", color: "#1E293B", flex: 1, marginRight: 8 },
  statusBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  statusComplete: { backgroundColor: "#DCFCE7" },
  statusPartial: { backgroundColor: "#FEF3C7" },
  statusText: { fontSize: 11, fontWeight: "600", color: "#374151" },
  dateText: { fontSize: 13, color: "#64748B", marginBottom: 8 },
  cardMeta: { flexDirection: "row", gap: 12, marginBottom: 8 },
  metaItem: { fontSize: 13, color: "#475569" },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 8 },
  ecTag: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
  ecYes: { backgroundColor: "#DCFCE7" },
  ecNo: { backgroundColor: "#FEE2E2" },
  ecTagText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  demandText: { fontSize: 13, fontWeight: "700", color: "#1D4ED8", flex: 1 },
  skuCount: { fontSize: 12, color: "#94A3B8" },

  emptyBox: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#1E293B", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#64748B", textAlign: "center", lineHeight: 20 },
});
