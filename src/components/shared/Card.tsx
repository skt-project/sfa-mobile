import React from "react";
import { View, StyleSheet } from "react-native";
import { Colors, Radius, Shadow, Spacing } from "../../theme";

interface CardProps {
  children: React.ReactNode;
  style?: object;
  padding?: number;
  noPadding?: boolean;
}

export default function Card({ children, style, padding = Spacing.lg, noPadding = false }: CardProps) {
  return (
    <View style={[styles.card, !noPadding && { padding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
});
