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
        {item.category ? (
          <Text style={styles.skuCat}>{item.category}</Text>
        ) : null}
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
        // Always attempt API first. Filtering by brand_group is enforced
        // server-side based on the JWT token — salesman only receives
        // products in their assigned business group.
        const r = await getApiClient().get("/product");
        await cacheSkus(r.data.items);
        return r.data.items;
      } catch {
        // Fall back to SQLite cache (offline). Re-throw if cache is empty
        // so the retry button surfaces instead of a silent empty list.
        const cached = (await getCachedSkus()) as unknown as Sku[];
        if (cached.length > 0) return cached;
        throw new Error("Tidak dapat memuat produk");
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Unique brands derived from the (already-filtered) server response.
  // Tab list is safe — it can never show brands outside the user's group.
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

  // Products visible in the active tab, further narrowed by search query
  const filteredSkus = useMemo<Sku[]>(() => {
    if (!skuData) return [];
    let base =
      activeTab === ALL_TAB
        ? skuData
        : skuData.filter((s) => s.brand === activeTab);
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

  // Totals derived from the full product list (not just the visible tab)
  const filledCount = useMemo(
    () => Object.values(qtyMap).filter((q) => q > 0).length,
    [qtyMap],
  );

  const totalQty = useMemo(
    () => Object.values(qtyMap).reduce((sum, q) => sum + q, 0),
    [qtyMap],
  );

  // Effective Call = any product with qty > 0 (qty-based, not monetary)
  const effectiveCall: EffectiveCall = filledCount > 0 ? "YES" : "NO";

  // totalDemand is computed for backend reporting only — never shown in UI
  const totalDemand = useMemo(
    () =>
      (skuData ?? []).reduce(
        (sum, s) => sum + (qtyMap[s.sku_id] ?? 0) * (s.stp ?? 0),
        0,
      ),
    [skuData, qtyMap],
  );

  const setQty = useCallback((skuId: string, qty: number) => {
    setQtyMap((prev) => ({ ...prev, [skuId]: Math.max(0, qty) }));
  }, []);

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
      {/* ── Header ── */}
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
          style={[
            styles.ecBadge,
            effectiveCall === "YES" ? styles.ecYes : styles.ecNo,
          ]}
        >
          <Text style={styles.ecText}>
            {effectiveCall === "YES" ? "✓ Efektif" : "✗ Tidak Efektif"}
          </Text>
        </View>
      </View>

      {/* ── Brand tabs (hidden when only one brand) ── */}
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
              <Text
                style={[styles.tabText, activeTab === tab && styles.tabTextActive]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Search bar ── */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama atau kode produk..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearch("")}
            style={styles.searchClear}
          >
            <Text style={styles.searchClearText}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Virtualized product list ── */}
      <FlatList
        data={filteredSkus}
        keyExtractor={(item) => item.sku_id}
        renderItem={renderItem}
        style={styles.list}
        contentContainerStyle={styles.listContent}
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
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => refetchSkus()}
              >
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
              {search
                ? "Tidak ada produk yang cocok."
                : "Tidak ada produk."}
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

      {/* ── Checkout footer ── */}
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

  // ── Header ──
  header: {
    backgroundColor: "#1D4ED8",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: { flex: 1, marginRight: 12 },
  headerStore: { fontSize: 15, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 12, color: "#BFDBFE", marginTop: 3 },
  ecBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  ecYes: { backgroundColor: "#16A34A" },
  ecNo: { backgroundColor: "#64748B" },
  ecText: { fontSize: 12, fontWeight: "600", color: "#fff" },

  // ── Brand tabs ──
  tabBar: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    // Explicit height (not maxHeight) so Yoga measures this correctly on all
    // Android API levels; flexShrink: 0 prevents the tab row from being
    // compressed when the FlatList claims its flex: 1 space.
    height: 52,
    flexShrink: 0,
  },
  tabBarContent: { paddingHorizontal: 12, alignItems: "center" },
  tab: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  tabActive: { backgroundColor: "#EFF6FF" },
  tabText: { fontSize: 13, color: "#64748B", fontWeight: "500" },
  tabTextActive: { color: "#2563EB", fontWeight: "700" },

  // ── Search ──
  searchRow: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1E293B",
  },
  searchClear: { padding: 8, marginLeft: 6 },
  searchClearText: { fontSize: 22, color: "#94A3B8", lineHeight: 24 },

  // ── List ──
  // flex: 1 is required. Without it, Yoga gives FlatList 0 measured height in
  // the column flex layout. On Android this causes elevated card children
  // (elevation: 1) to paint above sibling views, creating the
  // tabs/search-bar overlap. flex: 1 also properly constrains the scroll
  // viewport so the footer stays fixed at the bottom.
  list: { flex: 1 },
  listContent: { paddingBottom: 120 },

  // ── Status states ──
  loadingBox: { padding: 48, alignItems: "center", gap: 14 },
  loadingText: { color: "#64748B", fontSize: 14 },
  errorBox: { padding: 36, alignItems: "center", gap: 14 },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  retryBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  // ── Info banner ──
  infoBox: {
    backgroundColor: "#EFF6FF",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#2563EB",
  },
  infoText: { fontSize: 12, color: "#1D4ED8", lineHeight: 18 },

  emptyText: {
    textAlign: "center",
    color: "#94A3B8",
    marginTop: 36,
    fontSize: 14,
  },

  // ── Product card ──
  skuCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginVertical: 5,
    borderRadius: 10,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    elevation: 1,
    borderWidth: 1,
    borderColor: "transparent",
  },
  skuCardActive: { borderColor: "#BFDBFE", backgroundColor: "#F0F7FF" },
  skuInfo: { flex: 1, marginRight: 16 },
  skuCode: {
    fontSize: 11,
    color: "#94A3B8",
    fontFamily: "monospace",
    marginBottom: 3,
    letterSpacing: 0.3,
  },
  skuName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    lineHeight: 22,
  },
  skuCat: { fontSize: 12, color: "#64748B", marginTop: 3 },

  // ── Qty controls — 44×44 minimum touch target ──
  qtyBlock: { alignItems: "center", flexDirection: "row" },
  qtyBtn: {
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyBtnDisabled: { backgroundColor: "#F1F5F9" },
  qtyBtnText: {
    fontSize: 22,
    color: "#2563EB",
    fontWeight: "700",
    lineHeight: 26,
  },
  qtyBtnTextDisabled: { color: "#CBD5E1" },
  qtyInput: {
    width: 52,
    height: 44,
    textAlign: "center",
    // Android's EditText widget adds implicit top/bottom padding (~4-6dp each)
    // that is independent of React Native's padding style. Setting padding: 0
    // removes that system padding so the bold 18px text is never clipped.
    // textAlignVertical: "center" is required to vertically center the value
    // when the system padding is removed.
    padding: 0,
    textAlignVertical: "center",
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    borderBottomWidth: 2,
    borderBottomColor: "#E2E8F0",
    marginHorizontal: 6,
  },
  qtyInputActive: { borderBottomColor: "#2563EB", color: "#1D4ED8" },

  // ── Notes ──
  notesSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 10,
    padding: 16,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 10,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: "top",
    minHeight: 80,
    color: "#1E293B",
  },

  // ── Footer checkout button ──
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  checkoutBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  checkoutBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  checkoutBtnSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    marginTop: 4,
  },
});
