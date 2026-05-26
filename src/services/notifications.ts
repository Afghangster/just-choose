import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { nudgeCopy, urgencyLabels } from "../constants/labels";
import type { Decision } from "../types/domain";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications() {
  if (Platform.OS === "web") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission =
    existing.status === "granted"
      ? existing
      : await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });

  if (permission.status !== "granted") {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return token.data;
}

export async function scheduleUrgentDecisionNotifications(
  decision: Decision,
  gracePeriodMinutes: number,
) {
  if (Platform.OS === "web" || !decision.urgency || decision.urgency === "no_rush") {
    return [];
  }

  const ids: string[] = [];
  const immediate = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Just Choose",
      body: `${urgencyLabels[decision.urgency]}: ${decision.title}`,
      data: { decisionId: decision.id },
    },
    trigger: null,
  });
  ids.push(immediate);

  const reminder = await Notifications.scheduleNotificationAsync({
    content: {
      title: "A verdict is needed",
      body: nudgeCopy[Math.floor(Math.random() * nudgeCopy.length)],
      data: { decisionId: decision.id, kind: "nudge" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(60, gracePeriodMinutes * 60),
    },
  });
  ids.push(reminder);

  return ids;
}
