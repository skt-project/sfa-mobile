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
import { submitVisit } from "../../api/visit";
import type { ScheduleStore, EffectiveCall, VisitItem } from "../../types";

interface Props {
  route: {
    params: {
      visitId: string | null;
      localId: string | null;
      store: ScheduleStore;
      totalDemand: number;
      effectiveCall: EffectiveCall;
      isOffline: boolean;
      items?: VisitItem[];
    };
  };
  navigation: any;
}

interface BrandSection {
  brand: string;
  skuCount: number;
  totalQty: number;
  products: VisitItem[];
}

export default function VisitCheckoutScreen({ route, navigation }: Props) {
  const { visitId, store, effectiveCall, isOffline, items } = route.params;
  const [submitting, setSubmitting] = useState(false);

  // Group filled items by brand — qty only, no monetary calculations
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
        "Kunjungan tersimpan. Akan dikirim saat online (pull-to-refresh).",
        [{ text: "OK", onPress: () => navigation.navigate("SEHome") }],
      );
      return;
    }

    setSubmitting(true);
    try {
      await submitVisit(visitId);
      Alert.alert("Berhasil!", "Kunjungan berhasil disubmit ke SPV.", [
        { text: "OK", onPress: () => navigation.navigate("SEHome") },
      ]);
    } catch (e: any) {
      Alert.alert("Gagal", e?.response?.data?.detail ?? "Gagal submit. Coba lagi.");
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

        <View style={styles.row}>
          <Text style={styles.label}>Total SKU</Text>
          <Text style={styles.value}>{totalSkuCount} produk</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total Qty</Text>
          <Text style={styles.value}>{totalQty} pcs</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Efektif Call</Text>
          <Text
            style={[
              styles.value,
              effectiveCall === "YES" ? styles.yes : styles.no,
            ]}
          >
            {effectiveCall === "YES" ? "YA" : "TIDAK"}
          </Text>
        </View>
        <View style={[styles.row, { marginBottom: 0 }]}>
          <Text style={styles.label}>Mode</Text>
          <Text style={styles.value}>
            {isOffline ? "Offline (pending sync)" : "Online"}
          </Text>
        </View>
      </View>

      {/* ── Demand summary — grouped by brand with product detail ── */}
      {brandSections.length > 0 && (
        <View style={styles.demandCard}>
          <Text style={styles.demandCardTitle}>Demand Summary</Text>

          {brandSections.map(({ brand, skuCount, totalQty: brandQty, products }, idx) => (
            <View
              key={brand}
              style={[styles.brandSection, idx > 0 && styles.brandSectionBorder]}
            >
              {/* Brand header */}
              <View style={styles.brandHeader}>
                <Text style={styles.brandName}>{brand}</Text>
                <View style={styles.brandMeta}>
                  <Text style={styles.brandMetaText}>
                    {skuCount} SKU
                  </Text>
                  <Text style={styles.brandMetaDot}>·</Text>
                  <Text style={styles.brandMetaText}>
                    Total Qty: {brandQty} pcs
                  </Text>
                </View>
              </View>

              {/* Product list under brand */}
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
          <Text style={styles.offlineText}>
            📵  Data disimpan lokal. Lakukan pull-to-refresh saat kembali
            online untuk sinkronisasi otomatis.
          </Text>
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
  content: { padding: 16, paddingBottom: 32 },

  // ── Summary card ──
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 14,
    elevation: 2,
  },
  summaryTitle: { fontSize: 13, color: "#64748B", marginBottom: 6 },
  storeName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 16,
    lineHeight: 24,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  label: { fontSize: 14, color: "#64748B" },
  value: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  yes: { color: "#16A34A" },
  no: { color: "#DC2626" },

  // ── Demand card ──
  demandCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 14,
    elevation: 2,
  },
  demandCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 16,
  },

  // ── Brand section ──
  brandSection: { paddingBottom: 16 },
  brandSectionBorder: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 16,
    marginTop: 4,
  },
  brandHeader: { marginBottom: 10 },
  brandName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1D4ED8",
    marginBottom: 4,
  },
  brandMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandMetaText: { fontSize: 13, color: "#475569", fontWeight: "500" },
  brandMetaDot: { fontSize: 13, color: "#94A3B8" },

  // ── Product list under brand ──
  productSection: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 12,
  },
  productSectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  productRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  productRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  productInfo: { flex: 1, marginRight: 12 },
  productCode: {
    fontSize: 11,
    color: "#94A3B8",
    fontFamily: "monospace",
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  productName: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1E293B",
    lineHeight: 19,
  },
  productQtyBadge: {
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  productQtyText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },

  // ── Offline notice ──
  offlineBanner: {
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  offlineText: { color: "#92400E", fontSize: 13, lineHeight: 20 },

  // ── Buttons ──
  submitBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  disabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  backBtn: { alignItems: "center", paddingVertical: 12 },
  backText: { color: "#64748B", fontSize: 14 },
});
