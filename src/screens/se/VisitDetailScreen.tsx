import React from "react";
import {
  View, Text, StyleSheet, ScrollView, Image,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Colors, Spacing, Radius, Shadow, Typography } from "../../theme";
import type { VisitItem, EffectiveCall } from "../../types";

interface HistoryItem {
  id: string;
  outlet_name: string;
  visit_date: string;
  checkin_time?: string;
  checkout_time?: string;
  total_demand: number;
  effective_call: EffectiveCall;
  duration_min?: number;
  items_json?: string;
  source: "local" | "server";
  server_visit_id?: string;
  checkin_photo_path?: string;
  approval_status?: string;
  rejection_notes?: string;
}

interface Props {
  route: { params: { item: HistoryItem } };
}

function fmt(iso?: string, fmtStr = "HH:mm, d MMM yyyy"): string {
  if (!iso) return "-";
  try { return format(parseISO(iso), fmtStr, { locale: idLocale }); } catch { return "-"; }
}

function InfoRow({ label, value, valueStyle }: { label: string; value: string; valueStyle?: object }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueStyle]}>{value}</Text>
    </View>
  );
}

export default function VisitDetailScreen({ route }: Props) {
  const { item } = route.params;
  const isComplete = !!item.checkout_time;

  let demandItems: VisitItem[] = [];
  if (item.items_json) {
    try { demandItems = JSON.parse(item.items_json); } catch { /* ignore */ }
  }

  const totalQty = demandItems.reduce((s, it) => s + (it.qty ?? 0), 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>

      {/* ── Status banner ── */}
      <View style={[styles.statusBanner, isComplete ? styles.bannerComplete : styles.bannerPartial]}>
        <Ionicons
          name={isComplete ? "checkmark-circle-outline" : "time-outline"}
          size={18}
          color={isComplete ? Colors.success : "#92400E"}
        />
        <Text style={[styles.bannerText, isComplete ? styles.bannerTextComplete : styles.bannerTextPartial]}>
          {isComplete ? "Kunjungan Selesai" : "Kunjungan Parsial (belum checkout)"}
        </Text>
      </View>

      {/* ── Store + visit info ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Informasi Kunjungan</Text>
        <InfoRow label="Toko"      value={item.outlet_name} />
        <InfoRow label="Tanggal"   value={fmt(item.visit_date + "T00:00:00", "EEEE, d MMMM yyyy")} />
        <InfoRow label="Check-In"  value={fmt(item.checkin_time)} />
        <InfoRow label="Check-Out" value={fmt(item.checkout_time)} />
        {item.duration_min != null && (
          <InfoRow label="Durasi" value={`${item.duration_min} menit`} />
        )}
        <InfoRow
          label="Efektif Call"
          value={item.effective_call === "YES" ? "YA" : "TIDAK"}
          valueStyle={item.effective_call === "YES" ? styles.colorGreen : styles.colorRed}
        />
        <InfoRow
          label="Total Demand"
          value={`Rp ${item.total_demand.toLocaleString("id-ID")}`}
          valueStyle={styles.colorBlue}
        />
        {item.server_visit_id && (
          <InfoRow label="Visit ID" value={item.server_visit_id} />
        )}
      </View>

      {/* ── Check-in photo ── */}
      {item.checkin_photo_path ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Foto Check-In</Text>
          <Image
            source={{ uri: item.checkin_photo_path }}
            style={styles.photo}
            resizeMode="cover"
          />
        </View>
      ) : null}

      {/* ── Demand items ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Detail Demand
          {demandItems.length > 0 ? ` (${demandItems.length} SKU · ${totalQty} unit)` : ""}
        </Text>

        {demandItems.length === 0 ? (
          <Text style={styles.emptyItems}>Tidak ada demand yang diinput pada kunjungan ini.</Text>
        ) : (
          <>
            <View style={[styles.demandRow, styles.demandHeader]}>
              <Text style={[styles.demandCell, styles.demandCellName, styles.headerText]}>Produk</Text>
              <Text style={[styles.demandCell, styles.demandCellQty,  styles.headerText]}>Qty</Text>
              <Text style={[styles.demandCell, styles.demandCellAmount, styles.headerText]}>Total</Text>
            </View>

            {demandItems.map((it, idx) => {
              const lineTotal = (it.qty ?? 0) * (it.stp ?? 0);
              return (
                <View key={`${it.sku_id}-${idx}`} style={[styles.demandRow, idx % 2 === 0 && styles.demandRowAlt]}>
                  <View style={[styles.demandCell, styles.demandCellName]}>
                    <Text style={styles.demandSkuCode}>{it.sku_id}</Text>
                    <Text style={styles.demandSkuName}>{it.sku_name ?? it.sku_id}</Text>
                    {it.category && <Text style={styles.demandSkuCat}>{it.category}</Text>}
                  </View>
                  <Text style={[styles.demandCell, styles.demandCellQty, styles.qtyText]}>{it.qty}</Text>
                  <Text style={[styles.demandCell, styles.demandCellAmount, styles.amountText]}>
                    Rp {lineTotal.toLocaleString("id-ID")}
                  </Text>
                </View>
              );
            })}

            <View style={[styles.demandRow, styles.totalRow]}>
              <Text style={[styles.demandCell, styles.demandCellName, styles.totalLabel]}>TOTAL</Text>
              <Text style={[styles.demandCell, styles.demandCellQty,  styles.totalLabel]}>{totalQty}</Text>
              <Text style={[styles.demandCell, styles.demandCellAmount, styles.totalLabel]}>
                Rp {item.total_demand.toLocaleString("id-ID")}
              </Text>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  bannerComplete:     { backgroundColor: "#DCFCE7" },
  bannerPartial:      { backgroundColor: "#FEF3C7" },
  bannerText:         { fontSize: Typography.sm, fontWeight: "700" },
  bannerTextComplete: { color: Colors.success },
  bannerTextPartial:  { color: "#92400E" },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  cardTitle: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.slate600,
    marginBottom: Spacing.md,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.muted,
  },
  infoLabel: { fontSize: Typography.sm, color: Colors.slate500 },
  infoValue: {
    fontSize: Typography.sm,
    fontWeight: "600",
    color: Colors.slate800,
    maxWidth: "60%",
    textAlign: "right",
  },
  colorGreen: { color: Colors.success },
  colorRed:   { color: Colors.danger },
  colorBlue:  { color: Colors.primaryDark },

  photo: { width: "100%", height: 200, borderRadius: Radius.sm },

  emptyItems: {
    color: Colors.slate400,
    fontSize: Typography.sm,
    textAlign: "center",
    paddingVertical: Spacing.lg,
  },

  demandRow: {
    flexDirection: "row",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  demandRowAlt:   { backgroundColor: "#FAFBFF" },
  demandHeader:   { borderBottomWidth: 2, borderBottomColor: Colors.border, marginBottom: 2 },
  totalRow:       {
    borderTopWidth: 2,
    borderTopColor: Colors.border,
    borderBottomWidth: 0,
    backgroundColor: Colors.primaryBg,
  },

  demandCell:       { paddingHorizontal: 4 },
  demandCellName:   { flex: 3 },
  demandCellQty:    { flex: 1, alignItems: "center", textAlign: "center" },
  demandCellAmount: { flex: 2, textAlign: "right" },

  headerText: {
    fontSize: Typography.xs,
    fontWeight: "700",
    color: Colors.slate600,
    textTransform: "uppercase",
  },
  demandSkuCode: { fontSize: Typography.xs, color: Colors.slate400, fontFamily: "monospace" },
  demandSkuName: { fontSize: Typography.sm, color: Colors.slate800, fontWeight: "500" },
  demandSkuCat:  { fontSize: Typography.xs, color: Colors.slate500 },
  qtyText:       { fontSize: Typography.sm, fontWeight: "700", color: Colors.slate800, textAlign: "center" },
  amountText:    { fontSize: Typography.sm, color: Colors.slate700, textAlign: "right" },
  totalLabel:    { fontSize: Typography.sm, fontWeight: "700", color: Colors.primaryDark },
});
