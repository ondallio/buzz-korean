import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { ThemeGrainientBackground } from "@/app/ThemeGrainientBackground";
import { FlappingBee } from "@/shared/ui/buzz-logo/FlappingBee";

/** Immediate feedback shown while the native huddle session is being prepared. */
export function HuddleStartingView() {
  const { t: localize } = useAppTranslation();

  return (
    <div
      aria-label={localize("Starting huddle")}
      className="buzz-setup-loading-shell flex min-h-0 flex-1 items-center justify-center overflow-hidden px-6 text-foreground"
      data-testid="huddle-starting-view"
      role="status"
    >
      <ThemeGrainientBackground />
      <span className="sr-only">{localize("Starting huddle")}</span>
      <FlappingBee className="relative z-10 h-auto w-28" />
    </div>
  );
}
