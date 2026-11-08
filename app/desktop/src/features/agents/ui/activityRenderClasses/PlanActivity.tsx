import {
  formatActivityVerb,
  formatPlanUpdateText,
} from "../agentSessionPresentation";
import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { Markdown } from "@/shared/ui/markdown";
import {
  ActivityRow,
  ActivityRowContent,
  ActivityRowLabel,
} from "./ActivityRow";
import { ToolActivity } from "./ToolActivity";
import { formatTranscriptTimestampTitle } from "../agentSessionUtils";
import type { ActivityRenderClassItemProps } from "./types";

export function PlanActivity(props: ActivityRenderClassItemProps) {
  const { t: localize } = useAppTranslation();

  if (props.item.type === "tool") {
    return <ToolActivity {...props} />;
  }
  if (props.item.type !== "plan") {
    return null;
  }

  if (props.item.isUpdate) {
    return (
      <ActivityRow
        testId="transcript-plan-update-item"
        title={formatTranscriptTimestampTitle(props.item.timestamp)}
      >
        <ActivityRowLabel
          object={
            <PlanUpdateLabelObject text={formatPlanUpdateText(props.item)} />
          }
          openToneScope="none"
          verb={formatActivityVerb("Updated")}
        />
      </ActivityRow>
    );
  }

  return (
    <ActivityRow
      testId="transcript-plan-item"
      title={formatTranscriptTimestampTitle(props.item.timestamp)}
    >
      <ActivityRowLabel
        object={localize("plan")}
        openToneScope="tool"
        verb={formatActivityVerb("Updated")}
      />
      <ActivityRowContent className="pt-1 pb-1.5 text-sm leading-5 text-muted-foreground">
        <Markdown
          className="leading-5"
          content={props.item.text.trim() || localize("No plan details.")}
        />
      </ActivityRowContent>
    </ActivityRow>
  );
}

function PlanUpdateLabelObject({ text }: { text: string }) {
  const { t: localize } = useAppTranslation();

  return (
    <>
      {localize("plan")}
      {text ? (
        <>
          {" · "}
          <span className="text-foreground">{text}</span>
        </>
      ) : null}
    </>
  );
}
