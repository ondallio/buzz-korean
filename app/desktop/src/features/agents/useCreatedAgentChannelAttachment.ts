import { t as translateFinalText } from "@/shared/i18n";
import {
  t as localize,
  useTranslation as useAppTranslation,
} from "@/shared/i18n";
import { toast } from "sonner";

import { attachManagedAgentToChannel } from "./channelAgents";
import type { Channel, CreateManagedAgentResponse } from "@/shared/api/types";

type TargetChannel = Pick<Channel, "id" | "name">;

async function attach(
  created: CreateManagedAgentResponse,
  targetChannel: TargetChannel,
) {
  const attached = await attachManagedAgentToChannel(targetChannel.id, {
    agent: created.agent,
    role: "bot",
    ensureRunning: true,
  });
  created.agent = attached.agent;
}

function showAttachmentFailure(
  created: CreateManagedAgentResponse,
  targetChannel: TargetChannel,
  cause: unknown,
  toastId?: string | number,
) {
  const error = cause instanceof Error ? cause.message : "Failed to add agent.";
  const id = toast.warning(localize("Agent created"), {
    description: localize("{value1} couldn’t be added to #{value2}. {value3}", {
      value1: String(created.agent.name),
      value2: String(targetChannel.name),
      value3: String(error),
    }),
    id: toastId,
    action: {
      label: localize("Try again"),
      onClick: (event) => {
        event.preventDefault();
        toast.loading(translateFinalText("Agent created"), {
          description: localize("Adding {value1} to #{value2}…", {
            value1: String(created.agent.name),
            value2: String(targetChannel.name),
          }),
          id,
        });
        void attach(created, targetChannel).then(
          () => {
            toast.success(localize("Agent created"), {
              description: localize("Added {value1} to #{value2}", {
                value1: String(created.agent.name),
                value2: String(targetChannel.name),
              }),
              id,
            });
          },
          (retryCause: unknown) => {
            showAttachmentFailure(created, targetChannel, retryCause, id);
          },
        );
      },
    },
  });
}

/** Keeps creation successful when its optional channel attachment fails. */
export function useCreatedAgentChannelAttachment() {
  const { t: localize } = useAppTranslation();

  async function presentCreatedAgent(
    created: CreateManagedAgentResponse,
    targetChannel?: TargetChannel | null,
  ) {
    if (created.spawnError || !targetChannel) {
      toast.success(localize("Agent created"));
      return;
    }

    try {
      await attach(created, targetChannel);
      toast.success(localize("Agent created"));
    } catch (cause) {
      showAttachmentFailure(created, targetChannel, cause);
    }
  }

  return { presentCreatedAgent };
}
