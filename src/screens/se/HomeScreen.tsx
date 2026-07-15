import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Alert,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "@react-navigation/native";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useAuthStore } from "../../store/authStore";
import { useOfflineStore } from "../../store/offlineStore";
import { getKpi } from "../../api/dashboard";
import { flushPendingVisits, isOnline } from "../../sync/engine";
import { Card, Badge } from "../../components/shared";
import { Colors, Spacing, Radius, Shadow, Typography } from "../../theme";
import type { KpiData } from "../../types";

interface Props {
  navigation: any;
}

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
}

function KpiTile({ label, value, unit, color = Colors.primary }: KpiCardProps) {
  return (
    <View style={[styles.kpiTile, { borderLeftColor: color }]}>
      <Text style={[styles.kpiValue, { color }]}>
        {value}{unit}
      </Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

interface ActionBtnProps {
  icon: string;
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
}

function ActionBtn({ icon, label, onPress, variant = "primary" }: ActionBtnProps) {
  const isPrimary = variant === "primary";
  return (
    <TouchableOpacity
      style={[styles.actionBtn, isPrimary ? styles.actionBtnPrimary : styles.actionBtnSecondary]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <View style={[styles.actionIcon, { backgroundColor: isPrimary ? "rgba(255,255,255,0.2)" : Colors.primaryBg }]}>
        <Ionicons name={icon} size={20} color={isPrimary ? Colors.white : Colors.primary} accessible={false} />
      </View>
      <Text style={[styles.actionLabel, { color: isPrimary ? Colors.white : Colors.primary }]}>
        {label}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={isPrimary ? "rgba(255,255,255,0.6)" : Colors.slate400}
        style={styles.actionChevron}
        accessible={false}
      />
    </TouchableOpacity>
  );
}

export default function SEHomeScreen({ navigation }: Props) {
  const user    = useAuthStore((s) => s.user);
  const logout  = useAuthStore((s) => s.logout);
  const { isSyncing, pendingSyncCount, setSyncing } = useOfflineStore();
  const [refreshing, setRefreshing] = useState(false);

  const today      = format(new Date(), "yyyy-MM-dd");
  const todayLabel = format(new Date(), "EEEE, d MMM yyyy", { locale: idLocale });
  const salesmanSk = user?.salesman_sk ?? "";

  const { data: kpi, refetch: refetchKpi } = useQuery<KpiData>({
    queryKey: ["kpi", salesmanSk, today],
    queryFn:  () => getKpi(salesmanSk, today),
    enabled:  !!salesmanSk,
    staleTime: 60_000,
  });

  // The summary must reflect checkout/submit immediately — the user returns
  // to Home after both, so refetch on every focus (no manual refresh needed).
  useFocusEffect(
    useCallback(() => {
      if (salesmanSk) refetchKpi();
    }, [salesmanSk, refetchKpi]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setSyncing(true);
    try {
      const online = await isOnline();
      if (online) {
        const { synced, failed } = await flushPendingVisits();
        if (synced > 0)  Alert.alert("Sinkronisasi", `${synced} kunjungan berhasil dikirim.`);
        if (failed > 0)  Alert.alert("Peringatan",    `${failed} kunjungan gagal dikirim. Coba lagi.`);
      }
      await refetchKpi();
    } finally {
      setSyncing(false);
      setRefreshing(false);
    }
  }, [refetchKpi, setSyncing]);

  const routePct = kpi?.route_completion_pct ?? 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      testID="home-scroll"
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Halo, {user?.username}</Text>
            <Text style={styles.dateText}>{todayLabel}</Text>
          </View>
          <View style={styles.headerActions}>
            {pendingSyncCount > 0 && (
              <Badge label={`${pendingSyncCount} pending`} variant="yellow" />
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
              accessibilityLabel="Logout"
              accessibilityRole="button"
            >
              <Ionicons name="log-out-outline" size={16} color="rgba(255,255,255,0.9)" accessible={false} />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Inline route progress in header */}
        {routePct > 0 && (
          <View style={styles.routeRow}>
            <Text style={styles.routeLabel}>Rute hari ini</Text>
            <Text style={styles.routePct}>{routePct}%</Text>
          </View>
        )}
        {routePct > 0 && (
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${Math.min(routePct, 100)}%` }]} />
          </View>
        )}
      </View>

      {/* ── KPI Grid ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rangkuman Hari Ini</Text>
        <View style={styles.kpiGrid}>
          <KpiTile label="Kunjungan"   value={kpi?.total_visits ?? 0}   color={Colors.primary} />
          <KpiTile label="Efektif"     value={kpi?.effective_calls ?? 0} color={Colors.success} />
          <KpiTile label="Strike Rate" value={kpi?.strike_rate ?? 0}    color={Colors.warning} unit="%" />
          <KpiTile
            label="Total Order"
            value={kpi?.total_demand != null
              ? `${(kpi.total_demand / 1_000_000).toFixed(1)}M`
              : "0"}
            color={Colors.primaryDark}
          />
        </View>
      </View>

      {/* ── Quick Actions ── */}
      <View style={[styles.section, { gap: Spacing.sm }]}>
        <Text style={styles.sectionTitle}>Aksi Cepat</Text>
        <ActionBtn
          icon="map-outline"
          label="Lihat Rute Hari Ini"
          onPress={() => navigation.navigate("RouteList")}
          variant="primary"
        />
        <ActionBtn
          icon="time-outline"
          label="Riwayat Kunjungan"
          onPress={() => navigation.navigate("VisitHistory")}
          variant="secondary"
        />
      </View>

      {/* ── Alert banners ── */}
      {(kpi?.pending_approvals ?? 0) > 0 && (
        <View style={[styles.alertBanner, styles.alertInfo]}>
          <Ionicons name="time-outline" size={18} color={Colors.primary} accessible={false} />
          <Text style={[styles.alertText, { color: Colors.primaryDark }]}>
            {kpi?.pending_approvals} kunjungan menunggu persetujuan
          </Text>
        </View>
      )}

      {(kpi?.revision_count ?? 0) > 0 && (
        <View style={[styles.alertBanner, styles.alertWarning]}>
          <Ionicons name="create-outline" size={18} color={Colors.warning} accessible={false} />
          <Text style={[styles.alertText, { color: "#92400E" }]}>
            {kpi?.revision_count} kunjungan perlu direvisi
          </Text>
        </View>
      )}

      <View style={{ height: Spacing["2xl"] }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    backgroundColor: Colors.primary,
    padding: Spacing.xl,
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing.xl,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  greeting: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.white },
  dateText: { fontSize: Typography.sm, color: "rgba(255,255,255,0.7)", marginTop: 3 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
  },
  logoutText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: "rgba(255,255,255,0.95)" },
  routeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  routeLabel: { fontSize: Typography.sm, color: "rgba(255,255,255,0.8)" },
  routePct:   { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.white },
  progressBg: { height: 5, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: Radius.full },
  progressFill: {
    height: 5,
    backgroundColor: Colors.white,
    borderRadius: Radius.full,
  },

  // Section
  section: {
    margin: Spacing.lg,
    marginBottom: 0,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.slate800,
    marginBottom: Spacing.md,
  },

  // KPI tiles
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  kpiTile: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.slate50,
    borderRadius: Radius.md,
    borderLeftWidth: 3,
    padding: Spacing.md,
  },
  kpiValue: { fontSize: Typography["2xl"], fontWeight: Typography.bold },
  kpiLabel: { fontSize: Typography.xs, color: Colors.slate500, marginTop: 2 },

  // Action buttons
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  actionBtnPrimary:   { backgroundColor: Colors.primary },
  actionBtnSecondary: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  actionIcon: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: "center", justifyContent: "center" },
  actionLabel: { flex: 1, fontSize: Typography.base, fontWeight: Typography.semibold },
  actionChevron: { marginLeft: "auto" },

  // Alert banners
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    margin: Spacing.lg,
    marginBottom: 0,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
  },
  alertInfo:    { backgroundColor: Colors.infoBg,    borderColor: Colors.primaryBorder },
  alertWarning: { backgroundColor: Colors.warningBg, borderColor: "#FDE68A" },
  alertText:    { flex: 1, fontSize: Typography.sm, fontWeight: Typography.medium },
});
