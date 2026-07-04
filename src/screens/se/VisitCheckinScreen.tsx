import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView, Platform,
} from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { format } from "date-fns";
import { useAuthStore } from "../../store/authStore";
import { useOfflineStore } from "../../store/offlineStore";
import { checkin as apiCheckin } from "../../api/visit";
import { isOnline } from "../../sync/engine";
import type { ScheduleStore } from "../../types";

interface Props {
  route: { params: { store: ScheduleStore } };
  navigation: any;
}

export default function VisitCheckinScreen({ route, navigation }: Props) {
  const { store } = route.params;
  const user = useAuthStore((s) => s.user);
  const { isOffline, addLocalCheckin } = useOfflineStore();
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "fetching" | "done" | "failed">("idle");

  useEffect(() => {
    fetchGPS();
  }, []);

  const fetchGPS = async () => {
    setGpsStatus("fetching");
    try {
      if (Platform.OS === "web") {
        // Use browser geolocation on web
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
              setGpsStatus("done");
              resolve();
            },
            () => { setGpsStatus("failed"); resolve(); },
            { timeout: 10000 },
          );
        });
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setGpsStatus("failed");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: loc.coords.latitude, lon: loc.coords.longitude });
      setGpsStatus("done");
    } catch {
      setGpsStatus("failed");
    }
  };

  const pickPhoto = async () => {
    // Web: camera not available — use image library picker instead
    const pickerFn =
      Platform.OS === "web"
        ? ImagePicker.launchImageLibraryAsync
        : ImagePicker.launchCameraAsync;
    const result = await pickerFn({
      quality: 0.7,
      allowsEditing: false,
      base64: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleCheckin = async () => {
    setLoading(true);
    const now = new Date().toISOString();
    const today = format(new Date(), "yyyy-MM-dd");
    const salesmanSk = user?.user_id ?? "";

    try {
      const online = await isOnline();

      if (online && !isOffline) {
        // Online: send directly to server
        const resp = await apiCheckin({
          salesman_sk: salesmanSk,
          outlet_sk: store.outlet_sk ?? "",
          visit_date: today,
          visit_type: "ROUTE",
          checkin_latitude: coords?.lat,
          checkin_longitude: coords?.lon,
          schedule_id: store.route_plan_sk,
          offline_mode: false,
          captured_at: now,
        });

        if (resp.gps_warning) {
          Alert.alert(
            "Peringatan GPS",
            `Jarak check-in ${resp.checkin_distance_m?.toFixed(0) ?? "?"} meter dari toko. Kunjungan tetap direkam.`,
          );
        }

        navigation.navigate("VisitSurvey", {
          visitId: resp.visit_id,
          store,
          isOffline: false,
          localId: null,
        });
      } else {
        // Offline: save locally
        const local = await addLocalCheckin({
          salesman_sk: salesmanSk,
          outlet_sk: store.outlet_sk,
          outlet_name: store.store_name,
          schedule_id: store.route_plan_sk,
          visit_date: today,
          visit_type: "ROUTE",
          checkin_time: now,
          checkin_lat: coords?.lat,
          checkin_lon: coords?.lon,
          checkin_photo_path: photoUri ?? undefined,
          total_demand: 0,
          effective_call: "NO",
        });

        navigation.navigate("VisitSurvey", {
          visitId: null,
          store,
          isOffline: true,
          localId: local.local_id,
        });
      }
    } catch (e: any) {
      Alert.alert("Gagal", e?.response?.data?.detail ?? "Gagal check-in. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {/* Store Info */}
      <View style={styles.storeCard}>
        <Text style={styles.storeName}>{store.store_name ?? store.source_outlet_code}</Text>
        <Text style={styles.storeAddress}>{store.address ?? "-"}</Text>
        {store.store_grade && (
          <Text style={styles.storeGrade}>Grade: {store.store_grade}</Text>
        )}
      </View>

      {/* GPS Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lokasi GPS</Text>
        {gpsStatus === "fetching" && (
          <View style={styles.gpsRow}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.gpsText}>Mencari lokasi...</Text>
          </View>
        )}
        {gpsStatus === "done" && coords && (
          <Text style={styles.gpsSuccess}>
            ✓  {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
          </Text>
        )}
        {gpsStatus === "failed" && (
          <Text style={styles.gpsWarn}>
            ⚠ Lokasi tidak tersedia — kunjungan tetap dapat dilanjutkan
          </Text>
        )}
        <Text style={styles.gpsNote}>GPS direkam sebagai informasi saja, bukan validasi.</Text>
      </View>

      {/* Photo */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Foto Check-in (opsional)</Text>
        <TouchableOpacity style={styles.photoButton} onPress={pickPhoto} testID="btn-photo">
          <Text style={styles.photoButtonText}>
            {photoUri
              ? "✓ Foto diambil — Ganti"
              : Platform.OS === "web" ? "📁  Pilih Foto" : "📷  Ambil Foto"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Offline notice */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            📵  Mode Offline — kunjungan disimpan lokal dan akan disinkronkan saat online
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.checkinButton, loading && styles.disabled]}
        onPress={handleCheckin}
        disabled={loading}
        testID="btn-checkin"
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkinText}>CHECK-IN</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  storeCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
  storeName: { fontSize: 17, fontWeight: "700", color: "#1E293B" },
  storeAddress: { fontSize: 14, color: "#64748B", marginTop: 4 },
  storeGrade: { fontSize: 13, color: "#2563EB", marginTop: 4 },
  section: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#475569", marginBottom: 10 },
  gpsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  gpsText: { color: "#475569", fontSize: 14 },
  gpsSuccess: { color: "#16A34A", fontSize: 14, fontWeight: "500" },
  gpsWarn: { color: "#D97706", fontSize: 13 },
  gpsNote: { fontSize: 12, color: "#94A3B8", marginTop: 6 },
  photoButton: { backgroundColor: "#EFF6FF", borderRadius: 8, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#BFDBFE" },
  photoButtonText: { color: "#2563EB", fontWeight: "600" },
  offlineBanner: { backgroundColor: "#FEF3C7", borderRadius: 8, padding: 12, marginBottom: 12 },
  offlineText: { color: "#92400E", fontSize: 13 },
  checkinButton: { backgroundColor: "#16A34A", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  disabled: { opacity: 0.6 },
  checkinText: { color: "#fff", fontSize: 17, fontWeight: "700", letterSpacing: 1 },
});
