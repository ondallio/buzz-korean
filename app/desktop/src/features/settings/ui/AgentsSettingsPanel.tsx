import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { AgentDefaultsSettingsCard } from "./AgentDefaultsSettingsCard";
import {
  setKeepMentionedAgentsPinned,
  useKeepMentionedAgentsPinned,
} from "@/features/messages/lib/autoPinMentionedAgentsPreference";
import { Switch } from "@/shared/ui/switch";
import { HarnessesSettingsPanel } from "./HarnessesSettingsPanel";
import { PreventSleepSettingsCard } from "./PreventSleepSettingsCard";
import {
  SettingsOptionGroup,
  SettingsOptionGroupList,
  SettingsOptionRow,
} from "./SettingsOptionGroup";
import { SettingsSectionHeader } from "./SettingsSectionHeader";

export function AgentsSettingsPanel() {
  const { t: localize } = useAppTranslation();

  const automaticallyMentionAgents = useKeepMentionedAgentsPinned();

  return (
    <section className="min-w-0" data-testid="settings-agents">
      <SettingsSectionHeader
        title={localize("Agents")}
        description={localize(
          "Control how agents behave in conversations and run on this machine.",
        )}
      />

      <SettingsOptionGroupList>
        <SettingsOptionGroup title={localize("Conversations")}>
          <SettingsOptionRow data-testid="settings-automatic-agent-mentions">
            <div className="min-w-0">
              <label
                className="font-medium text-foreground"
                htmlFor="settings-automatic-agent-mentions-switch"
              >
                {localize("Automatically mention agents")}
              </label>
              <p
                className="mt-0.5 text-sm text-muted-foreground/70"
                data-settings-subcopy
              >
                {localize("Address selected agents in thread replies")}
              </p>
            </div>
            <Switch
              aria-label={localize("Automatically mention agents")}
              checked={automaticallyMentionAgents}
              id="settings-automatic-agent-mentions-switch"
              onCheckedChange={setKeepMentionedAgentsPinned}
            />
          </SettingsOptionRow>
        </SettingsOptionGroup>
        <PreventSleepSettingsCard />
        <HarnessesSettingsPanel />
        <AgentDefaultsSettingsCard />
      </SettingsOptionGroupList>
    </section>
  );
}
