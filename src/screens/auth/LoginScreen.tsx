import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useAuthStore } from "../../store/authStore";
import { StepLogo } from "../../components/brand/StepLogo";
import { Colors, Radius, Shadow, Spacing, Typography } from "../../theme";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const pwRef = useRef<TextInput>(null);
  const login = useAuthStore((s) => s.login);

  // ── Business logic unchanged — UI/branding only ──
  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Perhatian", "Username dan password wajib diisi");
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? "Login gagal. Periksa username/password.";
      Alert.alert("Login Gagal", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Soft brand background */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.blob, styles.blob1]} />
        <View style={[styles.blob, styles.blob2]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand lockup — STEP leads, Skintific subtle */}
        <View style={styles.brand}>
          <StepLogo size={72} style={{ marginBottom: Spacing.lg }} />
          <Text style={styles.brandName}>STEP</Text>
          <Text style={styles.brandTagline}>Sales Team Execution Platform</Text>
          <Text style={styles.brandSubhead}>
            Empowering sales teams to execute, monitor,{"\n"}and optimize every step of the call.
          </Text>
          <Text style={styles.brandBy}>
            by <Text style={styles.brandByName}>Skintific</Text>
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Masuk ke akun Anda</Text>

          {/* Username */}
          <View style={styles.field}>
            <Text style={styles.label}>USERNAME</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={16} color={Colors.slate400} style={styles.inputIcon} accessible={false} />
              <TextInput
                style={styles.input}
                placeholder="Masukkan username"
                placeholderTextColor={Colors.slate400}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => pwRef.current?.focus()}
                testID="input-username"
                accessibilityLabel="Username"
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={16} color={Colors.slate400} style={styles.inputIcon} accessible={false} />
              <TextInput
                ref={pwRef}
                style={[styles.input, { flex: 1 }]}
                placeholder="Masukkan password"
                placeholderTextColor={Colors.slate400}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                testID="input-password"
                accessibilityLabel="Password"
              />
              <TouchableOpacity onPress={() => setShowPw((v) => !v)} style={styles.eyeBtn} accessibilityLabel={showPw ? "Sembunyikan password" : "Tampilkan password"} accessibilityRole="button">
                <Ionicons
                  name={showPw ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={Colors.slate400}
                  accessible={false}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
            testID="btn-login"
            accessibilityLabel={loading ? "Sedang memproses..." : "Masuk"}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.buttonText}>Masuk</Text>
                <Ionicons name="arrow-forward" size={18} color={Colors.white} accessible={false} />
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.hint}>
            Hubungi HO Admin jika akun belum dibuat
          </Text>
        </View>

        <Text style={styles.version}>
          Hanya untuk Penggunaan Internal · by <Text style={styles.versionBy}>Skintific</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.brand50 },
  container: { flexGrow: 1, justifyContent: "center", padding: Spacing["2xl"], paddingTop: 56, paddingBottom: 40 },

  // Background blobs
  blob: { position: "absolute", borderRadius: 9999 },
  blob1: { width: 320, height: 320, backgroundColor: Colors.brand200, opacity: 0.5, top: -90, left: -80 },
  blob2: { width: 380, height: 380, backgroundColor: Colors.brand100, opacity: 0.7, bottom: -120, right: -100 },

  // Brand lockup
  brand: { alignItems: "center", marginBottom: Spacing["3xl"] },
  brandName: {
    fontSize: 46,
    fontWeight: "800",
    color: Colors.brand700,
    letterSpacing: 1,
    lineHeight: 50,
  },
  brandTagline: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.brand700,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginTop: 10,
  },
  brandSubhead: {
    fontSize: Typography.sm,
    color: Colors.slate500,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 19,
  },
  brandBy: { fontSize: Typography.xs, color: Colors.slate400, marginTop: 14 },
  brandByName: { fontWeight: Typography.semibold, color: Colors.slate500 },

  // Card
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: Spacing["2xl"],
    borderWidth: 1,
    borderColor: Colors.brand100,
    ...Shadow.lg,
  },
  cardTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.slate800,
    marginBottom: Spacing.xl,
  },
  field: { marginBottom: Spacing.lg },
  label: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.slate500,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.inputBg,
    paddingHorizontal: Spacing.md,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.slate900,
    paddingVertical: 13,
  },
  eyeBtn: { padding: 4 },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: Spacing.sm,
    ...Shadow.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  buttonText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.white,
  },
  hint: {
    fontSize: Typography.xs,
    color: Colors.slate400,
    textAlign: "center",
    marginTop: Spacing.xl,
  },
  version: {
    fontSize: Typography.xs,
    color: Colors.slate400,
    textAlign: "center",
    marginTop: Spacing["2xl"],
  },
  versionBy: { fontWeight: Typography.semibold, color: Colors.slate500 },
});
