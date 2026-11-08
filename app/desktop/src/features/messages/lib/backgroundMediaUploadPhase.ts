import { t as translateInterfaceText } from "@/shared/i18n";
export type BackgroundMediaUploadPhase =
  | "preparing"
  | "processing-video"
  | "converting-image"
  | "processing-files"
  | "uploading"
  | "finishing";

export type NativeMediaUploadPhase = Exclude<
  BackgroundMediaUploadPhase,
  "processing-files"
>;

const NATIVE_PHASES = new Set<NativeMediaUploadPhase>([
  "preparing",
  "processing-video",
  "converting-image",
  "uploading",
  "finishing",
]);

export function isNativeMediaUploadPhase(
  value: unknown,
): value is NativeMediaUploadPhase {
  return (
    typeof value === "string" &&
    NATIVE_PHASES.has(value as NativeMediaUploadPhase)
  );
}

export function resolveBackgroundMediaUploadPhase(
  phases: BackgroundMediaUploadPhase[],
): BackgroundMediaUploadPhase {
  if (phases.length === 0) return "preparing";
  if (phases.includes("uploading")) return "uploading";

  const activePhases = new Set(phases.filter((phase) => phase !== "finishing"));
  if (activePhases.size === 0) return "finishing";
  if (activePhases.size > 1) return "processing-files";
  return activePhases.values().next().value ?? "preparing";
}

export function backgroundMediaUploadPhaseLabel(
  phase: BackgroundMediaUploadPhase,
): string {
  switch (phase) {
    case "processing-video":
      return translateInterfaceText("Processing");
    case "converting-image":
      return translateInterfaceText("Converting");
    case "processing-files":
      return translateInterfaceText("Processing");
    case "uploading":
      return translateInterfaceText("Uploading");
    case "finishing":
      return translateInterfaceText("Finishing");
    default:
      return translateInterfaceText("Preparing");
  }
}
