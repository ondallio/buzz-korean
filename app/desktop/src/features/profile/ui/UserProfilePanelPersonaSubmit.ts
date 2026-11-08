import { t as translateInterfaceText } from "@/shared/i18n";
import { t as localize } from "@/shared/i18n";
import { toast } from "sonner";

import { personaManagedAgentUpdate } from "@/features/profile/ui/UserProfilePanelUtils";
import type {
  AcpRuntimeCatalogEntry,
  AgentPersona,
  CreateManagedAgentResponse,
  CreatePersonaInput,
  ManagedAgent,
  UpdateManagedAgentInput,
  UpdatePersonaInput,
} from "@/shared/api/types";

type SubmitProfilePersonaDialogOptions = {
  createManagedAgentForPersona: (
    persona: AgentPersona,
  ) => Promise<CreateManagedAgentResponse>;
  createPersona: (input: CreatePersonaInput) => Promise<AgentPersona>;
  input: CreatePersonaInput | UpdatePersonaInput;
  managedAgent: ManagedAgent | undefined;
  onDone: () => void;
  previousPersona?: AgentPersona;
  runtimes?: readonly AcpRuntimeCatalogEntry[];
  updateManagedAgent: (
    input: UpdateManagedAgentInput,
  ) => Promise<{ agent: ManagedAgent; profileSyncError: string | null }>;
  updatePersona: (input: UpdatePersonaInput) => Promise<AgentPersona>;
};

type ValidateLinkedAgentRuntimeEditOptions = {
  input: UpdatePersonaInput;
  managedAgent: ManagedAgent | undefined;
  previousPersona?: AgentPersona;
  runtimes?: readonly AcpRuntimeCatalogEntry[];
};

function normalizeRuntimePreference(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function validateLinkedAgentRuntimeEdit({
  input,
  managedAgent,
  previousPersona,
  runtimes,
}: ValidateLinkedAgentRuntimeEditOptions): string | null {
  if (!managedAgent || !previousPersona) {
    return null;
  }

  const previousRuntime = normalizeRuntimePreference(previousPersona.runtime);
  const nextRuntime = normalizeRuntimePreference(input.runtime);
  if (previousRuntime === nextRuntime) {
    return null;
  }

  const runtime = runtimes?.find((candidate) => candidate.id === nextRuntime);
  if (runtime?.availability === "available" && runtime.command) {
    return null;
  }

  const runtimeLabel = runtime?.label ?? "This provider";
  return translateInterfaceText(
    "{value1} is not available. Install it before saving this linked agent.",
    { value1: String(runtimeLabel) },
  );
}

export async function submitProfilePersonaDialog({
  createManagedAgentForPersona,
  createPersona,
  input,
  managedAgent,
  onDone,
  previousPersona,
  runtimes,
  updateManagedAgent,
  updatePersona,
}: SubmitProfilePersonaDialogOptions) {
  try {
    if ("id" in input) {
      const runtimeEditError = validateLinkedAgentRuntimeEdit({
        input,
        managedAgent,
        previousPersona,
        runtimes,
      });
      if (runtimeEditError) {
        toast.error(runtimeEditError);
        return;
      }

      const persona = await updatePersona(input);
      const agentUpdate = managedAgent
        ? personaManagedAgentUpdate(managedAgent, persona, {
            previousPersona,
            runtimes,
          })
        : null;
      const result = agentUpdate ? await updateManagedAgent(agentUpdate) : null;
      if (result?.profileSyncError) {
        toast.warning(
          localize("{value1} was updated, but profile sync failed: {value2}", {
            value1: String(result.agent.name),
            value2: String(result.profileSyncError),
          }),
        );
      }
      toast.success(
        localize("Updated {value1}.", { value1: String(input.displayName) }),
      );
    } else {
      const persona = await createPersona(input);
      try {
        const created = await createManagedAgentForPersona(persona);
        if (created.spawnError) {
          toast.error(
            localize("{value1} was created, but it did not start: {value2}", {
              value1: String(persona.displayName),
              value2: String(created.spawnError),
            }),
          );
        } else {
          toast.success(
            localize("Created and started {value1}.", {
              value1: String(created.agent.name),
            }),
          );
        }
        if (created.profileSyncError) {
          toast.warning(
            localize(
              "{value1} was created, but profile sync failed: {value2}",
              {
                value1: String(created.agent.name),
                value2: String(created.profileSyncError),
              },
            ),
          );
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? localize(
                "{value1} was created, but the agent instance could not be created: {value2}",
                {
                  value1: String(persona.displayName),
                  value2: String(error.message),
                },
              )
            : localize(
                "{value1} was created, but the agent instance could not be created.",
                { value1: String(persona.displayName) },
              ),
        );
      }
    }

    onDone();
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : localize("Failed to save agent."),
    );
  }
}
