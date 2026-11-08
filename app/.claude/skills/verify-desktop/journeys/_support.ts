// Shared evidence helpers for verify-desktop journeys.
//
// Every proof step writes a numbered screenshot + ARIA snapshot pair and an
// entry in steps.jsonl, so a reader can see the action and the state it
// produced, not only the final frame.
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Locator, Page, TestInfo } from "@playwright/test";

import { waitForAnimations } from "../../../../desktop/tests/helpers/animations";

export {
  installMockBridge,
  openChannelBrowser,
} from "../../../../desktop/tests/helpers/bridge";
export { openSettings } from "../../../../desktop/tests/helpers/settings";

/** Mock identity the bridge signs as (see desktop/tests/helpers/bridge.ts). */
export const MOCK_PUBKEY = "deadbeef".repeat(8);

/** Stable mock channel ids from desktop/src/testing/e2eBridge.ts. */
export const CHANNEL_IDS = {
  engineering: "1c7e1c02-87bb-5e88-b2da-5a7a9432d0c9",
} as const;

export class Evidence {
  private step = 0;
  readonly dir: string;

  constructor(
    private readonly page: Page,
    testInfo: TestInfo,
    feature: string,
  ) {
    const root = process.env.VERIFY_EVIDENCE_DIR;
    if (!root) throw new Error("VERIFY_EVIDENCE_DIR is unset");
    this.dir = join(root, feature);
    mkdirSync(this.dir, { recursive: true });
    this.note({ event: "start", test: testInfo.title });
  }

  note(entry: Record<string, unknown>) {
    appendFileSync(
      join(this.dir, "steps.jsonl"),
      `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`,
    );
  }

  /**
   * Capture a screenshot + ARIA snapshot of `scope` (default: whole page)
   * after animations settle. `action` names the user action that produced
   * this state.
   */
  async capture(label: string, action: string, scope?: Locator) {
    this.step += 1;
    const base = `${String(this.step).padStart(2, "0")}-${label}`;
    await waitForAnimations(this.page);
    const target = scope ?? this.page.locator("body");
    const png = join(this.dir, `${base}.png`);
    if (scope) await scope.screenshot({ path: png });
    else await this.page.screenshot({ path: png });
    const aria = await target.ariaSnapshot();
    writeFileSync(join(this.dir, `${base}.aria.txt`), `${aria}\n`);
    const missing = await this.page.evaluate(() => {
      const getter = (window as Window & { __BUZZ_E2E_MISSING_TRANSLATIONS__?: () => string[] }).__BUZZ_E2E_MISSING_TRANSLATIONS__;
      return getter ? getter() : null;
    });
    writeFileSync(join(this.dir, `${base}.missing-translations.json`), JSON.stringify(missing, null, 2));
    this.note({ step: this.step, label, action, png: `${base}.png`, missingTranslations: missing });
  }

  /** Persist a JSON side-effect observation (localStorage, signed events). */
  writeJson(name: string, value: unknown) {
    writeFileSync(join(this.dir, `${name}.json`), JSON.stringify(value, null, 2));
    this.note({ event: "side-effect", file: `${name}.json` });
  }
}

/** Boot the app at `/` and wait until the sidebar and #general are usable. */
export async function bootApp(page: Page) {
  await page.goto("/");
  await page.getByTestId("app-sidebar").waitFor({ state: "visible" });
  await page.getByTestId("channel-general").waitFor({ state: "visible" });
}
