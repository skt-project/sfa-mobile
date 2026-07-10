/**
 * Design tokens — single source of truth for the STEP Mobile design system.
 * All StyleSheet values should reference these constants.
 */

export const Colors = {
  // Brand
  primary:       "#2563EB",
  primaryDark:   "#1D4ED8",
  primaryLight:  "#3B82F6",
  primaryBg:     "#EFF6FF",
  primaryBorder: "#BFDBFE",

  // Semantic
  success:     "#10B981",
  successBg:   "#ECFDF5",
  warning:     "#F59E0B",
  warningBg:   "#FFF7ED",
  danger:      "#EF4444",
  dangerBg:    "#FFF1F2",
  info:        "#3B82F6",
  infoBg:      "#EFF6FF",

  // Neutrals
  slate50:  "#F8FAFC",
  slate100: "#F1F5F9",
  slate200: "#E2E8F0",
  slate300: "#CBD5E1",
  slate400: "#94A3B8",
  slate500: "#64748B",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1E293B",
  slate900: "#0F172A",

  // Surfaces
  white:     "#FFFFFF",
  background: "#F1F5F9",
  card:       "#FFFFFF",
  border:     "#E2E8F0",
  muted:      "#F8FAFC",
  inputBg:    "#F8FAFC",
} as const;

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  "2xl": 24,
  "3xl": 32,
} as const;

export const Radius = {
  sm:  6,
  md:  10,
  lg:  14,
  xl:  18,
  full: 9999,
} as const;

export const Shadow = {
  sm: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export const Typography = {
  // Sizes
  xs:   11,
  sm:   13,
  base: 15,
  lg:   17,
  xl:   20,
  "2xl": 24,
  "3xl": 28,
  // Weights (RN uses string literals)
  normal:    "400" as const,
  medium:    "500" as const,
  semibold:  "600" as const,
  bold:      "700" as const,
} as const;

export const TabBar = {
  activeTint:   Colors.primary,
  inactiveTint: Colors.slate400,
  background:   Colors.white,
  borderColor:  Colors.border,
} as const;
