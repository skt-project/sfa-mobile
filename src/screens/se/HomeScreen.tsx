import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useAuthStore } from "../../store/authStore";
import { useOfflineStore } from "../../store/offlineStore";
import { getKpi } from "../../api/dashboard";
import { flushPendingVisits, isOnline } from "../../sync/engine";
import type { KpiData } from "../../types";

interface Props {
  navigation: any;
}

export default function SEHomeScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { isSyncing, pendingSyncCount, setSyncing, setPendingCount } = useOfflineStore();
  const [refreshing, setRefreshing] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");
  const todayLabel = format(new Date(), "EEEE, d MMM yyyy", { locale: idLocale });

  const salesmanSk = user?.salesman_sk ?? "";

  const { data: kpi, refetch: refetchKpi } = useQuery<KpiData>({
    queryKey: ["kpi", salesmanSk, today],
    queryFn: () => getKpi(salesmanSk, today),
    enabled: !!salesmanSk,
    staleTime: 60_000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setSyncing(true);
    try {
      const online = await isOnline();
      if (online) {
        const { synced, failed } = await flushPendingVisits();
        if (synced > 0) {
          Alert.alert("Sinkronisasi", `${synced} kunjungan berhasil dikirim.`);
        }
        if (failed > 0) {
          Alert.alert("Peringatan", `${failed} kunjungan gagal dikirim. Coba lagi.`);
        }
      }
      await refetchKpi();
    } finally {
      setSyncing(false);
      setRefreshing(false);
    }
  }, [refetchKpi, setSyncing]);

  const KpiCard = ({ label, value, unit }: { label: string; value: string | number; unit?: string }) => (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiValue}>{value}{unit}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      testID="home-scroll"
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Halo, {user?.username} 👋</Text>
          <Text style={styles.dateText}>{todayLabel}</Text>
        </View>
        <View style={styles.headerRight}>
          {pendingSyncCount > 0 && (
            <View style={styles.syncBadge}>
              <Text style={styles.syncBadgeText}>{pendingSyncCount} pending</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() =>
              Alert.alert("Keluar", "Yakin ingin keluar?", [
                { text: "Batal", style: "cancel" },
                { text: "Keluar", style: "destructive", onPress: logout },
              ])
            }
            testID="btn-logout"
          >
            <Text style={styles.logoutText}>Keluar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* KPI Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rangkuman Hari Ini</Text>
        <View style={styles.kpiGrid}>
          <KpiCard label="Kunjungan" value={kpi?.total_visits ?? 0} />
          <KpiCard label="Efektif" value={kpi?.effective_calls ?? 0} />
          <KpiCard label="Strike Rate" value={kpi?.strike_rate ?? 0} unit="%" />
          <KpiCard
            label="Total Demand"
            value={kpi?.total_demand != null
              ? `${(kpi.total_demand / 1_000_000).toFixed(1)}M`
              : "0"}
          />
        </View>
        {(kpi?.route_completion_pct ?? 0) > 0 && (
          <View style={styles.routeBar}>
            <Text style={styles.routeBarLabel}>
              Rute: {kpi?.route_completion_pct ?? 0}%
            </Text>
            <View style={styles.progressBg}>
              <View
                style={[styles.progressFill, { width: `${Math.min(kpi?.route_completion_pct ?? 0, 100)}%` }]}
              />
            </View>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aksi Cepat</Text>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate("RouteList")}
          testID="btn-route"
        >
          <Text style={styles.actionButtonText}>📋  Lihat Rute Hari Ini</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => navigation.navigate("VisitHistory")}
          testID="btn-history"
        >
          <Text style={[styles.actionButtonText, { color: "#1E40AF" }]}>📊  Riwayat Kunjungan</Text>
        </TouchableOpacity>
      </View>

      {/* Pending Approvals Alert */}
      {(kpi?.pending_approvals ?? 0) > 0 && (
        <View style={styles.alertCard}>
          <Text style={styles.alertText}>
            ⏳  {kpi?.pending_approvals} kunjungan menunggu persetujuan
          </Text>
        </View>
      )}

      {(kpi?.revision_count ?? 0) > 0 && (
        <View style={[styles.alertCard, styles.alertWarning]}>
          <Text style={styles.alertText}>
            ✏️  {kpi?.revision_count} kunjungan perlu direvisi
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  header: { backgroundColor: "#2563EB", padding: 20, paddingTop: 28, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerRight: { alignItems: "flex-end", gap: 6 },
  logoutBtn: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  logoutText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  greeting: { fontSize: 18, fontWeight: "700", color: "#fff" },
  dateText: { fontSize: 13, color: "#BFDBFE", marginTop: 2 },
  syncBadge: { backgroundColor: "#FCD34D", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  syncBadgeText: { fontSize: 12, color: "#92400E", fontWeight: "600" },
  section: { backgroundColor: "#fff", margin: 12, borderRadius: 12, padding: 16, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#1E293B", marginBottom: 12 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpiCard: { flex: 1, minWidth: "45%", backgroundColor: "#EFF6FF", borderRadius: 10, padding: 12, alignItems: "center" },
  kpiValue: { fontSize: 22, fontWeight: "700", color: "#1D4ED8" },
  kpiLabel: { fontSize: 12, color: "#64748B", marginTop: 2 },
  routeBar: { marginTop: 12 },
  routeBarLabel: { fontSize: 13, color: "#475569", marginBottom: 6 },
  progressBg: { height: 6, backgroundColor: "#E2E8F0", borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: "#2563EB", borderRadius: 3 },
  actionButton: { backgroundColor: "#2563EB", borderRadius: 10, padding: 14, marginBottom: 10, alignItems: "center" },
  actionButtonSecondary: { backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE" },
  actionButtonText: { fontSize: 15, color: "#fff", fontWeight: "600" },
  alertCard: { backgroundColor: "#FEF3C7", margin: 12, borderRadius: 10, padding: 14 },
  alertWarning: { backgroundColor: "#FEE2E2" },
  alertText: { fontSize: 14, color: "#92400E" },
});
