import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "../store/authStore";
import { getApiClient } from "../api/client";
import { Colors, TabBar } from "../theme";
import LoginScreen from "../screens/auth/LoginScreen";
import SEHomeScreen from "../screens/se/HomeScreen";
import RouteListScreen from "../screens/se/RouteListScreen";
import VisitCheckinScreen from "../screens/se/VisitCheckinScreen";
import VisitSurveyScreen from "../screens/se/VisitSurveyScreen";
import VisitCheckoutScreen from "../screens/se/VisitCheckoutScreen";
import VisitHistoryScreen from "../screens/se/VisitHistoryScreen";
import VisitDetailScreen from "../screens/se/VisitDetailScreen";
import RevisionEditScreen from "../screens/se/RevisionEditScreen";
import SPVHomeScreen from "../screens/spv/SPVHomeScreen";
import ApprovalQueueScreen from "../screens/spv/ApprovalQueueScreen";
import TeamOverviewScreen from "../screens/spv/TeamOverviewScreen";
import AnnouncementsScreen from "../screens/shared/AnnouncementsScreen";
import NotificationsScreen from "../screens/shared/NotificationsScreen";
import ProfileScreen from "../screens/shared/ProfileScreen";

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function tabIcon(name: string, focused: boolean, color: string) {
  return <Ionicons name={focused ? name : `${name}-outline`} size={22} color={color} />;
}

function ProfileTabIcon({ focused, color }: { focused: boolean; color: string }) {
  const { data: count = 0 } = useQuery<number>({
    queryKey: ["notifications-unread-count"],
    queryFn:  () =>
      getApiClient()
        .get<{ notification_id: string; is_read: boolean }[]>("/notifications")
        .then((r) => r.data.filter((n) => !n.is_read).length)
        .catch(() => 0),
    staleTime: 60_000,
  });
  return (
    <View>
      <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} accessible={false} />
      {count > 0 && (
        <View style={navBadge.dot} accessibilityLabel={`${count} notifikasi belum dibaca`}>
          <Text style={navBadge.text} accessible={false}>{count > 9 ? "9+" : count}</Text>
        </View>
      )}
    </View>
  );
}

const navBadge = StyleSheet.create({
  dot: {
    position: "absolute",
    right: -6,
    top: -4,
    backgroundColor: Colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { fontSize: 9, fontWeight: "700", color: Colors.white },
});

const SHARED_TAB_OPTIONS = {
  tabBarActiveTintColor:   TabBar.activeTint,
  tabBarInactiveTintColor: TabBar.inactiveTint,
  tabBarStyle: {
    backgroundColor: TabBar.background,
    borderTopColor:  TabBar.borderColor,
    borderTopWidth:  1,
    paddingBottom:   4,
    paddingTop:      4,
    height:          58,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: "600" as const },
  headerShown: false,
} as const;

// ---- SE Tab Navigator ----
function SETabNavigator() {
  return (
    <Tab.Navigator screenOptions={SHARED_TAB_OPTIONS}>
      <Tab.Screen
        name="SEHome"
        component={SEHomeScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ focused, color }) => tabIcon("home", focused, color),
        }}
      />
      <Tab.Screen
        name="RouteList"
        component={RouteListScreen}
        options={{
          tabBarLabel: "Rute",
          tabBarIcon: ({ focused, color }) => tabIcon("map", focused, color),
        }}
      />
      <Tab.Screen
        name="VisitHistory"
        component={VisitHistoryScreen}
        options={{
          tabBarLabel: "Riwayat",
          tabBarIcon: ({ focused, color }) => tabIcon("time", focused, color),
        }}
      />
      <Tab.Screen
        name="Announcements"
        component={AnnouncementsScreen}
        options={{
          tabBarLabel: "Info",
          tabBarIcon: ({ focused, color }) => tabIcon("megaphone", focused, color),
        }}
      />
      <Tab.Screen
        name="SEProfile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profil",
          tabBarIcon: ({ focused, color }) => <ProfileTabIcon focused={focused} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ---- SPV Tab Navigator ----
