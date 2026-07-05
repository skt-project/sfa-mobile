import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { listVisits } from "../../api/visit";
import { getTeamKpi } from "../../api/dashboard";
import { useAuthStore } from "../../store/authStore";

interface Props {
  navigation: any;
}

export default function SPVHomeScreen({ navigation }: Props) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [refreshing, setRefreshing] = useState(false);
  const logout = useAuthStore((s) => s.logout);

  const { data: pending, refetch: refetchPending } = useQuery({
    queryKey: ["visits", "pending-spv"],
    queryFn: () => listVisits({ status: "PENDING_SPV", page_size: 5 }),
  });

  const { data: teamKpi, refetch: refetchTeam } = useQuery({
    queryKey: ["team-kpi-home", today],
    queryFn: () => getTeamKpi(today),
    staleTime: 60_000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchPending(), refetchTeam()]);
    setRefreshing(false);
  }, [refetchPending, refetchTeam]);

  const pendingCount = pending?.total ?? 0;
  const totalDemand = (teamKpi?.members ?? []).reduce((s, m) => s + m.total_demand, 0);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Dashboard SPV</Text>
          <Text style={styles.headerDate}>{format(new Date(), "EEEE, d MMM yyyy")}</Text>
        </View>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() =>
            Alert.alert("Keluar", "Yakin ingin keluar?", [
              { text: "Batal", style: "cancel" },
              { text: "Keluar", style: "destructive", onPress: logout },
            ])
          }
        >
          <Text style={styles.logoutText}>Keluar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{pendingCount}</Text>
          <Text style={styles.kpiLabel}>Perlu Disetujui</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{teamKpi?.total_members ?? 0}</Text>
          <Text style={styles.kpiLabel}>SE Aktif</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>Rp {(totalDemand / 1_000_000).toFixed(1)}M</Text>
          <Text style={styles.kpiLabel}>Total Demand</Text>
        </View>
      </View>

      {pendingCount > 0 && (
        <TouchableOpacity
          style={styles.alertCard}
          onPress={() => navigation.navigate("ApprovalQueue")}
          testID="btn-pending-alert"
        >
          <Text style={styles.alertText}>
            ⏳  {pendingCount} kunjungan menunggu persetujuan →
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.actionGrid}>
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate("ApprovalQueue")}>
          <Text style={styles.actionIcon}>✅</Text>
          <Text style={styles.actionLabel}>Approval</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate("TeamOverview")}>
          <Text style={styles.actionIcon}>👥</Text>
          <Text style={styles.actionLabel}>Tim</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  header: { backgroundColor: "#1D4ED8", padding: 20, paddingTop: 28, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#fff" },
  headerDate: { fontSize: 13, color: "#BFDBFE", marginTop: 2 },
  logoutBtn: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  logoutText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  kpiRow: { flexDirection: "row", margin: 12, gap: 8 },
  kpiCard: { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 14, alignItems: "center", elevation: 2 },
  kpiValue: { fontSize: 18, fontWeight: "700", color: "#1D4ED8" },
  kpiLabel: { fontSize: 11, color: "#64748B", marginTop: 2, textAlign: "center" },
  alertCard: { backgroundColor: "#FEF3C7", marginHorizontal: 12, borderRadius: 10, padding: 14, marginBottom: 12 },
  alertText: { color: "#92400E", fontSize: 14, fontWeight: "600" },
  actionGrid: { flexDirection: "row", marginHorizontal: 12, gap: 12 },
  actionCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 20, alignItems: "center", elevation: 2 },
  actionIcon: { fontSize: 32, marginBottom: 8 },
  actionLabel: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
});
