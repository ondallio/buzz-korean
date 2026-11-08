import { t as localize } from "@/shared/i18n";
import type {
  TeamSnapshotImportMemberResult,
  TeamSnapshotImportResult,
} from "@/shared/api/tauriTeams";

// ── Import phase derivation ──────────────────────────────────────────────────

export type ImportPhase = "preview" | "confirming" | "result";

export function deriveImportPhase(
  result: TeamSnapshotImportResult | null,
  isConfirming: boolean,
): ImportPhase {
  return result !== null ? "result" : isConfirming ? "confirming" : "preview";
}

// ── Profile-sync failure aggregation ─────────────────────────────────────────

export function getProfileSyncFailures(
  members: TeamSnapshotImportMemberResult[],
): TeamSnapshotImportMemberResult[] {
  return members.filter((m) => m.profileSyncError !== null);
}

// ── Toast message derivation ─────────────────────────────────────────────────

export type ToastOutcome = {
  type: "notice" | "error";
  message: string;
};

export function deriveImportToast(
  result: TeamSnapshotImportResult,
): ToastOutcome {
  const memberCount = result.members.length;
  const totalMemoryErrors = result.members.reduce(
    (sum, m) => sum + m.memoryErrors.length,
    0,
  );
  const profileSyncFailureCount = getProfileSyncFailures(result.members).length;

  const values = {
    name: result.team.name,
    memories: totalMemoryErrors,
    profiles: profileSyncFailureCount,
    members: memberCount,
  };
  if (totalMemoryErrors > 0 && profileSyncFailureCount > 0) {
    return {
      type: "error",
      message: localize(
        totalMemoryErrors === 1
          ? profileSyncFailureCount === 1
            ? "{name} imported, but {memories} memory entry failed to restore and {profiles} member failed to sync profile."
            : "{name} imported, but {memories} memory entry failed to restore and {profiles} members failed to sync profiles."
          : profileSyncFailureCount === 1
            ? "{name} imported, but {memories} memory entries failed to restore and {profiles} member failed to sync profile."
            : "{name} imported, but {memories} memory entries failed to restore and {profiles} members failed to sync profiles.",
        values,
      ),
    };
  }
  if (totalMemoryErrors > 0) {
    return {
      type: "error",
      message: localize(
        totalMemoryErrors === 1
          ? "{name} imported, but {memories} memory entry failed to restore."
          : "{name} imported, but {memories} memory entries failed to restore.",
        values,
      ),
    };
  }
  if (profileSyncFailureCount > 0) {
    return {
      type: "error",
      message: localize(
        profileSyncFailureCount === 1
          ? "{name} imported, but {profiles} member failed to sync profile."
          : "{name} imported, but {profiles} members failed to sync profiles.",
        values,
      ),
    };
  }
  return {
    type: "notice",
    message: localize(
      memberCount === 1
        ? "Imported {name} with {members} member."
        : "Imported {name} with {members} members.",
      values,
    ),
  };
}
