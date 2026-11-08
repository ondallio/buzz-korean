import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { LocalizedMessage } from "@/shared/i18n/LocalizedMessage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { formatTtlDuration } from "@/features/channels/lib/ephemeralChannel";
import type { ProjectChannelRequest } from "@/features/projects/projectChannelRequest";
import { useProjectChannelRequests } from "@/features/projects/useProjectChannelRequests";

type RequestedChannel = ProjectChannelRequest["request"];

/** Details an owner reviews before approving an agent-requested project channel. */
export function ProjectChannelRequestDetails({
  request,
}: {
  request: RequestedChannel;
}) {
  const { t: localize } = useAppTranslation();

  return (
    <dl className="space-y-2 rounded-xl border border-border/60 bg-muted/25 p-3 text-sm">
      <div className="flex gap-3">
        <dt className="w-24 shrink-0 text-muted-foreground">
          {localize("Name")}
        </dt>
        <dd className="min-w-0 break-words text-foreground">#{request.name}</dd>
      </div>
      {request.description ? (
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-muted-foreground">
            {localize("Description")}
          </dt>
          <dd className="min-w-0 break-words text-foreground">
            {request.description}
          </dd>
        </div>
      ) : null}
      <div className="flex gap-3">
        <dt className="w-24 shrink-0 text-muted-foreground">
          {localize("Visibility")}
        </dt>
        <dd className="text-foreground">{request.visibility}</dd>
      </div>
      {request.ttlSeconds ? (
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-muted-foreground">
            {localize("Lifetime")}
          </dt>
          <dd className="min-w-0 break-words text-foreground">
            <LocalizedMessage
              message={
                "Temporary · {part1}. Cleans up automatically after that period of inactivity."
              }
              values={{ part1: formatTtlDuration(request.ttlSeconds) }}
            />
          </dd>
        </div>
      ) : null}
      {request.templateName ? (
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-muted-foreground">
            {localize("Template")}
          </dt>
          <dd className="min-w-0 break-words text-foreground">
            {request.templateName}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

/** Global owner-review surface for project-channel requests from managed agents. */
export function ProjectChannelRequestDialog() {
  const { t: localize } = useAppTranslation();

  const management = useProjectChannelRequests();
  const request = management.request?.request;

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) management.dismiss();
      }}
      open={request != null}
    >
      <AlertDialogContent data-testid="project-channel-request-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {localize("Create project channel?")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            <LocalizedMessage
              message={
                "Your agent requested a new channel in {part1}. Review the details before creating it."
              }
              values={{
                part1: management.project?.name ?? localize("this project"),
              }}
            />
          </AlertDialogDescription>
        </AlertDialogHeader>
        {request ? <ProjectChannelRequestDetails request={request} /> : null}
        {management.error ? (
          <p className="text-sm text-destructive">{management.error}</p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={management.isPending}>
            {localize("Cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid="project-channel-request-approve"
            disabled={management.isPending}
            onClick={(event) => {
              event.preventDefault();
              void management.approve();
            }}
          >
            {management.isPending
              ? localize("Creating…")
              : localize("Create channel")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
