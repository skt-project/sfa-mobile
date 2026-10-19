import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { ProductFlag } from "../../types";

// Reusable product-identification badge (SKU Focus / NPD / future categories).
// Colour comes from the flag data (a design token) so new categories added in
// Master Data render automatically — no code change here.
const PALETTE: Record<string, { bg: string; fg: string }> = {
  blue:   { bg: "#EFF6FF", fg: "#1D4ED8" },
  purple: { bg: "#FAF5FF", fg: "#7E22CE" },
  orange: { bg: "#FFF7ED", fg: "#C2410C" },
  green:  { bg: "#ECFDF5", fg: "#047857" },
  amber:  { bg: "#FFFBEB", fg: "#B45309" },
  red:    { bg: "#FEF2F2", fg: "#B91C1C" },
  slate:  { bg: "#F1F5F9", fg: "#334155" },
};

function palette(color?: string | null) {
  return (color && PALETTE[color]) || PALETTE.slate;
}

export function ProductBadge({ flag }: { flag: ProductFlag }) {
  const p = palette(flag.color);
  const label = flag.short_label || flag.label || flag.type;
  return (
    <View style={[styles.badge, { backgroundColor: p.bg }]}>
      <Text style={[styles.text, { color: p.fg }]}>{label}</Text>
    </View>
  );
}

export function ProductBadges({ flags }: { flags?: ProductFlag[] | null }) {
  if (!flags || flags.length === 0) return null;
  return (
    <View style={styles.row}>
      {flags.map((f) => (
        <ProductBadge key={f.type} flag={f} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  badge: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4, marginTop: 2 },
  text: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
});

export default ProductBadge;
