import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export async function notifyIncomingMessage(title: string, body: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
    return;
  }

  try {
    await LocalNotifications.requestPermissions();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Date.now() % 2147483647,
          title,
          body,
          smallIcon: "ic_launcher_foreground",
          sound: "trivo_elite_notification.wav",
        },
      ],
    });
  } catch {
  }
}