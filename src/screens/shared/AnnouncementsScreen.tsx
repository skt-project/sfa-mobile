import React from "react";
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Colors, Spacing, Radius, Shadow, Typography } from "../../theme";
import { getApiClient } from "../../api/client";

interface Announcement {
  announcement_id: string;
  type: string;
  title: string;
  body: string;
  audience: string;
  created_at: string;
}

const TYPE_BG: Record<string, string> = {
  Campaign:    "#DBEAFE",
  Policy:      "#FEF3C7",
  Meeting:     "#D1FAE5",
  Distributor: "#FCE7F3",
  Training:    "#EDE9FE",
};
const TYPE_FG: Record<string, string> = {
  Campaign:    "#1D4ED8",
  Policy:      "#92400E",
  Meeting:     "#065F46",
  Distributor: "#9D174D",
  Training:    "#5B21B6",
};

async function fetchAnnouncements(): Promise<Announcement[]> {
  const r = await getApiClient().get<Announcement[]>("/announcements");
  return r.data;
}

export default function AnnouncementsScreen() {
  const { data = [], isLoading, refetch, isRefetching } = useQuery<Announcement[]>({
    queryKey: ["announcements-mobile"],
    queryFn:  fetchAnnouncements,
    staleTime: 5 * 60_000,
  });

  const renderItem = ({ item }: { item: Announcement }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: TYPE_BG[item.type] ?? Colors.background }]}>
          <Text style={[styles.typeText, { color: TYPE_FG[item.type] ?? Colors.slate600 }]}>
            {item.type}
          </Text>
        </View>
        <Text style={styles.dateText}>
          {format(new Date(item.created_at), "d MMM yyyy", { locale: idLocale })}
        </Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.body}>{item.body}</Text>
      <Text style={styles.audience}>Untuk: {item.audience}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={Colors.primary}
          style={{ marginTop: 60 }}
          accessibilityLabel="Memuat pengumuman…"
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.announcement_id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          contentContainerStyle={data.length === 0 ? styles.emptyContainer : styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="megaphone-outline" size={48} color={Colors.slate400} accessible={false} />
              <Text style={styles.emptyText}>Belum ada pengumuman</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.background },
  listContent:    { padding: Spacing.md },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyBox:       { alignItems: "center", marginTop: 80, gap: Spacing.md },
  emptyText:      { fontSize: Typography.base, color: Colors.slate400 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: 10,
    ...Shadow.sm,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  typeBadge:  { borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  typeText:   { fontSize: Typography.xs, fontWeight: "600" },
  dateText:   { fontSize: Typography.xs, color: Colors.slate400 },
  title:      { fontSize: Typography.base, fontWeight: "700", color: Colors.slate800, marginBottom: 6 },
  body:       { fontSize: Typography.sm, color: Colors.slate600, lineHeight: 20 },
  audience:   { fontSize: Typography.xs, color: Colors.slate400, marginTop: Spacing.sm },
});
