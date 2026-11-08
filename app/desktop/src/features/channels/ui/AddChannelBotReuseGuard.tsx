import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { LocalizedMessage } from "@/shared/i18n/LocalizedMessage";
import type { ManagedAgent } from "@/shared/api/types";

type AddChannelBotReuseGuardProps = {
  reusableAgent: ManagedAgent;
  forceNew: boolean;
  onForceNewChange: (forceNew: boolean) => void;
  disabled: boolean;
};

export function AddChannelBotReuseGuard({
  reusableAgent,
  forceNew,
  onForceNewChange,
  disabled,
}: AddChannelBotReuseGuardProps) {
  const { t: localize } = useAppTranslation();

  const isRunning =
    reusableAgent.status === "running" || reusableAgent.status === "deployed";

  return (
    <div className="space-y-2" data-testid="agent-instance-mode">
      <label className="text-sm font-medium" htmlFor="agent-instance-mode">
        {localize("Agent instance")}
      </label>
      <select
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
        disabled={disabled}
        id="agent-instance-mode"
        onChange={(e) => onForceNewChange(e.target.value === "new")}
        value={forceNew ? "new" : "reuse"}
      >
        <option value="reuse">{localize("Reuse existing agent")}</option>
        <option value="new">{localize("Create new instance")}</option>
      </select>
      <p className="text-xs text-muted-foreground">
        <LocalizedMessage
          message={
            isRunning
              ? "{agent} is already running. Reusing adds it to this channel without creating a duplicate keypair."
              : "{agent} is already stopped. Reusing adds it to this channel without creating a duplicate keypair."
          }
          values={{
            agent: (
              <span className="font-medium text-foreground">
                {reusableAgent.name}
              </span>
            ),
          }}
        />
      </p>
    </div>
  );
}
