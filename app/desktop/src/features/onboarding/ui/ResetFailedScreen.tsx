import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { RecoveryScreen } from "./RecoveryScreen";

export function ResetFailedScreen() {
  const { t: localize } = useAppTranslation();

  return (
    <RecoveryScreen
      testId="reset-failed"
      title={localize("Sign out could not complete")}
      body="Buzz was unable to fully clear your local data. Try relaunching — the reset will resume automatically. If this persists, contact support."
    />
  );
}
