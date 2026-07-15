import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Pressable,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { format } from "date-fns";
import { useAuthStore } from "../../store/authStore";
import { useOfflineStore } from "../../store/offlineStore";
import { downloadWeekSchedule } from "../../api/schedule";
import { submitSkippedStores } from "../../api/visit";
import { cacheSchedule, getCachedSchedule } from "../../db/schedule_cache";
import { isOnline } from "../../sync/engine";
import { Colors, Spacing, Radius, Shadow, Typography } from "../../theme";
import type { ScheduleStore, LocalVisit } from "../../types";

interface Props {
  navigation: any;
}

type VisitStageStatus = "not_visited" | "skipped" | "checked_in" | "checked_out" | "submitted";

function getStoreStatus(
  store: ScheduleStore,
  localVisits: LocalVisit[],
  skippedSet: Set<string>,
): VisitStageStatus {
  const visit = localVisits.find((v) => v.outlet_sk === store.outlet_sk);
  if (!visit) {
    if (skippedSet.has(store.outlet_sk)) return "skipped";
    return store.isVisited ? "checked_out" : "not_visited";
  }
  if (visit.submitted_at) return "submitted";
  if (visit.checkout_time) return "checked_out";
  if (visit.checkin_time) return "checked_in";
  return skippedSet.has(store.outlet_sk) ? "skipped" : "not_visited";
}

interface StatusConfig {
  icon: string;
  label: string;
  color: string;
  bgColor: string;
}

const STATUS_CONFIG: Record<VisitStageStatus, StatusConfig> = {
  not_visited: { icon: "ellipse-outline",        label: "Belum",    color: Colors.slate400, bgColor: Colors.slate100 },
  skipped:     { icon: "close-circle-outline",   label: "Terlewat", color: "#F97316",       bgColor: "#FFF7ED"       },
  checked_in:  { icon: "time-outline",           label: "Check-in", color: Colors.warning,  bgColor: Colors.warningBg },
  checked_out: { icon: "checkmark-circle-outline", label: "Checkout", color: Colors.success, bgColor: Colors.successBg },
  submitted:   { icon: "checkmark-circle",       label: "Disubmit", color: Colors.primary,  bgColor: Colors.primaryBg },
};

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ visited, total }: { visited: number; total: number }) {
  const pct = total > 0 ? (visited / total) * 100 : 0;
  const color = pct >= 80 ? Colors.success : pct >= 50 ? Colors.warning : Colors.primary;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}

// ── Brand tag chip ────────────────────────────────────────────────────────────

function BrandTag({ label, variant }: { label: string; variant?: "skt" | "g2g" | "default" }) {
  const bg = variant === "skt" ? Colors.primaryBg : variant === "g2g" ? "#FDF2F8" : Colors.slate100;
  const tc = variant === "skt" ? Colors.primary   : variant === "g2g" ? "#9333EA" : Colors.slate600;
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={[styles.tagText, { color: tc }]}>{label}</Text>
    </View>
  );
}

// ── Store card ────────────────────────────────────────────────────────────────

type SyncState = "none" | "local" | "synced";

// Whether a completed visit's data is still local-only or already on the server.
function getStoreSync(store: ScheduleStore, localVisits: LocalVisit[]): SyncState {
  const visit = localVisits.find((v) => v.outlet_sk === store.outlet_sk);
  if (!visit || !visit.checkout_time) return "none"; // nothing to sync yet
  return visit.sync_status === "synced" ? "synced" : "local";
}

interface StoreCardProps {
  item: ScheduleStore;
  status: VisitStageStatus;
  syncState: SyncState;
  isSkippable: boolean;
  onPress: () => void;
  onToggleSkip: () => void;
}

