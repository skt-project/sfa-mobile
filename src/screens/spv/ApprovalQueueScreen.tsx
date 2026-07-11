import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, Modal, TextInput,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listVisits, approveVisit, rejectVisit,
  listSkippedStores, returnSkippedStore, executeSkippedStore,
} from "../../api/visit";
import { Colors, Spacing, Radius, Shadow, Typography } from "../../theme";
import type { Visit, SkippedStore } from "../../types";

interface Props { navigation: any; }
type TabKey = "visits" | "skipped";

// ── Visit card ──────────────────────────────────────────────────────────────

function VisitCard({
  item, navigation, onApprove, onReject, actionLoading,
}: {
  item: Visit;
  navigation: any;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  actionLoading: string | null;
}) {
  const isLoading = actionLoading === item.visit_id;
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("VisitDetailSPV", { visitId: item.visit_id })}
      testID={`approval-${item.visit_id}`}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardId}>{item.visit_id}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{item.approval_status}</Text>
        </View>
      </View>

      <Text style={styles.outletName}>
        {(item as any).store_name ?? item.outlet_sk ?? "—"}
      </Text>
      <Text style={styles.meta}>
        {(item as any).salesman_name ?? item.salesman_sk} · {item.visit_date}
      </Text>

      <View style={styles.demandRow}>
        <Text style={styles.demand}>
          Rp {(item.total_demand ?? 0).toLocaleString("id-ID")}
        </Text>
        <Text style={[styles.ecTag, item.effective_call === "YES" ? styles.ecYes : styles.ecNo]}>
          {item.effective_call === "YES" ? "Efektif" : "Tidak Efektif"}
        </Text>
      </View>

      {item.revision_count != null && item.revision_count > 0 && (
        <Text style={styles.revisionNote}>Revisi ke-{item.revision_count}</Text>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.approveBtn}
          onPress={() => onApprove(item.visit_id)}
          disabled={isLoading}
          testID={`btn-approve-${item.visit_id}`}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <View style={styles.btnContent}>
              <Ionicons name="checkmark-outline" size={16} color={Colors.white} />
              <Text style={styles.approveBtnText}>Setuju</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rejectBtn}
          onPress={() => onReject(item.visit_id)}
          disabled={isLoading}
          testID={`btn-reject-${item.visit_id}`}
        >
          <View style={styles.btnContent}>
            <Ionicons name="close-outline" size={16} color={Colors.danger} />
            <Text style={styles.rejectBtnText}>Revisi</Text>
          </View>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ── Skipped Store card ────────────────────────────────────────────────────────

