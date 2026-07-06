import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView, TextInput,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "../../api/client";
import { useOfflineStore } from "../../store/offlineStore";
import { checkout as apiCheckout } from "../../api/visit";
import type { Sku, VisitItem, ScheduleStore, EffectiveCall } from "../../types";
import { getCachedSkus, cacheSkus } from "../../db/schedule_cache";
import { isOnline } from "../../sync/engine";

interface Props {
  route: {
    params: {
      visitId: string | null;
      store: ScheduleStore;
      isOffline: boolean;
      localId: string | null;
    };
  };
  navigation: any;
}

interface SkuRow extends Sku {
  qty: number;
}

export default function VisitSurveyScreen({ route, navigation }: Props) {
  const { visitId, store, isOffline: offlineMode, localId } = route.params;
  const { updateLocalCheckout } = useOfflineStore();
  const [skuRows, setSkuRows] = useState<SkuRow[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: skuData, isLoading: skuLoading } = useQuery<Sku[]>({
    queryKey: ["skus"],
    queryFn: async () => {
      const online = await isOnline();
      if (online) {
        const r = await getApiClient().get("/sku", { params: { page_size: 500 } });
        await cacheSkus(r.data.items);
        return r.data.items;
      }
      return getCachedSkus() as unknown as Sku[];
    },
  });

  useEffect(() => {
    if (skuData && skuRows.length === 0) {
      setSkuRows(skuData.map((s) => ({ ...s, qty: 0 })));
    }
  }, [skuData]);

  const totalDemand = skuRows.reduce((sum, r) => sum + r.qty * (r.stp ?? 0), 0);
  const effectiveCall: EffectiveCall = totalDemand > 0 ? "YES" : "NO";
  const filledCount = skuRows.filter((r) => r.qty > 0).length;

  const setQty = (skuId: string, qty: number) => {
    setSkuRows((rows) =>
      rows.map((r) => (r.sku_id === skuId ? { ...r, qty: Math.max(0, qty) } : r))
    );
  };

  const handleCheckout = async () => {
    setLoading(true);
    const now = new Date().toISOString();
    const filledItems: VisitItem[] = skuRows
      .filter((r) => r.qty > 0)
      .map((r) => ({
        sku_id: r.sku_id,
        sku_name: r.sku_name,
        brand: r.brand,
        brand_group: r.brand_group,
        category: r.category,
        stp: r.stp ?? 0,
        qty: r.qty,
      }));

    try {
      if (visitId && !offlineMode) {
        await apiCheckout(visitId, {
          total_demand: totalDemand,
          effective_call: effectiveCall,
          notes,
          items: filledItems,
          offline_mode: false,
          captured_at: now,
        });
      } else if (localId) {
        await updateLocalCheckout(localId, {
          checkout_time: now,
          total_demand: totalDemand,
          effective_call: effectiveCall,
          notes,
          items_json: JSON.stringify(filledItems),
        });
      }

      navigation.navigate("VisitCheckout", {
        visitId,
        localId,
        store,
        totalDemand,
        effectiveCall,
        isOffline: offlineMode,
      });
    } catch (e: any) {
      Alert.alert("Gagal", e?.response?.data?.detail ?? "Gagal menyimpan demand.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Sticky header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerStore} numberOfLines={1}>{store.store_name}</Text>
          <Text style={styles.headerSub}>
            {skuRows.length} produk
            {filledCount > 0 ? ` · ${filledCount} diisi` : ""}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.demandLabel}>Total Demand</Text>
          <Text style={styles.demandValue}>
            Rp {totalDemand.toLocaleString("id-ID")}
          </Text>
          <View style={[styles.ecBadge, effectiveCall === "YES" ? styles.ecYes : styles.ecNo]}>
            <Text style={styles.ecText}>
              {effectiveCall === "YES" ? "✓ Efektif" : "✗ Tidak Efektif"}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Instructions */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Masukkan jumlah produk yang terjual ke konsumen akhir (sell-out).
            Bukan pembelian dari salesman.
          </Text>
        </View>

        {skuLoading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Memuat daftar produk...</Text>
          </View>
        )}

        {/* SKU rows */}
        {skuRows.map((sku) => (
          <View key={sku.sku_id} style={[styles.skuCard, sku.qty > 0 && styles.skuCardActive]}>
            {/* Left: product info */}
            <View style={styles.skuInfo}>
              <View style={styles.skuCodeRow}>
                <Text style={styles.skuCode}>{sku.sku_id}</Text>
                {sku.brand_group && (
                  <View style={[
                    styles.brandBadge,
                    sku.brand_group === "SKT" ? styles.brandSkt : styles.brandG2g,
                  ]}>
                    <Text style={styles.brandText}>{sku.brand_group}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.skuName}>{sku.sku_name}</Text>
              {sku.category && (
                <Text style={styles.skuSize}>{sku.category}</Text>
              )}
              <Text style={styles.skuStp}>
                Rp {(sku.stp ?? 0).toLocaleString("id-ID")} / unit
              </Text>
            </View>

            {/* Right: qty control */}
            <View style={styles.qtyBlock}>
              <TouchableOpacity
                style={[styles.qtyBtn, sku.qty === 0 && styles.qtyBtnDisabled]}
                onPress={() => setQty(sku.sku_id, sku.qty - 1)}
                disabled={sku.qty === 0}
                testID={`dec-${sku.sku_id}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.qtyBtnText, sku.qty === 0 && styles.qtyBtnTextDisabled]}>−</Text>
              </TouchableOpacity>

              <TextInput
                style={[styles.qtyInput, sku.qty > 0 && styles.qtyInputActive]}
                value={String(sku.qty)}
                onChangeText={(v) => setQty(sku.sku_id, parseInt(v) || 0)}
                keyboardType="number-pad"
                selectTextOnFocus
                testID={`qty-${sku.sku_id}`}
              />

              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQty(sku.sku_id, sku.qty + 1)}
                testID={`inc-${sku.sku_id}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Notes */}
        <View style={styles.notesSection}>
          <Text style={styles.notesLabel}>Catatan Kunjungan (opsional)</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholder="Kondisi toko, feedback pelanggan, kendala, dll..."
            testID="input-notes"
          />
        </View>
      </ScrollView>

      {/* Checkout button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.checkoutBtn, loading && styles.btnDisabled]}
          onPress={handleCheckout}
          disabled={loading}
          testID="btn-checkout"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.checkoutBtnText}>LANJUT CHECK-OUT</Text>
              <Text style={styles.checkoutBtnSub}>
                {filledCount > 0
                  ? `${filledCount} SKU · Rp ${totalDemand.toLocaleString("id-ID")}`
                  : "Lanjut tanpa demand (tidak efektif)"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },

  header: {
    backgroundColor: "#1D4ED8",
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: { flex: 1, marginRight: 12 },
  headerStore: { fontSize: 15, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 12, color: "#BFDBFE", marginTop: 2 },
  headerRight: { alignItems: "flex-end" },
  demandLabel: { fontSize: 11, color: "#BFDBFE" },
  demandValue: { fontSize: 18, fontWeight: "700", color: "#fff", marginTop: 2 },
  ecBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  ecYes: { backgroundColor: "#16A34A" },
  ecNo: { backgroundColor: "#64748B" },
  ecText: { fontSize: 12, fontWeight: "600", color: "#fff" },

  list: { flex: 1 },

  infoBox: {
    backgroundColor: "#EFF6FF",
    margin: 12,
    marginBottom: 4,
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#2563EB",
  },
  infoText: { fontSize: 12, color: "#1D4ED8", lineHeight: 18 },

  loadingBox: { padding: 40, alignItems: "center", gap: 12 },
  loadingText: { color: "#64748B", fontSize: 14 },

  skuCard: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginTop: 6,
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    elevation: 1,
    borderWidth: 1,
    borderColor: "transparent",
  },
  skuCardActive: { borderColor: "#BFDBFE", backgroundColor: "#F0F7FF" },

  skuInfo: { flex: 1, marginRight: 12 },
  skuCodeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  skuCode: { fontSize: 11, color: "#94A3B8", fontFamily: "monospace" },
  brandBadge: { borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1 },
  brandSkt: { backgroundColor: "#DBEAFE" },
  brandG2g: { backgroundColor: "#FCE7F3" },
  brandText: { fontSize: 10, fontWeight: "600", color: "#475569" },
  skuName: { fontSize: 14, fontWeight: "600", color: "#1E293B", lineHeight: 20 },
  skuSize: { fontSize: 12, color: "#64748B", marginTop: 1 },
  skuStp: { fontSize: 12, color: "#94A3B8", marginTop: 2 },

  qtyBlock: { alignItems: "center" },
  qtyBtn: {
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyBtnDisabled: { backgroundColor: "#F1F5F9" },
  qtyBtnText: { fontSize: 20, color: "#2563EB", fontWeight: "700", lineHeight: 24 },
  qtyBtnTextDisabled: { color: "#CBD5E1" },
  qtyInput: {
    width: 48,
    height: 38,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    borderBottomWidth: 2,
    borderBottomColor: "#E2E8F0",
    marginHorizontal: 6,
  },
  qtyInputActive: { borderBottomColor: "#2563EB", color: "#1D4ED8" },

  notesSection: { backgroundColor: "#fff", margin: 12, borderRadius: 10, padding: 14 },
  notesLabel: { fontSize: 14, fontWeight: "600", color: "#475569", marginBottom: 8 },
  notesInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    textAlignVertical: "top",
    minHeight: 80,
  },

  footer: { padding: 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  checkoutBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  checkoutBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
  checkoutBtnSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 3 },
});
