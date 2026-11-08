import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { LocalizedMessage } from "@/shared/i18n/LocalizedMessage";
import * as React from "react";
import { AlertCircle, Upload } from "lucide-react";

import type {
  TeamSnapshotImportPreview,
  TeamSnapshotImportResult,
} from "@/shared/api/tauriTeams";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Separator } from "@/shared/ui/separator";
import {
  deriveImportPhase,
  getProfileSyncFailures,
} from "./teamSnapshotImport.lib";

type TeamSnapshotImportDialogProps = {
  open: boolean;
  /** Preview data loaded by the caller before opening. */
  preview: TeamSnapshotImportPreview;
  /** True while the confirm mutation is in-flight. */
  isConfirming: boolean;
  /** Set when the confirm mutation has returned a result. */
  result: TeamSnapshotImportResult | null;
  /** Error from the confirm mutation, if any. */
  confirmError: string | null;
  /** Called with keepAllowlist when user clicks Import. */
  onConfirm: (keepAllowlist: boolean) => void;
  onOpenChange: (open: boolean) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function TeamSnapshotImportDialog({
  open,
  preview,
  isConfirming,
  result,
  confirmError,
  onConfirm,
  onOpenChange,
}: TeamSnapshotImportDialogProps) {
  const { t: localize } = useAppTranslation();

  const [keepAllowlist, setKeepAllowlist] = React.useState(false);

  // Reset choice whenever the dialog opens with new data.
  React.useEffect(() => {
    if (open) {
      setKeepAllowlist(false);
    }
  }, [open]);

  const phase = deriveImportPhase(result, isConfirming);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-md"
        data-testid="team-snapshot-import-dialog"
        showCloseButton={false}
      >
        <DialogHeader className="space-y-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>
              {phase === "result"
                ? localize("Team imported")
                : localize("Import team snapshot")}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {phase === "preview" ? (
                <>
                  <Button
                    data-testid="team-snapshot-import-confirm"
                    disabled={isConfirming}
                    onClick={() => onConfirm(keepAllowlist)}
                    size="sm"
                    type="button"
                    variant="default"
                  >
                    <Upload className="h-4 w-4" />
                    {localize("Import")}
                  </Button>
                  <DialogClose asChild>
                    <Button
                      disabled={isConfirming}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {localize("Cancel")}
                    </Button>
                  </DialogClose>
                </>
              ) : (
                <DialogClose asChild>
                  <Button size="sm" type="button" variant="ghost">
                    {localize("Close")}
                  </Button>
                </DialogClose>
              )}
            </div>
          </div>
        </DialogHeader>

        <Separator />

        {phase === "preview" ? (
          <div className="space-y-3">
            <PreviewBody
              preview={preview}
              keepAllowlist={keepAllowlist}
              onKeepAllowlistChange={setKeepAllowlist}
            />
            {confirmError ? (
              <div
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                data-testid="team-snapshot-import-confirm-error"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{confirmError}</p>
              </div>
            ) : null}
          </div>
        ) : phase === "confirming" ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            {localize("Creating team…")}
          </div>
        ) : result !== null ? (
          <ResultBody result={result} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ── Preview body ──────────────────────────────────────────────────────────────

function PreviewBody({
  preview,
  keepAllowlist,
  onKeepAllowlistChange,
}: {
  preview: TeamSnapshotImportPreview;
  keepAllowlist: boolean;
  onKeepAllowlistChange: (v: boolean) => void;
}) {
  const { t: localize } = useAppTranslation();

  return (
    <div className="space-y-4 py-1">
      {/* Team identity */}
      <div className="space-y-1">
        <p className="text-sm font-medium">{preview.name}</p>
        {preview.description ? (
          <p className="text-xs text-muted-foreground">{preview.description}</p>
        ) : null}
        {preview.instructions ? (
          <p className="line-clamp-3 text-xs text-muted-foreground">
            {preview.instructions}
          </p>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        {localize(
          "A new team will be created with fresh keypairs for all members. The imported team is independent of the source — identity never travels.",
        )}
      </p>

      {/* Member list */}
      {preview.members.length > 0 ? (
        <div className="space-y-1">
          <p className="text-sm font-medium">
            <LocalizedMessage
              message={"Members ({part1})"}
              values={{ part1: preview.members.length }}
            />
          </p>
          <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-border p-2">
            {preview.members.map((member, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: member names may duplicate
              <div key={idx} className="flex flex-col gap-0.5 px-1 py-0.5">
                <p className="text-sm font-medium">{member.displayName}</p>
                {member.systemPrompt ? (
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {member.systemPrompt}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Allowlist section */}
      {preview.hasSourceAllowlist ? (
        <div
          className="space-y-2 rounded-md border border-border p-3"
          data-testid="team-snapshot-import-allowlist-section"
        >
          <p className="text-sm font-medium">
            {localize("Respond-to allowlist")}
          </p>
          <p className="text-xs text-muted-foreground">
            {localize(
              "This snapshot includes source-environment pubkey allowlists for one or more members. Those identities are not meaningful on your relay.",
            )}
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                checked={!keepAllowlist}
                data-testid="team-snapshot-import-allowlist-clear"
                name="allowlist-choice"
                onChange={() => onKeepAllowlistChange(false)}
                type="radio"
              />
              <span className="text-sm">
                <LocalizedMessage
                  message={"{part1} — start with empty allowlists (safer)"}
                  values={{ part1: <strong>{localize("Clear")}</strong> }}
                />
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                checked={keepAllowlist}
                data-testid="team-snapshot-import-allowlist-keep"
                name="allowlist-choice"
                onChange={() => onKeepAllowlistChange(true)}
                type="radio"
              />
              <span className="text-sm">
                <LocalizedMessage
                  message={"{part1} — copy source allowlists to new members"}
                  values={{ part1: <strong>{localize("Keep")}</strong> }}
                />
              </span>
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Result body ───────────────────────────────────────────────────────────────

function ResultBody({ result }: { result: TeamSnapshotImportResult }) {
  const { t: localize } = useAppTranslation();

  const totalMemoryErrors = result.members.reduce(
    (sum, m) => sum + m.memoryErrors.length,
    0,
  );
  const totalMemoryWritten = result.members.reduce(
    (sum, m) => sum + m.memoryWritten,
    0,
  );
  const totalMemoryTotal = result.members.reduce(
    (sum, m) => sum + m.memoryTotal,
    0,
  );
  const hasPartialMemory =
    totalMemoryTotal > 0 && totalMemoryWritten < totalMemoryTotal;
  const profileSyncFailures = getProfileSyncFailures(result.members);

  return (
    <div className="space-y-3 py-1">
      <p className="text-sm">
        <LocalizedMessage
          message={
            profileSyncFailures.length > 0
              ? profileSyncFailures.length === 1
                ? "{team} was created, but {count} member failed to publish a profile."
                : "{team} was created, but {count} members failed to publish profiles."
              : result.members.length === 1
                ? "{team} was created successfully with {count} member."
                : "{team} was created successfully with {count} members."
          }
          values={{
            team: <span className="font-medium">{result.team.name}</span>,
            count:
              profileSyncFailures.length > 0
                ? profileSyncFailures.length
                : result.members.length,
          }}
        />
      </p>

      {profileSyncFailures.length > 0 ? (
        <div
          className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
          data-testid="team-snapshot-import-profile-sync-errors"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex flex-col gap-1">
            <p>{localize("Profile sync failed for:")}</p>
            <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-xs">
              {profileSyncFailures.map((m) => (
                <li key={m.pubkey} className="break-all font-mono">
                  {m.displayName}: {m.profileSyncError}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {totalMemoryTotal > 0 ? (
        hasPartialMemory ? (
          <div
            className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
            data-testid="team-snapshot-import-partial-memory"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex flex-col gap-1">
              <p>
                <LocalizedMessage
                  message={
                    totalMemoryTotal === 1
                      ? "Memory partially restored: {part1} of {part2} entry written across all members."
                      : "Memory partially restored: {part1} of {part2} entries written across all members."
                  }
                  values={{
                    part1: totalMemoryWritten,
                    part2: totalMemoryTotal,
                  }}
                />
              </p>
              {totalMemoryErrors > 0 ? (
                <ul
                  className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-xs"
                  data-testid="team-snapshot-import-memory-errors"
                >
                  {result.members.flatMap((member) =>
                    member.memoryErrors.map((err, index) => (
                      <li
                        // biome-ignore lint/suspicious/noArrayIndexKey: error strings may duplicate; pubkey+index is the stable composite key
                        key={`${member.pubkey}:${index}`}
                        className="break-all font-mono"
                      >
                        {member.displayName}: {err}
                      </li>
                    )),
                  )}
                </ul>
              ) : null}
            </div>
          </div>
        ) : (
          <p
            className="text-xs text-muted-foreground"
            data-testid="team-snapshot-import-memory-success"
          >
            <LocalizedMessage
              message={
                totalMemoryTotal === 1
                  ? "{part1} memory entry restored across all members."
                  : "{part1} memory entries restored across all members."
              }
              values={{ part1: totalMemoryTotal }}
            />
          </p>
        )
      ) : null}
    </div>
  );
}
