import { t as translateFinalText } from "@/shared/i18n";
import {
  useLocale as useAppLocale,
  useTranslation as useAppTranslation,
} from "@/shared/i18n";
import { Check, CloudOff } from "lucide-react";

import {
  SidebarCompactActionCard,
  type SidebarActionCardSurface,
} from "@/shared/ui/sidebar-action-card";
import { Spinner } from "@/shared/ui/spinner";

type SidebarRelayConnectionCardProps = {
  isActionDisabled?: boolean;
  actionTestId?: string;
  className?: string;
  dismissClassName?: string;
  isConnected?: boolean;
  isReconnectPending: boolean;
  isWaitingOnReconnectHook?: boolean;
  onDismiss?: () => void;
  onReconnect: () => void;
  surface?: SidebarActionCardSurface;
  testId?: string;
};

export function SidebarRelayConnectionCard({
  actionTestId,
  className,
  isActionDisabled = false,
  isConnected = false,
  isReconnectPending,
  isWaitingOnReconnectHook = false,
  onDismiss,
  onReconnect,
  surface,
}: SidebarRelayConnectionCardProps) {
  useAppLocale();

  return (
    <SidebarRelayConnectionCompactCard
      actionTestId={actionTestId ?? "sidebar-reconnect"}
      className={className}
      isActionDisabled={isActionDisabled}
      isConnected={isConnected}
      isReconnectPending={isReconnectPending}
      isWaitingOnReconnectHook={isWaitingOnReconnectHook}
      onDismiss={onDismiss}
      onReconnect={onReconnect}
      surface={surface}
      testId="sidebar-relay-unreachable"
    />
  );
}

export function SidebarRelayConnectionCompactCard({
  actionTestId,
  className,
  dismissClassName,
  isActionDisabled = false,
  isConnected = false,
  isReconnectPending,
  isWaitingOnReconnectHook = false,
  onDismiss,
  onReconnect,
  surface,
  testId = "sidebar-relay-unreachable-compact",
}: SidebarRelayConnectionCardProps) {
  const { t: localize } = useAppTranslation();

  const reconnectTitle = isWaitingOnReconnectHook
    ? localize("Waiting to reconnect")
    : localize("Connecting");
  const reconnectDescription = isWaitingOnReconnectHook
    ? localize(
        "Complete any prompts opened by the reconnect helper to continue.",
      )
    : localize("Reconnecting");

  return (
    <SidebarCompactActionCard
      actionAriaLabel={
        isConnected
          ? translateFinalText("Connected")
          : translateFinalText("Connect to relay")
      }
      actionDisabled={isActionDisabled || isReconnectPending || isConnected}
      actionTestId={actionTestId}
      description={
        isConnected
          ? undefined
          : isReconnectPending
            ? reconnectDescription
            : localize("Click to connect")
      }
      dismissClassName={dismissClassName}
      dismissLabel={translateFinalText("Dismiss relay notification")}
      iconKey={
        isConnected ? "connected" : isReconnectPending ? "pending" : "idle"
      }
      icon={
        isConnected ? (
          <Check aria-hidden="true" className="h-5 w-5" />
        ) : isReconnectPending ? (
          <Spinner aria-hidden="true" className="h-5 w-5 border-2" />
        ) : (
          <CloudOff aria-hidden="true" className="h-5 w-5" />
        )
      }
      className={className}
      onAction={onReconnect}
      onDismiss={onDismiss}
      role={isConnected ? "status" : "alert"}
      surface={surface}
      testId={testId}
      title={
        isConnected
          ? localize("Connected")
          : isReconnectPending
            ? reconnectTitle
            : localize("Can't reach the relay")
      }
      tone={isConnected ? "success" : "neutral"}
    />
  );
}
