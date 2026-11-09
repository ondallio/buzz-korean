import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../src-tauri/src/", import.meta.url));

test("compiled Korean identity stays isolated in both debug and release executables", () => {
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), "buzz-korean-identity-"),
  );
  try {
    const source = path.join(temporary, "identity.rs");
    fs.writeFileSync(
      source,
      `
extern crate self as dirs;
static CONFIG_AVAILABLE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(true);
pub fn config_dir() -> Option<std::path::PathBuf> {
    CONFIG_AVAILABLE.load(std::sync::atomic::Ordering::SeqCst).then(|| "/isolated/config".into())
}
#[path = ${JSON.stringify(path.join(root, "build_identity.rs"))}]
mod build_identity;
#[path = ${JSON.stringify(path.join(root, "app_state_keyring.rs"))}]
mod app_state_keyring;
#[test]
fn korean_identity_does_not_use_official_or_disposable_demo_state() {
    assert_eq!(build_identity::keyring_service(), "buzz-korean-desktop");
    assert_eq!(app_state_keyring::keyring_service(), "buzz-korean-desktop");
    assert_eq!(build_identity::deep_link_scheme(), "buzz-korean");
    assert!(build_identity::is_deep_link_for_build("buzz-korean://message?id=1"));
    assert!(build_identity::is_deep_link_for_build("buzz://message?id=1"));
    assert_eq!(build_identity::nest_name(false), ".buzz-korean");
    assert_eq!(build_identity::nest_name(true), ".buzz-korean");
    assert_eq!(build_identity::cli_name(false), "buzz-korean");
    assert_eq!(build_identity::cli_name(true), "buzz-korean");
    assert!(!build_identity::is_demo_build());
    assert!(build_identity::is_isolated_build());
    let mut child = std::process::Command::new("buzz-agent");
    build_identity::apply_scoped_config_home(&mut child).unwrap();
    let root = child.get_envs().find(|(key, _)| *key == "BUZZ_AGENT_CONFIG_DIR").unwrap().1.unwrap();
    assert_eq!(root, "/isolated/config/buzz-korean");
    assert_eq!(build_identity::scoped_agent_oauth_cache_dir().unwrap().unwrap(), std::path::PathBuf::from("/isolated/config/buzz-korean/buzz-agent/oauth"));
    CONFIG_AVAILABLE.store(false, std::sync::atomic::Ordering::SeqCst);
    assert!(build_identity::scoped_config_home().is_err());
    assert!(build_identity::scoped_agent_oauth_cache_dir().is_err());
    let mut blocked = std::process::Command::new("buzz-agent");
    assert!(build_identity::apply_scoped_config_home(&mut blocked).is_err());
    assert!(blocked.get_envs().next().is_none());
}
`,
    );
    for (const debug of [true, false]) {
      const binary = path.join(
        temporary,
        `identity-${debug}${process.platform === "win32" ? ".exe" : ""}`,
      );
      const compilation = spawnSync(
        "rustc",
        [
          "--edition=2021",
          "--test",
          source,
          "-C",
          `debug-assertions=${debug ? "yes" : "no"}`,
          "-o",
          binary,
        ],
        {
          encoding: "utf8",
          timeout: 30000,
          maxBuffer: 1024 * 1024,
          env: { ...process.env, BUZZ_DESKTOP_BUILD_CHANNEL: "korean" },
        },
      );
      assert.equal(compilation.status, 0, compilation.stderr);
      const execution = spawnSync(
        binary,
        ["korean_identity_does_not_use_official_or_disposable_demo_state"],
        { encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024 },
      );
      assert.equal(execution.status, 0, execution.stdout + execution.stderr);
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("build channel validation rejects unknown and disposable demo combinations", () => {
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), "buzz-korean-channel-"),
  );
  try {
    const binary = path.join(
      temporary,
      process.platform === "win32" ? "channel.exe" : "channel",
    );
    const compilation = spawnSync(
      "rustc",
      [
        "--edition=2021",
        "--test",
        path.join(root, "build_channel.rs"),
        "-o",
        binary,
      ],
      {
        encoding: "utf8",
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      },
    );
    assert.equal(compilation.status, 0, compilation.stderr);
    const execution = spawnSync(binary, [], {
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });
    assert.equal(execution.status, 0, execution.stdout + execution.stderr);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
