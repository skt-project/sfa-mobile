import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "react-native-vector-icons/Ionicons";

import { useAuthStore } from "../store/authStore";
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

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function tabIcon(name: string, focused: boolean, color: string) {
  return <Ionicons name={focused ? name : `${name}-outline`} size={22} color={color} />;
}

// ---- SE Tab Navigator ----
function SETabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor:   TabBar.activeTint,
        tabBarInactiveTintColor: TabBar.inactiveTint,
        tabBarStyle: {
          backgroundColor:   TabBar.background,
          borderTopColor:    TabBar.borderColor,
          borderTopWidth:    1,
          paddingBottom:     4,
          paddingTop:        4,
          height:            58,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerShown: false,
      }}
    >
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
    </Tab.Navigator>
  );
}

// ---- SPV Tab Navigator ----
function SPVTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor:   TabBar.activeTint,
        tabBarInactiveTintColor: TabBar.inactiveTint,
        tabBarStyle: {
          backgroundColor:   TabBar.background,
          borderTopColor:    TabBar.borderColor,
          borderTopWidth:    1,
          paddingBottom:     4,
          paddingTop:        4,
          height:            58,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerShown: false,
      }}
    >
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
    </Tab.Navigator>
  );
}

// ---- Root Navigator ----
export default function RootNavigator() {
  const { isAuthenticated, user } = useAuthStore();
  const isSE  = user?.role === "se"  || user?.role === "SE";
  const isSPV = user?.role === "spv" || user?.role === "SPV";

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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
