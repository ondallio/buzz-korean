import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { useSystemColorScheme } from "@/shared/theme/useSystemColorScheme";
import { Button } from "@/shared/ui/button";
import { StartupWindowDragRegion } from "@/shared/ui/StartupWindowDragRegion";

type CommunityApplyErrorScreenProps = {
  error: string;
  onChangeCommunity: () => void;
  onRetry: () => void;
};

export function CommunityApplyErrorScreen({
  error,
  onChangeCommunity,
  onRetry,
}: CommunityApplyErrorScreenProps) {
  const { t: localize } = useAppTranslation();

  const systemColorScheme = useSystemColorScheme();

  return (
    <div
      className="buzz-onboarding-neutral-theme buzz-startup-shell flex items-center justify-center bg-background px-4 py-8 text-foreground"
      data-system-color-scheme={systemColorScheme}
      data-testid="community-apply-error"
    >
      <StartupWindowDragRegion />
      <div className="relative flex w-full max-w-[500px] flex-col items-center text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          {localize("Community connection failed")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{error}</p>
        <div className="mt-8 flex w-full max-w-[300px] flex-col gap-3">
          <Button
            className="h-10 w-full"
            data-testid="community-apply-error-retry"
            onClick={onRetry}
            type="button"
          >
            {localize("Retry")}
          </Button>
          <Button
            className="h-10 w-full"
            onClick={onChangeCommunity}
            type="button"
            variant="secondary"
          >
            {localize("Change community")}
          </Button>
        </div>
      </div>
    </div>
  );
}