function SkippedCard({
  item, onReturn, onExecute, actionLoading,
}: {
  item: SkippedStore;
  onReturn: (id: string) => void;
  onExecute: (id: string) => void;
  actionLoading: string | null;
}) {
  const isLoading = actionLoading === item.skipped_store_id;
  const isPending = item.status === "PENDING_SPV";

  const statusColors: Record<string, string> = {
    PENDING_SPV:          "#92400E",
    RETURNED_TO_SALESMAN: Colors.primaryDark,
    EXECUTED_BY_SPV:      "#166534",
    EXPIRED:              Colors.slate500,
  };

  const statusLabels: Record<string, string> = {
    PENDING_SPV:          "Menunggu SPV",
    RETURNED_TO_SALESMAN: "Dikembalikan ke SE",
    EXECUTED_BY_SPV:      "Dilaksanakan SPV",
    EXPIRED:              "Kadaluarsa",
  };

  return (
    <View
      style={[styles.card, !isPending && styles.cardDone]}
      testID={`skipped-${item.skipped_store_id}`}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardId}>{item.week_iso} · {item.visit_date}</Text>
        <View style={[styles.statusBadge, { backgroundColor: Colors.warningBg }]}>
          <Text style={[styles.statusText, { color: statusColors[item.status] ?? Colors.slate500 }]}>
            {statusLabels[item.status] ?? item.status}
          </Text>
        </View>
      </View>

      <Text style={styles.outletName}>{item.outlet_name ?? item.outlet_sk}</Text>
      {item.distributor_code && (
        <Text style={styles.meta}>{item.distributor_code}</Text>
      )}
      {item.spv_notes && (
        <Text style={styles.spvNotes}>{item.spv_notes}</Text>
      )}

      {isPending && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.returnBtn}
            onPress={() => onReturn(item.skipped_store_id)}
            disabled={isLoading}
            testID={`btn-return-${item.skipped_store_id}`}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={Colors.primaryDark} />
            ) : (
              <View style={styles.btnContent}>
                <Ionicons name="return-up-back-outline" size={16} color={Colors.primaryDark} />
                <Text style={styles.returnBtnText}>Kembalikan ke SE</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.executeBtn}
            onPress={() => onExecute(item.skipped_store_id)}
            disabled={isLoading}
            testID={`btn-execute-${item.skipped_store_id}`}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <View style={styles.btnContent}>
                <Ionicons name="play-outline" size={16} color={Colors.white} />
                <Text style={styles.executeBtnText}>Laksanakan</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyQueue({ message }: { message: string }) {
  return (
    <View style={styles.emptyWrap}>
      <Ionicons name="checkmark-circle-outline" size={48} color={Colors.success} />
      <Text style={styles.empty}>{message}</Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ApprovalQueueScreen({ navigation }: Props) {
  const qc  = useQueryClient();
  const [tab, setTab] = useState<TabKey>("visits");

  const [visitActionLoading, setVisitActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ visible: boolean; visitId: string | null }>({
    visible: false, visitId: null,
  });
  const [rejectNote, setRejectNote] = useState("");

  const [skipActionLoading, setSkipActionLoading] = useState<string | null>(null);
  const [skipNoteModal, setSkipNoteModal] = useState<{
    visible: boolean; id: string | null; action: "return" | "execute";
  }>({ visible: false, id: null, action: "return" });
  const [skipNote, setSkipNote] = useState("");

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: visitData, isLoading: visitsLoading, refetch: refetchVisits } = useQuery({
    queryKey: ["visits", "pending"],
    queryFn:  () => listVisits({ status: "PENDING_SPV", page_size: 50 }),
    staleTime: 30_000,
    enabled:  tab === "visits",
  });

  const { data: skippedData, isLoading: skippedLoading, refetch: refetchSkipped } = useQuery({
    queryKey: ["skipped-stores", "pending"],
    queryFn:  () => listSkippedStores({ status: "PENDING_SPV", page_size: 100 }),
    staleTime: 30_000,
    enabled:  tab === "skipped",
  });

  // ── Visit actions ──────────────────────────────────────────────────────────

  const handleApprove = async (visitId: string) => {
    setVisitActionLoading(visitId);
    try {
      await approveVisit(visitId);
      qc.invalidateQueries({ queryKey: ["visits"] });
      Alert.alert("Disetujui", "Kunjungan berhasil disetujui.");
    } catch (e: any) {
      Alert.alert("Gagal", e?.response?.data?.detail ?? "Gagal approve.");
    } finally {
      setVisitActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) {
      Alert.alert("Error", "Catatan penolakan wajib diisi.");
      return;
    }
    setVisitActionLoading(rejectModal.visitId!);
    setRejectModal({ visible: false, visitId: null });
    try {
      await rejectVisit(rejectModal.visitId!, rejectNote.trim());
      qc.invalidateQueries({ queryKey: ["visits"] });
      setRejectNote("");
      Alert.alert("Dikembalikan", "Kunjungan dikembalikan ke SE untuk direvisi.");
    } catch (e: any) {
      Alert.alert("Gagal", e?.response?.data?.detail ?? "Gagal reject.");
    } finally {
      setVisitActionLoading(null);
    }
  };

  // ── Skipped store actions ──────────────────────────────────────────────────

  const handleSkipAction = async () => {
    const { id, action } = skipNoteModal;
    if (!id) return;
    setSkipActionLoading(id);
    setSkipNoteModal({ visible: false, id: null, action: "return" });
    try {
      if (action === "return") {
        await returnSkippedStore(id, skipNote.trim() || undefined);
        Alert.alert("Dikembalikan", "Toko dikembalikan ke salesman untuk dikunjungi.");
      } else {
        await executeSkippedStore(id, skipNote.trim() || undefined);
        Alert.alert("Dilaksanakan", "Kunjungan akan dilaksanakan oleh SPV.");
      }
      qc.invalidateQueries({ queryKey: ["skipped-stores"] });
      setSkipNote("");
    } catch (e: any) {
      Alert.alert("Gagal", e?.response?.data?.detail ?? "Gagal memproses.");
    } finally {
      setSkipActionLoading(null);
    }
  };

  const openSkipModal = (id: string, action: "return" | "execute") => {
    setSkipNote("");
    setSkipNoteModal({ visible: true, id, action });
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const visitItems     = visitData?.items   ?? [];
  const skippedItems   = skippedData?.items ?? [];
  const pendingVisits  = visitData?.total   ?? 0;
  const pendingSkipped = skippedData?.total ?? 0;

  return (
    <View style={styles.container}>
      {/* ── Tabs ── */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === "visits" && styles.tabActive]}
          onPress={() => setTab("visits")}
        >
          <Text style={[styles.tabText, tab === "visits" && styles.tabTextActive]}>Kunjungan</Text>
          {pendingVisits > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingVisits}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, tab === "skipped" && styles.tabActive]}
          onPress={() => setTab("skipped")}
        >
          <Text style={[styles.tabText, tab === "skipped" && styles.tabTextActive]}>Toko Terlewat</Text>
          {pendingSkipped > 0 && (
            <View style={[styles.badge, { backgroundColor: "#F97316" }]}>
              <Text style={styles.badgeText}>{pendingSkipped}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Visit list ── */}
      {tab === "visits" && (
        <FlatList
          data={visitItems}
          keyExtractor={(item) => item.visit_id}
          renderItem={({ item }) => (
            <VisitCard
              item={item}
              navigation={navigation}
              onApprove={handleApprove}
              onReject={(id) => setRejectModal({ visible: true, visitId: id })}
              actionLoading={visitActionLoading}
            />
          )}
          onRefresh={refetchVisits}
          refreshing={visitsLoading}
          contentContainerStyle={{ paddingVertical: Spacing.sm }}
          ListEmptyComponent={
            !visitsLoading
              ? <EmptyQueue message="Tidak ada kunjungan menunggu persetujuan" />
              : null
          }
          testID="approval-list"
        />
      )}

      {/* ── Skipped store list ── */}
      {tab === "skipped" && (
        <FlatList
          data={skippedItems}
          keyExtractor={(item) => item.skipped_store_id}
          renderItem={({ item }) => (
            <SkippedCard
              item={item}
              onReturn={(id) => openSkipModal(id, "return")}
              onExecute={(id) => openSkipModal(id, "execute")}
              actionLoading={skipActionLoading}
            />
          )}
          onRefresh={refetchSkipped}
          refreshing={skippedLoading}
          contentContainerStyle={{ paddingVertical: Spacing.sm }}
          ListEmptyComponent={
            !skippedLoading
              ? <EmptyQueue message="Tidak ada toko terlewat yang perlu ditinjau" />
              : null
          }
          testID="skipped-list"
        />
      )}

      {/* ── Visit reject modal ── */}
      <Modal visible={rejectModal.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Catatan Penolakan</Text>
            <TextInput
              style={styles.modalInput}
              value={rejectNote}
              onChangeText={setRejectNote}
              placeholder="Alasan penolakan / catatan revisi..."
              multiline
              numberOfLines={4}
              testID="input-reject-note"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setRejectModal({ visible: false, visitId: null })}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalReject} onPress={handleReject}>
                <Text style={styles.modalRejectText}>Kembalikan ke SE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Skipped store action modal ── */}
      <Modal visible={skipNoteModal.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {skipNoteModal.action === "return" ? "Kembalikan ke Salesman" : "Laksanakan oleh SPV"}
            </Text>
            <Text style={styles.modalSubtitle}>
              {skipNoteModal.action === "return"
                ? "Salesman akan mendapat notifikasi untuk mengunjungi toko ini."
                : "SPV akan melaksanakan kunjungan ke toko ini (rekam sebagai kunjungan SPV)."}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={skipNote}
              onChangeText={setSkipNote}
              placeholder="Catatan (opsional)..."
              multiline
              numberOfLines={3}
              testID="input-skip-note"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setSkipNoteModal({ visible: false, id: null, action: "return" })}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirm,
                  skipNoteModal.action === "execute" && { backgroundColor: Colors.primary },
                ]}
                onPress={handleSkipAction}
              >
                <Text style={styles.modalConfirmText}>
                  {skipNoteModal.action === "return" ? "Kembalikan" : "Laksanakan"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  tabRow: {
    flexDirection: "row",
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: Spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive:     { borderBottomColor: Colors.primary },
  tabText:       { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.slate400 },
  tabTextActive: { color: Colors.primary },
  badge: {
    backgroundColor: Colors.danger,
    borderRadius: Radius.full,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: { color: Colors.white, fontSize: Typography.xs, fontWeight: Typography.bold },

  card: {
    backgroundColor: Colors.card,
    margin: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  cardDone: { backgroundColor: Colors.muted, opacity: 0.85 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.sm },
  cardId: { fontSize: Typography.xs, color: Colors.slate400, flexShrink: 1, marginRight: Spacing.sm },
  statusBadge: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: { fontSize: Typography.xs, color: "#92400E", fontWeight: Typography.semibold },

  outletName: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.slate800 },
  meta:       { fontSize: Typography.sm,   color: Colors.slate500, marginTop: 2 },
  spvNotes:   { fontSize: Typography.xs,   color: Colors.slate600, marginTop: Spacing.sm, fontStyle: "italic" },

  demandRow: { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.sm },
  demand:    { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.primaryDark },
  ecTag:     { fontSize: Typography.sm,   fontWeight: Typography.semibold },
  ecYes:     { color: Colors.success },
  ecNo:      { color: Colors.danger },
  revisionNote: { fontSize: Typography.xs, color: Colors.danger, marginTop: Spacing.xs },

  btnContent: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  actions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },

  approveBtn: {
    flex: 1, backgroundColor: Colors.success, borderRadius: Radius.sm,
    padding: Spacing.sm, alignItems: "center",
  },
  approveBtnText: { color: Colors.white, fontWeight: Typography.bold },

  rejectBtn: {
    flex: 1, backgroundColor: Colors.dangerBg, borderRadius: Radius.sm,
    padding: Spacing.sm, alignItems: "center",
    borderWidth: 1, borderColor: "#FECACA",
  },
  rejectBtnText: { color: Colors.danger, fontWeight: Typography.bold },

  returnBtn: {
    flex: 1, backgroundColor: Colors.primaryBg, borderRadius: Radius.sm,
    padding: Spacing.sm, alignItems: "center",
    borderWidth: 1, borderColor: Colors.primaryBorder,
  },
  returnBtnText: { color: Colors.primaryDark, fontWeight: Typography.bold },

  executeBtn: {
    flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.sm,
    padding: Spacing.sm, alignItems: "center",
  },
  executeBtnText: { color: Colors.white, fontWeight: Typography.bold },

  emptyWrap: { alignItems: "center", marginTop: 60, gap: Spacing.md, paddingHorizontal: Spacing.xl },
  empty:     { color: Colors.slate400, fontSize: Typography.base, textAlign: "center" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: 36,
  },
  modalTitle:    { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.slate800, marginBottom: Spacing.xs },
  modalSubtitle: { fontSize: Typography.sm, color: Colors.slate500, marginBottom: Spacing.md, lineHeight: 18 },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.slate300,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    fontSize: Typography.sm,
    textAlignVertical: "top",
    minHeight: 90,
  },
  modalActions: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.lg },
  modalCancel: {
    flex: 1, backgroundColor: Colors.slate100, borderRadius: Radius.sm,
    padding: Spacing.md, alignItems: "center",
  },
  modalCancelText: { color: Colors.slate600, fontWeight: Typography.semibold },
  modalReject: {
    flex: 1, backgroundColor: Colors.danger, borderRadius: Radius.sm,
    padding: Spacing.md, alignItems: "center",
  },
  modalRejectText: { color: Colors.white, fontWeight: Typography.bold },
  modalConfirm: {
    flex: 1, backgroundColor: Colors.success, borderRadius: Radius.sm,
    padding: Spacing.md, alignItems: "center",
  },
  modalConfirmText: { color: Colors.white, fontWeight: Typography.bold },
});
