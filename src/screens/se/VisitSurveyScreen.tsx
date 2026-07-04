import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, ScrollView,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "../../api/client";
import { useOfflineStore } from "../../store/offlineStore";
import { checkout as apiCheckout } from "../../api/visit";
import type { Sku, VisitItem, ScheduleStore, EffectiveCall } from "../../types";
import { getCachedSkus, cacheSkus } from "../../db/schedule_cache";
import { isOnline } from "../../sync/engine";

interface Props {
  route: { params: { visitId: string | null; store: ScheduleStore; isOffline: boolean; localId: string | null } };
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

  // Load SKUs from server or cache
  const { data: skuData } = useQuery<Sku[]>({
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

  const totalDemand = skuRows.reduce((sum, r) => sum + (r.qty * (r.stp ?? 0)), 0);
  const effectiveCall: EffectiveCall = totalDemand > 0 ? "YES" : "NO";

  const updateQty = (skuId: string, qty: number) => {
    setSkuRows((rows) => rows.map((r) => r.sku_id === skuId ? { ...r, qty } : r));
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
        // Online checkout
        await apiCheckout(visitId, {
          total_demand: totalDemand,
          effective_call: effectiveCall,
          notes,
          items: filledItems,
          offline_mode: false,
          captured_at: now,
        });
      } else if (localId) {
        // Offline: update local record
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
      Alert.alert("Gagal", e?.response?.data?.detail ?? "Gagal menyimpan survey.");
    } finally {
      setLoading(false);
    }
  };

  const activeSkus = skuRows.filter((r) => r.qty > 0);

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Store header */}
        <View style={styles.storeHeader}>
          <Text style={styles.storeName}>{store.store_name}</Text>
          <Text style={styles.demandTotal}>
            Total Demand: Rp {totalDemand.toLocaleString("id-ID")}
          </Text>
          <Text style={[styles.effectiveTag, effectiveCall === "YES" ? styles.effective : styles.notEffective]}>
            {effectiveCall === "YES" ? "✓ Efektif" : "✗ Tidak Efektif"}
          </Text>
        </View>

        {/* SKU List */}
        {skuRows.map((sku) => (
          <View key={sku.sku_id} style={styles.skuRow}>
            <View style={styles.skuInfo}>
              <Text style={styles.skuName}>{sku.sku_name}</Text>
              <Text style={styles.skuStp}>Rp {(sku.stp ?? 0).toLocaleString("id-ID")}</Text>
            </View>
            <View style={styles.qtyControl}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => updateQty(sku.sku_id, Math.max(0, sku.qty - 1))}
                testID={`dec-${sku.sku_id}`}
              >
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.qtyInput}
                value={String(sku.qty)}
                onChangeText={(v) => updateQty(sku.sku_id, Math.max(0, parseInt(v) || 0))}
                keyboardType="number-pad"
                testID={`qty-${sku.sku_id}`}
              />
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => updateQty(sku.sku_id, sku.qty + 1)}
                testID={`inc-${sku.sku_id}`}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Notes */}
        <View style={styles.notesSection}>
          <Text style={styles.notesLabel}>Catatan (opsional)</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholder="Kondisi toko, feedback, dll..."
            testID="input-notes"
          />
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.checkoutBtn, loading && styles.disabled]}
        onPress={handleCheckout}
        disabled={loading}
        testID="btn-checkout"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.checkoutBtnText}>CHECKOUT →</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  storeHeader: { backgroundColor: "#fff", padding: 16, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  storeName: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  demandTotal: { fontSize: 18, fontWeight: "700", color: "#1D4ED8", marginTop: 4 },
  effectiveTag: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  effective: { color: "#16A34A" },
  notEffective: { color: "#DC2626" },
  skuRow: { backgroundColor: "#fff", flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  skuInfo: { flex: 1 },
  skuName: { fontSize: 14, color: "#1E293B", fontWeight: "500" },
  skuStp: { fontSize: 12, color: "#64748B" },
  qtyControl: { flexDirection: "row", alignItems: "center" },
  qtyBtn: { backgroundColor: "#EFF6FF", borderRadius: 6, width: 32, height: 32, justifyContent: "center", alignItems: "center" },
  qtyBtnText: { fontSize: 18, color: "#2563EB", fontWeight: "600" },
  qtyInput: { width: 44, textAlign: "center", fontSize: 16, fontWeight: "600", color: "#1E293B", borderBottomWidth: 1, borderBottomColor: "#CBD5E1", marginHorizontal: 4 },
  notesSection: { backgroundColor: "#fff", margin: 12, borderRadius: 10, padding: 14 },
  notesLabel: { fontSize: 14, fontWeight: "600", color: "#475569", marginBottom: 8 },
  notesInput: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, padding: 10, fontSize: 14, textAlignVertical: "top" },
  checkoutBtn: { backgroundColor: "#2563EB", margin: 12, borderRadius: 12, padding: 16, alignItems: "center" },
  disabled: { opacity: 0.6 },
  checkoutBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 1 },
});
