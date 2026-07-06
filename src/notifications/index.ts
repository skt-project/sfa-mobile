/**
 * Expo push notification registration.
 *
 * Call registerPushToken() after login — it requests permission, reads the
 * Expo push token, and POSTs it to the backend so the server can target
 * this specific device.
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getApiClient } from "../api/client";

// Show alerts + play sound when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerPushToken(): Promise<void> {
  // Physical device required — skip on simulator/emulator
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return; // User denied permission — silent exit
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const pushToken = tokenData.data;

  // Android requires a notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  // Register the token with our backend
  await getApiClient().post("/notifications/register-push-token", {
    push_token: pushToken,
  });
}

/**
 * Add a listener that fires when the user taps a notification.
 * Returns the subscription so the caller can remove it on unmount.
 */
export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/**
 * Add a listener that fires when a notification arrives while app is foregrounded.
 */
export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(handler);
}
