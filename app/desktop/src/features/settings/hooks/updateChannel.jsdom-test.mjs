import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

function loadProduction(relativePath, channel, dependencies) {
  const source = fs.readFileSync(
    new URL(relativePath, import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(
    source.replaceAll("import.meta.env", "__buildEnv"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      assert.ok(name in dependencies, `unbound production dependency ${name}`);
      return dependencies[name];
    },
    window,
    console,
    __buildEnv: { VITE_BUZZ_BUILD_CHANNEL: channel },
  });
  return exports;
}

for (const [channel, releaseUrl] of [
  ["korean", "https://github.com/ondallio/buzz-korean/releases/latest"],
  [undefined, "https://github.com/block/buzz/releases/latest"],
]) {
  test(`manual updater routes ${channel ?? "official"} users to their own release channel`, async () => {
    const channelPath = new URL("./updateChannel.ts", import.meta.url);
    const channelModule = fs.existsSync(channelPath)
      ? loadProduction("./updateChannel.ts", channel, {})
      : {};
    const { useUpdater } = loadProduction("./use-updater.ts", channel, {
      react: React,
      "@tauri-apps/plugin-updater": {
        check: async () => ({ version: "1.0.2", close: async () => {} }),
      },
      "@tauri-apps/plugin-process": { relaunch: async () => {} },
      "@/shared/api/tauri": { isAutoUpdateSupported: async () => false },
      "./updateChannel": channelModule,
    });
    let result;
    function Harness() {
      result = useUpdater();
      return null;
    }
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
      await act(async () => root.render(React.createElement(Harness)));
      assert.equal(result.status.state, "manual-required");
      assert.equal(result.status.releaseUrl, releaseUrl);
      assert.equal(result.status.version, "1.0.2");
    } finally {
      await act(async () => root.unmount());
    }
  });
}
