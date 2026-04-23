import { dbGet, dbPut } from "@/lib/storage";

export interface TranslationSettingsState {
  sourceLanguage: string;
  targetLanguage: string;
  autoTranslateIncoming: boolean;
}

export const TRANSLATION_SETTINGS_KEY = "translation-settings";

export const TRANSLATION_LANGUAGE_OPTIONS: Array<{ code: string; name: string }> = [
  ["af", "Afrikaans"], ["sq", "Albanian"], ["am", "Amharic"], ["ar", "Arabic"], ["hy", "Armenian"], ["az", "Azerbaijani"],
  ["eu", "Basque"], ["be", "Belarusian"], ["bn", "Bengali"], ["bs", "Bosnian"], ["bg", "Bulgarian"], ["ca", "Catalan"],
  ["ceb", "Cebuano"], ["zh", "Chinese"], ["co", "Corsican"], ["hr", "Croatian"], ["cs", "Czech"], ["da", "Danish"],
  ["nl", "Dutch"], ["en", "English"], ["eo", "Esperanto"], ["et", "Estonian"], ["fi", "Finnish"], ["fr", "French"],
  ["fy", "Frisian"], ["gl", "Galician"], ["ka", "Georgian"], ["de", "German"], ["el", "Greek"], ["gu", "Gujarati"],
  ["ht", "Haitian Creole"], ["ha", "Hausa"], ["haw", "Hawaiian"], ["he", "Hebrew"], ["hi", "Hindi"], ["hmn", "Hmong"],
  ["hu", "Hungarian"], ["is", "Icelandic"], ["ig", "Igbo"], ["id", "Indonesian"], ["ga", "Irish"], ["it", "Italian"],
  ["ja", "Japanese"], ["jv", "Javanese"], ["kn", "Kannada"], ["kk", "Kazakh"], ["km", "Khmer"], ["ko", "Korean"],
  ["ku", "Kurdish"], ["ky", "Kyrgyz"], ["lo", "Lao"], ["la", "Latin"], ["lv", "Latvian"], ["lt", "Lithuanian"],
  ["lb", "Luxembourgish"], ["mk", "Macedonian"], ["mg", "Malagasy"], ["ms", "Malay"], ["ml", "Malayalam"], ["mt", "Maltese"],
  ["mi", "Maori"], ["mr", "Marathi"], ["mn", "Mongolian"], ["my", "Myanmar"], ["ne", "Nepali"], ["no", "Norwegian"],
  ["ny", "Nyanja"], ["or", "Odia"], ["ps", "Pashto"], ["fa", "Persian"], ["pl", "Polish"], ["pt", "Portuguese"],
  ["pa", "Punjabi"], ["ro", "Romanian"], ["ru", "Russian"], ["sm", "Samoan"], ["gd", "Scots Gaelic"], ["sr", "Serbian"],
  ["st", "Sesotho"], ["sn", "Shona"], ["sd", "Sindhi"], ["si", "Sinhala"], ["sk", "Slovak"], ["sl", "Slovenian"],
  ["so", "Somali"], ["es", "Spanish"], ["su", "Sundanese"], ["sw", "Swahili"], ["sv", "Swedish"], ["tl", "Tagalog"],
  ["tg", "Tajik"], ["ta", "Tamil"], ["tt", "Tatar"], ["te", "Telugu"], ["th", "Thai"], ["tr", "Turkish"],
  ["tk", "Turkmen"], ["uk", "Ukrainian"], ["ur", "Urdu"], ["ug", "Uyghur"], ["uz", "Uzbek"], ["vi", "Vietnamese"],
  ["cy", "Welsh"], ["xh", "Xhosa"], ["yi", "Yiddish"], ["yo", "Yoruba"], ["zu", "Zulu"],
].map(([code, name]) => ({ code, name }));

const DEFAULT_SETTINGS: TranslationSettingsState = {
  sourceLanguage: "en",
  targetLanguage: "ru",
  autoTranslateIncoming: true,
};

const bundledDictionary: Record<string, Record<string, string>> = {
  "en:ru": {
    hello: "привет",
    hi: "привет",
    thanks: "спасибо",
    thank: "спасибо",
    friend: "друг",
    message: "сообщение",
    sent: "отправлено",
    meeting: "встреча",
    tomorrow: "завтра",
    yes: "да",
    no: "нет",
    call: "звонок",
    photo: "фото",
  },
  "ru:en": {
    "привет": "hello",
    "спасибо": "thanks",
    "друг": "friend",
    "сообщение": "message",
    "отправлено": "sent",
    "встреча": "meeting",
    "завтра": "tomorrow",
    "да": "yes",
    "нет": "no",
    "звонок": "call",
    "фото": "photo",
  },
};

export async function getTranslationSettings(): Promise<TranslationSettingsState> {
  return (await dbGet<TranslationSettingsState>("settings", TRANSLATION_SETTINGS_KEY)) || DEFAULT_SETTINGS;
}

export async function saveTranslationSettings(settings: TranslationSettingsState): Promise<void> {
  await dbPut("settings", TRANSLATION_SETTINGS_KEY, settings);
}

export function detectLanguage(text: string): string | null {
  if (!text.trim()) return null;
  if (/[\u0400-\u04FF]/.test(text)) return "ru";
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh";
  if (/[\u3040-\u30FF]/.test(text)) return "ja";
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  if (/[ğüşöçıİĞÜŞÖÇ]/i.test(text)) return "tr";
  if (/[A-Za-z]/.test(text)) return "en";
  return null;
}

export function translateWithBundledDictionary(text: string, sourceLanguage: string, targetLanguage: string): string | null {
  const dictionary = bundledDictionary[`${sourceLanguage}:${targetLanguage}`];
  if (!dictionary) return null;

  const translated = text
    .split(/(\s+)/)
    .map((chunk) => {
      const key = chunk.toLowerCase();
      return dictionary[key] || chunk;
    })
    .join("")
    .trim();

  return translated && translated !== text ? translated : null;
}

export function getLanguageName(code: string): string {
  return TRANSLATION_LANGUAGE_OPTIONS.find((item) => item.code === code)?.name || code;
}