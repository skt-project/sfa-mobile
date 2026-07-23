import React from "react";
import { View, type ViewStyle } from "react-native";
import { Colors, Shadow } from "../../theme";

interface Props {
  /** Pixel size of the square mark. */
  size?: number;
  /** Tile background color (default brand600). */
  tint?: string;
  /** Bar/dot color (default white). */
  glyph?: string;
  style?: ViewStyle;
}

/**
 * STEP product mark (React Native) — three ascending steps rising to a
 * checkpoint. Built from Views so it needs no SVG/gradient dependency.
 * Mirrors the web StepLogo. Reusable across login, header, splash.
 */
export function StepLogo({ size = 64, tint = Colors.brand600, glyph = Colors.white, style }: Props) {
  const barW = size * 0.15;
  const heights = [0.2, 0.35, 0.5];

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="STEP"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * 0.275,
          backgroundColor: tint,
          position: "relative",
        },
        Shadow.md,
        style,
      ]}
    >
      {heights.map((h, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: size * (0.225 + i * 0.2),
            bottom: size * 0.225,
            width: barW,
            height: size * h,
            borderRadius: barW / 2,
            backgroundColor: glyph,
          }}
        />
      ))}
      {/* checkpoint dot above the tallest step */}
      <View
        style={{
          position: "absolute",
          left: size * 0.625,
          top: size * 0.125,
          width: size * 0.15,
          height: size * 0.15,
          borderRadius: size * 0.075,
          backgroundColor: glyph,
        }}
      />
    </View>
  );
}

export default StepLogo;
