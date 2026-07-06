import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  FlatList,
  ScrollView,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "../../api/client";
import { useOfflineStore } from "../../store/offlineStore";
import { checkout as apiCheckout } from "../../api/visit";
import type { Sku, VisitItem, ScheduleStore, EffectiveCall } from "../../types";
import { getCachedSkus, cacheSkus } from "../../db/schedule_cache";

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

const ALL_TAB = "Semua";

// Memoized product card — only re-renders when its own qty changes.
const SkuCard = React.memo(function SkuCard({
  item,
  qty,
  onSetQty,
}: {
  item: Sku;
  qty: number;
  onSetQty: (id: string, qty: number) => void;
}) {
  return (
    <View style={[styles.skuCard, qty > 0 && styles.skuCardActive]}>
      <View style={styles.skuInfo}>
        <Text style={styles.skuCode}>{item.sku_id}</Text>
        <Text style={styles.skuName}>{item.sku_name}</Text>
        {item.category ? <Text style={styles.skuCat}>{item.category}</Text> : null}
      </View>
      <View style={styles.qtyBlock}>
        <TouchableOpacity
          style={[styles.qtyBtn, qty === 0 && styles.qtyBtnDisabled]}
          onPress={() => onSetQty(item.sku_id, qty - 1)}
          disabled={qty === 0}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.qtyBtnText, qty === 0 && styles.qtyBtnTextDisabled]}>
            −
          </Text>
        </TouchableOpacity>
        <TextInput
          style={[styles.qtyInput, qty > 0 && styles.qtyInputActive]}
          value={String(qty)}
          onChangeText={(v) => onSetQty(item.sku_id, parseInt(v) || 0)}
          keyboardType="number-pad"
          selectTextOnFocus
        />
        <TouchableOpacity
          style={styles.qtyBtn}
          onPress={() => onSetQty(item.sku_id, qty + 1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default function VisitSurveyScreen({ route, navigation }: Props) {
  const { visitId, store, isOffline: offlineMode, localId } = route.params;
  const { updateLocalCheckout } = useOfflineStore();

  // qty stored as a map so switching tabs preserves entered values
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(ALL_TAB);
  const [search, setSearch] = useState("");

  const {
    data: skuData,
    isLoading: skuLoading,
    isError: skuError,
    refetch: refetchSkus,
  } = useQuery<Sku[]>({
    queryKey: ["products"],
    queryFn: async () => {
      try {
        const r = await getApiClient().get("/product");
        await cacheSkus(r.data.items);
        return r.data.items;
      } catch {
        const cached = await getCachedSkus() as unknown as Sku[];
        if (cached.length > 0) return cached;
        throw new Error("Tidak dapat memuat produk");
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Unique brands in order of first appearance
  const brands = useMemo(() => {
    if (!skuData) return [];
    const seen = new Set<string>();
    const list: string[] = [];
    for (const s of skuData) {
      if (s.brand && !seen.has(s.brand)) {
        seen.add(s.brand);
        list.push(s.brand);
      }
    }
    return list;
  }, [skuData]);

  // Products for the active tab, filtered by search query
  const filteredSkus = useMemo<Sku[]>(() => {
    if (!skuData) return [];
    let base =
      activeTab === ALL_TAB ? skuData : skuData.filter((s) => s.brand === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter(
        (s) =>
          s.sku_name.toLowerCase().includes(q) ||
          s.sku_id.toLowerCase().includes(q),
      );
    }
    return base;
  }, [skuData, activeTab, search]);

  // SKUs with qty > 0 — drives effectiveCall and checkout button
  const filledCount = useMemo(
    () => Object.values(qtyMap).filter((q) => q > 0).length,
    [qtyMap],
  );

  // Total pcs across all filled SKUs (qty-based, no Rp)
  const totalQty = useMemo(
    () => Object.values(qtyMap).reduce((sum, q) => sum + q, 0),
    [qtyMap],
  );

  // Effective Call is qty-based: any product with qty > 0 makes the call effective
  const effectiveCall: EffectiveCall = filledCount > 0 ? "YES" : "NO";

  // totalDemand (Rp) is still calculated and sent to backend for STEP Web reporting,
  // but is never displayed in the mobile UI.
  const totalDemand = useMemo(
    () =>
      (skuData ?? []).reduce(
        (sum, s) => sum + (qtyMap[s.sku_id] ?? 0) * (s.stp ?? 0),
        0,
      ),
    [skuData, qtyMap],
  );

  // Stable updater — functional form avoids stale closure over qtyMap
  const setQty = useCallback((skuId: string, qty: number) => {
    setQtyMap((prev) => ({ ...prev, [skuId]: Math.max(0, qty) }));
  }, []);

  // renderItem closes over qtyMap (so it updates when qty changes), but
  // SkuCard.memo bails out for cards whose qty value didn't change.
  const renderItem = useCallback(
    ({ item }: { item: Sku }) => (
      <SkuCard item={item} qty={qtyMap[item.sku_id] ?? 0} onSetQty={setQty} />
    ),
    [qtyMap, setQty],
  );

  const handleCheckout = async () => {
    setLoading(true);
    const now = new Date().toISOString();
    const filledItems: VisitItem[] = (skuData ?? [])
      .filter((s) => (qtyMap[s.sku_id] ?? 0) > 0)
      .map((s) => ({
        sku_id: s.sku_id,
        sku_name: s.sku_name,
        brand: s.brand,
        brand_group: s.brand_group,
        category: s.category,
        stp: s.stp ?? 0,
        qty: qtyMap[s.sku_id],
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
        items: filledItems,
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
          <Text style={styles.headerStore} numberOfLines={1}>
            {store.store_name}
          </Text>
          <Text style={styles.headerSub}>
            {filledCount > 0
              ? `${filledCount} SKU · ${totalQty} pcs`
              : "Belum ada demand"}
          </Text>
        </View>
        <View
          style={[styles.ecBadge, effectiveCall === "YES" ? styles.ecYes : styles.ecNo]}
        >
          <Text style={styles.ecText}>
            {effectiveCall === "YES" ? "✓ Efektif" : "✗ Tidak Efektif"}
          </Text>
        </View>
      </View>

      {/* Brand tabs (only shown when there are multiple brands) */}
      {brands.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBar}
          contentContainerStyle={styles.tabBarContent}
        >
          {[ALL_TAB, ...brands].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => {
                setActiveTab(tab);
                setSearch("");
              }}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama atau kode produk..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} style={styles.searchClear}>
            <Text style={styles.searchClearText}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Virtualized product list */}
      <FlatList
        data={filteredSkus}
        keyExtractor={(item) => item.sku_id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          skuLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>Memuat daftar produk...</Text>
            </View>
          ) : skuError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                Gagal memuat produk. Periksa koneksi internet.
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => refetchSkus()}>
                <Text style={styles.retryBtnText}>Coba Lagi</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Masukkan jumlah produk yang terjual ke konsumen akhir (sell-out).
                Bukan pembelian dari salesman.
              </Text>
            </View>
          )
        }
        ListEmptyComponent={
          !skuLoading && !skuError ? (
            <Text style={styles.emptyText}>
              {search ? "Tidak ada produk yang cocok." : "Tidak ada produk."}
            </Text>
          ) : null
        }
        ListFooterComponent={
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
        }
      />

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
                  ? `${filledCount} SKU · ${totalQty} pcs`
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
    alignItems: "center",
  },
  headerLeft: { flex: 1, marginRight: 12 },
  headerStore: { fontSize: 15, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 12, color: "#BFDBFE", marginTop: 2 },
  ecBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  ecYes: { backgroundColor: "#16A34A" },
  ecNo: { backgroundColor: "#64748B" },
  ecText: { fontSize: 12, fontWeight: "600", color: "#fff" },

  tabBar: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    maxHeight: 48,
  },
  tabBarContent: { paddingHorizontal: 8, alignItems: "center" },
  tab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6, marginRight: 4 },
  tabActive: { backgroundColor: "#EFF6FF" },
  tabText: { fontSize: 13, color: "#64748B", fontWeight: "500" },
  tabTextActive: { color: "#2563EB", fontWeight: "700" },

  searchRow: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#1E293B",
  },
  searchClear: { padding: 8, marginLeft: 4 },
  searchClearText: { fontSize: 22, color: "#94A3B8", lineHeight: 24 },

  loadingBox: { padding: 40, alignItems: "center", gap: 12 },
  loadingText: { color: "#64748B", fontSize: 14 },

  errorBox: { padding: 32, alignItems: "center", gap: 12 },
  errorText: { color: "#DC2626", fontSize: 14, textAlign: "center", lineHeight: 20 },
  retryBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },

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

  emptyText: { textAlign: "center", color: "#94A3B8", marginTop: 32, fontSize: 14 },

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
  skuCode: { fontSize: 11, color: "#94A3B8", fontFamily: "monospace", marginBottom: 2 },
  skuName: { fontSize: 14, fontWeight: "600", color: "#1E293B", lineHeight: 20 },
  skuCat: { fontSize: 12, color: "#64748B", marginTop: 1 },

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

  notesSection: {
    backgroundColor: "#fff",
    margin: 12,
    marginTop: 16,
    borderRadius: 10,
    padding: 14,
  },
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

  footer: {
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
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
