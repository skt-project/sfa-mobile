import React from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { getTeamKpi, TeamMemberKpi } from "../../api/dashboard";

interface Props {
  navigation: any;
}

export default function TeamOverviewScreen({ navigation }: Props) {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["team-kpi", today],
    queryFn: () => getTeamKpi(today),
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
      {/* Team summary */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{data?.total_members ?? 0}</Text>
          <Text style={styles.summaryLabel}>SE Aktif</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalVisits}</Text>
          <Text style={styles.summaryLabel}>Total Kunjungan</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            Rp {(totalDemand / 1_000_000).toFixed(1)}M
          </Text>
          <Text style={styles.summaryLabel}>Total Demand</Text>
        </View>
      </View>

      <FlatList
        data={data?.members ?? []}
        keyExtractor={(item) => item.salesman_sk}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          !isLoading ? <Text style={styles.empty}>Belum ada data hari ini.</Text> : null
        }
        testID="team-list"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  summaryBar: { backgroundColor: "#1D4ED8", flexDirection: "row", padding: 16, justifyContent: "space-around" },
  summaryItem: { alignItems: "center" },
  summaryValue: { fontSize: 18, fontWeight: "700", color: "#fff" },
  summaryLabel: { fontSize: 12, color: "#BFDBFE", marginTop: 2 },
  memberCard: { backgroundColor: "#fff", marginHorizontal: 12, marginTop: 8, borderRadius: 10, padding: 14, flexDirection: "row", alignItems: "center", elevation: 1 },
  rank: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center", marginRight: 12 },
  rankText: { fontSize: 14, fontWeight: "700", color: "#1D4ED8" },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: "600", color: "#1E293B" },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  stat: { fontSize: 12, color: "#64748B" },
  pendingBadge: { backgroundColor: "#FCD34D", borderRadius: 12, width: 24, height: 24, justifyContent: "center", alignItems: "center" },
  pendingBadgeText: { fontSize: 11, fontWeight: "700", color: "#92400E" },
  empty: { textAlign: "center", marginTop: 60, color: "#94A3B8", fontSize: 15 },
});
