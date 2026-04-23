import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Translation } from "@capacitor-mlkit/translation";
import { detectLanguage, getTranslationSettings, translateWithBundledDictionary } from "@/lib/translation-config";

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

export async function translateIncomingMessage(text: string): Promise<string | null> {
  const settings = await getTranslationSettings();
  if (!settings.autoTranslateIncoming || !text.trim()) return null;

  const detected = detectLanguage(text);
  if (!detected || detected !== settings.sourceLanguage) return null;

  const bundled = translateWithBundledDictionary(text, settings.sourceLanguage, settings.targetLanguage);
  if (bundled) return bundled;

  if (!Capacitor.isNativePlatform()) return null;

  try {
    const { text: translated } = await Translation.translate({
      text,
      sourceLanguage: settings.sourceLanguage as any,
      targetLanguage: settings.targetLanguage as any,
    });
    return translated;
  } catch {
    return null;
  }
}