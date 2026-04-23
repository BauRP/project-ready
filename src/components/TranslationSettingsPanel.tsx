import { useEffect, useState } from "react";
import { ArrowLeft, Download, Languages } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Language, Translation } from "@capacitor-mlkit/translation";
import { getLanguageName, getTranslationSettings, saveTranslationSettings, TRANSLATION_LANGUAGE_OPTIONS } from "@/lib/translation-config";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { toast } from "sonner";

interface TranslationSettingsPanelProps {
  onBack: () => void;
}

const TranslationSettingsPanel = ({ onBack }: TranslationSettingsPanelProps) => {
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("ru");
  const [autoTranslateIncoming, setAutoTranslateIncoming] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    getTranslationSettings().then((settings) => {
      setSourceLanguage(settings.sourceLanguage);
      setTargetLanguage(settings.targetLanguage);
      setAutoTranslateIncoming(settings.autoTranslateIncoming);
    });
  }, []);

  const persist = async (nextSource = sourceLanguage, nextTarget = targetLanguage, nextAuto = autoTranslateIncoming) => {
    await saveTranslationSettings({
      sourceLanguage: nextSource,
      targetLanguage: nextTarget,
      autoTranslateIncoming: nextAuto,
    });
  };

  const handleDownloadModels = async () => {
    if (!Capacitor.isNativePlatform()) {
      toast.info("Offline model download is available in the mobile app build.");
      return;
    }

    setDownloading(true);
    try {
      await Translation.downloadModel({ language: sourceLanguage as Language });
      await Translation.downloadModel({ language: targetLanguage as Language });
      toast.success(`Offline packs ready: ${getLanguageName(sourceLanguage)} → ${getLanguageName(targetLanguage)}`);
    } catch {
      toast.error("Could not download language packs.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-4 pb-2 flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-secondary/50 transition-colors">
          <ArrowLeft size={20} className="text-foreground" />
        </button>
        <h1 className="text-xl font-bold gradient-text">Translation Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-10 space-y-4">
        <div className="glass-panel-sm rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Languages size={18} className="text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Automatic translation</p>
              <p className="text-xs text-muted-foreground">Translate incoming messages when the detected source matches your chosen pair.</p>
            </div>
            <Switch
              checked={autoTranslateIncoming}
              onCheckedChange={(checked) => {
                setAutoTranslateIncoming(checked);
                persist(sourceLanguage, targetLanguage, checked);
              }}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Source Language</p>
            <Select value={sourceLanguage} onValueChange={(value) => { setSourceLanguage(value); persist(value, targetLanguage, autoTranslateIncoming); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select source language" />
              </SelectTrigger>
              <SelectContent>
                {TRANSLATION_LANGUAGE_OPTIONS.map((language) => (
                  <SelectItem key={language.code} value={language.code}>{language.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Target Language</p>
            <Select value={targetLanguage} onValueChange={(value) => { setTargetLanguage(value); persist(sourceLanguage, value, autoTranslateIncoming); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select target language" />
              </SelectTrigger>
              <SelectContent>
                {TRANSLATION_LANGUAGE_OPTIONS.map((language) => (
                  <SelectItem key={language.code} value={language.code}>{language.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <button
            onClick={handleDownloadModels}
            disabled={downloading}
            className="w-full rounded-xl bg-primary text-primary-foreground px-4 py-3 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Download size={16} />
            {downloading ? "Downloading..." : "Download offline language packs"}
          </button>

          <div className="rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground leading-relaxed">
            English ↔ Russian is bundled as the default offline pair. Additional language packs can be downloaded on-device for 100+ languages.
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranslationSettingsPanel;