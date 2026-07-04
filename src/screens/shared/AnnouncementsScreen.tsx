import React from "react";
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { getApiClient } from "../../api/client";

interface Announcement {
  announcement_id: string;
  type: string;
  title: string;
  body: string;
  audience: string;
  created_at: string;
}

const TYPE_COLOR: Record<string, string> = {
  Campaign:    "#DBEAFE",
  Policy:      "#FEF3C7",
  Meeting:     "#D1FAE5",
  Distributor: "#FCE7F3",
  Training:    "#EDE9FE",
};
const TYPE_TEXT_COLOR: Record<string, string> = {
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
    queryFn: fetchAnnouncements,
    staleTime: 5 * 60_000,
  });

  const renderItem = ({ item }: { item: Announcement }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: TYPE_COLOR[item.type] ?? "#F1F5F9" }]}>
          <Text style={[styles.typeText, { color: TYPE_TEXT_COLOR[item.type] ?? "#475569" }]}>
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
        <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.announcement_id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          contentContainerStyle={data.length === 0 ? styles.emptyContainer : styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📢</Text>
              <Text style={styles.emptyText}>Belum ada pengumuman</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#F1F5F9" },
  listContent:    { padding: 12 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyBox:       { alignItems: "center", marginTop: 80 },
  emptyIcon:      { fontSize: 48, marginBottom: 12 },
  emptyText:      { fontSize: 15, color: "#94A3B8" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  typeBadge:   { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeText:    { fontSize: 12, fontWeight: "600" },
  dateText:    { fontSize: 12, color: "#94A3B8" },
  title:       { fontSize: 15, fontWeight: "700", color: "#1E293B", marginBottom: 6 },
  body:        { fontSize: 14, color: "#475569", lineHeight: 20 },
  audience:    { fontSize: 12, color: "#94A3B8", marginTop: 8 },
});
