import { invoke, isTauri } from "@tauri-apps/api/core";
import { getLocale, subscribeLocale, type Locale } from "./store";

/** Native menu synchronization is observable and never changes the saved locale. */
export type NativeLocaleSyncStatus =
  | { state: "unsupported" }
  | { state: "pending"; locale: Locale }
  | { state: "synced"; locale: Locale }
  | { state: "error"; locale: Locale; error: string };

const listeners = new Set<() => void>();
let status: NativeLocaleSyncStatus = { state: "unsupported" };
let owners = 0;
let unsubscribeLocale: (() => void) | undefined;
let revision = 0;
let inFlight = false;

function publish(next: NativeLocaleSyncStatus): void {
  status = next;
  for (const listener of listeners) listener();
}

async function flush(): Promise<void> {
  if (inFlight || owners === 0 || status.state !== "pending") return;
  const requestRevision = revision;
  const locale = status.locale;
  inFlight = true;
  try {
    await invoke("set_desktop_locale", { locale });
    if (requestRevision === revision && owners > 0) {
      publish({ state: "synced", locale });
    }
  } catch (error) {
    if (requestRevision === revision && owners > 0) {
      publish({ state: "error", locale, error: String(error) });
    }
  } finally {
    inFlight = false;
    if (
      requestRevision !== revision &&
      owners > 0 &&
      status.state === "pending"
    ) {
      void flush();
    }
  }
}

function requestCurrentLocale(): void {
  revision += 1;
  if (!isTauri()) {
    publish({ state: "unsupported" });
    return;
  }
  // The locale preference in localStorage is the durable retry record. A new
  // app session replays it; this session exposes failures for an explicit retry.
  publish({ state: "pending", locale: getLocale() });
  void flush();
}

/** Start one shared native projection for this webview, including initial state. */
export function startNativeLocaleSync(): () => void {
  owners += 1;
  if (owners === 1) {
    unsubscribeLocale = subscribeLocale(requestCurrentLocale);
    requestCurrentLocale();
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    owners -= 1;
    if (owners === 0) {
      unsubscribeLocale?.();
      unsubscribeLocale = undefined;
      revision += 1;
    }
  };
}

/** Read a stable snapshot for a useSyncExternalStore subscriber. */
export function getNativeLocaleSyncStatus(): NativeLocaleSyncStatus {
  return status;
}

/** Subscribe a visible error/status affordance to native projection changes. */
export function subscribeNativeLocaleSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Retry a failed projection once; pending IPC is never duplicated by retries. */
export function retryNativeLocaleSync(): void {
  if (status.state === "error" && owners > 0) requestCurrentLocale();
}
