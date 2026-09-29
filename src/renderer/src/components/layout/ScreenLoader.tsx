import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

export function ScreenLoader() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center h-full min-h-[12rem]">
      <div className="text-center">
        <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    </div>
  );
}