function StoreCard({ item, status, syncState, isSkippable, onPress, onToggleSkip }: StoreCardProps) {
  const cfg = STATUS_CONFIG[status];
  const isSkipped = status === "skipped";

  return (
    <Pressable
      style={({ pressed }) => [
        styles.storeCard,
        isSkipped   && styles.storeCardSkipped,
        (status === "checked_out" || status === "submitted") && styles.storeCardVisited,
        pressed && styles.storeCardPressed,
      ]}
      onPress={onPress}
      testID={`store-${item.outlet_sk}`}
      accessibilityLabel={`${item.store_name ?? item.source_outlet_code}, ${cfg.label}`}
      accessibilityRole="button"
    >
      <View style={styles.cardInner}>
        {/* Status badge circle */}
        <View style={[styles.statusCircle, { backgroundColor: cfg.bgColor }]}>
          <Ionicons name={cfg.icon} size={20} color={cfg.color} accessible={false} />
        </View>

        {/* Store info */}
        <View style={styles.storeInfo}>
          <Text style={styles.storeName} numberOfLines={1}>{item.store_name ?? item.source_outlet_code}</Text>
          {item.address ? (
            <Text style={styles.storeAddress} numberOfLines={1}>{item.address}</Text>
          ) : null}
          <View style={styles.tagRow}>
            {item.store_grade && <BrandTag label={item.store_grade} />}
            {item.brand_group && (
              <BrandTag
                label={item.brand_group}
                variant={item.brand_group === "SKT" ? "skt" : item.brand_group === "G2G" ? "g2g" : "default"}
              />
            )}
          </View>
        </View>

        {/* Right: status label + sync indicator + skip button */}
        <View style={styles.rightCol}>
          <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
          {syncState !== "none" && (
            <View
              style={[styles.syncPill, syncState === "synced" ? styles.syncPillOk : styles.syncPillLocal]}
              accessibilityLabel={syncState === "synced" ? "Tersinkron ke server" : "Tersimpan lokal, belum tersinkron"}
            >
              <View
                style={[styles.syncDot, { backgroundColor: syncState === "synced" ? Colors.success : Colors.warning }]}
                accessible={false}
              />
              <Text
                style={[styles.syncText, { color: syncState === "synced" ? Colors.success : "#B45309" }]}
                accessible={false}
              >
                {syncState === "synced" ? "Tersinkron" : "Local"}
              </Text>
            </View>
          )}
          {isSkippable && (
            <TouchableOpacity
              style={[styles.skipBtn, isSkipped && styles.skipBtnActive]}
              onPress={onToggleSkip}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID={`btn-skip-${item.outlet_sk}`}
              accessibilityLabel={isSkipped ? `Batalkan terlewat ${item.store_name ?? item.outlet_sk}` : `Tandai terlewat ${item.store_name ?? item.outlet_sk}`}
              accessibilityRole="button"
            >
              <Text style={[styles.skipBtnText, isSkipped && styles.skipBtnTextActive]}>
                {isSkipped ? "Batalkan" : "Terlewat"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function RouteListScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const { todayStores, localVisits, setTodayStores, loadLocalVisitsForDate } = useOfflineStore();
  const [downloading,    setDownloading]    = useState(false);
  const [submittingSkip, setSubmittingSkip] = useState(false);
  const [skippedSet,     setSkippedSet]     = useState<Set<string>>(new Set());

  const salesmanSk = user?.salesman_sk ?? "";
  const today      = format(new Date(), "yyyy-MM-dd");
  const weekIso    = getISOWeekLabel(new Date());

  useFocusEffect(
    useCallback(() => {
      loadLocalVisitsForDate(today);
    }, [today, loadLocalVisitsForDate]),
  );

  const loadStores = useCallback(async (): Promise<ScheduleStore[]> => {
    const cached = await getCachedSchedule(salesmanSk, weekIso);
    if (cached) {
      setTodayStores(filterToday(cached.stores));
      return cached.stores;
    }
    const data = await downloadWeekSchedule(salesmanSk, weekIso);
    await cacheSchedule(data);
    setTodayStores(filterToday(data.stores));
    return data.stores;
  }, [salesmanSk, weekIso, setTodayStores]);

  const { data: allStores, isLoading, refetch } = useQuery<ScheduleStore[]>({
    queryKey: ["route", salesmanSk, today],
    queryFn:  loadStores,
    enabled:  !!salesmanSk,
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
    } catch {
      Alert.alert("Gagal", "Gagal mengunduh rute. Coba lagi.");
    } finally {
      setDownloading(false);
    }
  };

  const toggleSkipped = (store: ScheduleStore) => {
    if (!store.outlet_sk) return;
    setSkippedSet((prev) => {
      const next = new Set(prev);
      if (next.has(store.outlet_sk)) next.delete(store.outlet_sk);
      else next.add(store.outlet_sk);
      return next;
    });
  };

  const handleSubmitSkipped = async () => {
    if (skippedSet.size === 0) return;
    const online = await isOnline();
    if (!online) {
      Alert.alert("Offline", "Tidak ada koneksi. Hubungkan ke internet lalu coba lagi.");
      return;
    }
    Alert.alert(
      "Kirim Toko Terlewat",
      `${skippedSet.size} toko akan dikirim ke SPV untuk ditinjau. Lanjutkan?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Kirim", style: "default",
          onPress: async () => {
            setSubmittingSkip(true);
            try {
              const skippedStores = (displayStores ?? [])
                .filter((s) => skippedSet.has(s.outlet_sk))
                .map((s) => ({
                  outlet_sk:        s.outlet_sk,
                  outlet_name:      s.store_name,
                  distributor_code: s.distributor_code,
                  brand_group:      s.brand_group,
                  week_iso:         weekIso,
                  visit_date:       today,
                }));
              const result = await submitSkippedStores(salesmanSk, skippedStores);
              setSkippedSet(new Set());
              Alert.alert(
                "Berhasil",
                `${result.created} toko berhasil dikirim ke SPV.${result.skipped > 0 ? ` (${result.skipped} sudah ada sebelumnya)` : ""}`,
              );
            } catch (e: any) {
              Alert.alert("Gagal", e?.response?.data?.detail ?? "Gagal mengirim. Coba lagi.");
            } finally {
              setSubmittingSkip(false);
            }
          },
        },
      ],
    );
  };

  const todayDayName  = getTodayDayName();
  const displayStores = (allStores ?? []).filter(
    (s) => !s.visit_day_of_week || s.visit_day_of_week === todayDayName,
  );
  const visitedCount = displayStores.filter((s) => {
    const st = getStoreStatus(s, localVisits, skippedSet);
    return st === "checked_out" || st === "submitted";
  }).length;

  const renderItem = ({ item }: { item: ScheduleStore }) => {
    const status = getStoreStatus(item, localVisits, skippedSet);
    return (
      <StoreCard
        item={item}
        status={status}
        syncState={getStoreSync(item, localVisits)}
        isSkippable={status === "not_visited" || status === "skipped"}
        onPress={() => {
          if (status === "skipped") return;
          // Completed visits are READ-ONLY: open the summary, never re-enter
          // the check-in flow. Only untouched / mid-visit stores continue the flow.
          if (status === "checked_out" || status === "submitted") {
            const visit = localVisits.find((v) => v.outlet_sk === item.outlet_sk);
            navigation.navigate("VisitDetail", {
              item: {
                id: visit?.local_id ?? item.outlet_sk,
                outlet_name: item.store_name ?? item.source_outlet_code,
                visit_date: visit?.visit_date ?? today,
                checkin_time: visit?.checkin_time,
                checkout_time: visit?.checkout_time,
                total_demand: visit?.total_demand ?? 0,
                effective_call: visit?.effective_call ?? "NO",
                items_json: visit?.items_json,
                source: (visit?.sync_status === "synced" ? "server" : "local") as "server" | "local",
                server_visit_id: visit?.server_visit_id,
                checkin_photo_path: visit?.checkin_photo_path,
              },
            });
            return;
          }
          navigation.navigate("VisitCheckin", { store: item });
        }}
        onToggleSkip={() => toggleSkipped(item)}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              {visitedCount}/{displayStores.length} toko
            </Text>
            {skippedSet.size > 0 && (
              <View style={styles.skippedChip}>
                <Ionicons name="warning-outline" size={11} color="#EA580C" accessible={false} />
                <Text style={styles.skippedChipText}>{skippedSet.size} terlewat</Text>
              </View>
            )}
          </View>
          <ProgressBar visited={visitedCount} total={displayStores.length} />
        </View>
        <TouchableOpacity
          style={styles.downloadBtn}
          onPress={handleDownload}
          disabled={downloading}
          testID="btn-download-route"
          accessibilityLabel={downloading ? "Sedang mengunduh rute…" : "Unduh rute hari ini"}
          accessibilityRole="button"
        >
          {downloading
            ? <ActivityIndicator color={Colors.white} size="small" />
            : <Ionicons name="cloud-download-outline" size={16} color={Colors.white} accessible={false} />}
          <Text style={styles.downloadBtnText}>{downloading ? "Mengunduh…" : "Unduh"}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Legend chips ── */}
      <View style={styles.legendBar}>
        {(Object.entries(STATUS_CONFIG) as [VisitStageStatus, StatusConfig][]).map(([key, cfg]) => (
          <View key={key} style={styles.legendChip}>
            <Ionicons name={cfg.icon} size={12} color={cfg.color} accessible={false} />
            <Text style={[styles.legendLabel, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        ))}
      </View>

      {/* ── List ── */}
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} accessibilityLabel="Memuat rute…" />
          <Text style={styles.loadingText}>Memuat rute…</Text>
        </View>
      ) : (
        <FlatList
          data={displayStores}
          keyExtractor={(item) => item.outlet_sk ?? item.route_plan_sk}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.primary} />}
          contentContainerStyle={{ paddingVertical: Spacing.sm }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="map-outline" size={40} color={Colors.slate300} accessible={false} />
              <Text style={styles.emptyTitle}>Tidak ada toko hari ini</Text>
              <Text style={styles.emptySubtitle}>Jadwal kunjungan untuk hari ini belum tersedia.</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: skippedSet.size > 0 ? 100 : 24 }} />}
          testID="store-list"
        />
      )}

      {/* ── Floating submit bar ── */}
      {skippedSet.size > 0 && (
        <View style={styles.floatingBar}>
          <TouchableOpacity
            style={styles.submitSkipBtn}
            onPress={handleSubmitSkipped}
            disabled={submittingSkip}
            testID="btn-submit-skipped"
            accessibilityLabel={submittingSkip ? "Sedang mengirim…" : `Kirim ${skippedSet.size} toko terlewat ke SPV`}
            accessibilityRole="button"
          >
            {submittingSkip ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="send-outline" size={16} color={Colors.white} accessible={false} />
                <Text style={styles.submitSkipBtnText}>
                  Kirim {skippedSet.size} Toko Terlewat ke SPV
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function getISOWeekLabel(d: Date): string {
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diffMs = d.getTime() - startOfWeek1.getTime();
  const week = Math.floor(diffMs / (7 * 24 * 3600 * 1000)) + 1;
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getTodayDayName(): string {
  return ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][new Date().getDay()];
}

function filterToday(stores: ScheduleStore[]): ScheduleStore[] {
  const today = getTodayDayName();
  return stores.filter((s) => !s.visit_day_of_week || s.visit_day_of_week === today);
}

// ── styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadow.sm,
  },
  progressRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.xs },
  progressText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.slate700 },
  skippedChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#FFF7ED", borderRadius: Radius.full,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  skippedChipText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: "#EA580C" },
  progressTrack: {
    height: 4, borderRadius: Radius.full,
    backgroundColor: Colors.slate100, overflow: "hidden",
  },
  progressFill: { height: 4, borderRadius: Radius.full },
  downloadBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Shadow.sm,
  },
  downloadBtnText: { color: Colors.white, fontSize: Typography.sm, fontWeight: Typography.semibold },

  // Legend
  legendBar: {
    flexDirection: "row", flexWrap: "wrap", gap: Spacing.md,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.slate100,
  },
  legendChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendLabel: { fontSize: Typography.xs, fontWeight: Typography.medium },

  // Store cards
  storeCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: Radius.lg,
    ...Shadow.sm,
    overflow: "hidden",
  },
  storeCardVisited: { backgroundColor: Colors.slate50, opacity: 0.85 },
  storeCardSkipped: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  storeCardPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  cardInner: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.md,
  },
  statusCircle: {
    width: 40, height: 40, borderRadius: Radius.full,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  storeInfo: { flex: 1, minWidth: 0 },
  storeName: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.slate800 },
  storeAddress: { fontSize: Typography.sm, color: Colors.slate500, marginTop: 2 },
  tagRow: { flexDirection: "row", gap: Spacing.xs, marginTop: Spacing.xs, flexWrap: "wrap" },
  tag: { borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: Typography.xs, fontWeight: Typography.medium },
  rightCol: { alignItems: "center", gap: Spacing.xs, minWidth: 66 },
  statusLabel: { fontSize: Typography.xs, fontWeight: Typography.semibold, textAlign: "center" },
  syncPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2,
  },
  syncPillOk:    { backgroundColor: Colors.successBg },
  syncPillLocal: { backgroundColor: Colors.warningBg },
  syncDot:  { width: 6, height: 6, borderRadius: 3 },
  syncText: { fontSize: 10, fontWeight: Typography.bold },
  skipBtn: {
    borderWidth: 1, borderColor: Colors.slate200, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    backgroundColor: Colors.slate50,
  },
  skipBtnActive: { borderColor: "#F97316", backgroundColor: "#FFF7ED" },
  skipBtnText: { fontSize: Typography.xs, color: Colors.slate500, fontWeight: Typography.semibold },
  skipBtnTextActive: { color: "#EA580C" },

  // Empty state
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.md },
  loadingText: { fontSize: Typography.sm, color: Colors.slate400 },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: Spacing.sm },
  emptyTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.slate600 },
  emptySubtitle: { fontSize: Typography.sm, color: Colors.slate400, textAlign: "center", paddingHorizontal: Spacing["2xl"] },

  // FAB submit bar
  floatingBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderTopWidth: 1, borderTopColor: Colors.border,
    ...Shadow.lg,
  },
  submitSkipBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm,
    backgroundColor: "#F97316", borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    ...Shadow.md,
  },
  submitSkipBtnText: { color: Colors.white, fontWeight: Typography.bold, fontSize: Typography.base },
});