function SPVTabNavigator() {
  return (
    <Tab.Navigator screenOptions={SHARED_TAB_OPTIONS}>
      <Tab.Screen
        name="SPVHome"
        component={SPVHomeScreen}
        options={{
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ focused, color }) => tabIcon("bar-chart", focused, color),
        }}
      />
      <Tab.Screen
        name="ApprovalQueue"
        component={ApprovalQueueScreen}
        options={{
          tabBarLabel: "Approval",
          tabBarIcon: ({ focused, color }) => tabIcon("checkmark-circle", focused, color),
        }}
      />
      <Tab.Screen
        name="TeamOverview"
        component={TeamOverviewScreen}
        options={{
          tabBarLabel: "Tim",
          tabBarIcon: ({ focused, color }) => tabIcon("people", focused, color),
        }}
      />
      <Tab.Screen
        name="SPVAnnouncements"
        component={AnnouncementsScreen}
        options={{
          tabBarLabel: "Info",
          tabBarIcon: ({ focused, color }) => tabIcon("megaphone", focused, color),
        }}
      />
      <Tab.Screen
        name="SPVProfile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profil",
          tabBarIcon: ({ focused, color }) => <ProfileTabIcon focused={focused} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ---- Root Navigator ----
export default function RootNavigator() {
  const { isAuthenticated, user } = useAuthStore();
  const isSPV = user?.role === "spv";

  const stackScreenOptions = {
    headerStyle: { backgroundColor: Colors.white },
    headerTintColor: Colors.primary,
    headerTitleStyle: { fontWeight: "700" as const, fontSize: 16, color: Colors.slate900 },
    headerShadowVisible: true,
  };

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : isSPV ? (
          <>
            <Stack.Screen name="SPVTabs" component={SPVTabNavigator} />
            <Stack.Screen name="ApprovalQueue" component={ApprovalQueueScreen}
              options={{ ...stackScreenOptions, headerShown: true, title: "Antrean Approval" }} />
            <Stack.Screen name="TeamOverview" component={TeamOverviewScreen}
              options={{ ...stackScreenOptions, headerShown: true, title: "Ringkasan Tim" }} />
            <Stack.Screen name="VisitDetail" component={VisitDetailScreen as any}
              options={{ ...stackScreenOptions, headerShown: true, title: "Detail Kunjungan" }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen}
              options={{ ...stackScreenOptions, headerShown: true, title: "Notifikasi" }} />
          </>
        ) : (
          <>
            <Stack.Screen name="SETabs" component={SETabNavigator} />
            <Stack.Screen name="RouteList" component={RouteListScreen as any}
              options={{ ...stackScreenOptions, headerShown: true, title: "Rute Hari Ini" }} />
            <Stack.Screen name="VisitCheckin" component={VisitCheckinScreen as any}
              options={{ ...stackScreenOptions, headerShown: true, title: "Check-in" }} />
            <Stack.Screen name="VisitSurvey" component={VisitSurveyScreen as any}
              options={{ ...stackScreenOptions, headerShown: true, title: "Input Demand" }} />
            <Stack.Screen name="VisitCheckout" component={VisitCheckoutScreen as any}
              options={{ ...stackScreenOptions, headerShown: true, title: "Checkout" }} />
            <Stack.Screen name="VisitHistory" component={VisitHistoryScreen as any}
              options={{ ...stackScreenOptions, headerShown: true, title: "Riwayat Kunjungan" }} />
            <Stack.Screen name="VisitDetail" component={VisitDetailScreen as any}
              options={{ ...stackScreenOptions, headerShown: true, title: "Detail Kunjungan" }} />
            <Stack.Screen name="RevisionEdit" component={RevisionEditScreen as any}
              options={{ ...stackScreenOptions, headerShown: true, title: "Revisi Kunjungan" }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen}
              options={{ ...stackScreenOptions, headerShown: true, title: "Notifikasi" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
