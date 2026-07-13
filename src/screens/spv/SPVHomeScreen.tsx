import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Alert, Pressable,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import Ionicons from "react-native-vector-icons/Ionicons";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { listVisits } from "../../api/visit";
import { getTeamKpi } from "../../api/dashboard";
import { useAuthStore } from "../../store/authStore";
import { Colors, Spacing, Radius, Shadow, Typography } from "../../theme";

interface Props {
  navigation: any;
}

// ── KPI tile ──────────────────────────────────────────────────────────────────

interface KpiTileProps {
  value: string;
  label: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  onPress?: () => void;
}

function KpiTile({ value, label, icon, iconBg, iconColor, onPress }: KpiTileProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.kpiTile, pressed && styles.kpiTilePressed]}
      onPress={onPress}
      accessibilityLabel={`${label}: ${value}`}
      accessibilityRole={onPress ? "button" : undefined}
    >
      <View style={[styles.kpiIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </Pressable>
  );
}

// ── Quick action card ─────────────────────────────────────────────────────────

interface ActionCardProps {
  icon: string;
  label: string;
  badge?: number;
  onPress: () => void;
}

function ActionCard({ icon, label, badge, onPress }: ActionCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
      onPress={onPress}
      accessibilityLabel={badge != null && badge > 0 ? `${label}, ${badge} menunggu` : label}
      accessibilityRole="button"
    >
      <View style={styles.actionIconWrap}>
        <Ionicons name={icon} size={24} color={Colors.primary} accessible={false} />
        {badge != null && badge > 0 && (
          <View style={styles.actionBadge} accessible={false}>
            <Text style={styles.actionBadgeText} accessible={false}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({ title, action, onAction }: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction} accessibilityRole="button" accessibilityLabel={action}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Pending visit row ─────────────────────────────────────────────────────────

interface PendingVisitProps {
  title: string;
  submittedBy: string;
  date: string;
  onPress: () => void;
}

function PendingVisitRow({ title, submittedBy, date, onPress }: PendingVisitProps) {
  return (
    <TouchableOpacity
      style={styles.visitRow}
      onPress={onPress}
      accessibilityLabel={`${title}, ${submittedBy}, ${date}`}
      accessibilityRole="button"
    >
      <View style={[styles.visitIcon, { backgroundColor: Colors.warningBg }]}>
        <Ionicons name="time-outline" size={16} color={Colors.warning} accessible={false} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.visitTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.visitMeta}>{submittedBy} · {date}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.slate300} accessible={false} />
    </TouchableOpacity>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SPVHomeScreen({ navigation }: Props) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [refreshing, setRefreshing] = useState(false);
  const user   = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const { data: pending, refetch: refetchPending } = useQuery({
    queryKey: ["visits", "pending-spv"],
    queryFn:  () => listVisits({ status: "PENDING_SPV", page_size: 5 }),
    staleTime: 30_000,
  });

  const { data: teamKpi, refetch: refetchTeam } = useQuery({
    queryKey: ["team-kpi-home", today],
    queryFn:  () => getTeamKpi(today),
    staleTime: 60_000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchPending(), refetchTeam()]);
    setRefreshing(false);
  }, [refetchPending, refetchTeam]);

  const pendingCount = pending?.total ?? 0;
  const totalDemand  = (teamKpi?.members ?? []).reduce((s, m) => s + (m.total_demand ?? 0), 0);
  const visitedToday = (teamKpi?.members ?? []).reduce((s, m) => s + (m.total_visits ?? 0), 0);
  const teamSize     = teamKpi?.total_members ?? 0;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat Pagi";
    if (h < 15) return "Selamat Siang";
    if (h < 18) return "Selamat Sore";
    return "Selamat Malam";
  })();

  const dateStr = format(new Date(), "EEEE, d MMMM yyyy", { locale: idLocale });

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.white} />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero header ── */}
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroGreeting}>{greeting},</Text>
            <Text style={styles.heroName} numberOfLines={1}>{user?.username ?? "SPV"}</Text>
            <Text style={styles.heroDate}>{dateStr}</Text>
          </View>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() =>
              Alert.alert("Keluar", "Yakin ingin keluar?", [
                { text: "Batal", style: "cancel" },
                { text: "Keluar", style: "destructive", onPress: logout },
              ])
            }
            accessibilityLabel="Keluar"
            accessibilityRole="button"
          >
            <Ionicons name="log-out-outline" size={18} color="rgba(255,255,255,0.9)" accessible={false} />
          </TouchableOpacity>
        </View>

        {/* ── Pending alert banner ── */}
        {pendingCount > 0 && (
          <TouchableOpacity
            style={styles.alertBanner}
            onPress={() => navigation.navigate("ApprovalQueue")}
            testID="btn-pending-alert"
            activeOpacity={0.85}
            accessibilityLabel={`${pendingCount} kunjungan menunggu persetujuan`}
            accessibilityRole="button"
          >
            <View style={styles.alertIconWrap}>
              <Ionicons name="time" size={18} color={Colors.warning} accessible={false} />
            </View>
            <Text style={styles.alertText}>
              <Text style={styles.alertCount}>{pendingCount} kunjungan</Text>
              {" "}menunggu persetujuan Anda
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#92400E" accessible={false} />
          </TouchableOpacity>
        )}

        {/* ── KPI tiles ── */}
        <View style={styles.kpiGrid}>
          <KpiTile
            value={String(pendingCount)}
            label="Perlu Disetujui"
            icon="document-text-outline"
            iconBg={Colors.warningBg}
            iconColor={Colors.warning}
            onPress={() => navigation.navigate("ApprovalQueue")}
          />
          <KpiTile
            value={String(teamSize)}
            label="SE Aktif"
            icon="people-outline"
            iconBg={Colors.primaryBg}
            iconColor={Colors.primary}
            onPress={() => navigation.navigate("TeamOverview")}
          />
          <KpiTile
            value={String(visitedToday)}
            label="Kunjungan Hari Ini"
            icon="location-outline"
            iconBg={Colors.successBg}
            iconColor={Colors.success}
          />
          <KpiTile
            value={`Rp ${(totalDemand / 1_000_000).toFixed(1)}M`}
            label="Total Demand MTD"
            icon="trending-up-outline"
            iconBg="#F5F3FF"
            iconColor="#7C3AED"
          />
        </View>

        {/* ── Quick actions ── */}
        <View style={styles.section}>
          <SectionHeading title="Aksi Cepat" />
          <View style={styles.actionGrid}>
            <ActionCard
              icon="checkmark-circle-outline"
              label="Approval"
              badge={pendingCount}
              onPress={() => navigation.navigate("ApprovalQueue")}
            />
            <ActionCard
              icon="people-outline"
              label="Pantau Tim"
              onPress={() => navigation.navigate("TeamOverview")}
            />
          </View>
        </View>

        {/* ── Pending visits ── */}
        {pendingCount > 0 && (
          <View style={styles.section}>
            <SectionHeading
              title="Menunggu Persetujuan"
              action="Lihat semua"
              onAction={() => navigation.navigate("ApprovalQueue")}
            />
            <View style={styles.card}>
              {(pending?.items ?? []).slice(0, 5).map((v) => (
                <PendingVisitRow
                  key={v.visit_id}
                  title={v.store_name ?? v.outlet_sk ?? v.visit_id}
                  submittedBy={v.salesman_name ?? v.salesman_sk ?? "—"}
                  date={v.visit_date ?? "—"}
                  onPress={() => navigation.navigate("VisitDetail", {
                    item: {
                      id: v.visit_id,
                      outlet_name: v.store_name ?? v.outlet_sk ?? v.visit_id,
                      visit_date: v.visit_date,
                      checkin_time: v.checkin_time,
                      checkout_time: v.checkout_time,
                      total_demand: v.total_demand ?? 0,
                      effective_call: v.effective_call ?? "NO",
                      duration_min: v.duration_minutes,
                      items_json: v.items ? JSON.stringify(v.items) : undefined,
                      source: "server" as const,
                      server_visit_id: v.visit_id,
                      approval_status: v.approval_status,
                      rejection_notes: v.rejection_notes,
                    },
                  })}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Team overview ── */}
        {teamSize > 0 && (
          <View style={styles.section}>
            <SectionHeading
              title="Performa Tim Hari Ini"
              action="Detail"
              onAction={() => navigation.navigate("TeamOverview")}
            />
            <View style={styles.card}>
              {(teamKpi?.members ?? []).slice(0, 5).map((m) => {
                const ecRate = m.strike_rate ?? 0;
                const color  = ecRate >= 80 ? Colors.success : ecRate >= 60 ? Colors.primary : Colors.danger;
                return (
                  <View key={m.salesman_sk} style={styles.memberRow}>
                    <View style={[styles.memberAvatar, { backgroundColor: Colors.primaryBg }]}>
                      <Ionicons name="person-outline" size={14} color={Colors.primary} accessible={false} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName} numberOfLines={1}>{m.salesman_name}</Text>
                      <View style={styles.memberProgress}>
                        <View style={styles.memberTrack}>
                          <View style={[styles.memberFill, { width: `${Math.min(ecRate, 100)}%` as any, backgroundColor: color }]} />
                        </View>
                        <Text style={[styles.memberPct, { color }]}>{ecRate.toFixed(0)}%</Text>
                      </View>
                    </View>
                    <Text style={styles.memberVisit}>{m.total_visits ?? 0} toko</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Hero
  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl + Spacing.sm,
    paddingBottom: Spacing["2xl"] + 8,
  },
  heroGreeting: { fontSize: Typography.sm, color: Colors.primaryBorder, fontWeight: Typography.medium },
  heroName:     { fontSize: Typography["2xl"], fontWeight: Typography.bold, color: Colors.white, marginTop: 2 },
  heroDate:     { fontSize: Typography.xs, color: Colors.primaryBorder, marginTop: 4 },
  logoutBtn:    { padding: Spacing.sm },

  // Alert banner
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: -Spacing.lg,
    marginBottom: Spacing.xs,
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: "#FDE68A",
    ...Shadow.sm,
  },
  alertIconWrap: {
    width: 32, height: 32, borderRadius: Radius.full,
    backgroundColor: "#FEF3C7",
    alignItems: "center", justifyContent: "center",
  },
  alertText:  { flex: 1, fontSize: Typography.sm, color: "#92400E" },
  alertCount: { fontWeight: Typography.bold },

  // KPI grid
  kpiGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  kpiTile: {
    width: "48%",
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: "center",
    ...Shadow.sm,
  },
  kpiTilePressed: { opacity: 0.85 },
  kpiIconWrap: {
    width: 40, height: 40, borderRadius: Radius.full,
    alignItems: "center", justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  kpiValue: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.slate900 },
  kpiLabel: { fontSize: Typography.xs, color: Colors.slate500, marginTop: 3, textAlign: "center" },

  // Section
  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.xl },
  sectionHeading: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.slate800 },
  sectionAction: { fontSize: Typography.sm, color: Colors.primary, fontWeight: Typography.semibold },

  // Quick actions
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  actionCard: {
    width: "47%",
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  actionCardPressed: { opacity: 0.8 },
  actionIconWrap: { position: "relative" },
  actionBadge: {
    position: "absolute", top: -4, right: -8,
    backgroundColor: Colors.danger,
    borderRadius: Radius.full,
    minWidth: 18, height: 18,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4,
  },
  actionBadgeText: { fontSize: 9, fontWeight: Typography.bold, color: Colors.white },
  actionLabel: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.slate800, textAlign: "center" },

  // Card container
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    ...Shadow.sm,
    overflow: "hidden",
  },

  // Pending visit rows
  visitRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.slate100,
  },
  visitIcon: {
    width: 32, height: 32, borderRadius: Radius.full,
    alignItems: "center", justifyContent: "center",
  },
  visitTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.slate800 },
  visitMeta:  { fontSize: Typography.xs, color: Colors.slate400, marginTop: 2 },

  // Team members
  memberRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.slate50,
  },
  memberAvatar: {
    width: 32, height: 32, borderRadius: Radius.full,
    alignItems: "center", justifyContent: "center",
  },
  memberName:    { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.slate800 },
  memberProgress: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: 3 },
  memberTrack: {
    flex: 1, height: 4, borderRadius: Radius.full,
    backgroundColor: Colors.slate100, overflow: "hidden",
  },
  memberFill:  { height: 4, borderRadius: Radius.full },
  memberPct:   { fontSize: Typography.xs, fontWeight: Typography.bold, width: 32 },
  memberVisit: { fontSize: Typography.xs, color: Colors.slate400, width: 44, textAlign: "right" },
});
