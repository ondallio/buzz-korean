import { t as translateInterfaceText } from "@/shared/i18n";
import { formatTtlDuration } from "@/features/channels/lib/ephemeralChannel";

export type ChannelLifecycle = "ongoing" | "temporary" | "project";

export function channelLifecycle(input: {
  projectHome: boolean;
  temporary: boolean;
}): ChannelLifecycle {
  if (input.projectHome) return "project";
  return input.temporary ? "temporary" : "ongoing";
}

export function channelLifecycleLabel(
  lifecycle: ChannelLifecycle,
  ttlSeconds: number | null,
): string {
  if (lifecycle === "project") return translateInterfaceText("Project");
  if (lifecycle === "temporary" && ttlSeconds != null) {
    return translateInterfaceText("Temporary · {value1}", {
      value1: String(formatTtlDuration(ttlSeconds)),
    });
  }
  if (lifecycle === "temporary") return translateInterfaceText("Temporary");
  return translateInterfaceText("Ongoing");
}
