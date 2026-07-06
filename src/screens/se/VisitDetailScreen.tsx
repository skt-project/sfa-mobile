import React from "react";
import {
  View, Text, StyleSheet, ScrollView, Image,
} from "react-native";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
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
}

interface Props {
  route: { params: { item: HistoryItem } };
}

function fmt(iso?: string, fmt = "HH:mm, d MMM yyyy"): string {
  if (!iso) return "-";
  try { return format(parseISO(iso), fmt, { locale: idLocale }); } catch { return "-"; }
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
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* Status banner */}
      <View style={[styles.statusBanner, isComplete ? styles.bannerComplete : styles.bannerPartial]}>
        <Text style={styles.bannerText}>
          {isComplete ? "✓  Kunjungan Selesai" : "⏳  Kunjungan Parsial (belum checkout)"}
        </Text>
      </View>

      {/* Store + visit info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Informasi Kunjungan</Text>
        <InfoRow label="Toko" value={item.outlet_name} />
        <InfoRow label="Tanggal" value={fmt(item.visit_date + "T00:00:00", "EEEE, d MMMM yyyy")} />
        <InfoRow label="Check-In" value={fmt(item.checkin_time)} />
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

      {/* Check-in photo */}
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

      {/* Demand items */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Detail Demand
          {demandItems.length > 0 ? ` (${demandItems.length} SKU · ${totalQty} unit)` : ""}
        </Text>

        {demandItems.length === 0 ? (
          <Text style={styles.emptyItems}>Tidak ada demand yang diinput pada kunjungan ini.</Text>
        ) : (
          <>
            {/* Table header */}
            <View style={[styles.demandRow, styles.demandHeader]}>
              <Text style={[styles.demandCell, styles.demandCellName, styles.headerText]}>Produk</Text>
              <Text style={[styles.demandCell, styles.demandCellQty, styles.headerText]}>Qty</Text>
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

            {/* Total row */}
            <View style={[styles.demandRow, styles.totalRow]}>
              <Text style={[styles.demandCell, styles.demandCellName, styles.totalLabel]}>
                TOTAL
              </Text>
              <Text style={[styles.demandCell, styles.demandCellQty, styles.totalLabel]}>{totalQty}</Text>
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
  container: { flex: 1, backgroundColor: "#F1F5F9" },

  statusBanner: { borderRadius: 10, padding: 12, marginBottom: 12, alignItems: "center" },
  bannerComplete: { backgroundColor: "#DCFCE7" },
  bannerPartial: { backgroundColor: "#FEF3C7" },
  bannerText: { fontSize: 14, fontWeight: "700", color: "#374151" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#475569", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },

  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#F8FAFC" },
  infoLabel: { fontSize: 14, color: "#64748B" },
  infoValue: { fontSize: 14, fontWeight: "600", color: "#1E293B", maxWidth: "60%", textAlign: "right" },
  colorGreen: { color: "#16A34A" },
  colorRed: { color: "#DC2626" },
  colorBlue: { color: "#1D4ED8" },

  photo: { width: "100%", height: 200, borderRadius: 8 },

  emptyItems: { color: "#94A3B8", fontSize: 14, textAlign: "center", paddingVertical: 16 },

  demandRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  demandRowAlt: { backgroundColor: "#FAFBFF" },
  demandHeader: { borderBottomWidth: 2, borderBottomColor: "#E2E8F0", marginBottom: 2 },
  totalRow: { borderTopWidth: 2, borderTopColor: "#E2E8F0", borderBottomWidth: 0, backgroundColor: "#EFF6FF" },

  demandCell: { paddingHorizontal: 4 },
  demandCellName: { flex: 3 },
  demandCellQty: { flex: 1, alignItems: "center", textAlign: "center" },
  demandCellAmount: { flex: 2, textAlign: "right" },

  headerText: { fontSize: 12, fontWeight: "700", color: "#475569", textTransform: "uppercase" },
  demandSkuCode: { fontSize: 10, color: "#94A3B8", fontFamily: "monospace" },
  demandSkuName: { fontSize: 13, color: "#1E293B", fontWeight: "500" },
  demandSkuCat: { fontSize: 11, color: "#64748B" },
  qtyText: { fontSize: 14, fontWeight: "700", color: "#1E293B", textAlign: "center" },
  amountText: { fontSize: 13, color: "#374151", textAlign: "right" },
  totalLabel: { fontSize: 13, fontWeight: "700", color: "#1D4ED8" },
});
