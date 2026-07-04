import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";

import { useAuthStore } from "../store/authStore";
import LoginScreen from "../screens/auth/LoginScreen";
import SEHomeScreen from "../screens/se/HomeScreen";
import RouteListScreen from "../screens/se/RouteListScreen";
import VisitCheckinScreen from "../screens/se/VisitCheckinScreen";
import VisitSurveyScreen from "../screens/se/VisitSurveyScreen";
import VisitCheckoutScreen from "../screens/se/VisitCheckoutScreen";
import SPVHomeScreen from "../screens/spv/SPVHomeScreen";
import ApprovalQueueScreen from "../screens/spv/ApprovalQueueScreen";
import TeamOverviewScreen from "../screens/spv/TeamOverviewScreen";
import AnnouncementsScreen from "../screens/shared/AnnouncementsScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ---- SE Tab Navigator ----
function SETabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: "#2563EB",
        tabBarInactiveTintColor: "#94A3B8",
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="SEHome"
        component={SEHomeScreen}
        options={{ tabBarLabel: "Home", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏠</Text> }}
      />
      <Tab.Screen
        name="RouteList"
        component={RouteListScreen}
        options={{ tabBarLabel: "Rute", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📋</Text> }}
      />
      <Tab.Screen
        name="Announcements"
        component={AnnouncementsScreen}
        options={{ tabBarLabel: "Info", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📢</Text> }}
      />
    </Tab.Navigator>
  );
}

// ---- SPV Tab Navigator ----
function SPVTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: "#1D4ED8",
        tabBarInactiveTintColor: "#94A3B8",
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="SPVHome"
        component={SPVHomeScreen}
        options={{ tabBarLabel: "Dashboard", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📊</Text> }}
      />
      <Tab.Screen
        name="ApprovalQueue"
        component={ApprovalQueueScreen}
        options={{ tabBarLabel: "Approval", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>✅</Text> }}
      />
      <Tab.Screen
        name="TeamOverview"
        component={TeamOverviewScreen}
        options={{ tabBarLabel: "Tim", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👥</Text> }}
      />
      <Tab.Screen
        name="SPVAnnouncements"
        component={AnnouncementsScreen}
        options={{ tabBarLabel: "Info", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📢</Text> }}
      />
    </Tab.Navigator>
  );
}

// ---- Root Navigator ----
export default function RootNavigator() {
  const { isAuthenticated, user } = useAuthStore();
  const isSE = user?.role === "se" || user?.role === "SE";
  const isSPV = user?.role === "spv" || user?.role === "SPV";

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : isSPV ? (
          <>
            <Stack.Screen name="SPVTabs" component={SPVTabNavigator} />
            <Stack.Screen name="ApprovalQueue" component={ApprovalQueueScreen} options={{ headerShown: true, title: "Antrean Approval" }} />
            <Stack.Screen name="TeamOverview" component={TeamOverviewScreen} options={{ headerShown: true, title: "Ringkasan Tim" }} />
          </>
        ) : (
          <>
            <Stack.Screen name="SETabs" component={SETabNavigator} />
            <Stack.Screen name="RouteList" component={RouteListScreen} options={{ headerShown: true, title: "Rute Hari Ini" }} />
            <Stack.Screen name="VisitCheckin" component={VisitCheckinScreen as any} options={{ headerShown: true, title: "Check-in" }} />
            <Stack.Screen name="VisitSurvey" component={VisitSurveyScreen as any} options={{ headerShown: true, title: "Survey" }} />
            <Stack.Screen name="VisitCheckout" component={VisitCheckoutScreen as any} options={{ headerShown: true, title: "Checkout" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
