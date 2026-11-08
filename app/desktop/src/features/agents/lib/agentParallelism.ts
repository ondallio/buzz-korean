import { t as translateInterfaceText } from "@/shared/i18n";
/**
 * Desktop-managed agents materialize this value when neither the create input
 * nor the linked definition sets parallelism. Keep in sync with
 * `managed_agents::DEFAULT_AGENT_PARALLELISM` in the Tauri backend.
 */
export const DEFAULT_AGENT_PARALLELISM = 10;

export const AGENT_PARALLELISM_PLACEHOLDER = `App default (${DEFAULT_AGENT_PARALLELISM})`;
export const AGENT_PARALLELISM_HELP = `Leave blank to use the app default (currently ${DEFAULT_AGENT_PARALLELISM}). Custom values may be 1–32.`;
export const EDIT_AGENT_PARALLELISM_HELP =
  "Current value for this agent. Custom values may be 1–32.";

export function resolveAgentParallelism(
  input: number | undefined,
  definition: number | null | undefined,
): number {
  return input ?? definition ?? DEFAULT_AGENT_PARALLELISM;
}

/**
 * Return an explanatory hint string when a harness cap would reduce the
 * requested parallelism, or `null` when the value is within the cap.
 *
 * The hint carries both facts: what was requested and what will run, so users
 * understand the effective value without needing to look elsewhere.
 *
 * @param harnessLabel - Human-readable harness name (e.g. "OpenClaw").
 * @param cap - The harness's maximum parallelism (from catalog maxParallelism).
 * @param requested - The user's requested parallelism value (1–32).
 * @returns A hint string, or null when requested <= cap.
 */
export function parallelismCapHint(
  harnessLabel: string,
  cap: number,
  requested: number,
): string | null {
  if (requested <= cap) return null;
  return translateInterfaceText(
    cap === 1
      ? "{value1} runs at most {value2} parallel conversation — this agent will run {value4}."
      : "{value1} runs at most {value2} parallel conversations — this agent will run {value4}.",
    { value1: String(harnessLabel), value2: String(cap), value4: String(cap) },
  );
}

/** Locale-aware placeholder, evaluated when displayed rather than at import. */
export function agentParallelismPlaceholder(): string {
  return translateInterfaceText("App default ({value1})", {
    value1: DEFAULT_AGENT_PARALLELISM,
  });
}
/** Locale-aware explanation of the current default and supported bounds. */
export function agentParallelismHelp(): string {
  return translateInterfaceText(
    "Leave blank to use the app default (currently {count}). Custom values may be 1–32.",
    { count: DEFAULT_AGENT_PARALLELISM },
  );
}
/** Locale-aware explanation of an existing agent's parallelism. */
export function editAgentParallelismHelp(): string {
  return translateInterfaceText(
    "Current value for this agent. Custom values may be 1–32.",
  );
}
