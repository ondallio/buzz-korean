import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { AgentDefaultsEditor } from "@/features/agents/ui/AgentDefaultsEditor";
import { SettingsOptionGroup } from "./SettingsOptionGroup";

export function AgentDefaultsSettingsCard() {
  const { t: localize } = useAppTranslation();

  return (
    <SettingsOptionGroup
      data-testid="settings-global-agent-config"
      description={localize(
        "Provider, model, effort, and environment settings inherited by local agents. Agent-specific settings always take priority.",
      )}
      title={localize("Agent defaults")}
    >
      <div className="px-4 py-4">
        <AgentDefaultsEditor layout="flat" />
      </div>
    </SettingsOptionGroup>
  );
}
