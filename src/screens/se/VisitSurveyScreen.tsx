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
import Ionicons from "react-native-vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { Colors, Spacing, Radius, Shadow, Typography } from "../../theme";
import { getApiClient } from "../../api/client";
import { useOfflineStore } from "../../store/offlineStore";
import { useAuthStore } from "../../store/authStore";
import { checkout as apiCheckout } from "../../api/visit";
import { updateLocalVisitSyncStatus } from "../../db/visits";
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

// Business Unit → allowed brands (mirrors backend dependencies.BRAND_GROUPS).
// Brand values from master_product are UPPERCASE — compare case-insensitively.
// Client-side enforcement guarantees a salesman never sees or orders brands
// outside their unit even if the API returns a broader list.
// BU 1 (SKT): SKINTIFIC, TIMEPHORIA, FACERINNA
// BU 2 (G2G): G2G (Glad2Glow), BODIBREZE, NEXTPRIME
const BRAND_GROUPS: Record<string, string[]> = {
  SKT: ["SKINTIFIC", "TIMEPHORIA", "FACERINNA"],
  G2G: ["G2G", "BODIBREZE", "NEXTPRIME"],
};

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
        <View style={styles.skuMeta}>
          {item.pack_size ? (
            <View style={styles.packBadge}>
              <Text style={styles.packBadgeText}>{item.pack_size}</Text>
            </View>
          ) : null}
          {item.category ? (
            <Text style={styles.skuCat}>{item.category}</Text>
          ) : null}
          {item.stp != null && item.stp > 0 ? (
            <Text style={styles.skuPrice}>
              Rp {item.stp.toLocaleString("id-ID")}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.qtyBlock}>
        <TouchableOpacity
          style={[styles.qtyBtn, qty === 0 && styles.qtyBtnDisabled]}
          onPress={() => onSetQty(item.sku_id, qty - 1)}
          disabled={qty === 0}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`Kurangi qty ${item.sku_name}`}
          accessibilityRole="button"
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
          accessibilityLabel={`Jumlah ${item.sku_name}`}
        />
        <TouchableOpacity
          style={styles.qtyBtn}
          onPress={() => onSetQty(item.sku_id, qty + 1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`Tambah qty ${item.sku_name}`}
          accessibilityRole="button"
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
  const user = useAuthStore((s) => s.user);
  const userBg = user?.brand_group;

  // qty stored as a map so switching tabs preserves entered values
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(ALL_TAB);
  const [search, setSearch] = useState("");
  const [tabsOpen, setTabsOpen] = useState(true);

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

  // Client-side business-unit enforcement (defense-in-depth) + price validity.
  // 1. SKUs without a valid selling price (stp <= 0) are never shown/orderable.
  // 2. A BU-scoped SE only sees brands of their own unit (case-insensitive —
  //    master_product brands are UPPERCASE). Unrestricted accounts see all.
  const groupSkus = useMemo<Sku[]>(() => {
    if (!skuData) return [];
    const priced = skuData.filter((s) => (s.stp ?? 0) > 0);
    const allowed = userBg ? BRAND_GROUPS[userBg] : undefined;
    if (!allowed) return priced; // unrestricted / demo
    return priced.filter(
      (s) =>
        s.brand_group === userBg ||
        (s.brand ? allowed.includes(s.brand.toUpperCase()) : false),
    );
  }, [skuData, userBg]);

  // Unique brands derived from the group-filtered list.
  const brands = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const s of groupSkus) {
      if (s.brand && !seen.has(s.brand)) {
        seen.add(s.brand);
        list.push(s.brand);
      }
    }
    return list;
  }, [groupSkus]);

  // Products visible in the active tab, further narrowed by search query
  const filteredSkus = useMemo<Sku[]>(() => {
    let base =
      activeTab === ALL_TAB
        ? groupSkus
        : groupSkus.filter((s) => s.brand === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter(
        (s) =>
          s.sku_name.toLowerCase().includes(q) ||
          s.sku_id.toLowerCase().includes(q),
      );
    }
    return base;
  }, [groupSkus, activeTab, search]);

  // Totals derived from the group-filtered product list (never counts a brand
  // outside the user's group, so the summary stays consistent with the list).
  const filledCount = useMemo(
    () => groupSkus.filter((s) => (qtyMap[s.sku_id] ?? 0) > 0).length,
    [groupSkus, qtyMap],
  );

  const totalQty = useMemo(
    () => groupSkus.reduce((sum, s) => sum + (qtyMap[s.sku_id] ?? 0), 0),
    [groupSkus, qtyMap],
  );

  // Effective Call = any product with qty > 0 (qty-based, not monetary)
  const effectiveCall: EffectiveCall = filledCount > 0 ? "YES" : "NO";

  // totalDemand is computed for backend reporting only — never shown in UI
  const totalDemand = useMemo(
    () =>
      groupSkus.reduce(
        (sum, s) => sum + (qtyMap[s.sku_id] ?? 0) * (s.stp ?? 0),
        0,
      ),
    [groupSkus, qtyMap],
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
    const filledItems: VisitItem[] = groupSkus
      .filter((s) => (qtyMap[s.sku_id] ?? 0) > 0)
      .map((s) => ({
        sku_id: s.sku_id,
        sku_name: s.sku_name,
        brand: s.brand,
        brand_group: s.brand_group,
        category: s.category,
        pack_size: s.pack_size,
        stp: s.stp ?? 0,
        qty: qtyMap[s.sku_id],
      }));

    const localPayload = {
      checkout_time: now,
      total_demand: totalDemand,
      effective_call: effectiveCall,
      notes,
      items_json: JSON.stringify(filledItems),
    };

    // isOffline tracks whether THIS checkout was ultimately saved online or locally.
    // Starts as the mode from checkin; may flip to true if network drops mid-visit.
    let fellOffline = offlineMode;

    try {
      if (visitId && !offlineMode) {
        try {
          await apiCheckout(visitId, {
            total_demand: totalDemand,
            effective_call: effectiveCall,
            notes,
            items: filledItems,
            offline_mode: false,
            captured_at: now,
          });
          // Mirror into local DB so RouteListScreen shows "Checkout" status.
          if (localId) await updateLocalCheckout(localId, localPayload);
        } catch (e: any) {
          // Network dropped after an online checkin — fall back to SQLite.
          // Store server_visit_id so the sync engine can skip the checkin step.
          if (!e.response && localId) {
            await updateLocalCheckout(localId, localPayload);
            await updateLocalVisitSyncStatus(localId, "local", visitId);
            fellOffline = true;
          } else {
            throw e; // server-side error (4xx/5xx) — re-throw to show to user
          }
        }
      } else if (localId) {
        await updateLocalCheckout(localId, localPayload);
      }

      navigation.navigate("VisitCheckout", {
        visitId: fellOffline ? null : visitId,
        localId,
        store,
        totalDemand,
        effectiveCall,
        isOffline: fellOffline,
        items: filledItems,
      });
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const isTimeout = e?.code === "ECONNABORTED" || e?.code === "ERR_NETWORK";
      Alert.alert(
        "Gagal",
        detail ?? (isTimeout
          ? "Koneksi timeout. Pastikan sinyal stabil lalu coba lagi."
          : "Gagal menyimpan demand. Coba lagi."),
      );
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
              : "Belum ada order"}
          </Text>
        </View>
        <View
          style={[
            styles.ecBadge,
            effectiveCall === "YES" ? styles.ecYes : styles.ecNo,
          ]}
        >
          <View style={styles.ecContent}>
            <Ionicons
              name={effectiveCall === "YES" ? "checkmark-outline" : "close-outline"}
              size={13}
              color={Colors.white}
              accessible={false}
            />
            <Text style={styles.ecText}>
              {effectiveCall === "YES" ? "Efektif" : "Tidak Efektif"}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Brand tabs — collapsible, compact padding ── */}
      {brands.length > 1 && (
        <View style={styles.tabBarWrapper}>
          {/* Toggle header: shows active brand + chevron */}
          <TouchableOpacity
            style={styles.tabBarToggle}
            onPress={() => setTabsOpen((v) => !v)}
            activeOpacity={0.7}
            accessibilityLabel={tabsOpen ? "Sembunyikan filter brand" : "Tampilkan filter brand"}
            accessibilityRole="button"
          >
            <Text style={styles.tabBarToggleLabel} numberOfLines={1}>
              Brand
            </Text>
            <Ionicons
              name={tabsOpen ? "chevron-up" : "chevron-down"}
              size={14}
              color={Colors.slate400}
              accessible={false}
            />
          </TouchableOpacity>

          {/* Collapsible tab row — outer View owns the height for layout stability */}
          {tabsOpen && (
            <View style={styles.tabBarScrollOuter}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabBarScroll}
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
                    accessibilityRole="tab"
                    accessibilityState={{ selected: activeTab === tab }}
                    accessibilityLabel={tab}
                  >
                    <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                      {tab}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {/* ── Search bar ── */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama atau kode produk..."
          placeholderTextColor={Colors.slate400}
          value={search}
          onChangeText={setSearch}
          accessibilityLabel="Cari produk"
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearch("")}
            style={styles.searchClear}
            accessibilityLabel="Hapus pencarian"
            accessibilityRole="button"
          >
            <Ionicons name="close-circle" size={20} color={Colors.slate400} accessible={false} />
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
              <ActivityIndicator size="large" color={Colors.primary} />
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
                accessibilityLabel="Coba lagi memuat produk"
                accessibilityRole="button"
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
              placeholderTextColor={Colors.slate300}
              testID="input-notes"
              accessibilityLabel="Catatan kunjungan"
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
          accessibilityLabel={
            filledCount > 0
              ? `Lanjut check-out, ${filledCount} SKU, ${totalQty} pcs`
              : "Lanjut check-out tanpa order"
          }
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.checkoutBtnText}>LANJUT CHECK-OUT</Text>
              <Text style={styles.checkoutBtnSub}>
                {filledCount > 0
                  ? `${filledCount} SKU · ${totalQty} pcs`
                  : "Lanjut tanpa order (tidak efektif)"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexShrink: 0,
  },
  headerLeft:  { flex: 1, marginRight: Spacing.md },
  headerStore: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.white },
  headerSub:   { fontSize: Typography.xs,   color: Colors.primaryBorder, marginTop: 3 },
  ecBadge:     { borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  ecYes:       { backgroundColor: Colors.success },
  ecNo:        { backgroundColor: Colors.slate500 },
  ecContent:   { flexDirection: "row", alignItems: "center", gap: 4 },
  ecText:      { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.white },

  tabBarWrapper: {
    flexShrink: 0,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBarToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    height: 36,
    gap: Spacing.sm,
  },
  tabBarToggleLabel: {
    flex: 1,
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.slate600,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tabBarScrollOuter: { height: 38 },
  tabBarScroll:      { flex: 1 },
  tabBarContent:     { paddingHorizontal: Spacing.md, alignItems: "center" },
  tab:               { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.sm, marginRight: 4 },
  tabActive:         { backgroundColor: Colors.primaryBg },
  tabText:           { fontSize: Typography.sm, color: Colors.slate500, fontWeight: Typography.medium },
  tabTextActive:     { color: Colors.primary, fontWeight: Typography.bold },

  searchRow: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: Typography.sm,
    color: Colors.slate800,
  },
  searchClear: { padding: Spacing.sm, marginLeft: Spacing.xs },

  // flex: 1 is required — without it Yoga gives FlatList 0 measured height.
  // On Android this causes elevated card children (elevation: 1) to paint
  // above sibling views, creating a tabs/search-bar overlap.
  list:        { flex: 1 },
  listContent: { paddingBottom: 120 },

  loadingBox: { padding: 48, alignItems: "center", gap: 14 },
  loadingText: { color: Colors.slate500, fontSize: Typography.sm },
  errorBox:    { padding: 36, alignItems: "center", gap: 14 },
  errorText:   { color: Colors.danger, fontSize: Typography.sm, textAlign: "center", lineHeight: 22 },
  retryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingHorizontal: 28,
    paddingVertical: Spacing.md,
  },
  retryBtnText: { color: Colors.white, fontWeight: Typography.semibold, fontSize: Typography.sm },

  infoBox: {
    backgroundColor: Colors.primaryBg,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  infoText: { fontSize: Typography.xs, color: Colors.primaryDark, lineHeight: 18 },

  emptyText: {
    textAlign: "center",
    color: Colors.slate400,
    marginTop: 36,
    fontSize: Typography.sm,
  },

  skuCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.lg,
    marginVertical: 5,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  skuCardActive: { borderColor: Colors.primaryBorder, backgroundColor: Colors.primaryBg },
  skuInfo:       { flex: 1, marginRight: Spacing.lg },
  skuCode: {
    fontSize: Typography.xs,
    color: Colors.slate400,
    fontFamily: "monospace",
    marginBottom: 3,
    letterSpacing: 0.3,
  },
  skuName: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.slate800, lineHeight: 22 },
  skuMeta: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: 3, flexWrap: "wrap" },
  skuCat:  { fontSize: Typography.xs, color: Colors.slate500 },
  packBadge: {
    backgroundColor: Colors.slate100,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  packBadgeText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.slate600 },
  skuPrice:{ fontSize: Typography.xs, color: Colors.primary, fontWeight: Typography.semibold },

  // 44×44 minimum touch target
  qtyBlock:        { alignItems: "center", flexDirection: "row" },
  qtyBtn:          { backgroundColor: Colors.primaryBg, borderRadius: Radius.sm, width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  qtyBtnDisabled:  { backgroundColor: Colors.slate100 },
  qtyBtnText:      { fontSize: 22, color: Colors.primary, fontWeight: Typography.bold, lineHeight: 26 },
  qtyBtnTextDisabled: { color: Colors.slate300 },
  qtyInput: {
    width: 52,
    height: 44,
    textAlign: "center",
    // Android EditText adds implicit ~4-6dp top/bottom padding. padding: 0
    // removes it; textAlignVertical: "center" re-centers the value.
    padding: 0,
    textAlignVertical: "center",
    fontSize: 18,
    fontWeight: Typography.bold,
    color: Colors.slate800,
    borderBottomWidth: 2,
    borderBottomColor: Colors.border,
    marginHorizontal: Spacing.xs,
  },
  qtyInputActive: { borderBottomColor: Colors.primary, color: Colors.primaryDark },

  notesSection: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
  notesLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.slate600,
    marginBottom: 10,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: Colors.slate300,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    fontSize: Typography.sm,
    textAlignVertical: "top",
    minHeight: 80,
    color: Colors.slate800,
  },

  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  checkoutBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  btnDisabled:     { opacity: 0.6 },
  checkoutBtnText: { color: Colors.white, fontSize: Typography.lg, fontWeight: Typography.bold, letterSpacing: 0.5 },
  checkoutBtnSub:  { color: "rgba(255,255,255,0.75)", fontSize: Typography.xs, marginTop: 4 },
});
