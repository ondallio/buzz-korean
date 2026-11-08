import {
  feedbackMessage as localizedFeedback,
  useLocalizedFeedback,
} from "@/shared/i18n";
import { useLocaleCallback } from "@/shared/i18n";
import { useTranslation as useAppTranslation } from "@/shared/i18n";
import * as React from "react";

import { requestOpenCreateAgent } from "@/features/agents/openCreateAgentEvent";
import { useSendMessageMutation } from "@/features/messages/hooks";
import { isWelcomeExperienceChannel } from "@/features/onboarding/welcome";
import type { Channel, Identity } from "@/shared/api/types";

type WelcomeGuideAgent = {
  name: string;
  pubkey: string;
};

/** Coordinates the Welcome channel's chat-first versus manual create choice. */
export function useWelcomeAgentCreate({
  activeChannel,
  currentIdentity,
  welcomeGuideAgent,
}: {
  activeChannel: Channel | null;
  currentIdentity: Identity | null | undefined;
  welcomeGuideAgent: WelcomeGuideAgent | null | undefined;
}) {
  const { t: localize } = useAppTranslation();

  const sendMessageMutation = useSendMessageMutation(
    activeChannel,
    currentIdentity ?? undefined,
  );
  const [isOpen, setIsOpen] = React.useState(false);
  const [error, setError] = useLocalizedFeedback(null);
  const beforeSendRef = React.useRef<(() => void) | null>(null);

  const openAddAgent = useLocaleCallback(
    (openRegularPicker: () => void, options?: { beforeSend?: () => void }) => {
      setError(null);
      if (isWelcomeExperienceChannel(activeChannel)) {
        beforeSendRef.current = options?.beforeSend ?? null;
        setIsOpen(true);
        return;
      }
      beforeSendRef.current = null;
      openRegularPicker();
    },
    [activeChannel],
  );

  const createManually = useLocaleCallback(() => {
    if (!activeChannel) return;
    setIsOpen(false);
    requestOpenCreateAgent({
      channelId: activeChannel.id,
      channelName: activeChannel.name,
    });
  }, [activeChannel]);

  const createInChat = useLocaleCallback(async () => {
    if (!activeChannel || !welcomeGuideAgent) {
      setError(
        localizedFeedback(
          "The welcome guide is unavailable. Create the agent manually instead.",
        ),
      );
      return;
    }
    setError(null);
    try {
      beforeSendRef.current?.();
      await sendMessageMutation.mutateAsync({
        channelId: activeChannel.id,
        content: `@${welcomeGuideAgent.name}, help me create a new agent.`,
        mentionPubkeys: [welcomeGuideAgent.pubkey],
      });
      setIsOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : localizedFeedback("Could not start the conversation."),
      );
    }
  }, [activeChannel, sendMessageMutation, welcomeGuideAgent, localize]);

  return {
    createInChat,
    createManually,
    error,
    isOpen,
    isSending: sendMessageMutation.isPending,
    openAddAgent,
    setIsOpen,
  };
}
