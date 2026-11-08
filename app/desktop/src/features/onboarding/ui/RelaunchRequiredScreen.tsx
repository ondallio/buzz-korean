import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { RecoveryScreen } from "./RecoveryScreen";

export function RelaunchRequiredScreen() {
  const { t: localize } = useAppTranslation();

  return (
    <RecoveryScreen
      testId="relaunch-required"
      title={localize("Restart Buzz to finish recovery")}
      body="Your identity was updated. Buzz needs to restart so syncing and agents run under it."
    />
  );
}
