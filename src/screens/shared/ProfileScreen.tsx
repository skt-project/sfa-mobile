import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import { getApiClient } from "../../api/client";
import { Colors, Spacing, Radius, Shadow, Typography } from "../../theme";

const ROLE_LABELS: Record<string, string> = {
  salesman: "Sales Executive",
  spv:      "Supervisor",
  asm:      "Area Sales Manager",
  dm:       "Distributor Manager",
  ho_admin: "HO Admin",
  demo:     "Demo",
};

const ROLE_COLORS: Record<string, string> = {
  salesman: Colors.primary,
  spv:      "#7C3AED",
  asm:      "#0891B2",
  dm:       "#0D9488",
  ho_admin: "#BE185D",
  demo:     Colors.slate500,
};

const APP_VERSION = "1.0.0 (9)";

interface AppNotification { notification_id: string; is_read: boolean; }

const fetchUnreadCount = () =>
  getApiClient()
    .get<AppNotification[]>("/notifications")
    .then((r) => r.data.filter((n) => !n.is_read).length)
    .catch(() => 0);

interface NavRowProps {
  icon: string;
  label: string;
  badge?: number;
  onPress: () => void;
}

function NavRow({ icon, label, badge, onPress }: NavRowProps) {
  return (
    <TouchableOpacity
      style={styles.navRow}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} baru` : label}
    >
      <View style={styles.navRowLeft}>
        <View style={styles.navIcon}>
          <Ionicons name={icon} size={18} color={Colors.primary} accessible={false} />
        </View>
        <Text style={styles.navLabel}>{label}</Text>
      </View>
      <View style={styles.navRowRight}>
        {badge != null && badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={Colors.slate300} accessible={false} />
      </View>
    </TouchableOpacity>
  );
}

interface Props {
  navigation: any;
}

export default function ProfileScreen({ navigation }: Props) {
  const { user, logout } = useAuthStore();
  const role      = user?.role ?? "salesman";
  const roleLabel = ROLE_LABELS[role] ?? role;
  const roleColor = ROLE_COLORS[role] ?? Colors.primary;

  const initials = (user?.username ?? "?")
    .split(/[\s_]/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ["notifications-unread"],
    queryFn:  fetchUnreadCount,
    staleTime: 60_000,
  });

  const handleLogout = () => {
    Alert.alert(
      "Keluar",
      "Yakin ingin keluar dari akun ini?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Keluar",
          style: "destructive",
          onPress: () => logout(),
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: Spacing["3xl"] }}>

      {/* ── Avatar + user info ── */}
      <View style={styles.heroCard}>
        <View style={[styles.avatar, { backgroundColor: `${roleColor}18` }]}>
          <Text style={[styles.avatarText, { color: roleColor }]}>{initials}</Text>
        </View>
        <Text style={styles.username}>{user?.username ?? "—"}</Text>
        <View style={[styles.roleBadge, { backgroundColor: `${roleColor}18` }]}>
          <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel}</Text>
        </View>

        {/* Extra user details */}
        <View style={styles.metaRow}>
          {user?.territory && (
            <View style={styles.metaChip}>
              <Ionicons name="map-outline" size={12} color={Colors.slate400} accessible={false} />
              <Text style={styles.metaChipText}>{user.territory}</Text>
            </View>
          )}
          {user?.distributor_code && (
            <View style={styles.metaChip}>
              <Ionicons name="business-outline" size={12} color={Colors.slate400} accessible={false} />
              <Text style={styles.metaChipText}>{user.distributor_code}</Text>
            </View>
          )}
          {user?.brand_group && (
            <View style={styles.metaChip}>
              <Ionicons name="pricetag-outline" size={12} color={Colors.slate400} accessible={false} />
              <Text style={styles.metaChipText}>{user.brand_group}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Navigation section ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>AKTIVITAS</Text>
        <View style={styles.card}>
          <NavRow
            icon="notifications-outline"
            label="Notifikasi"
            badge={unreadCount}
            onPress={() => navigation.navigate("Notifications")}
          />
        </View>
      </View>

      {/* ── App info ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>APLIKASI</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.navRowLeft}>
              <View style={styles.navIcon}>
                <Ionicons name="phone-portrait-outline" size={18} color={Colors.slate500} accessible={false} />
              </View>
              <Text style={styles.navLabel}>Versi Aplikasi</Text>
            </View>
            <Text style={styles.infoValue}>{APP_VERSION}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoRow}>
            <View style={styles.navRowLeft}>
              <View style={styles.navIcon}>
                <Ionicons name="server-outline" size={18} color={Colors.slate500} accessible={false} />
              </View>
              <Text style={styles.navLabel}>Platform</Text>
            </View>
            <Text style={styles.infoValue}>STEP SFA</Text>
          </View>
        </View>
      </View>

      {/* ── Logout ── */}
      <View style={styles.section}>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.logoutRow}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Keluar dari akun"
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.danger} accessible={false} />
            <Text style={styles.logoutText}>Keluar</Text>
          </TouchableOpacity>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  heroCard: {
    backgroundColor: Colors.card,
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.lg,
    ...Shadow.sm,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  avatarText:  { fontSize: 28, fontWeight: Typography.bold },
  username:    { fontSize: Typography.xl, fontWeight: "700", color: Colors.slate900, marginBottom: Spacing.sm },
  roleBadge:   { borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 4, marginBottom: Spacing.md },
  roleText:    { fontSize: Typography.xs, fontWeight: "700", letterSpacing: 0.5 },

  metaRow:  { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, justifyContent: "center" },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.slate100, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  metaChipText: { fontSize: Typography.xs, color: Colors.slate500 },

  section:      { marginTop: Spacing.xl, marginHorizontal: Spacing.md },
  sectionLabel: { fontSize: Typography.xs, fontWeight: "700", color: Colors.slate400, letterSpacing: 1, marginBottom: Spacing.sm, paddingHorizontal: 4 },
  card:         { backgroundColor: Colors.card, borderRadius: Radius.md, overflow: "hidden", ...Shadow.sm },
  separator:    { height: 1, backgroundColor: Colors.slate100, marginLeft: 56 },

  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  navRowLeft:  { flexDirection: "row", alignItems: "center", flex: 1, gap: Spacing.md },
  navRowRight: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  navIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryBg,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel:    { fontSize: Typography.base, color: Colors.slate700, fontWeight: "500" },

  badge: {
    backgroundColor: Colors.danger,
    borderRadius: Radius.full,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, fontWeight: "700", color: Colors.white },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  infoValue: { fontSize: Typography.sm, color: Colors.slate500, fontWeight: "500" },

  logoutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  logoutText: { fontSize: Typography.base, fontWeight: "700", color: Colors.danger },
});
