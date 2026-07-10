import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Platform,
} from "react-native";
import { Colors, Spacing, Typography } from "../../theme";

interface HeaderProps {
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  variant?: "primary" | "white";
}

export default function Header({ title, subtitle, rightElement, variant = "primary" }: HeaderProps) {
  const isPrimary = variant === "primary";

  return (
    <View style={[styles.container, isPrimary ? styles.primary : styles.white]}>
      <StatusBar
        barStyle={isPrimary ? "light-content" : "dark-content"}
        backgroundColor={isPrimary ? Colors.primary : Colors.white}
      />
      <View style={styles.content}>
        <View style={styles.left}>
          <Text style={[styles.title, isPrimary ? styles.titleLight : styles.titleDark]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.subtitle, isPrimary ? styles.subtitleLight : styles.subtitleDark]}>
              {subtitle}
            </Text>
          )}
        </View>
        {rightElement && (
          <View style={styles.right}>{rightElement}</View>
        )}
      </View>
    </View>
  );
}

const PT = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;

const styles = StyleSheet.create({
  container: {
    paddingTop: PT + Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  primary: { backgroundColor: Colors.primary },
  white: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  left: { flex: 1 },
  right: { marginLeft: Spacing.md },
  title: { fontSize: Typography.lg, fontWeight: Typography.bold },
  titleLight: { color: Colors.white },
  titleDark: { color: Colors.slate900 },
  subtitle: { fontSize: Typography.xs, marginTop: 2 },
  subtitleLight: { color: "rgba(255,255,255,0.7)" },
  subtitleDark: { color: Colors.slate500 },
});
