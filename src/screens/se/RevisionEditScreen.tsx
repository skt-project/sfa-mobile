import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  FlatList,
} from "react-native";
import { CommonActions } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Colors, Spacing, Radius, Shadow, Typography } from "../../theme";
import { getApiClient } from "../../api/client";
import { getVisitDetail, resubmitVisit } from "../../api/visit";
import { getCachedSkus, cacheSkus } from "../../db/schedule_cache";
import type { Sku, VisitItem } from "../../types";

interface Props {
  route: {
    params: {
      visitId: string;
      outlet_name: string;
      rejection_notes?: string;
    };
  };
  navigation: any;
}

function goHome(navigation: any) {
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [
        {
          name: "SETabs",
          state: { routes: [{ name: "SEHome" }], index: 0 },
        },
      ],
    }),
  );
}

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
          {item.category ? <Text style={styles.skuCat}>{item.category}</Text> : null}
          {item.stp != null && item.stp > 0 ? (
            <Text style={styles.skuPrice}>Rp {item.stp.toLocaleString("id-ID")}</Text>
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
          <Text style={[styles.qtyBtnText, qty === 0 && styles.qtyBtnTextDisabled]}>−</Text>
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

export default function RevisionEditScreen({ route, navigation }: Props) {
  const { visitId, outlet_name, rejection_notes } = route.params;
  const [qtyMap, setQtyMap]   = useState<Record<string, number>>({});
  const [notes, setNotes]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [prefilled, setPrefilled]   = useState(false);

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
        const cached = (await getCachedSkus()) as unknown as Sku[];
        if (cached.length > 0) return cached;
        throw new Error("Tidak dapat memuat produk");
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: visitData, isLoading: visitLoading } = useQuery({
    queryKey: ["visit-detail", visitId],
    queryFn:  () => getVisitDetail(visitId),
    enabled:  !!visitId && !!skuData,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (visitData?.items && visitData.items.length > 0 && !prefilled) {
      const map: Record<string, number> = {};
      for (const it of visitData.items) {
        if (it.qty && it.qty > 0) map[it.sku_id] = it.qty;
      }
      setQtyMap(map);
      setPrefilled(true);
    }
  }, [visitData, prefilled]);

  const setQty = useCallback((skuId: string, qty: number) => {
    setQtyMap((prev) => ({ ...prev, [skuId]: Math.max(0, qty) }));
  }, []);

  const filledCount = useMemo(
    () => Object.values(qtyMap).filter((q) => q > 0).length,
    [qtyMap],
  );
  const totalQty = useMemo(
    () => Object.values(qtyMap).reduce((sum, q) => sum + q, 0),
    [qtyMap],
  );
  const totalDemand = useMemo(
    () => (skuData ?? []).reduce((sum, s) => sum + (qtyMap[s.sku_id] ?? 0) * (s.stp ?? 0), 0),
    [skuData, qtyMap],
  );

  const renderItem = useCallback(
    ({ item }: { item: Sku }) => (
      <SkuCard item={item} qty={qtyMap[item.sku_id] ?? 0} onSetQty={setQty} />
    ),
    [qtyMap, setQty],
  );

  const handleResubmit = async () => {
    setSubmitting(true);
    try {
      const filledItems: VisitItem[] = (skuData ?? [])
        .filter((s) => (qtyMap[s.sku_id] ?? 0) > 0)
        .map((s) => ({
          sku_id:     s.sku_id,
          sku_name:   s.sku_name,
          brand:      s.brand,
          brand_group: s.brand_group,
          category:   s.category,
          stp:        s.stp ?? 0,
          qty:        qtyMap[s.sku_id],
        }));

      await resubmitVisit(visitId, totalDemand, filledItems, notes || undefined);

      Alert.alert(
        "Berhasil!",
        "Kunjungan berhasil disubmit ulang dan menunggu persetujuan SPV.",
        [{ text: "OK", onPress: () => goHome(navigation) }],
      );
    } catch (e: any) {
      Alert.alert("Gagal", e?.response?.data?.detail ?? "Gagal submit ulang. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = skuLoading || visitLoading;

  return (
    <View style={styles.container}>
      {/* ── Rejection note banner ── */}
      {rejection_notes ? (
        <View style={styles.rejectionBanner}>
          <Text style={styles.rejectionLabel}>Catatan SPV:</Text>
          <Text style={styles.rejectionText}>{rejection_notes}</Text>
        </View>
      ) : null}

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerStore} numberOfLines={1}>{outlet_name}</Text>
          <Text style={styles.headerSub}>
            {filledCount > 0 ? `${filledCount} SKU · ${totalQty} pcs` : "Edit order lalu submit ulang"}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.danger} />
          <Text style={styles.loadingText}>Memuat data kunjungan...</Text>
        </View>
      ) : skuError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Gagal memuat produk. Periksa koneksi internet.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetchSkus()} accessibilityLabel="Coba lagi memuat produk" accessibilityRole="button">
            <Text style={styles.retryBtnText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={skuData ?? []}
          keyExtractor={(item) => item.sku_id}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>Catatan (opsional)</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                placeholder="Tambahkan keterangan tambahan..."
                placeholderTextColor={Colors.slate300}
                accessibilityLabel="Catatan tambahan (opsional)"
              />
            </View>
          }
        />
      )}

      {/* ── Footer ── */}
      {!isLoading && !skuError && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={handleResubmit}
            disabled={submitting}
            testID="btn-resubmit"
            accessibilityLabel={submitting ? "Sedang memproses..." : filledCount > 0 ? `Submit ulang ke SPV, ${filledCount} SKU, ${totalQty} pcs` : "Submit ulang ke SPV tanpa order"}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Text style={styles.submitBtnText}>SUBMIT ULANG KE SPV</Text>
                <Text style={styles.submitBtnSub}>
                  {filledCount > 0 ? `${filledCount} SKU · ${totalQty} pcs` : "Submit tanpa order"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  rejectionBanner: {
    backgroundColor: Colors.dangerBg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
    padding: Spacing.md,
    paddingLeft: 14,
  },
  rejectionLabel: { fontSize: Typography.xs, fontWeight: "700", color: "#991B1B", textTransform: "uppercase", marginBottom: 2 },
  rejectionText:  { fontSize: Typography.sm, color: "#7F1D1D", lineHeight: 18 },

  header: {
    backgroundColor: Colors.danger,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexShrink: 0,
  },
  headerLeft:  { flex: 1 },
  headerStore: { fontSize: Typography.base, fontWeight: "700", color: Colors.white },
  headerSub:   { fontSize: Typography.xs, color: "#FECACA", marginTop: 3 },

  loadingBox:  { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  loadingText: { color: Colors.slate500, fontSize: Typography.sm },
  errorBox:    { flex: 1, justifyContent: "center", alignItems: "center", padding: 36, gap: 14 },
  errorText:   { color: Colors.danger, fontSize: Typography.sm, textAlign: "center", lineHeight: 22 },
  retryBtn:    { backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: 28, paddingVertical: Spacing.md },
  retryBtnText: { color: Colors.white, fontWeight: "600", fontSize: Typography.sm },

  list:        { flex: 1 },
  listContent: { paddingBottom: 120 },

  skuCard: {
    backgroundColor: Colors.card,
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
  skuCardActive:      { borderColor: Colors.primaryBorder, backgroundColor: Colors.primaryBg },
  skuInfo:            { flex: 1, marginRight: Spacing.lg },
  skuCode:            { fontSize: Typography.xs, color: Colors.slate400, fontFamily: "monospace", marginBottom: 3, letterSpacing: 0.3 },
  skuName:            { fontSize: Typography.sm, fontWeight: "600", color: Colors.slate800, lineHeight: 22 },
  skuMeta:            { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: 3, flexWrap: "wrap" },
  skuCat:             { fontSize: Typography.xs, color: Colors.slate500 },
  skuPrice:           { fontSize: Typography.xs, color: Colors.primary, fontWeight: "600" },

  qtyBlock:           { alignItems: "center", flexDirection: "row" },
  qtyBtn:             { backgroundColor: Colors.primaryBg, borderRadius: Radius.sm, width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  qtyBtnDisabled:     { backgroundColor: Colors.background },
  qtyBtnText:         { fontSize: 22, color: Colors.primary, fontWeight: "700", lineHeight: 26 },
  qtyBtnTextDisabled: { color: Colors.slate300 },
  qtyInput: {
    width: 52,
    height: 44,
    textAlign: "center",
    padding: 0,
    textAlignVertical: "center",
    fontSize: 18,
    fontWeight: "700",
    color: Colors.slate800,
    borderBottomWidth: 2,
    borderBottomColor: Colors.border,
    marginHorizontal: 6,
  },
  qtyInputActive: { borderBottomColor: Colors.danger, color: Colors.danger },

  notesSection: {
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
  notesLabel: { fontSize: Typography.sm, fontWeight: "600", color: Colors.slate600, marginBottom: 10 },
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
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  submitBtn:     { backgroundColor: Colors.danger, borderRadius: Radius.md, paddingVertical: 15, alignItems: "center" },
  btnDisabled:   { opacity: 0.6 },
  submitBtnText: { color: Colors.white, fontSize: Typography.lg, fontWeight: "700", letterSpacing: 0.5 },
  submitBtnSub:  { color: "rgba(255,255,255,0.75)", fontSize: Typography.xs, marginTop: 4 },
});
