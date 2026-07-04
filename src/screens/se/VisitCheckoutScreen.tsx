import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView,
} from "react-native";
import { submitVisit } from "../../api/visit";
import type { ScheduleStore, EffectiveCall } from "../../types";

interface Props {
  route: {
    params: {
      visitId: string | null;
      localId: string | null;
      store: ScheduleStore;
      totalDemand: number;
      effectiveCall: EffectiveCall;
      isOffline: boolean;
    };
  };
  navigation: any;
}

export default function VisitCheckoutScreen({ route, navigation }: Props) {
  const { visitId, localId, store, totalDemand, effectiveCall, isOffline } = route.params;
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!visitId) {
      // Offline: just mark as done locally
      Alert.alert(
        "Tersimpan Offline",
        "Kunjungan tersimpan. Akan dikirim saat online (pull-to-refresh).",
        [{ text: "OK", onPress: () => navigation.navigate("SEHome") }],
      );
      return;
    }

    setSubmitting(true);
    try {
      await submitVisit(visitId);
      Alert.alert(
        "Berhasil!",
        "Kunjungan berhasil disubmit ke SPV.",
        [{ text: "OK", onPress: () => navigation.navigate("SEHome") }],
      );
    } catch (e: any) {
      Alert.alert("Gagal", e?.response?.data?.detail ?? "Gagal submit. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Ringkasan Kunjungan</Text>
        <Text style={styles.storeName}>{store.store_name}</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Total Demand</Text>
          <Text style={styles.value}>Rp {totalDemand.toLocaleString("id-ID")}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Efektif Call</Text>
          <Text style={[styles.value, effectiveCall === "YES" ? styles.yes : styles.no]}>
            {effectiveCall === "YES" ? "YA" : "TIDAK"}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Mode</Text>
          <Text style={styles.value}>{isOffline ? "Offline (pending sync)" : "Online"}</Text>
        </View>
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            📵  Data disimpan lokal. Lakukan pull-to-refresh saat kembali online untuk sinkronisasi otomatis.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.disabled]}
        onPress={handleSubmit}
        disabled={submitting}
        testID="btn-submit"
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>
            {isOffline ? "SELESAI" : "SUBMIT KE SPV"}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.navigate("SEHome")}
      >
        <Text style={styles.backText}>Kembali ke Home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  summaryCard: { backgroundColor: "#fff", borderRadius: 12, padding: 20, marginBottom: 16, elevation: 2 },
  summaryTitle: { fontSize: 14, color: "#64748B", marginBottom: 8 },
  storeName: { fontSize: 18, fontWeight: "700", color: "#1E293B", marginBottom: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  label: { fontSize: 14, color: "#64748B" },
  value: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  yes: { color: "#16A34A" },
  no: { color: "#DC2626" },
  offlineBanner: { backgroundColor: "#FEF3C7", borderRadius: 10, padding: 14, marginBottom: 16 },
  offlineText: { color: "#92400E", fontSize: 13 },
  submitBtn: { backgroundColor: "#2563EB", borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 12 },
  disabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  backBtn: { alignItems: "center", padding: 12 },
  backText: { color: "#64748B", fontSize: 14 },
});
