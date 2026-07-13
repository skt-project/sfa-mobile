import React, { useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { getApiClient } from "../../api/client";
import { Colors, Spacing, Radius, Shadow, Typography } from "../../theme";

interface AppNotification {
  notification_id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

type TypeConfig = { icon: string; color: string; bg: string };
const TYPE_CONFIG: Record<string, TypeConfig> = {
  approval:     { icon: "checkmark-circle-outline", color: Colors.success,  bg: "#DCFCE7" },
  announcement: { icon: "megaphone-outline",         color: Colors.primary,  bg: Colors.primaryBg },
  compliance:   { icon: "warning-outline",           color: Colors.warning,  bg: Colors.warningBg },
  target:       { icon: "trending-up-outline",       color: "#7C3AED",       bg: "#EDE9FE" },
  system:       { icon: "information-circle-outline",color: Colors.slate500, bg: Colors.slate100 },
};
const DEFAULT_CONFIG: TypeConfig = {
  icon: "notifications-outline", color: Colors.slate500, bg: Colors.slate100,
};

const fetchNotifications = () =>
  getApiClient().get<AppNotification[]>("/notifications").then((r) => r.data);

const markRead = (id: string) =>
  getApiClient().post(`/notifications/${id}/read`);

const markAllRead = () =>
  getApiClient().post("/notifications/mark-all-read");

interface Props {
  navigation: any;
}

export default function NotificationsScreen({ navigation }: Props) {
  const qc = useQueryClient();

  const { data: items = [], isLoading, refetch } = useQuery<AppNotification[]>({
    queryKey: ["notifications"],
    queryFn:  fetchNotifications,
    staleTime: 60_000,
  });

  const markOneMut = useMutation({
    mutationFn: markRead,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllMut = useMutation({
    mutationFn: markAllRead,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unreadCount = items.filter((n) => !n.is_read).length;

  const handlePress = useCallback((n: AppNotification) => {
    if (!n.is_read) markOneMut.mutate(n.notification_id);
  }, [markOneMut]);

  const renderItem = ({ item }: { item: AppNotification }) => {
    const cfg = TYPE_CONFIG[item.type] ?? DEFAULT_CONFIG;
    return (
      <TouchableOpacity
        style={[styles.item, !item.is_read && styles.itemUnread]}
        onPress={() => handlePress(item)}
        accessibilityLabel={`${item.title}${!item.is_read ? " — belum dibaca" : ""}`}
        accessibilityRole="button"
        activeOpacity={0.7}
      >
        <View style={[styles.iconBadge, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={18} color={cfg.color} accessible={false} />
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.title, !item.is_read && styles.titleUnread]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            <Text style={styles.time}>
              {format(new Date(item.created_at), "d MMM")}
            </Text>
          </View>
          <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
        </View>

        {!item.is_read && (
          <View style={styles.unreadDot} accessibilityLabel="Belum dibaca" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <View style={styles.markAllBar}>
          <Text style={styles.markAllCount}>{unreadCount} belum dibaca</Text>
          <TouchableOpacity
            onPress={() => markAllMut.mutate()}
            disabled={markAllMut.isPending}
            accessibilityRole="button"
            accessibilityLabel="Tandai semua dibaca"
          >
            <Text style={styles.markAllBtn}>
              {markAllMut.isPending ? "Menandai…" : "Tandai semua dibaca"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} accessibilityLabel="Memuat notifikasi" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.notification_id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
          contentContainerStyle={items.length === 0 ? styles.emptyContainer : { paddingBottom: Spacing.xl }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="notifications-off-outline" size={44} color={Colors.slate300} accessible={false} />
              <Text style={styles.emptyTitle}>Tidak ada notifikasi</Text>
              <Text style={styles.emptyBody}>Pemberitahuan penting akan muncul di sini.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  markAllBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primaryBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primaryBorder,
  },
  markAllCount: { fontSize: Typography.sm, color: Colors.primaryDark, fontWeight: Typography.semibold },
  markAllBtn:   { fontSize: Typography.sm, color: Colors.primary, fontWeight: "600" },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    padding: 14,
    gap: Spacing.md,
    ...Shadow.sm,
  },
  itemUnread: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    backgroundColor: `${Colors.primaryBg}80`,
  },

  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },

  content: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, marginBottom: 3 },
  title:        { flex: 1, fontSize: Typography.sm, color: Colors.slate700, lineHeight: 18 },
  titleUnread:  { fontWeight: "600", color: Colors.slate900 },
  time:         { fontSize: Typography.xs, color: Colors.slate400, flexShrink: 0, marginTop: 1 },
  body:         { fontSize: Typography.xs, color: Colors.slate500, lineHeight: 16 },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    flexShrink: 0,
    marginTop: 4,
  },

  emptyContainer: { flex: 1 },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: Spacing.md,
  },
  emptyTitle: { fontSize: Typography.base, fontWeight: "600", color: Colors.slate600 },
  emptyBody:  { fontSize: Typography.sm,   color: Colors.slate400, textAlign: "center", paddingHorizontal: Spacing.xl },
});
