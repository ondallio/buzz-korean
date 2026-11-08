import { localeTag } from "@/shared/i18n";
import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { LocalizedMessage } from "@/shared/i18n/LocalizedMessage";
import type { WorkflowApproval } from "@/shared/api/types";

type WorkflowApprovalCardProps = {
  approval: WorkflowApproval;
};

export function WorkflowApprovalCard({ approval }: WorkflowApprovalCardProps) {
  const { t: localize } = useAppTranslation();

  const isExpired = new Date(approval.expiresAt) < new Date();

  if (approval.status !== "pending" || isExpired) {
    return null;
  }

  return (
    <div
      className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"
      data-testid="workflow-approval-card"
    >
      <p className="mb-2 text-sm font-medium">
        {localize("Approval Required")}
      </p>
      <p className="mb-2 text-xs text-muted-foreground">
        <LocalizedMessage
          message={"Approver: {part1}"}
          values={{ part1: approval.approverSpec }}
        />
      </p>
      <p className="mb-2 text-xs text-muted-foreground">
        <LocalizedMessage
          message={"Expires: {part1}"}
          values={{
            part1: new Date(approval.expiresAt).toLocaleString(localeTag()),
          }}
        />
      </p>
      <p className="text-xs text-muted-foreground" role="status">
        {localize("Approval actions are not yet available in Desktop.")}
      </p>
    </div>
  );
}
