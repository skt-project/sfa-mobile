import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, Modal, TextInput,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listVisits, approveVisit, rejectVisit } from "../../api/visit";
import type { Visit } from "../../types";

interface Props {
  navigation: any;
}

export default function ApprovalQueueScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ visible: boolean; visitId: string | null }>({ visible: false, visitId: null });
  const [rejectNote, setRejectNote] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["visits", "pending"],
    queryFn: () => listVisits({ status: "PENDING_SPV", page_size: 50 }),
    staleTime: 30_000,
  });

  const handleApprove = async (visitId: string) => {
    setActionLoading(visitId);
    try {
      await approveVisit(visitId);
      qc.invalidateQueries({ queryKey: ["visits"] });
      Alert.alert("Approved", "Kunjungan berhasil disetujui.");
    } catch (e: any) {
      Alert.alert("Gagal", e?.response?.data?.detail ?? "Gagal approve.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) {
      Alert.alert("Error", "Catatan penolakan wajib diisi.");
      return;
    }
    setActionLoading(rejectModal.visitId!);
    setRejectModal({ visible: false, visitId: null });
    try {
      await rejectVisit(rejectModal.visitId!, rejectNote.trim());
      qc.invalidateQueries({ queryKey: ["visits"] });
      setRejectNote("");
      Alert.alert("Ditolak", "Kunjungan dikembalikan ke SE untuk direvisi.");
    } catch (e: any) {
      Alert.alert("Gagal", e?.response?.data?.detail ?? "Gagal reject.");
    } finally {
      setActionLoading(null);
    }
  };

  const renderItem = ({ item }: { item: Visit }) => (
    <TouchableOpacity
      style={styles.visitCard}
      onPress={() => navigation.navigate("VisitDetailSPV", { visitId: item.visit_id })}
      testID={`approval-${item.visit_id}`}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.visitId}>{item.visit_id}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{item.approval_status}</Text>
        </View>
      </View>
      <Text style={styles.outletSk}>{item.outlet_sk}</Text>
      <Text style={styles.visitDate}>{item.visit_date}</Text>
      <View style={styles.demandRow}>
        <Text style={styles.demand}>Rp {(item.total_demand ?? 0).toLocaleString("id-ID")}</Text>
        <Text style={[styles.effectiveTag, item.effective_call === "YES" ? styles.yes : styles.no]}>
          {item.effective_call === "YES" ? "Efektif" : "Tidak Efektif"}
        </Text>
      </View>
      {item.revision_count && item.revision_count > 0 && (
        <Text style={styles.revisionNote}>Revisi ke-{item.revision_count}</Text>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.approveBtn}
          onPress={() => handleApprove(item.visit_id)}
          disabled={actionLoading === item.visit_id}
          testID={`btn-approve-${item.visit_id}`}
        >
          {actionLoading === item.visit_id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.approveBtnText}>✓ Setuju</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectBtn}
          onPress={() => setRejectModal({ visible: true, visitId: item.visit_id })}
          testID={`btn-reject-${item.visit_id}`}
        >
          <Text style={styles.rejectBtnText}>✗ Tolak</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.visit_id}
        renderItem={renderItem}
        onRefresh={refetch}
        refreshing={isLoading}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={styles.empty}>Tidak ada kunjungan yang menunggu persetujuan 🎉</Text>
          ) : null
        }
        testID="approval-list"
      />

      {/* Reject Modal */}
      <Modal visible={rejectModal.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Catatan Penolakan</Text>
            <TextInput
              style={styles.modalInput}
              value={rejectNote}
              onChangeText={setRejectNote}
              placeholder="Alasan penolakan..."
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
                <Text style={styles.modalRejectText}>Tolak</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  visitCard: { backgroundColor: "#fff", margin: 10, borderRadius: 10, padding: 14, elevation: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  visitId: { fontSize: 12, color: "#94A3B8" },
  statusBadge: { backgroundColor: "#FEF3C7", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, color: "#92400E", fontWeight: "600" },
  outletSk: { fontSize: 15, fontWeight: "600", color: "#1E293B" },
  visitDate: { fontSize: 13, color: "#64748B", marginTop: 2 },
  demandRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  demand: { fontSize: 15, fontWeight: "700", color: "#1D4ED8" },
  effectiveTag: { fontSize: 13, fontWeight: "600" },
  yes: { color: "#16A34A" },
  no: { color: "#DC2626" },
  revisionNote: { fontSize: 12, color: "#EF4444", marginTop: 4 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  approveBtn: { flex: 1, backgroundColor: "#16A34A", borderRadius: 8, padding: 10, alignItems: "center" },
  approveBtnText: { color: "#fff", fontWeight: "700" },
  rejectBtn: { flex: 1, backgroundColor: "#FEE2E2", borderRadius: 8, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#FECACA" },
  rejectBtnText: { color: "#DC2626", fontWeight: "700" },
  empty: { textAlign: "center", marginTop: 60, color: "#94A3B8", fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#1E293B", marginBottom: 12 },
  modalInput: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, padding: 12, fontSize: 14, textAlignVertical: "top", minHeight: 100 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  modalCancel: { flex: 1, backgroundColor: "#F1F5F9", borderRadius: 8, padding: 12, alignItems: "center" },
  modalCancelText: { color: "#475569", fontWeight: "600" },
  modalReject: { flex: 1, backgroundColor: "#DC2626", borderRadius: 8, padding: 12, alignItems: "center" },
  modalRejectText: { color: "#fff", fontWeight: "700" },
});
