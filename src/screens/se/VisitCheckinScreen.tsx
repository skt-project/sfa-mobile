import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView, Platform, Image,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { format } from "date-fns";
import { useAuthStore } from "../../store/authStore";
import { useOfflineStore } from "../../store/offlineStore";
import { checkin as apiCheckin } from "../../api/visit";
import { isOnline } from "../../sync/engine";
import { Colors, Spacing, Radius, Shadow, Typography } from "../../theme";
import type { ScheduleStore } from "../../types";

interface Props {
  route: { params: { store: ScheduleStore } };
  navigation: any;
}

export default function VisitCheckinScreen({ route, navigation }: Props) {
  const { store } = route.params;
  const user = useAuthStore((s) => s.user);
  const { isOffline, addLocalCheckin, addOnlineTrackingCheckin } = useOfflineStore();
  const [loading, setLoading]       = useState(false);
  const [coords, setCoords]         = useState<{ lat: number; lon: number } | null>(null);
  const [photoUri, setPhotoUri]     = useState<string | null>(null);
  const [gpsStatus, setGpsStatus]   = useState<"idle" | "fetching" | "done" | "failed">("idle");
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => { fetchGPS(); }, []);

  const fetchGPS = async () => {
    setGpsStatus("fetching");
    try {
      if (Platform.OS === "web") {
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
      if (status !== "granted") { setGpsStatus("failed"); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: loc.coords.latitude, lon: loc.coords.longitude });
      setGpsStatus("done");
    } catch {
      setGpsStatus("failed");
    }
  };

  const pickPhoto = async () => {
    const pickerFn =
      Platform.OS === "web"
        ? ImagePicker.launchImageLibraryAsync
        : ImagePicker.launchCameraAsync;
    const result = await pickerFn({ quality: 0.7, allowsEditing: false, base64: false });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setPhotoError(false);
    }
  };

  const handleCheckin = async () => {
    if (!photoUri) { setPhotoError(true); return; }
    setLoading(true);
    const now = new Date().toISOString();
    const today = format(new Date(), "yyyy-MM-dd");
    const salesmanSk = user?.salesman_sk ?? "";
    try {
      const online = await isOnline();
      if (online && !isOffline) {
        const resp = await apiCheckin({
          salesman_sk:         salesmanSk,
          outlet_sk:           store.outlet_sk ?? "",
          visit_date:          today,
          visit_type:          "ROUTE",
          checkin_latitude:    coords?.lat,
          checkin_longitude:   coords?.lon,
          schedule_id:         store.route_plan_sk,
          offline_mode:        false,
          captured_at:         now,
        });
        if (resp.gps_warning) {
          Alert.alert(
            "Peringatan GPS",
            `Jarak check-in ${resp.checkin_distance_m?.toFixed(0) ?? "?"} meter dari toko. Kunjungan tetap direkam.`,
          );
        }
        const tracking = await addOnlineTrackingCheckin({
          server_visit_id: resp.visit_id,
          salesman_sk:     salesmanSk,
          outlet_sk:       store.outlet_sk ?? "",
          outlet_name:     store.store_name,
          schedule_id:     store.route_plan_sk,
          visit_date:      today,
          visit_type:      "ROUTE",
          checkin_time:    now,
          checkin_lat:     coords?.lat,
          checkin_lon:     coords?.lon,
          checkin_photo_path: photoUri,
          total_demand:    0,
          effective_call:  "NO",
        });
        navigation.navigate("VisitSurvey", {
          visitId: resp.visit_id, store, isOffline: false, localId: tracking.local_id,
        });
      } else {
        const local = await addLocalCheckin({
          salesman_sk:        salesmanSk,
          outlet_sk:          store.outlet_sk,
          outlet_name:        store.store_name,
          schedule_id:        store.route_plan_sk,
          visit_date:         today,
          visit_type:         "ROUTE",
          checkin_time:       now,
          checkin_lat:        coords?.lat,
          checkin_lon:        coords?.lon,
          checkin_photo_path: photoUri,
          total_demand:       0,
          effective_call:     "NO",
        });
        navigation.navigate("VisitSurvey", {
          visitId: null, store, isOffline: true, localId: local.local_id,
        });
      }
    } catch (e: any) {
      Alert.alert("Gagal", e?.response?.data?.detail ?? "Gagal check-in. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const canCheckin = !!photoUri;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.lg }}>
      {/* ── Store Info ── */}
      <View style={styles.storeCard}>
        <Text style={styles.storeName}>{store.store_name ?? store.source_outlet_code}</Text>
        <Text style={styles.storeAddress}>{store.address ?? "-"}</Text>
        {store.store_grade && (
          <Text style={styles.storeGrade}>Grade: {store.store_grade}</Text>
        )}
      </View>

      {/* ── GPS Status ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lokasi GPS</Text>
        {gpsStatus === "fetching" && (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.statusText}>Mencari lokasi...</Text>
          </View>
        )}
        {gpsStatus === "done" && coords && (
          <View style={styles.statusRow}>
            <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />
            <Text style={styles.gpsSuccess}>
              {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
            </Text>
          </View>
        )}
        {gpsStatus === "failed" && (
          <View style={styles.statusRow}>
            <Ionicons name="warning-outline" size={16} color={Colors.warning} />
            <Text style={styles.gpsWarn}>
              Lokasi tidak tersedia — kunjungan tetap dapat dilanjutkan
            </Text>
          </View>
        )}
        <Text style={styles.gpsNote}>GPS direkam sebagai informasi saja, bukan validasi.</Text>
      </View>

      {/* ── Photo — MANDATORY ── */}
      <View style={[styles.section, photoError && styles.sectionError]}>
        <View style={styles.photoHeader}>
          <Text style={styles.sectionTitle}>Foto Toko</Text>
          <View style={styles.requiredBadge}>
            <Text style={styles.requiredText}>WAJIB</Text>
          </View>
        </View>

        {photoUri ? (
          <View>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
            <TouchableOpacity style={styles.photoButtonRetake} onPress={pickPhoto} testID="btn-photo">
              <View style={styles.retakeRow}>
                <Ionicons
                  name={Platform.OS === "web" ? "folder-open-outline" : "camera-outline"}
                  size={18}
                  color={Colors.slate600}
                />
                <Text style={styles.photoButtonRetakeText}>
                  {Platform.OS === "web" ? "Ganti Foto" : "Ambil Ulang"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.photoButton, photoError && styles.photoButtonError]}
            onPress={pickPhoto}
            testID="btn-photo"
          >
            <Ionicons
              name="camera-outline"
              size={40}
              color={photoError ? Colors.danger : Colors.primary}
            />
            <Text style={[styles.photoButtonText, photoError && styles.photoButtonTextError]}>
              {Platform.OS === "web" ? "Pilih Foto dari Galeri" : "Ambil Foto Toko"}
            </Text>
            <Text style={styles.photoSubText}>Foto diperlukan sebelum check-in</Text>
          </TouchableOpacity>
        )}

        {photoError && !photoUri && (
          <View style={styles.errorBanner}>
            <View style={styles.statusRow}>
              <Ionicons name="warning-outline" size={15} color={Colors.danger} />
              <Text style={styles.errorText}>
                Foto toko wajib diambil sebelum melanjutkan check-in.
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ── Offline notice ── */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <View style={styles.statusRow}>
            <Ionicons name="cloud-offline-outline" size={16} color="#92400E" />
            <Text style={styles.offlineText}>
              Mode Offline — kunjungan disimpan lokal dan akan disinkronkan saat online
            </Text>
          </View>
        </View>
      )}

      {/* ── Check-In Button ── */}
      <TouchableOpacity
        style={[styles.checkinButton, !canCheckin && styles.checkinButtonDisabled]}
        onPress={handleCheckin}
        disabled={loading}
        testID="btn-checkin"
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <>
            <Text style={styles.checkinText}>CHECK-IN</Text>
            {!canCheckin && (
              <Text style={styles.checkinSubText}>Ambil foto terlebih dahulu</Text>
            )}
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  storeCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  storeName:    { fontSize: Typography.lg,   fontWeight: Typography.bold,    color: Colors.slate800 },
  storeAddress: { fontSize: Typography.sm,   color: Colors.slate500, marginTop: Spacing.xs },
  storeGrade:   { fontSize: Typography.base, color: Colors.primary,  marginTop: Spacing.xs },

  section: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionError: { borderWidth: 1.5, borderColor: Colors.danger },
  sectionTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.slate600,
    marginBottom: Spacing.sm,
  },

  photoHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm, gap: Spacing.sm },
  requiredBadge: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  requiredText: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.danger,
    letterSpacing: 0.5,
  },

  photoButton: {
    backgroundColor: Colors.primaryBg,
    borderRadius: Radius.md,
    padding: Spacing.xl,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    borderStyle: "dashed",
    gap: Spacing.xs,
  },
  photoButtonError: { borderColor: Colors.danger, backgroundColor: Colors.dangerBg },
  photoButtonText: {
    color: Colors.primary,
    fontWeight: Typography.semibold,
    fontSize: Typography.base,
  },
  photoButtonTextError: { color: Colors.danger },
  photoSubText: { color: Colors.slate400, fontSize: Typography.xs, marginTop: Spacing.xs },

  photoPreview: { width: "100%", height: 200, borderRadius: Radius.md, marginBottom: Spacing.sm },
  photoButtonRetake: {
    backgroundColor: Colors.slate100,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.slate300,
  },
  retakeRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  photoButtonRetakeText: {
    color: Colors.slate600,
    fontWeight: Typography.semibold,
    fontSize: Typography.sm,
  },

  statusRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, flexShrink: 1 },
  statusText: { color: Colors.slate600, fontSize: Typography.sm },
  gpsSuccess: { color: Colors.success, fontSize: Typography.sm, fontWeight: Typography.medium, flexShrink: 1 },
  gpsWarn:    { color: Colors.warning,  fontSize: Typography.xs, flexShrink: 1 },
  gpsNote:    { fontSize: Typography.xs, color: Colors.slate400, marginTop: Spacing.sm },

  errorBanner: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  errorText: { color: Colors.danger, fontSize: Typography.sm, fontWeight: Typography.medium, flexShrink: 1 },

  offlineBanner: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  offlineText: { color: "#92400E", fontSize: Typography.xs, flexShrink: 1 },

  checkinButton: {
    backgroundColor: Colors.success,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  checkinButtonDisabled: { backgroundColor: Colors.slate400 },
  checkinText:    { color: Colors.white, fontSize: Typography.lg, fontWeight: Typography.bold, letterSpacing: 1 },
  checkinSubText: { color: "rgba(255,255,255,0.8)", fontSize: Typography.xs, marginTop: 2 },
});
