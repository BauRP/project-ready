import { ArrowLeft, ExternalLink } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface TransparencyPageProps {
  onBack: () => void;
}

const libraries = [
  {
    name: "TweetNaCl.js",
    version: "1.0.3",
    license: "Unlicense (Public Domain)",
    purpose: "Ed25519 signing, X25519 key exchange, XSalsa20-Poly1305 encryption",
    url: "https://github.com/nickolay/nickel",
  },
  {
    name: "GunDB",
    version: "0.2020.x",
    license: "MIT / Apache-2.0 / Zlib",
    purpose: "Decentralized P2P data synchronization",
    url: "https://gun.eco",
  },
  {
    name: "QRCode.react",
    version: "4.x",
    license: "ISC",
    purpose: "QR code generation for contact exchange",
    url: "https://github.com/zpao/qrcode.react",
  },
  {
    name: "React",
    version: "18.x",
    license: "MIT",
    purpose: "UI framework",
    url: "https://react.dev",
  },
  {
    name: "Framer Motion",
    version: "11.x",
    license: "MIT",
    purpose: "Animation library",
    url: "https://www.framer.com/motion/",
  },
  {
    name: "Tailwind CSS",
    version: "3.x",
    license: "MIT",
    purpose: "Utility-first CSS framework",
    url: "https://tailwindcss.com",
  },
];

const TransparencyPage = ({ onBack }: TransparencyPageProps) => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-hide">
      <div className="px-3 pt-4 pb-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-secondary/50 transition-colors">
          <ArrowLeft size={20} className="text-foreground" />
        </button>
        <h1 className="text-xl font-bold gradient-text">{t("technicalTransparency")}</h1>
      </div>

      <div className="px-5 space-y-3">
        <p className="text-sm text-muted-foreground">
          {t("transparencyDescription")}
        </p>

        {libraries.map((lib) => (
          <div key={lib.name} className="glass-panel-sm neon-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-foreground">{lib.name}</h3>
              <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {lib.license}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{lib.purpose}</p>
            <a
              href={lib.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink size={12} />
              {lib.url}
            </a>
          </div>
        ))}
      </div>

      <div className="h-24" />
    </div>
  );
};

export default TransparencyPage;
