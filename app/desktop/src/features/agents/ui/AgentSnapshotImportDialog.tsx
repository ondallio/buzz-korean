import {
  useLocale as useAppLocale,
  useTranslation as useAppTranslation,
} from "@/shared/i18n";
import { LocalizedMessage } from "@/shared/i18n/LocalizedMessage";
import * as React from "react";
import { AlertCircle, Lock, Upload } from "lucide-react";

import type {
  AgentSnapshotImportPreview,
  AgentSnapshotImportResult,
} from "@/features/agents/hooks";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Separator } from "@/shared/ui/separator";

import { AgentDefinitionMetadata } from "./AgentDefinitionMetadata";

// ── Types ─────────────────────────────────────────────────────────────────────

type ImportPhase = "preview" | "confirming" | "result";

type AgentSnapshotImportDialogProps = {
  open: boolean;
  /** Preview data loaded by the caller before opening. */
  preview: AgentSnapshotImportPreview;
  /** True while the confirm mutation is in-flight. */
  isConfirming: boolean;
  /** Set when the confirm mutation has returned a result. */
  result: AgentSnapshotImportResult | null;
  /** Error from the confirm mutation, if any. */
  confirmError: string | null;
  /** Called with keepAllowlist when user clicks Import. */
  onConfirm: (keepAllowlist: boolean) => void;
  onOpenChange: (open: boolean) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AgentSnapshotImportDialog({
  open,
  preview,
  isConfirming,
  result,
  confirmError,
  onConfirm,
  onOpenChange,
}: AgentSnapshotImportDialogProps) {
  const { t: localize } = useAppTranslation();

  // Default: clear the source allowlist (safe default per spec).
  const [keepAllowlist, setKeepAllowlist] = React.useState(false);

  // Reset choice whenever the dialog opens with new data.
  React.useEffect(() => {
    if (open) {
      setKeepAllowlist(false);
    }
  }, [open]);

  const phase: ImportPhase =
    result !== null ? "result" : isConfirming ? "confirming" : "preview";

  const hasMemory = preview.memoryEntryCount > 0;
  const memoryLevelLabel =
    preview.memoryLevel === "core"
      ? localize("core")
      : preview.memoryLevel === "everything"
        ? localize("all")
        : localize("none");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[85vh] max-w-2xl overflow-y-auto"
        data-testid="agent-snapshot-import-dialog"
        showCloseButton={false}
      >
        <DialogHeader className="space-y-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>
              {phase === "result"
                ? localize("Agent imported")
                : localize("Import agent snapshot")}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {phase === "preview" ? (
                <>
                  <Button
                    data-testid="agent-snapshot-import-confirm"
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
          <PreviewBody
            preview={preview}
            hasMemory={hasMemory}
            memoryLevelLabel={memoryLevelLabel}
            keepAllowlist={keepAllowlist}
            onKeepAllowlistChange={setKeepAllowlist}
          />
        ) : phase === "confirming" ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            {localize("Creating agent…")}
          </div>
        ) : result !== null ? (
          <ResultBody result={result} confirmError={confirmError} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ── Preview body ──────────────────────────────────────────────────────────────

export function PreviewBody({
  preview,
  hasMemory,
  memoryLevelLabel,
  keepAllowlist,
  onKeepAllowlistChange,
}: {
  preview: AgentSnapshotImportPreview;
  hasMemory: boolean;
  memoryLevelLabel: string;
  keepAllowlist: boolean;
  onKeepAllowlistChange: (v: boolean) => void;
}) {
  const { t: localize } = useAppTranslation();

  return (
    <div className="space-y-4 py-1">
      {/* Agent identity */}
      <div className="space-y-1">
        <p className="text-sm font-medium">{preview.displayName}</p>
      </div>

      {/* Locked-card provenance: this file was encrypted to this machine's
          keys and has been unlocked for review. */}
      {preview.locked ? (
        <div
          className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
          data-testid="agent-snapshot-import-locked-notice"
        >
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <LocalizedMessage
              message={
                "This card is {part1} — its agent is encrypted to the original owner and agent keys. Your keys unlocked it; the full decrypted payload is shown below."
              }
              values={{ part1: <strong>{localize("locked")}</strong> }}
            />
          </p>
        </div>
      ) : null}

      <AgentDefinitionMetadata
        isBuiltIn={preview.isBuiltIn}
        model={preview.model}
        runtime={preview.runtime}
      />

      {/* Portable behavior — never hide executable configuration behind a summary. */}
      <section
        className="space-y-2 rounded-md border border-border p-3"
        data-testid="agent-snapshot-import-behavior"
      >
        <div>
          <p className="text-sm font-medium">
            {localize("Agent instructions")}
          </p>
          <p className="text-xs text-muted-foreground">
            {localize(
              "Review the instructions this agent will follow after import.",
            )}
          </p>
        </div>
        <pre
          className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/60 p-3 text-xs"
          data-testid="agent-snapshot-import-system-prompt"
        >
          {preview.systemPrompt || localize("No system prompt included.")}
        </pre>
      </section>

      <p className="text-sm text-muted-foreground">
        {localize(
          "A new agent will be created with a fresh keypair. The imported agent is independent of the source — identity never travels.",
        )}
      </p>

      {/* Memory section */}
      {hasMemory ? (
        <div
          className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
          data-testid="agent-snapshot-import-memory-warning"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <LocalizedMessage
              message={
                "This snapshot includes {part1}. Memory is stored as plaintext in the file and will be restored under the new agent's identity."
              }
              values={{
                part1: (
                  <strong>
                    <LocalizedMessage
                      message={
                        preview.memoryEntryCount === 1
                          ? "{part1} {part2} memory entry"
                          : "{part1} {part2} memory entries"
                      }
                      values={{
                        part1: preview.memoryEntryCount,
                        part2: memoryLevelLabel,
                      }}
                    />
                  </strong>
                ),
              }}
            />
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {localize("No memory included — config only.")}
        </p>
      )}

      {/* Allowlist section */}
      {preview.hasSourceAllowlist ? (
        <div
          className="space-y-2 rounded-md border border-border p-3"
          data-testid="agent-snapshot-import-allowlist-section"
        >
          <p className="text-sm font-medium">
            <LocalizedMessage
              message={
                preview.sourceAllowlistCount === 1
                  ? "Respond-to allowlist ({part1} entry)"
                  : "Respond-to allowlist ({part1} entries)"
              }
              values={{ part1: preview.sourceAllowlistCount }}
            />
          </p>
          <p className="text-xs text-muted-foreground">
            {localize(
              "This snapshot includes source-environment pubkeys. Review every key before choosing Keep; Clear is safer when you do not recognize them.",
            )}
          </p>
          <ul
            className="max-h-28 space-y-1 overflow-y-auto rounded bg-muted/60 p-2 font-mono text-xs"
            data-testid="agent-snapshot-import-allowlist-values"
          >
            {preview.sourceAllowlist.map((pubkey) => (
              <li className="break-all" key={pubkey}>
                {pubkey}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1.5">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                checked={!keepAllowlist}
                data-testid="agent-snapshot-import-allowlist-clear"
                name="allowlist-choice"
                onChange={() => onKeepAllowlistChange(false)}
                type="radio"
              />
              <span className="text-sm">
                <LocalizedMessage
                  message={"{part1} — start with an empty allowlist (safer)"}
                  values={{ part1: <strong>{localize("Clear")}</strong> }}
                />
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                checked={keepAllowlist}
                data-testid="agent-snapshot-import-allowlist-keep"
                name="allowlist-choice"
                onChange={() => onKeepAllowlistChange(true)}
                type="radio"
              />
              <span className="text-sm">
                <LocalizedMessage
                  message={"{part1} — copy source allowlist to the new agent"}
                  values={{ part1: <strong>{localize("Keep")}</strong> }}
                />
              </span>
            </label>
          </div>
        </div>
      ) : null}

      <details
        className="rounded-md border border-border p-3"
        data-testid="agent-snapshot-import-manifest"
      >
        <summary className="cursor-pointer text-sm font-medium">
          {localize("Full embedded manifest")}
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          {localize(
            "This is the complete portable payload decoded from the file. Secrets, credentials, and source identity are not part of the snapshot format.",
          )}
        </p>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/60 p-3 text-xs">
          {preview.manifestJson}
        </pre>
      </details>
    </div>
  );
}

// ── Result body ───────────────────────────────────────────────────────────────

export function ResultBody({
  result,
  confirmError,
}: {
  result: AgentSnapshotImportResult;
  confirmError: string | null;
}) {
  useAppLocale();

  const hasPartialMemory =
    result.memoryTotal > 0 && result.memoryWritten < result.memoryTotal;

  return (
    <div className="space-y-3 py-1">
      <p className="text-sm">
        <LocalizedMessage
          message={"{part1} was created successfully."}
          values={{
            part1: <span className="font-medium">{result.displayName}</span>,
          }}
        />
      </p>

      {result.memoryTotal > 0 ? (
        hasPartialMemory ? (
          <div
            className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
            data-testid="agent-snapshot-import-partial-memory"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex flex-col gap-1">
              <p>
                <LocalizedMessage
                  message={
                    result.memoryTotal === 1
                      ? "Memory partially restored: {part1} of {part2} entry written. The agent exists but some memory entries failed to publish."
                      : "Memory partially restored: {part1} of {part2} entries written. The agent exists but some memory entries failed to publish."
                  }
                  values={{
                    part1: result.memoryWritten,
                    part2: result.memoryTotal,
                  }}
                />
              </p>
              {result.memoryErrors.length > 0 ? (
                <ul
                  className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-xs"
                  data-testid="agent-snapshot-import-memory-errors"
                >
                  {result.memoryErrors.map((err) => (
                    <li key={err} className="break-all font-mono">
                      {err}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : (
          <p
            className="text-xs text-muted-foreground"
            data-testid="agent-snapshot-import-memory-success"
          >
            <LocalizedMessage
              message={
                result.memoryTotal === 1
                  ? "{part1} memory entry restored."
                  : "{part1} memory entries restored."
              }
              values={{ part1: result.memoryTotal }}
            />
          </p>
        )
      ) : null}

      {result.profileSyncError ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          <LocalizedMessage
            message={"Profile sync: {part1}"}
            values={{ part1: result.profileSyncError }}
          />
        </p>
      ) : null}

      {confirmError ? (
        <p className="text-xs text-destructive">{confirmError}</p>
      ) : null}
    </div>
  );
}
