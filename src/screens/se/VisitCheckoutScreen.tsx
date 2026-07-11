import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { CommonActions } from "@react-navigation/native";
import { submitVisit } from "../../api/visit";
import { updateLocalVisitSyncStatus } from "../../db/visits";
import { useOfflineStore } from "../../store/offlineStore";
import { Colors, Spacing, Radius, Shadow, Typography } from "../../theme";
import type { ScheduleStore, EffectiveCall, VisitItem } from "../../types";

interface Props {
  route: {
    params: {
      visitId:       string | null;
      localId:       string | null;
      store:         ScheduleStore;
      totalDemand:   number;
      effectiveCall: EffectiveCall;
      isOffline:     boolean;
      items?:        VisitItem[];
    };
  };
  navigation: any;
}

interface BrandSection {
  brand:    string;
  skuCount: number;
  totalQty: number;
  products: VisitItem[];
}

function goHome(navigation: any) {
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: "SETabs", state: { routes: [{ name: "SEHome" }], index: 0 } }],
    }),
  );
}

export default function VisitCheckoutScreen({ route, navigation }: Props) {
  const { visitId, localId, store, totalDemand, effectiveCall, isOffline, items } = route.params;
  const { markSubmittedToSpv } = useOfflineStore();
  const [submitting, setSubmitting] = useState(false);

  const brandSections = useMemo<BrandSection[]>(() => {
    if (!items || items.length === 0) return [];
    const map: Record<string, BrandSection> = {};
    for (const item of items) {
      const brand = item.brand ?? "Lainnya";
      if (!map[brand]) map[brand] = { brand, skuCount: 0, totalQty: 0, products: [] };
      map[brand].skuCount += 1;
      map[brand].totalQty += item.qty;
      map[brand].products.push(item);
    }
    return Object.values(map);
  }, [items]);

  const totalSkuCount = items?.length ?? 0;
  const totalQty = useMemo(
    () => (items ?? []).reduce((sum, i) => sum + i.qty, 0),
    [items],
  );

  const handleSubmit = async () => {
    if (!visitId) {
      Alert.alert(
        "Tersimpan Offline",
        "Kunjungan tersimpan lokal dan akan dikirim ke SPV saat koneksi tersedia.",
        [{ text: "OK", onPress: () => goHome(navigation) }],
      );
      return;
    }

    setSubmitting(true);
    try {
      await submitVisit(visitId, {
        total_demand:   totalDemand,
        effective_call: effectiveCall,
        items:          items ?? [],
      });
      if (localId) {
        try { await markSubmittedToSpv(localId); } catch { /* non-critical */ }
      }
      Alert.alert(
        "Berhasil!",
        "Kunjungan berhasil disubmit ke SPV dan sedang menunggu persetujuan.",
        [{ text: "OK", onPress: () => goHome(navigation) }],
      );
    } catch (e: any) {
      const isNetwork =
        !e.response &&
        (e?.code === "ECONNABORTED" || e?.code === "ERR_NETWORK" || !e?.code);
      if (isNetwork && localId) {
        try { await updateLocalVisitSyncStatus(localId, "local", visitId); } catch { /* non-critical */ }
        Alert.alert(
          "Koneksi Terputus",
          "Data tersimpan lokal. Lakukan pull-to-refresh saat kembali online untuk mengirim ke SPV.",
          [{ text: "OK", onPress: () => goHome(navigation) }],
        );
      } else {
        const detail    = e?.response?.data?.detail;
        const isTimeout = e?.code === "ECONNABORTED" || e?.code === "ERR_NETWORK";
        Alert.alert(
          "Gagal Submit",
          detail ?? (isTimeout
            ? "Koneksi timeout. Pastikan sinyal stabil lalu coba lagi."
            : "Gagal submit. Coba lagi."),
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Visit summary card ── */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Ringkasan Kunjungan</Text>
        <Text style={styles.storeName}>{store.store_name}</Text>

        {[
          { label: "Total SKU",   value: `${totalSkuCount} produk` },
          { label: "Total Qty",   value: `${totalQty} pcs` },
        ].map(({ label, value }) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}

        <View style={styles.row}>
          <Text style={styles.label}>Efektif Call</Text>
          <Text style={[styles.value, effectiveCall === "YES" ? styles.yes : styles.no]}>
            {effectiveCall === "YES" ? "YA" : "TIDAK"}
          </Text>
        </View>

        <View style={[styles.row, { marginBottom: 0 }]}>
          <Text style={styles.label}>Mode</Text>
          <Text style={styles.value}>{isOffline ? "Offline (pending sync)" : "Online"}</Text>
        </View>
      </View>

      {/* ── Demand summary grouped by brand ── */}
      {brandSections.length > 0 && (
        <View style={styles.demandCard}>
          <Text style={styles.demandCardTitle}>Demand Summary</Text>

          {brandSections.map(({ brand, skuCount, totalQty: brandQty, products }, idx) => (
            <View
              key={brand}
              style={[styles.brandSection, idx > 0 && styles.brandSectionBorder]}
            >
              <View style={styles.brandHeader}>
                <Text style={styles.brandName}>{brand}</Text>
                <View style={styles.brandMeta}>
                  <Text style={styles.brandMetaText}>{skuCount} SKU</Text>
                  <Text style={styles.brandMetaDot}>·</Text>
                  <Text style={styles.brandMetaText}>Total Qty: {brandQty} pcs</Text>
                </View>
              </View>

              <View style={styles.productSection}>
                <Text style={styles.productSectionLabel}>Produk</Text>
                {products.map((p, pIdx) => (
                  <View
                    key={p.sku_id}
                    style={[
                      styles.productRow,
                      pIdx < products.length - 1 && styles.productRowBorder,
                    ]}
                  >
                    <View style={styles.productInfo}>
                      <Text style={styles.productCode}>{p.sku_id}</Text>
                      <Text style={styles.productName}>{p.sku_name}</Text>
                    </View>
                    <View style={styles.productQtyBadge}>
                      <Text style={styles.productQtyText}>{p.qty} pcs</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Offline notice ── */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <View style={styles.offlineRow}>
            <Ionicons name="cloud-offline-outline" size={16} color="#92400E" />
            <Text style={styles.offlineText}>
              Data disimpan lokal. Lakukan pull-to-refresh saat kembali online untuk sinkronisasi otomatis ke SPV.
            </Text>
          </View>
        </View>
      )}

      {/* ── Submit button ── */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.disabled]}
        onPress={handleSubmit}
        disabled={submitting}
        testID="btn-submit"
      >
        {submitting ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.submitText}>
            {isOffline ? "SELESAI" : "SUBMIT KE SPV"}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.backBtn} onPress={() => goHome(navigation)}>
        <Text style={styles.backText}>Kembali ke Home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content:   { padding: Spacing.lg, paddingBottom: Spacing["3xl"] },

  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.xl,
    marginBottom: 14,
    ...Shadow.sm,
  },
  summaryTitle: { fontSize: Typography.sm,   color: Colors.slate500, marginBottom: Spacing.xs },
  storeName: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.slate800,
    marginBottom: Spacing.lg,
    lineHeight: 24,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  label: { fontSize: Typography.sm,   color: Colors.slate500 },
  value: { fontSize: Typography.sm,   fontWeight: Typography.semibold, color: Colors.slate800 },
  yes:   { color: "#16A34A" },
  no:    { color: Colors.danger },

  demandCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.xl,
    marginBottom: 14,
    ...Shadow.sm,
  },
  demandCardTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.slate800,
    marginBottom: Spacing.lg,
  },

  brandSection:       { paddingBottom: Spacing.lg },
  brandSectionBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.lg,
    marginTop: Spacing.xs,
  },
  brandHeader: { marginBottom: Spacing.sm },
  brandName: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.primaryDark,
    marginBottom: Spacing.xs,
  },
  brandMeta:     { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  brandMetaText: { fontSize: Typography.sm, color: Colors.slate600, fontWeight: Typography.medium },
  brandMetaDot:  { fontSize: Typography.sm, color: Colors.slate400 },

  productSection: {
    backgroundColor: Colors.muted,
    borderRadius: Radius.sm,
    padding: Spacing.md,
  },
  productSectionLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.slate400,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
  },
  productRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  productRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  productInfo:      { flex: 1, marginRight: Spacing.md },
  productCode: {
    fontSize: Typography.xs,
    color: Colors.slate400,
    fontFamily: "monospace",
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  productName: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.slate800,
    lineHeight: 19,
  },
  productQtyBadge: {
    backgroundColor: Colors.primaryBg,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  productQtyText: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: Colors.primary,
  },

  offlineBanner: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 14,
  },
  offlineRow: { flexDirection: "row", gap: Spacing.sm, alignItems: "flex-start" },
  offlineText: { color: "#92400E", fontSize: Typography.sm, lineHeight: 20, flex: 1 },

  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  disabled:   { opacity: 0.6 },
  submitText: { color: Colors.white, fontSize: Typography.lg, fontWeight: Typography.bold },
  backBtn:    { alignItems: "center", paddingVertical: Spacing.md },
  backText:   { color: Colors.slate500, fontSize: Typography.sm },
});
