import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useAuthStore } from "../../store/authStore";
import { getAllLocalVisits, seedDemoVisitsIfNeeded } from "../../db/visits";
import { listVisits } from "../../api/visit";
import { isOnline } from "../../sync/engine";
import { Colors, Spacing, Radius, Shadow, Typography } from "../../theme";
import type { LocalVisit, Visit, EffectiveCall, ApprovalStatus } from "../../types";

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
  approval_status?: ApprovalStatus;
  rejection_notes?: string;
};

type TabFilter = "all" | "revision";

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
    outlet_name: (v as any).store_name ?? v.outlet_sk ?? "Toko",
    visit_date: v.visit_date,
    checkin_time: v.checkin_time,
    checkout_time: v.checkout_time,
    total_demand: v.total_demand ?? 0,
    effective_call: v.effective_call ?? "NO",
    duration_min: v.duration_minutes,
    items_json: v.items ? JSON.stringify(v.items) : undefined,
    source: "server",
    server_visit_id: v.visit_id,
    approval_status: v.approval_status,
    rejection_notes: v.rejection_notes,
  };
}

function formatTime(iso?: string): string {
  if (!iso) return "-";
  try { return format(parseISO(iso), "HH:mm"); } catch { return "-"; }
}

function formatDate(dateStr: string): string {
  try { return format(parseISO(dateStr), "EEE, d MMM yyyy", { locale: idLocale }); } catch { return dateStr; }
}

