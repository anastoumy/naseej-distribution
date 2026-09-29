import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

export default function StatusBar() {
  const { t, i18n } = useTranslation();
  const [time, setTime] = useState(new Date());
  const [platform, setPlatform] = useState("");

  useEffect(() => {
    setPlatform(window.api?.getPlatform?.() || "");
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const locale = i18n.language === "ar" ? "ar-SA" : "en-SA";
  const timeStr = time.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = time.toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const isMac = platform === "darwin";

  return (
    <header
      className="h-11 bg-primary border-b border-border flex items-center px-3 shrink-0 select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <span className="text-sm font-semibold text-foreground">
        {t("appName")}
      </span>

      <div className="flex-1" />

      <div
        className="flex items-center gap-3 text-xs text-muted-foreground"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <span>{dateStr}</span>
        <span>{timeStr}</span>
        <LanguageSwitcher />
      </div>

      {!isMac && (
        <div
          className="flex items-center gap-0.5 ms-2"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <button
            onClick={() => window.api?.minimizeWindow()}
            aria-label={t("common.minimizeWindow")}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors cursor-pointer text-sm"
          >
            ─
          </button>
          <button
            onClick={() => window.api?.maximizeWindow()}
            aria-label={t("common.maximizeWindow")}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors cursor-pointer text-sm"
          >
            □
          </button>
          <button
            onClick={() => window.api?.closeWindow()}
            aria-label={t("common.closeWindow")}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:destructive hover:bg-destructive/20 rounded transition-colors cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>
      )}
    </header>
  );
}
