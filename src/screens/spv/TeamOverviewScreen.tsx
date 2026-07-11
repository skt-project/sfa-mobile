import React from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Colors, Spacing, Radius, Shadow, Typography } from "../../theme";
import { getTeamKpi, TeamMemberKpi } from "../../api/dashboard";

interface Props {
  navigation: any;
}

export default function TeamOverviewScreen({ navigation }: Props) {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["team-kpi", today],
    queryFn:  () => getTeamKpi(today),
    staleTime: 60_000,
  });

  const renderItem = ({ item, index }: { item: TeamMemberKpi; index: number }) => (
    <View style={styles.memberCard} testID={`member-${item.salesman_sk}`}>
      <View style={styles.rank}>
        <Text style={styles.rankText}>{index + 1}</Text>
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.salesman_name ?? item.salesman_sk}</Text>
        <View style={styles.statsRow}>
          <Text style={styles.stat}>{item.total_visits} kunjungan</Text>
          <Text style={styles.stat}>{item.strike_rate}% efektif</Text>
          <Text style={styles.stat}>
            Rp {(item.total_demand / 1_000_000).toFixed(1)}M
          </Text>
        </View>
      </View>
      {item.pending_approvals > 0 && (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingBadgeText}>{item.pending_approvals}</Text>
        </View>
      )}
    </View>
  );

  const totalDemand = (data?.members ?? []).reduce((s, m) => s + m.total_demand, 0);
  const totalVisits = (data?.members ?? []).reduce((s, m) => s + m.total_visits, 0);

  return (
    <View style={styles.container}>
      {/* ── Team summary ── */}
      <View style={styles.summaryBar}>
        {[
          { value: String(data?.total_members ?? 0), label: "SE Aktif" },
          { value: String(totalVisits),               label: "Total Kunjungan" },
          { value: `Rp ${(totalDemand / 1_000_000).toFixed(1)}M`, label: "Total Demand" },
        ].map((item) => (
          <View key={item.label} style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{item.value}</Text>
            <Text style={styles.summaryLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <FlatList
        data={data?.members ?? []}
        keyExtractor={(item) => item.salesman_sk}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        contentContainerStyle={{ paddingBottom: Spacing.xl }}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={40} color={Colors.slate400} />
              <Text style={styles.empty}>Belum ada data hari ini.</Text>
            </View>
          ) : null
        }
        testID="team-list"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  summaryBar: {
    backgroundColor: Colors.primaryDark,
    flexDirection: "row",
    padding: Spacing.lg,
    justifyContent: "space-around",
  },
  summaryItem:  { alignItems: "center" },
  summaryValue: { fontSize: Typography.lg,  fontWeight: "700", color: Colors.white },
  summaryLabel: { fontSize: Typography.xs,  color: Colors.primaryBorder, marginTop: 2 },

  memberCard: {
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    ...Shadow.sm,
  },
  rank: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryBg,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  rankText:   { fontSize: Typography.sm, fontWeight: "700", color: Colors.primaryDark },
  memberInfo: { flex: 1 },
  memberName: { fontSize: Typography.base, fontWeight: "600", color: Colors.slate800 },
  statsRow:   { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.xs },
  stat:       { fontSize: Typography.xs, color: Colors.slate500 },

  pendingBadge: {
    backgroundColor: "#FCD34D",
    borderRadius: Radius.full,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  pendingBadgeText: { fontSize: 11, fontWeight: "700", color: "#92400E" },

  emptyWrap: { alignItems: "center", paddingTop: 60, gap: Spacing.md },
  empty:     { textAlign: "center", color: Colors.slate400, fontSize: Typography.base },
});
