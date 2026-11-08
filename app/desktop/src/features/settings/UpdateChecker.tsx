import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { LocalizedMessage } from "@/shared/i18n/LocalizedMessage";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useUpdaterContext } from "./hooks/UpdaterProvider";
import { Button } from "@/shared/ui/button";
import {
  SettingsOptionGroup,
  SettingsOptionRow,
} from "./ui/SettingsOptionGroup";
import { SettingsSectionHeader } from "./ui/SettingsSectionHeader";
export function UpdateChecker() {
  const { t: localize } = useAppTranslation();

  const { status, checkForUpdate, installAndRelaunch } = useUpdaterContext();

  return (
    <section className="min-w-0" data-testid="settings-updates">
      <SettingsSectionHeader
        title={localize("Software Updates")}
        description={localize(
          "Keep Buzz up to date with the latest features and fixes.",
        )}
      />

      <SettingsOptionGroup title={localize("Update status")}>
        {status.state === "idle" && (
          <SettingsOptionRow>
            <div className="min-w-0">
              <p
                className="text-sm font-normal text-muted-foreground/70"
                data-settings-subcopy
              >
                {localize("Check if a new version is available.")}
              </p>
            </div>
            <Button size="sm" onClick={checkForUpdate}>
              {localize("Check for Updates")}
            </Button>
          </SettingsOptionRow>
        )}

        {status.state === "checking" && (
          <SettingsOptionRow>
            <div className="min-w-0">
              <p
                className="text-sm font-normal text-muted-foreground/70"
                data-settings-subcopy
              >
                {localize("Checking for updates...")}
              </p>
            </div>
          </SettingsOptionRow>
        )}

        {status.state === "up-to-date" && (
          <SettingsOptionRow>
            <div className="min-w-0">
              <p
                className="text-sm font-normal text-muted-foreground/70"
                data-settings-subcopy
              >
                {localize("You're on the latest version.")}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={checkForUpdate}>
              {localize("Check Again")}
            </Button>
          </SettingsOptionRow>
        )}

        {status.state === "unavailable" && (
          <SettingsOptionRow>
            <div className="min-w-0">
              <p
                className="text-sm font-normal text-muted-foreground/70"
                data-settings-subcopy
              >
                {localize(
                  "Automatic updates aren't available on this build. Download the latest release manually.",
                )}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={checkForUpdate}>
              {localize("Check Again")}
            </Button>
          </SettingsOptionRow>
        )}

        {status.state === "manual-required" && (
          <SettingsOptionRow>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                <LocalizedMessage
                  message={"Update available — v{part1}"}
                  values={{ part1: status.version }}
                />
              </p>
              <p
                className="text-sm font-normal text-muted-foreground/70"
                data-settings-subcopy
              >
                <LocalizedMessage
                  message={
                    "In-app updates aren't supported on this Linux package. Download the new version from GitHub. {part1}"
                  }
                  values={{
                    part1: (
                      <span>
                        {localize(
                          "Switch to the AppImage build for automatic updates.",
                        )}
                      </span>
                    ),
                  }}
                />
              </p>
            </div>
            <Button size="sm" onClick={() => void openUrl(status.releaseUrl)}>
              {localize("Download Update")}
            </Button>
          </SettingsOptionRow>
        )}

        {status.state === "available" && (
          <SettingsOptionRow>
            <div className="min-w-0">
              <p
                className="text-sm font-normal text-muted-foreground/70"
                data-settings-subcopy
              >
                {localize("Preparing update...")}
              </p>
            </div>
          </SettingsOptionRow>
        )}

        {status.state === "downloading" && (
          <SettingsOptionRow>
            <div className="min-w-0">
              <p
                className="text-sm font-normal text-muted-foreground/70"
                data-settings-subcopy
              >
                {localize("Downloading update...")}
              </p>
            </div>
          </SettingsOptionRow>
        )}

        {status.state === "installing" && (
          <SettingsOptionRow>
            <div className="min-w-0">
              <p
                className="text-sm font-normal text-muted-foreground/70"
                data-settings-subcopy
              >
                {localize("Installing update...")}
              </p>
            </div>
          </SettingsOptionRow>
        )}

        {status.state === "ready" && (
          <SettingsOptionRow>
            <div className="min-w-0">
              <p
                className="text-sm font-normal text-muted-foreground/70"
                data-settings-subcopy
              >
                {localize("Update downloaded. Click to apply.")}
              </p>
            </div>
            <Button size="sm" onClick={installAndRelaunch}>
              {localize("Update Now")}
            </Button>
          </SettingsOptionRow>
        )}

        {status.state === "error" && (
          <SettingsOptionRow>
            <div className="min-w-0">
              <p className="text-sm font-normal text-destructive">
                <LocalizedMessage
                  message={"Update failed: {part1}"}
                  values={{ part1: status.message }}
                />
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={checkForUpdate}>
              {localize("Retry")}
            </Button>
          </SettingsOptionRow>
        )}
      </SettingsOptionGroup>
    </section>
  );
}
