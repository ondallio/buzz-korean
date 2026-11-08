import { useLocale } from "@/shared/i18n";
import { buildCompactToolSummary } from "../agentSessionToolSummary";
import {
  formatTranscriptTimestampTitle,
  getToolDurationDisplay,
} from "../agentSessionUtils";
import {
  ActivityRow,
  ActivityRowLabel,
  splitActivityRowLabel,
} from "./ActivityRow";
import type { ActivityRenderClassItemProps } from "./types";

export function SuppressedActivity(props: ActivityRenderClassItemProps) {
  useLocale();
  if (props.item.type !== "tool") {
    return null;
  }

  const summary = buildCompactToolSummary(props.item);
  const action = summary.action;
  const labelParts = action ?? splitActivityRowLabel(summary.label);
  const duration = getToolDurationDisplay(props.item);

  return (
    <ActivityRow
      testId="transcript-suppressed-item"
      title={formatTranscriptTimestampTitle(props.item.timestamp)}
    >
      <ActivityRowLabel
        object={labelParts?.object ?? summary.preview}
        openToneScope="none"
        verb={labelParts?.verb ?? summary.label}
      />
      {duration ? (
        <span className="shrink-0 text-xs text-muted-foreground/60">
          {duration}
        </span>
      ) : null}
    </ActivityRow>
  );
}