function ApprovalBadge({ status }: { status?: ApprovalStatus }) {
  if (!status || status === "DRAFT") return null;
  const config: Record<string, { label: string; bg: string; color: string }> = {
    PENDING_SPV:       { label: "Menunggu SPV", bg: "#FEF3C7", color: "#92400E" },
    SUBMITTED:         { label: "Disubmit",     bg: "#DBEAFE", color: "#1E40AF" },
    SPV_APPROVED:      { label: "SPV Setuju",   bg: "#DCFCE7", color: "#166534" },
    ASM_APPROVED:      { label: "ASM Setuju",   bg: "#DCFCE7", color: "#166534" },
    DDM_APPROVED:      { label: "DDM Setuju",   bg: "#DCFCE7", color: "#166534" },
    REVISION_REQUIRED: { label: "Perlu Revisi", bg: "#FEE2E2", color: "#991B1B" },
    COMPLETED:         { label: "Selesai",       bg: "#D1FAE5", color: "#065F46" },
    REJECTED:          { label: "Ditolak",       bg: "#FEE2E2", color: "#991B1B" },
  };
  const c = config[status];
  if (!c) return null;
  return (
    <View style={[badgeStyles.badge, { backgroundColor: c.bg }]}>
      <Text style={[badgeStyles.text, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 4 },
  text:  { fontSize: 10, fontWeight: "700" },
});

export default function VisitHistoryScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const [allItems, setAllItems]   = useState<HistoryItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab]             = useState<TabFilter>("all");

  const loadHistory = useCallback(async () => {
    const salesmanSk = user?.salesman_sk ?? user?.user_id ?? "";
    const isDemoUser = user?.username === "demo";
    if (isDemoUser) await seedDemoVisitsIfNeeded(salesmanSk);

    try {
      const online = await isOnline();
      if (online && user?.salesman_sk) {
        const result = await listVisits({ salesman_sk: user.salesman_sk, page_size: 50 });
        const serverItems = (result.items ?? []).map(serverToHistoryItem);
        if (serverItems.length > 0) {
          setAllItems(serverItems);
          return;
        }
      }
    } catch {
      // Fall through to local
    }

    const local    = await getAllLocalVisits(50);
    const filtered = local.filter((v) => v.salesman_sk === salesmanSk);
    setAllItems(filtered.map(localToHistoryItem));
  }, [user]);

  useEffect(() => {
    loadHistory().finally(() => setLoading(false));
  }, [loadHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  }, [loadHistory]);

  const revisionCount = allItems.filter((i) => i.approval_status === "REVISION_REQUIRED").length;

  const displayItems =
    tab === "revision"
      ? allItems.filter((i) => i.approval_status === "REVISION_REQUIRED")
      : allItems;

  const handleItemPress = (item: HistoryItem) => {
    if (item.approval_status === "REVISION_REQUIRED" && item.server_visit_id) {
      navigation.navigate("RevisionEdit", {
        visitId: item.server_visit_id,
        outlet_name: item.outlet_name,
        rejection_notes: item.rejection_notes,
      });
    } else {
      navigation.navigate("VisitDetail", { item });
    }
  };

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const isComplete = !!item.checkout_time;
    const isRevision = item.approval_status === "REVISION_REQUIRED";
    const itemCount  = item.items_json
      ? (() => { try { return JSON.parse(item.items_json).length; } catch { return 0; } })()
      : 0;

    return (
      <TouchableOpacity
        style={[styles.card, isRevision && styles.cardRevision]}
        onPress={() => handleItemPress(item)}
        testID={`history-${item.id}`}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.storeName} numberOfLines={1}>{item.outlet_name}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, isComplete ? styles.statusComplete : styles.statusPartial]}>
              <Text style={styles.statusText}>{isComplete ? "Selesai" : "Parsial"}</Text>
            </View>
            <ApprovalBadge status={item.approval_status} />
          </View>
        </View>

        <Text style={styles.dateText}>{formatDate(item.visit_date)}</Text>

        {isRevision && item.rejection_notes ? (
          <View style={styles.revisionNote}>
            <Text style={styles.revisionNoteText} numberOfLines={2}>
              Catatan SPV: {item.rejection_notes}
            </Text>
          </View>
        ) : null}

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={13} color={Colors.slate500} />
            <Text style={styles.metaText}>{formatTime(item.checkin_time)}</Text>
          </View>
          {item.checkout_time && (
            <View style={styles.metaItem}>
              <Ionicons name="arrow-forward" size={13} color={Colors.slate400} />
              <Text style={styles.metaText}>{formatTime(item.checkout_time)}</Text>
            </View>
          )}
          {item.duration_min != null && (
            <View style={styles.metaItem}>
              <Ionicons name="timer-outline" size={13} color={Colors.slate500} />
              <Text style={styles.metaText}>{item.duration_min} mnt</Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <View style={[styles.ecTag, item.effective_call === "YES" ? styles.ecYes : styles.ecNo]}>
            <Ionicons
              name={item.effective_call === "YES" ? "checkmark-outline" : "close-outline"}
              size={12}
              color={item.effective_call === "YES" ? Colors.success : Colors.danger}
            />
            <Text style={[
              styles.ecTagText,
              item.effective_call === "YES" ? styles.ecTagTextYes : styles.ecTagTextNo,
            ]}>
              {item.effective_call === "YES" ? "Efektif" : "Tidak Efektif"}
            </Text>
          </View>
          <Text style={styles.demandText}>
            Rp {item.total_demand.toLocaleString("id-ID")}
          </Text>
          {itemCount > 0 && (
            <Text style={styles.skuCount}>{itemCount} SKU</Text>
          )}
          {isRevision && (
            <View style={styles.revisionAction}>
              <Text style={styles.revisionActionText}>Revisi</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.danger} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Memuat riwayat...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Tab filter ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "all" && styles.tabBtnActive]}
          onPress={() => setTab("all")}
        >
          <Text style={[styles.tabBtnText, tab === "all" && styles.tabBtnTextActive]}>
            Semua ({allItems.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "revision" && styles.tabBtnActive]}
          onPress={() => setTab("revision")}
        >
          <Text style={[styles.tabBtnText, tab === "revision" && styles.tabBtnTextActive]}>
            Perlu Revisi {revisionCount > 0 ? `(${revisionCount})` : ""}
          </Text>
          {revisionCount > 0 && <View style={styles.revisionDot} />}
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.xl }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons
              name={tab === "revision" ? "checkmark-circle-outline" : "clipboard-outline"}
              size={48}
              color={tab === "revision" ? Colors.success : Colors.slate400}
            />
            <Text style={styles.emptyTitle}>
              {tab === "revision" ? "Tidak Ada Revisi" : "Belum Ada Kunjungan"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {tab === "revision"
                ? "Semua kunjungan Anda sudah disetujui."
                : "Riwayat kunjungan akan muncul setelah Anda menyelesaikan check-in dan check-out."}
            </Text>
          </View>
        }
        testID="visit-history-list"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.background },
  centered:    { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.md },
  loadingText: { color: Colors.slate500, fontSize: Typography.sm },

  tabBar: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    marginRight: Spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    gap: 6,
  },
  tabBtnActive:     { borderBottomColor: Colors.primary },
  tabBtnText:       { fontSize: Typography.sm, color: Colors.slate500, fontWeight: "500" },
  tabBtnTextActive: { color: Colors.primary, fontWeight: "700" },
  revisionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
  },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 10,
    ...Shadow.sm,
  },
  cardRevision: { borderLeftWidth: 3, borderLeftColor: Colors.danger },
  cardHeader:   {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
  },
  storeName:      { fontSize: 15, fontWeight: "700", color: Colors.slate800, flex: 1, marginRight: Spacing.sm },
  badgeRow:       { flexDirection: "row", alignItems: "center" },
  statusBadge:    { borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  statusComplete: { backgroundColor: "#DCFCE7" },
  statusPartial:  { backgroundColor: "#FEF3C7" },
  statusText:     { fontSize: 11, fontWeight: "600", color: Colors.slate700 },
  dateText:       { fontSize: Typography.sm, color: Colors.slate500, marginBottom: 6 },
  revisionNote:   {
    backgroundColor: "#FEF2F2",
    borderRadius: 6,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  revisionNoteText: { fontSize: Typography.xs, color: "#991B1B", lineHeight: 18 },

  cardMeta: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.sm },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: Typography.sm, color: Colors.slate600 },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.background,
    paddingTop: Spacing.sm,
  },
  ecTag:        { borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 3 },
  ecYes:        { backgroundColor: "#DCFCE7" },
  ecNo:         { backgroundColor: "#FEE2E2" },
  ecTagText:    { fontSize: Typography.xs, fontWeight: "600" },
  ecTagTextYes: { color: Colors.success },
  ecTagTextNo:  { color: Colors.danger },
  demandText:   { fontSize: Typography.sm, fontWeight: "700", color: Colors.primaryDark, flex: 1 },
  skuCount:     { fontSize: Typography.xs, color: Colors.slate400 },
  revisionAction: { flexDirection: "row", alignItems: "center", gap: 2 },
  revisionActionText: { fontSize: Typography.xs, fontWeight: "700", color: Colors.danger },

  emptyBox: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.slate800,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: { fontSize: Typography.sm, color: Colors.slate500, textAlign: "center", lineHeight: 20 },
});
