import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, Radius, Typography } from "../../theme";

type BadgeVariant = "blue" | "green" | "yellow" | "red" | "gray" | "purple";

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  blue:   { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  green:  { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  yellow: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  red:    { bg: "#FFF1F2", text: "#9F1239", border: "#FECDD3" },
  gray:   { bg: "#F8FAFC", text: "#475569", border: "#E2E8F0" },
  purple: { bg: "#F5F3FF", text: "#4C1D95", border: "#DDD6FE" },
};

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  dot?: boolean;
}

export default function Badge({ label, variant = "gray", dot = false }: BadgeProps) {
  const v = VARIANT_STYLES[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg, borderColor: v.border }]}>
      {dot && <View style={[styles.dot, { backgroundColor: v.text }]} />}
      <Text style={[styles.label, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: Typography.xs, fontWeight: Typography.semibold },
});
